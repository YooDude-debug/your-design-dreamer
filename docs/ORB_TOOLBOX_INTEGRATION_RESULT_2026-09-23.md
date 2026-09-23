# ORB CORE – TOOLBOX ANALYSE VERDRAHTUNG

**Datum:** 2026-09-23
**Grundlage:** P9 (`docs/ORB_P9_DIAGNOSTIC_COUNT_OPTIMIZATION_RESULT_2026-09-23.md`)
**Art:** Integrationsschritt (Verdrahtung + Analysefähigkeit), keine DB-Optimierung
**Grundsatz:** TOOLBOX = ANALYSE · ORB = AUSFÜHRUNG · MENSCH = FREIGABE

---

## 1. Vorhandene Toolbox-Struktur

**Befund vorab:** Der Begriff „Toolbox" existiert im Projekt nicht. `rg -i toolbox`
über das gesamte Repository (ohne `node_modules`) ergab **null Treffer** – keine
Datei, keine Komponente, keine Route, kein Dokument.

Es existiert jedoch eine vollständige, bereits produktiv abgesicherte
Analyse- und Freigabe-Infrastruktur, die genau die geforderte Rolle erfüllt:

| Bereich | Ort | Charakter |
| --- | --- | --- |
| READ-ONLY Diagnose | `src/orb-dev/diagnose.server.ts` | liest Code + rechnet mit ORB-Core-Funktionen, kein Schreiben, kein LLM |
| Codelesezugriff | `src/orb-dev/code-access.server.ts` | nur lesend |
| Fix-Modell / Zustände | `src/orb-dev/fix-model.ts`, `types.ts` | Zustandsmaschine, Fingerabdruck |
| Persistenz + Prüfprotokoll | `src/orb-dev/repo.server.ts` | Vorschläge, Freigaben, anfügendes Audit |
| Sandbox | `src/orb-dev/sandbox.server.ts`, `sandbox-policy.ts` | isolierte Ausführung nur nach Freigabe |
| Rollout | `src/orb-dev/rollout.server.ts`, `rollout-policy.ts` | getrennte Deployment-Freigabe |
| Chat-Brücke | `src/orb-dev/chat-bridge.ts`, `chat-bridge.server.ts` | nur Administrator, nur lesende Analyse |
| Server-Schnittstelle | `src/lib/orb-dev.functions.ts`, `src/lib/orb-chat-bridge.functions.ts` | `requireSupabaseAuth` + `assertAdmin` |
| Admin-Oberfläche | `src/routes/admin.orb-dev.tsx` | Warteschlange, Befunde, Freigaben |
| Beobachtungsschicht | `src/orb-core/observability.server.ts` | P3: `evt_…`/`mrq_…`, nur Protokollzeilen |
| Tabellen | `orb_dev_fix_proposals`, `orb_dev_fix_approvals`, `orb_dev_deployment_approvals`, `orb_dev_audit_log` | Migrationen 0048/0049 |

## 2. Gefundene Schnittstellen

1. `diagnoseMemoryRecallCase()` – reproduzierbare, lesende Diagnose ohne DB und ohne LLM.
2. `proposalFromDiagnosis()` – erzeugt einen Vorschlagsentwurf, wendet nichts an.
3. `repo.listProposals/getProposal/listApprovals/auditLog` – lesende Zustandsabfragen.
4. `repo.audit()` – anfügendes Prüfprotokoll mit Schlüssel-Redaktion (`redactAuditText`).
5. `runChatDiagnostic()` – vorhandener Adapter aus dem Admin-Chat in dieselbe Strecke.
6. `newEventContext()/nextModelRequest()` – technische Kennungen aus P3.
7. `assertAdmin()` / `isAdmin()` (`has_role`) und `is_admin_owner` – Berechtigungen.

## 3. Verwendete Schnittstelle

Verwendet wurden ausschliesslich die vorhandenen Schnittstellen 1, 3, 4 und 7.
Es wurde **keine zweite Toolbox-Architektur**, keine neue Tabelle, keine neue
Freigabelogik und kein zweites Fix-System erzeugt.

Neu ist nur eine dünne Schicht:

```text
ORB Core (unverändert)
        │
        │   (kein Aufruf aus dem normalen Verarbeitungspfad)
        ▼
ORB Toolbox Adapter        src/orb-core/toolbox/adapter.server.ts
        │                  Vertrag: src/orb-core/toolbox/contract.ts
        ▼
vorhandene Analysestrecke  src/orb-dev/diagnose.server.ts
                           src/orb-dev/repo.server.ts (nur lesend)
```

## 4. ORB → Toolbox Datenfluss

Aufruf nur über die admin-geschützte Serverfunktion
`orbToolboxAnalyze` (`src/lib/orb-toolbox.functions.ts`).

Übergeben wird ausschliesslich:

| Feld | Inhalt |
| --- | --- |
| `analysisType` | `memory_recall` \| `repair_pipeline_state` \| `system_logs` \| `request_structure` |
| `source` | `admin_ui` \| `admin_chat` |
| `eventId` | technische Ereigniskennung `evt_…` oder `null` |
| `requestId` | technische Modellaufrufkennung `mrq_…` oder `null` |

**Kein Chattext, keine Nachricht, keine Erinnerung, keine personenbezogenen
Daten.** Kennungen werden gegen ein Muster geprüft; alles andere wird auf `null`
gesetzt (Test M: `requestId: "Wie alt bin ich?"` → `null`).

Rückgabe: `analysisId` (`ORB-TBX-XXXXXXXX`), `status`, `timestamp`, `durationMs`,
`findings[]`, `recommendations[]`, `failureKind` sowie die unveränderlichen
Nachweise `readOnly: true`, `codeChanged: false`, `dbChanged: false`,
`proposalCreated: false`, `approvalCreated: false`, `deployed: false`,
`modelCalls: 0`.

## 5. Berechtigungen

- `requireSupabaseAuth` – angemeldeter Nutzer, serverseitig erzwungen.
- `assertAdmin` (`has_role(auth.uid(),'admin')`) – Administratorrolle, serverseitig erzwungen.
- Erlaubte Quellen: `admin_ui`, `admin_chat`. Ausdrücklich verboten und im
  Vertrag als `FORBIDDEN_TOOLBOX_SOURCES` hinterlegt: `orb_autonomous`, `llm`,
  `memory`, `graph`, `system_prompt` – ORB kann sich also nicht selbst
  diagnostizieren lassen.
- `analysisGrantsAuthority()` liefert konstant `false`: ein Befund begründet
  niemals ein Recht.

## 6. Read-only-Grenzen

Im Vertrag als geprüfte Konstanten verankert:

| Riegel | Wert |
| --- | --- |
| `TOOLBOX_READ_ONLY` | `true` |
| `TOOLBOX_CODE_WRITE_ENABLED` | `false` |
| `TOOLBOX_DB_WRITE_ENABLED` | `false` |
| `TOOLBOX_MIGRATION_ENABLED` | `false` |
| `TOOLBOX_DEPLOYMENT_ENABLED` | `false` |
| `TOOLBOX_APPROVAL_ENABLED` | `false` |
| `TOOLBOX_CONFIG_WRITE_ENABLED` | `false` |
| `TOOLBOX_SECRET_ACCESS_ENABLED` | `false` |

`checkToolboxOperationAllowed()` lehnt jede dieser Operationen mit Begründung ab;
`orbToolboxRequestOperation` protokolliert eine solche Anfrage als
`TOOLBOX_OPERATION_DENIED` und führt nichts aus.

Der Adapter selbst enthält keinerlei `insert/update/upsert/delete` und ruft
`insertProposal`, `approveFix`, Sandbox oder Deployment **nicht** auf
(statisch geprüft in Test H). **Die einzige Schreiboperation des gesamten
Integrationsstandes** ist der anfügende Eintrag im bestehenden
`orb_dev_audit_log` durch die Serverfunktion – identisch zur bereits
vorhandenen Chat-Brücke, mit Schlüssel-Redaktion und ohne Inhalte.

## 7. Human-in-the-Loop

```text
ANALYSE  →  BEFUND  →  EMPFEHLUNG  →  (Admin-Bereich) PATCH-VORSCHLAG
         →  MENSCHLICHE FREIGABE  →  Sandbox  →  separate Deployment-Freigabe
```

Jede Empfehlung trägt zwingend `requiresHumanApproval: true` und `applied: false`.
`proposalCandidate: true` ist nur ein Hinweis, dass die vorhandene
Reparaturstrecke daraus einen Vorschlag erzeugen **könnte** – der Adapter
erzeugt keinen. Die Erzeugung persistenter Fix-Vorschläge bleibt unverändert
bei der bestehenden, admin-ausgelösten Strecke (Phase 2/3/4). Ein Vorschlag
verändert weiterhin nichts, bis ein Mensch ihn freigibt.

## 8. Fehlerisolierung

`runToolboxAnalysis()` **wirft nie**. Alle Fehler werden in ein Ergebnis
umgesetzt: `status: "FAILED"` mit technischem Grund ohne Inhalt.

| Fall | Ergebnis | Test |
| --- | --- | --- |
| Analysefehler (z. B. Datenbankfehler) | `FAILED` / `analysis_error` | O |
| nicht erreichbar | `FAILED` / `unavailable` | P |
| hängende Analyse (Zeitgrenze, Standard 10 s) | `FAILED` / `timeout` | Q |
| Fehlertext enthält Schlüssel/Inhalt | wird nicht übernommen | R |
| Analyseart ohne Schnittstelle | `UNSUPPORTED` + Begründung | N |

Zusätzlich: ein Fehler beim Protokollschreiben hebt die Analyse nicht auf
(eigener `try/catch` in der Serverfunktion). ORB Core ist von all dem
unberührt, weil es die Toolbox überhaupt nicht aufruft (Abschnitt 9).

## 9. Performance-Auswirkungen

**Auf den normalen ORB-Verarbeitungspfad: keine – messbar null.**

`src/orb-core/engine.server.ts` wurde nicht verändert und enthält keinen
Toolbox-Bezug; Test E prüft das statisch (`engine` enthält kein „toolbox").
Damit gilt unverändert der P9-Stand: gleiche Anzahl Datenbankoperationen,
gleiche Reihenfolge, gleiche Schwellen, gleiche Entscheidungen.

Last entsteht ausschliesslich, wenn ein Administrator eine Analyse auslöst:

| Analyseart | Datenbankoperationen | Modellaufrufe |
| --- | --- | --- |
| `memory_recall` | 0 (nur Rechnen + Codelesen) | 0 |
| `repair_pipeline_state` | 1 lesend (`orb_dev_fix_proposals`, Limit 50) | 0 |
| Prüfprotokoll je Analyse | 1 anfügend (`orb_dev_audit_log`) | 0 |

Die Analyse läuft synchron im Administrator-Request, nicht im Chatpfad. Eine
asynchrone Warteschlange wurde bewusst **nicht** gebaut (Abschnitt 13).

## 10. Zusätzliche Requests / AI Calls

**Zusätzliche kostenpflichtige Modellaufrufe: 0.**

Der Vertrag führt `modelCalls: 0` als unveränderlichen Wert; Test H prüft
statisch, dass der Adapter weder OpenAI-Endpunkte noch Gateway-Schlüssel
kennt. Sämtliche Tests liefen mit Attrappen; im gesamten Lauf entstand kein
echter Modellaufruf. Im normalen ORB-Pfad entstehen null zusätzliche Requests.

## 11. Tests

Neu: `tests/orb-toolbox-integration.test.ts` – **18 Tests, alle grün.**

| Geforderter Fall | Test |
| --- | --- |
| ORB funktioniert ohne Toolbox | E (Core ruft Toolbox nicht auf), gesamter Bestandslauf |
| ORB mit erreichbarer Toolbox | K, L |
| Toolbox nicht erreichbar | P |
| Toolbox liefert Fehler | O, Q, R |
| Toolbox liefert Analyse | K, L, M |
| Analyse erzeugt Vorschlag/Empfehlung | K (Empfehlung mit `proposalCandidate`) |
| Vorschlag verändert noch nichts | K (`applied:false`, `proposalCreated:false`), H |
| normale Chatverarbeitung unverändert | E + 1371 unveränderte Bestandstests |
| autonome Fragen / Memory / Graph / Energy / Curiosity unverändert | E, F, D + Bestandstests |
| DB-Verhalten des normalen Pfades unverändert | E + P9-Messtests im Bestand |
| keine zusätzlichen AI-Aufrufe im normalen Pfad | H, `modelCalls: 0` |
| Read-only-Riegel und Ablehnungen | A, B, C |
| technische Identität, keine Inhalte | I, J, M, R |

Gesamtprüfung:

| Prüfung | Ergebnis |
| --- | --- |
| Logiktests | **1389 / 1389 grün** (87 Dateien; vorher 1371, +18 neu) |
| Datenbank-/Sicherheitstests (`test:db`) | **102 / 102 grün** (11 Dateien) |
| Typprüfung (`tsgo --noEmit`) | fehlerfrei |
| Lint (geänderte/neue Dateien) | sauber |
| Build | OK |

## 12. Welche Änderungen tatsächlich vorgenommen wurden

Nur neue Dateien – **keine bestehende Produktionsdatei wurde verändert**:

1. `src/orb-core/toolbox/contract.ts` (neu) – reiner Vertrag: Riegel, Analysearten,
   technische Identität, Befund-/Empfehlungsform. Kein DB-, Datei- oder Modellzugriff.
2. `src/orb-core/toolbox/adapter.server.ts` (neu) – dünner, lesender Adapter auf die
   vorhandene Diagnose und die vorhandenen Leseabfragen; Zeitgrenze; wirft nie.
3. `src/lib/orb-toolbox.functions.ts` (neu) – admin-geschützte Serverfunktionen
   `orbToolboxCapabilities`, `orbToolboxAnalyze`, `orbToolboxRequestOperation`.
4. `tests/orb-toolbox-integration.test.ts` (neu) – 18 Tests.
5. `docs/ORB_TOOLBOX_INTEGRATION_RESULT_2026-09-23.md` (dieser Bericht).

Unverändert: `src/orb-core/engine.server.ts` und der gesamte übrige ORB-Core,
`src/orb-dev/*`, `src/routes/admin.orb-dev.tsx`, alle Schwellen, Prompts,
Modelle, Datenbankschema (keine Migration), Freigabe- und Rolloutlogik.
Die P3–P9-Optimierungen wurden nicht zurückgenommen.

## 13. Welche Funktionen bewusst NICHT implementiert wurden

1. **Kein Aufruf der Toolbox aus ORB Core.** Die Verdrahtung ist der Adapter; ein
   Aufruf im Verarbeitungspfad würde synchrone Last und Abhängigkeit erzeugen.
2. **Kein Erzeugen von Fix-Vorschlägen durch die Toolbox.** Das bleibt bei der
   vorhandenen, admin-ausgelösten Strecke.
3. **Keine Logauswertung (`system_logs`).** Die P3-Protokollzeilen existieren nur
   als Laufzeitausgabe; es gibt keine lesbare Abfrageschnittstelle. Als
   `UNSUPPORTED` dokumentiert statt erfunden.
4. **Keine Request-/Ereignisstrukturanalyse (`request_structure`).** Gleiche
   Begründung: keine abfragbare Ablage vorhanden.
5. **Keine asynchrone Analyse-Warteschlange.** Vorlagen existieren
   (`notification_jobs`, `media_variant_jobs`, zeitgesteuerte Endpunkte unter
   `src/routes/api/public/*`), aber es gibt keine ORB-Analyse-Warteschlange.
   Laut Vorgabe §11 nur dokumentiert, nicht gebaut.
6. **Keine Oberfläche.** `admin.orb-dev.tsx` wurde nicht angefasst; die
   Anbindung der Analyse an die Oberfläche ist ein eigener Freigabeschritt.
7. **Keine ChatBridge-Erweiterung.** Die bestehende Brücke bleibt wie sie ist.
8. **Keine Migration, kein Deployment, keine Selbstreparatur.**

### Für einen späteren, ausdrücklich freizugebenden Schritt offen

- Anzeige der Analysen im Admin-Bereich (Fähigkeiten, Befunde, Protokoll).
- Asynchrone Ausführung über eine neue Auftragstabelle (benötigt Migration).
- Lesbare Ablage der P3-Protokollzeilen, damit Log- und Requestanalyse möglich wird.
- Weitere Analysearten über weitere reproduzierbare Diagnosefunktionen.

---

## ABSCHLUSS

Verdrahtung und Analysefähigkeit sind hergestellt, ausschliesslich lesend,
administrativ geschützt, fehlerisoliert, ohne zusätzliche Modellaufrufe und ohne
Eingriff in ORB Core.

**STOPP.** Kein Patch, kein Deployment, keine Migration, keine Selbständerung,
keine weitere Optimierung. Jeder weitergehende Schreib- oder Patch-Schritt
benötigt eine neue ausdrückliche menschliche Freigabe.
