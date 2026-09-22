# ORB DEVELOPER / REPAIR ENVIRONMENT – PHASE 1 (2026-09-22)

Status: **READY FOR MANUAL REVIEW** – nicht deployed.
Phase 1 stellt ausschliesslich die geschützte Umgebung bereit. Es gibt keine
autonome Reparatur, keine Selbstveränderung, kein Deployment, keine Migration
und keine Änderung an bestehender ORB-Funktionalität.

---

## 1. Architektur

```
LIVE ORB RUNTIME            (src/orb-core/*, unverändert)
        ↓  Diagnostic Request (Admin, serverseitig geprüft)
ORB DEVELOPER ENVIRONMENT   (src/orb-dev/*)
        ↓  Code Analysis      code-access.server.ts  (READ-ONLY)
        ↓  Root Cause         diagnose.server.ts     (deterministisch)
        ↓  Fix Proposal       fix-model.ts + session-store.server.ts
        ↓  Human Approval     ausdrücklich, an Fix-ID + Diff gebunden
        ↓  separate execution environment  ← Phase 2, noch nicht vorhanden
```

Neue Dateien (nichts Bestehendes geändert):

| Datei | Rolle |
| --- | --- |
| `src/orb-dev/fix-model.ts` | Reines Modell: Phasen, Fix-ID, Fingerabdruck, Approval-Prüfung, Phase-1-Riegel |
| `src/orb-dev/types.ts` | Browser-sichere Typen (Audit, Diagnose) |
| `src/orb-dev/code-access.server.ts` | READ-ONLY Codezugriff mit Allowlist und Secret-Sperre |
| `src/orb-dev/diagnose.server.ts` | Diagnosekette Observation → Reproduction → Code Trace → Root Cause → Fix Proposal |
| `src/orb-dev/session-store.server.ts` | Flüchtiger Speicher + Audit-Log (nur Server-Sitzung/Server-Log) |
| `src/lib/orb-dev.functions.ts` | Server-Funktionen, jede mit Auth + Admin-Pflicht |
| `src/routes/admin.orb-dev.tsx` | Admin-Oberfläche `/admin/orb-dev` mit sieben Bereichen |
| `tests/orb-dev-environment.test.ts` | 20 Sicherheitstests |

Der laufende ORB kann seinen eigenen Code nicht überschreiben: die Umgebung
besitzt keine Schreibfunktion, keinen Shell-Zugriff, kein Git und keine
Migrationsschnittstelle. `checkExecutionAllowed()` gibt immer `allowed: false`.

## 2. Security Boundary

- Die UI ist reine Anzeige. Jede Operation läuft über `createServerFn`.
- Jede der 7 Server-Funktionen: `.middleware([requireSupabaseAuth])` **und**
  `assertAdmin(context)` (bestehende `has_role`-Prüfung aus `src/lib/admin.server.ts`
  über den RLS-gebundenen Nutzer-Client). Keine neue, parallele Rollenlogik.
- Ein manipuliertes Frontend erreicht nichts: fehlende Rolle → `Forbidden`;
  fremde Fix-ID → abgelehnt; falscher Fingerabdruck → abgelehnt; nicht gedeckte
  Operation → abgelehnt; Ausführung → in Phase 1 grundsätzlich abgelehnt.
- Codezugriff ist auf `src/orb-core`, `src/orb-dev`, `src/orb-sdk`,
  `src/integrations`, `src/routes`, `src/lib`, `tests`, `docs`,
  `supabase/config.toml` beschränkt. Gesperrt: `.env*`, `.git`, `node_modules`,
  alles mit `secret`/`credential`, Schlüsseldateien. Pfad-Traversal wird
  abgewiesen; schlüsselartige Inhalte werden vor der Anzeige als `[REDACTED]`
  maskiert.
- **MEMORY ≠ AUTHORIZATION**: `memoryGrantsAuthority()` gibt konstant `false`.
  `FORBIDDEN_APPROVAL_SOURCES` (`llm`, `memory`, `graph`, `system_prompt`,
  `autonomous`) werden von `isApprovalSourceAllowed()` abgelehnt; die Quelle ist
  serverseitig fest auf `admin_ui` verdrahtet und nicht aus Eingaben ableitbar.

## 3. Admin Enforcement

Bestehende Mechanismen wiederverwendet:
`requireSupabaseAuth` (Bearer-Token-Prüfung) + `assertAdmin` (`has_role`
`admin`). Die Route `/admin` prüft zusätzlich clientseitig für die Navigation –
das ist nur Komfort, nicht die Sicherheitsgrenze.

## 4. Approval Model

Freigabe ist gebunden an **Fix-ID + Fingerabdruck + erlaubte Operationen**:

- `fixFingerprint()` hasht Fix-ID, Root Cause, Dateien, Diff, Operationen und
  Testplan (FNV-1a, deterministisch).
- `approveFix()` verlangt Status `WAITING_FOR_ADMIN_APPROVAL`, bewiesene Ursache
  und den aktuell angezeigten Fingerabdruck.
- `checkApproval()` prüft bei jeder späteren Anfrage erneut: gleiche Fix-ID,
  gleicher Fingerabdruck, gedeckte Operation, `ROOT_CAUSE_PROVEN`.
- **Invalidierung:** Diff-Änderung, zusätzliche Datei, anderer Befehl, andere
  Migration oder anderer Testplan ändern den Fingerabdruck → alte Freigabe
  ungültig. `reviseProposal()` löscht die Freigabe, setzt den alten Vorschlag
  auf `ROLLED_BACK` und erzeugt eine **neue Fix-ID**.
- Eine natürlichsprachliche Zustimmung („Ja, mach das.“) erzeugt technisch
  keine Freigabe – nur der Button in der Approval Queue.

## 5. Fix-ID-Modell

`ORB-FIX-0001` (`formatFixId`, `FIX_ID_RE`). Gebunden an: Root Cause,
Root-Cause-Stufe, betroffene Dateien, exakten Diff, geplante Operationen,
Testplan, erwartete Auswirkungen, Risiken, Rollback-Plan, Ersteller/Quelle,
Erstellungszeitpunkt, Status.

Phasen: `ANALYZING → DIAGNOSIS_READY → FIX_PROPOSED → WAITING_FOR_ADMIN_APPROVAL
→ APPROVED → EXECUTING → TESTING → PASSED/FAILED → COMPLETED/ROLLED_BACK`.
`ALLOWED_TRANSITIONS` lässt keine Abkürzung um die Freigabe herum zu
(`FIX_PROPOSED → APPROVED` ist unmöglich).

Root-Cause-Stufen: `ROOT_CAUSE_PROVEN` / `ROOT_CAUSE_PLAUSIBLE` /
`ROOT_CAUSE_UNKNOWN`. Nur `PROVEN` darf zu einem Vorschlag führen
(`mayProposeRepair`).

## 6. Sandbox-Konzept (Phase 2, nicht implementiert)

`LIVE ORB ≠ REPAIR WORKSPACE`. Vorgesehen: isolierte Arbeitskopie/Branch, in der
ein freigegebener Diff angewandt und getestet wird; Rückmeldung nur als
Testergebnis an die Fix-ID. In Phase 1 existiert keine solche Umgebung, deshalb
ist jede Ausführung hart deaktiviert
(`PHASE1_WRITE_OPERATIONS_ENABLED = false`).

## 7. Audit Log

Jede administrative Aktion erzeugt einen Eintrag mit Administrator, Zeitpunkt,
Aktion, Fix-ID, vorherigem und neuem Status, betroffenen Dateien und Ergebnis –
ohne Secrets oder API-Keys. Erfasst: Code-Zugriffe, Diagnosen, Erstellung von
Vorschlägen, erteilte und abgelehnte Freigaben, abgelehnte Ausführungsanfragen.

## 8. Erster Testfall (READ-ONLY)

Frage „Wie alt bin ich?“ gegen Erinnerung „Ich bin 36 Jahre.“ Die Diagnose
rechnet mit den bestehenden ORB-Core-Funktionen und zeigt die Kette:

| Stufe | Ergebnis | Beobachtung |
| --- | --- | --- |
| MEMORY | PASS | Erinnerung vorhanden und belastbar |
| RECALL | BLOCKED | `questionIntentOf()` erkennt keinen Bereich (nur vier vorhanden) |
| CANDIDATE_SEARCH | BLOCKED | `topicOf()` liefert das Fragewort „wie“ als Thema |
| FILTER | BLOCKED | `overlap = max(0.000, 0.000) = 0`, Filter verlangt `> 0` |
| RANKING / ACTIVE_MEMORY / CONTEXT / LLM | NOT_REACHED | Erinnerung erreicht den Kontext nie |

Ergebnis: `ROOT_CAUSE_PROVEN`. Der daraus abgeleitete Fix-Vorschlag bleibt ein
Vorschlag – es wurde nichts angewandt.

## 9. Aktuelle Grenzen (Phase 1)

Nur flüchtig bzw. nur im Server-Log vorhanden:

- Fix-Vorschläge (inkl. Diff, Testplan, Risiken, Rollback-Plan)
- Freigaben (Fix-ID, Fingerabdruck, Administrator, Zeitpunkt)
- Fix-Status und Statuswechsel
- Audit-Einträge (zusätzlich als `[orb-dev][audit]` im Server-Log)

Folge: Nach einem Serverneustart sind Vorschläge und Freigaben weg. Das ist
sicherheitsseitig unkritisch – ein fehlender Eintrag bedeutet immer „keine
Freigabe“, niemals „freigegeben“.

Für **Phase 2** zu persistieren (mit Migration und RLS, nur nach Freigabe):
Tabelle für Fix-Vorschläge, Tabelle für Freigaben (unveränderlich,
Fingerabdruck-gebunden), Tabelle für Audit-Einträge, Tabelle für Testergebnisse
je Fix-ID.

## 10. Noch nicht implementierte autonome Reparatur

Ausdrücklich NICHT enthalten: automatisches Patchen des laufenden ORB,
automatisches Git-Commit/Merge, automatisches Deployment, Production-Restart,
autonome Freigabe, Freigabe durch LLM/Memory/Graph/Systemprompt, Testausführung
mit Wirkung auf Production.

## 11. Acceptance Criteria

| Kriterium | Status |
| --- | --- |
| Nur Administratoren haben Zugriff | erfüllt (`requireSupabaseAuth` + `assertAdmin` in allen 7 Server-Funktionen) |
| Zugriff serverseitig geschützt | erfüllt (UI ist nur Anzeige) |
| Memory erzeugt keine Berechtigung | erfüllt (`memoryGrantsAuthority()` = false, Quelle fest `admin_ui`) |
| Eindeutige Fix-IDs | erfüllt (`ORB-FIX-0001`) |
| Nachvollziehbarer Diff | erfüllt (Diff Teil des Vorschlags und des Fingerabdrucks) |
| Approval an den konkreten Fix gebunden | erfüllt (`checkApproval`) |
| Änderung invalidiert Approval | erfüllt (Fingerabdruck + `reviseProposal` mit neuer Fix-ID) |
| Keine automatische Production-Änderung möglich | erfüllt (`checkExecutionAllowed()` immer false) |
| Live ORB nicht überschreibbar | erfüllt (keine Schreib-/Git-/Shell-Schnittstelle) |
| Audit-Log vorhanden | erfüllt (flüchtig + Server-Log) |
| Keine Secrets im Diagnose-/Audit-System | erfüllt (Allowlist, Deny-Patterns, Redaktion) |
| Bestehende ORB-Funktionalität unverändert | erfüllt (nur neue Dateien) |

## 12. Verifikation

- Neue Sicherheitstests: `tests/orb-dev-environment.test.ts` – 20 grün
- Volle Logik-Suite: 1190 Tests in 76 Dateien grün
- Typecheck: 0 Fehler · Lint: 0 Fehler · Build: OK

**READY FOR MANUAL REVIEW – nicht deployed.**
