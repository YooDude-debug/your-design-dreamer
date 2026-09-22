# ORB CHAT → DEVELOPER REPAIR BRIDGE

**Datum:** 2026-09-22
**Status:** READY FOR MANUAL REVIEW
**Deployment:** keines. Keine Codeänderung, keine Freigabe, keine Sandbox-Ausführung,
keine Production-Änderung, keine Migration.

Die einzige neue Fähigkeit dieser Phase:
`EXPLIZITE CHAT-ANWEISUNG → KONTROLLIERTE READ-ONLY ANALYSE → PERSISTENTER FIX PROPOSAL → ADMIN APPROVAL QUEUE`.

---

## 1. Architektur

| Datei | Rolle |
| --- | --- |
| `src/orb-dev/chat-bridge.ts` | Reines Modell: Sicherheitsriegel, Intent-Erkennung, Diagnostic-Request-Statusmodell, Vertrauensgrade, Chat-Antworttexte. Kein Dateizugriff, keine DB, kein LLM, kein Schreiben. |
| `src/orb-dev/chat-bridge.server.ts` | `runChatDiagnostic` (lesende Analyse + Fix-Vorschlag über Phase-2-Repo), `listChatBridgeEvents`. |
| `src/lib/orb-chat-bridge.functions.ts` | Server-Funktionen `orbChatRequestDiagnostic`, `orbChatBridgeEvents`, `orbChatBridgeRequestOperation` (lehnt jede Operation ab). |
| `src/orb-dev/fix-model.ts` | `createdBy` um `"orb_chat"` erweitert — kein neues paralleles Fix-System. |
| `src/orb-dev/repo.server.ts` | Mapping der neuen Quelle. |
| `src/routes/_authenticated/channels.orb.tsx` | Chat-Anbindung + informative Hinweiskarte. |
| `src/routes/admin.orb-dev.tsx` | Abschnitt „8 · Chat → Diagnostic Bridge“, Quelle „ORB Chat“ an den Vorschlägen. |

Phase 1–4 bleiben unverändert; die Brücke nutzt deren bestehende Funktionen.

## 2. Chat → Diagnostic Flow

```
Nutzer-Nachricht
  → detectDeveloperDiagnosticIntent (Client: nur Vorfilter)
  → orbChatRequestDiagnostic (Server: Authentifizierung, Admin-Rolle, Action-Typ, Scope, Intent erneut geprüft)
  → DiagnosticRequest (ORB-DIAG-REQ-XXXXXXXX): REQUESTED → ANALYZING
  → READ-ONLY Forensik über die Phase-1-Diagnose (Reproduktion, Code-Trace, Root Cause)
  → DIAGNOSIS_READY
  → nur bei CONFIRMED: Fix-Vorschlag (Phase-2-Persistenz), Status WAITING_FOR_ADMIN_APPROVAL → FIX_PROPOSED
  → Chat-Antwort (informativ) + Admin Approval Queue
```

Statusmodell der Brücke: `REQUESTED, ANALYZING, DIAGNOSIS_READY, FIX_PROPOSED, FAILED`.
Ausführungs- und Deployment-Zustände existieren hier bewusst nicht.

## 3. Authorization

Serverseitig geprüft, bei jeder Anfrage erneut: angemeldeter Nutzer
(`requireSupabaseAuth`), Admin-Rolle (`isAdmin`), gültiger Action-Typ
(`developer_diagnostic`), unterstützter Diagnostic Scope, ausdrückliche technische
Anweisung. Der Client-Vorfilter ist nur Komfort und niemals die Sicherheitsgrenze.

`MEMORY ≠ AUTHORIZATION`, `LLM OUTPUT ≠ AUTHORIZATION`, `CHAT TEXT ≠ AUTHORIZATION`,
`FIX APPROVAL ≠ DEPLOYMENT APPROVAL` — als Konstanten und Tests festgeschrieben.

## 4. READ-ONLY Grenzen

Erlaubt: Code lesen, Dateien und Tests untersuchen, Fehler reproduzieren,
Abhängigkeiten analysieren, Root Cause bestimmen, Diff vorbereiten.
Verweigert (`checkBridgeOperationAllowed`): `code_write`, `approval`,
`sandbox_execution`, `deployment`. Ebenso: Commits, Datenbank-Mutationen ausserhalb
der Vorschlags-/Audit-Persistenz, Secrets, Auditänderungen.

## 5. Fix Proposal Flow

Enthält Fix-ID, Version, Diagnostic-Request-ID, Root Cause, Confidence, betroffene
Dateien, exakten Diff, erlaubte Operationen, erwartetes Verhalten, Regressionstests,
Risiken, Rollback, Base Commit, Diff-Fingerprint, Zeit und Quelle `orb_chat`.
Endstatus: `WAITING_FOR_ADMIN_APPROVAL`. Spätere Änderung → alte Version
`INVALIDATED`, neue Version, neuer Fingerprint, neue Freigabe nötig (Phase-2-Logik
unverändert).

## 6. Chat-Antworten

Erfolg: „Ich habe die technische Ursache analysiert und einen Fixvorschlag
ORB-FIX-… im Developer-Bereich hinterlegt. Der Fix wurde noch nicht ausgeführt.“
Ohne bestätigte Ursache: „Ich konnte die Ursache nicht eindeutig bestätigen. Ich habe
deshalb keinen Fixvorschlag zur Ausführung erstellt.“
Behauptungen wie „Ich habe den Fehler repariert.“ sind ausgeschlossen und getestet.

## 7. Security

Chat → Analyse: erlaubt. Chat → Codeänderung, Freigabe, Sandbox-Ausführung,
Deployment: verboten und serverseitig blockiert, jeder Versuch wird im Audit
protokolliert. Audit-Einträge enthalten keine Secrets und erzeugen keine Rechte.

## 8. Testfälle

1. Erster End-to-End-Fall „Analysiere warum du mein Alter nicht abrufen kannst und
   erstelle einen Fixvorschlag.“ → Diagnostic Request → lesende Analyse → Root Cause
   → persistenter Fix-Vorschlag → im Admin sichtbar → `WAITING_FOR_ADMIN_APPROVAL`.
   Keine Codeänderung, keine Sandbox-Ausführung, kein Deployment.
2. Normale Chatnachrichten („Wie alt bin ich?“, „Mir ist das egal.“, …) starten keine
   Analyse.
3. Memory erzeugt keine Analyseberechtigung.
4. Manipulierte Client-Anfragen werden serverseitig abgelehnt.
5. Analyse kann keinen Code verändern, keine Freigabe erzeugen, keine Sandbox
   ausführen, kein Deployment auslösen.
6. Fehlende Ursachen-Evidenz (LIKELY/UNCONFIRMED) erzeugt keinen ausführbaren Fix.
7. Rechteversuche im Chat („deploye das“, „gib dir selbst frei“) → `escalation_denied`.

## 9. Testergebnisse

- `bunx vitest run`: 1347 Tests grün (83 Dateien), davon 39 neue Brückentests.
- `bun run test:db`: 102 Datenbank-/Sicherheitstests grün.
- `bunx tsgo --noEmit`: fehlerfrei.
- Lint der neuen/berührten Dateien: keine neuen Befunde.
- `bun run build`: erfolgreich.

Kein bestehender Test wurde entfernt oder abgeschwächt.

## 10. Bekannte Einschränkungen

- Nur der Bereich `memory_recall` hat heute einen reproduzierbaren Analysepfad; andere
  Bereiche werden erkannt, führen aber bewusst zu keinem Fix-Vorschlag.
- Der Diagnostic Request lebt innerhalb der Anfrage; persistiert wird der Fix-Vorschlag
  samt Request-ID und die Audit-Kette — keine eigene Request-Tabelle (keine Migration).
- Die Brücke ist Admin-only; normale Nutzer können keine Analyse anfordern.
