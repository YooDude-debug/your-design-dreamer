# ORB Developer / Repair Environment — Phase 3: Controlled Repair Sandbox

Datum: 2026-09-22
Status: **READY FOR MANUAL REVIEW**
Grenzen: **NO PRODUCTION CODE CHANGE · NO DEPLOYMENT · NO AUTOMATIC APPROVAL · NO AUTONOMOUS SELF-REPAIR**

---

## 1. Ziel

Ein bereits von einem Administrator freigegebener Fix-Vorschlag soll **isoliert**
ausgeführt und getestet werden können, ohne den laufenden ORB-Code, Staging oder
Production zu berühren. Ein erfolgreicher Durchlauf bedeutet ausschliesslich: der
freigegebene Fix liess sich exakt anwenden und die Tests waren grün. Er bedeutet
nicht „Production Ready“, nicht „deployed“, nicht „selbst repariert“.

## 2. Architektur

| Baustein | Datei | Rolle |
| --- | --- | --- |
| Statusmodell, Flags, Freigabe-Fingerabdruck | `src/orb-dev/fix-model.ts` | Phase-2-Modell um Execution-States erweitert |
| Sandbox-Regelwerk | `src/orb-dev/sandbox-policy.ts` | Positivlisten, Schutzpfade, Limits, Umgebungsfilter, Ausführungstor |
| Diff-Integrität | `src/orb-dev/diff-integrity.ts` | Patch zerlegen, Dateimengen und Difftext vergleichen |
| Sandbox-Ausführung | `src/orb-dev/sandbox.server.ts` | Arbeitskopie, Patch, Reproduktion, Testpipeline, Aufräumen, Redaktion |
| Genehmigter Patch | `src/orb-dev/fixes/memory-recall-age.patch.ts` | echter, anwendbarer Unified-Diff des bekannten Fehlers |
| Serverfunktionen | `src/lib/orb-dev.functions.ts` | Freigabe erneut prüfen, Auftrag protokollieren, Ereignisse lesen |
| Runner | `scripts/orb-repair-sandbox.ts` | führt ausserhalb des Serverprozesses in Node/Bun aus |
| Oberfläche | `src/routes/admin.orb-dev.tsx` | Bereich „6 · Repair Sandbox“ inkl. ▶-Knopf |

Trennung der Verantwortung: Der veröffentlichte Serverprozess (Worker) kann
grundsätzlich keine Prozesse starten. Er prüft nur die Freigabe erneut und
protokolliert den Auftrag; die Ausführung passiert im getrennten Runner.

## 3. Sandbox-Isolation

- Basisstand über `git rev-parse HEAD`; Arbeitskopie über `git archive HEAD | tar -x`
  in ein temporäres Verzeichnis (kein `.git`, daher kein Commit, kein Push, kein Merge).
- `node_modules` wird nur verlinkt, nie beschrieben.
- Umgebung wird auf eine Positivliste reduziert (`sandboxEnv`): keine Secrets,
  keine Datenbankzugänge, keine Deployment-Zugangsdaten, keine `VITE_*`-Werte.
- Protokolliert werden: Execution-ID, Fix-ID, Version, Freigabe, Fingerabdruck,
  Base Commit, Sandbox-ID, Executor, Start, Ende, Schritte, Ergebnis.

## 4. Approval Enforcement

`checkSandboxExecutionRequest` blockiert bei: fehlender Freigabe, falschem
Fingerabdruck, abweichender Fix-ID, abweichender Version, nachträglich geändertem
Diff, abweichendem auszuführendem Diff, nicht bewiesener Ursache, Freigabequelle
ausserhalb von `admin_ui`, fehlendem Testbefehl, unerlaubten Pfaden oder Befehlen.
Die Prüfung läuft **doppelt**: in der Serverfunktion (auch bei manipulierten
Anfragen, unabhängig von der UI) und erneut im Runner unmittelbar vor der
Ausführung. Ein geänderter Fix wird nie automatisch übernommen — er braucht eine
neue Fix-Version und eine neue Freigabe.

## 5. Patch Integrity

- Nur der genehmigte Patch wird angewandt (`patch -p1 --forward --batch`), keine
  zusätzliche Codegenerierung, kein Nachbessern. Scheitert die Anwendung:
  `EXECUTION_FAILED`.
- Nach der Anwendung wird die tatsächlich veränderte Dateimenge gegen die
  genehmigte verglichen. Zusätzliche oder fehlende Dateien → `UNEXPECTED_CHANGE`.
- Nachgewiesener Durchlauf: `changedFiles` = `src/orb-core/memory.ts`,
  `src/orb-core/recall.ts`, `tests/orb-memory-recall-age.regression.test.ts`,
  `unexpected: []`, `missing: []`.

## 6. Security Boundaries

- Geschützte Bereiche sind für jeden Patch gesperrt: `src/orb-dev/**`,
  `src/lib/orb-dev.functions.ts`, `src/lib/admin.server.ts`, `src/lib/admin.functions.ts`,
  `src/integrations/**`, `src/routes/admin*`, `drizzle/**`, `supabase/**`,
  `scripts/orb-repair-sandbox.ts`, `tests/orb-dev-*`, `.env`, `.github/**`,
  `package.json`, `bun.lock`, `vite.config.ts`, `wrangler.toml`, `drizzle.config.ts`.
  Ein Repair-Fix kann die Sicherheitsgrenzen des Repair-Systems nicht verändern.
- Erlaubte Patch-Wurzeln: `src/orb-core/`, `src/lib/`, `src/components/`, `tests/`.
- Erlaubte Befehle: Typecheck, Lint, Vitest, Build. Verboten und geblockt:
  Deployment, `wrangler`, `git commit/push/merge`, Migrationen, `supabase`,
  `psql`, Netzzugriffe, Umgebungs-Dumps, `.env`-Zugriffe, Befehlsketten.
- Alle Serverfunktionen: `requireSupabaseAuth` + `assertAdmin`, Daten über
  `context.supabase` (Zeilenschutz greift). Nicht-Administratoren und nicht
  angemeldete Anfragen werden serverseitig abgewiesen.

## 7. Execution Flow

```text
APPROVED → EXECUTION_QUEUED → EXECUTING → PATCH_APPLIED → TESTING → PASSED
```

Fehlerzustände (alle terminal, kein automatischer Neuversuch):
`EXECUTION_FAILED`, `TEST_FAILED`, `UNEXPECTED_CHANGE`, `APPROVAL_INVALID`,
`BLOCKED_OPERATION`, `TIMEOUT`, `RESOURCE_LIMIT`, `SANDBOX_ERROR`.
Eine erneute Ausführung erfordert eine neue ausdrückliche Administratoraktion.

## 8. Test Results

Erster kontrollierter Fall: bekannter Memory/Recall-Fehler „Wie alt bin ich?“
(Fragewort „wie“ belegt einen Suchplatz, die Erinnerung „Ich bin 36 Jahre.“ wird
verworfen). Verwendet wurde der bestehende Fix-Vorschlag `ORB-FIX-0001` aus der
Phase-2-Diagnose — kein neu erfundener Fix.

Vollständiger Runner-Durchlauf (`bun run scripts/orb-repair-sandbox.ts ORB-FIX-0001 …`):

| Feld | Wert |
| --- | --- |
| Execution-ID | `ORB-EXEC-MUCZBTVR` |
| Fix-ID / Fingerabdruck | `ORB-FIX-0001` / `c76aa75c02e19874` (= erwartet) |
| Base Commit | `f88eb23f32b5ccbf1fb383564fe79b9b504d311d` |
| Reproduktion des Fehlers vor dem Fix | bestätigt (`failureConfirmed: true`) |
| Patch angewandt | ja, exakt |
| Diff-Integrität | `ok: true`, keine unerwarteten Dateien |
| `bunx tsgo --noEmit` | Exit 0 (3,6 s) |
| `bunx eslint src/orb-core/memory.ts src/orb-core/recall.ts` | Exit 0 (1,4 s) |
| gezielte Vitest-Regression (5 Suiten) | Exit 0 (0,8 s) |
| Endstatus | **PASSED** |
| Aufgeräumt / Live-Code verändert / deployed | ja / nein / nein |

Gesamtsuite im Projekt (nach allen Phase-3-Änderungen):

| Prüfung | Ergebnis |
| --- | --- |
| Logiktests `bunx vitest run` | 79 Dateien, **1249 Tests grün** |
| Datenbank-/Sicherheitstests `bun run test:db` | 10 Dateien, **90 Tests grün** |
| Typecheck `bunx tsgo --noEmit` | fehlerfrei |
| Lint `bunx eslint src tests scripts` | keine neuen Befunde (bestehende Altbefunde in unberührten Dateien unverändert) |
| Build `bun run build` | erfolgreich |

Kein Test wurde entfernt oder abgeschwächt. Neu: `tests/orb-dev-sandbox.test.ts`
(30 Tests) und `tests/orb-dev-sandbox-execution.test.ts` (3 Tests, echte
Sandbox-Ausführung inkl. Prüfung, dass der Arbeitsbaum unverändert bleibt).

## 9. Failure Handling

Jeder Fehler beendet den Durchlauf sofort, verwirft die Arbeitskopie und schreibt
einen terminalen Zustand. Nachgewiesene Blockaden im Betrieb:

- Diff nach der Freigabe geändert → `APPROVAL_INVALID`
  (real beobachtet: Fingerabdruck `628b614b…` erwartet `c76aa75c…`, Ausführung verweigert).
- Lint-Fehler im gepatchten Code → `TEST_FAILED` (real beobachtet, Durchlauf abgebrochen).
- Keine Freigabe → `APPROVAL_INVALID`, keine Schritte ausgeführt.

## 10. Timeout / Resource Handling

`SANDBOX_LIMITS`: Befehls-Timeout 240 s, Gesamt-Timeout 900 s, maximale
Ausgabegrösse 200 000 Bytes, höchstens 25 gepatchte Dateien, 200 000 Bytes Diff,
höchstens 12 Befehle. Überschreitungen führen zu `TIMEOUT` bzw. `RESOURCE_LIMIT`
und kontrolliertem Abbruch; Endlosläufe sind damit ausgeschlossen.

## 11. Audit Trail

Ereignisse werden ausschliesslich angehängt (`orb_dev_audit_log`, Phase-2-Struktur,
keine neue Tabelle, keine Migration): `SANDBOX_EXECUTION_QUEUED`,
`SANDBOX_EXECUTION_BLOCKED` mit Zeitpunkt, Actor, Fix-ID, vorherigem und neuem
Status, Ergebnis und Metadaten (Fingerabdruck, Version, geprüfte Befehle,
`liveCodeWrite: false`, `deployment: false`). Bestehende Einträge werden nie
verändert oder gelöscht. Ausgaben werden vor dem Speichern von Secret-Mustern
befreit (`redact`, getestet).

## 12. Sandbox Cleanup

Die Arbeitskopie wird in jedem Fall entfernt (`cleanedUp: true` in allen
Durchläufen, auch bei Fehlern). Der Projektarbeitsbaum ist nachweislich
unverändert: der Ausführungstest vergleicht `git status --porcelain` vor und nach
dem Durchlauf.

## 13. Security Test Results

30 Tests in `tests/orb-dev-sandbox.test.ts`, alle grün:

- **Freigabe (9):** gültig erlaubt; ohne Freigabe, geänderter Diff, falscher
  Fingerabdruck, falsche Version, manipulierte Fix-ID, nicht bewiesene Ursache,
  abweichender Ausführungs-Diff und gefälschte Freigabequelle blockiert.
- **Sandbox (9):** Schutzpfade, Pfade ausserhalb der Wurzeln, Deployment-/DB-/
  Secret-/Netz-Befehle, Migrationen und Patches ausserhalb der Freigabe blockiert;
  erlaubte Befehle zugelassen; Umgebung ohne Secrets; Limits endlich; kein Retry.
- **Integrität (6):** echter Unified-Diff auf erlaubte Dateien, mitgelieferter
  Regressionstest, gleiche Dateimenge = PASS, zusätzliche oder fehlende Änderung = FAIL.
- **Phase-3-Grenzen (6):** Live-Schreiben, Deployment und autonome Selbstreparatur
  aus; Auth- und Adminprüfung in jeder Sandbox-Serverfunktion; kein Prozessstart im
  Serverprozess; Runner nur in Arbeitskopie; Secret-Redaktion; Testbefehl erforderlich.

## 14. Known Limitations

- `diffTextMatches` ist informativ `false`: der aus der Arbeitskopie
  rekonstruierte Difftext unterscheidet sich in Kontext und Kopfzeilen vom
  eingereichten Patch (u. a. weil die neue Testdatei unversioniert ist).
  Verbindlich für die Integrität ist der **Dateimengen-Vergleich**, der exakt
  übereinstimmen muss; zusätzliche Änderungen werden dadurch erkannt.
- Die Isolation ist prozessbasiert (eigene Arbeitskopie, gefilterte Umgebung),
  keine Container- oder Kernel-Isolation.
- Der Runner wird bewusst von Hand gestartet; es gibt absichtlich keine
  automatische Warteschlangenverarbeitung.
- Die Testpipeline fährt gezielte Suiten des Fixes, nicht die Gesamtsuite; die
  Gesamtsuite läuft in der normalen Projektverifikation.

## 15. Was NICHT implementiert wurde

- Keine Änderung an Live-, Staging- oder Production-Code.
- Kein Deployment, kein Neustart, kein Git-Schreibvorgang, keine Migration
  (Phase 3 brauchte keine; die Phase-2-Strukturen genügen).
- Keine automatische Freigabe, keine Freigabe durch Memory, Graph oder LLM.
- Keine autonome Selbstreparatur, kein automatischer Neuversuch, kein Rollout.
- Keine Änderungen an Chat, Memory, Autonomie, Curiosity, Impulse oder anderen
  Produktfunktionen ausserhalb des Repair-Bereichs.

## 16. Final Status

**SANDBOX TEST PASSED — READY FOR HUMAN REVIEW.**
Der freigegebene Fix `ORB-FIX-0001` wurde isoliert angewendet und getestet; der
zuvor bewiesene Fehler wurde reproduziert und ist nach dem Patch behoben.
Production bleibt unverändert. Phase 4 (kontrollierter Rollout) wurde nicht
begonnen und ist nicht vorbereitet freigeschaltet.
