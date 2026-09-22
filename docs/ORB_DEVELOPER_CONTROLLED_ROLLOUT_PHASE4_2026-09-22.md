# ORB Core – Developer / Repair Environment · Phase 4: Controlled Rollout

**Status: READY FOR MANUAL DEPLOYMENT APPROVAL**

NO AUTONOMOUS DEPLOYMENT · NO DEPLOYMENT WITHOUT HUMAN APPROVAL ·
NO MEMORY-BASED AUTHORIZATION · NO LLM-BASED AUTHORIZATION ·
NO AUTOMATIC RETRY · NO UNAPPROVED PRODUCTION CHANGE

Nichts wurde veröffentlicht. Der laufende Code, die veröffentlichte App und die
Produktionsdaten sind unverändert. Phase 5 wurde nicht begonnen.

---

## 1 · Ziel

Phase 4 ergänzt die Governance für einen kontrollierten Rollout eines Fixes, der
in Phase 3 in der isolierten Sandbox bestanden hat. Sandbox-Erfolg ist
ausdrücklich **keine** Deployment-Freigabe: jeder Rollout benötigt eine
zusätzliche, eigenständige, menschliche Freigabe, die an den exakt getesteten
Stand gebunden ist.

## 2 · Architektur

| Datei | Rolle |
| --- | --- |
| `src/orb-dev/rollout-policy.ts` | Reine Entscheidungslogik: Zustände, Fingerabdrücke, Scope, Pre-flight, Rollback-Kriterien, Nachverifikation. Kein Dateizugriff, kein Prozess, keine Datenbank. |
| `src/orb-dev/rollout.server.ts` | Ausführung des kontrollierten Rollouts in einer isolierten Umgebung, Health Checks, Smoke Tests, Rollback, Nachverifikation. |
| `src/orb-dev/repo.server.ts` | Persistenz: Deployment-Freigaben, Sandbox-Nachweise, append-only Protokoll. |
| `src/lib/orb-dev.functions.ts` | Server-Funktionen (`requireSupabaseAuth` + `assertAdmin`): Plan, Sandbox-Nachweis hinterlegen, Freigabe anfordern, Rollout beauftragen, Protokoll lesen. |
| `src/routes/admin.orb-dev.tsx` | Admin-Bereich „7 · Production Rollout“. |
| `scripts/orb-rollout.ts` | Externer Runner; der Serverprozess selbst führt nichts aus. |
| `drizzle/migrations/0049_orb_dev_deployment_approvals.sql` | Eine neue Tabelle `orb_dev_deployment_approvals`; bestehende Tabellen und Daten unverändert. |

## 3 · Deployment Approval

Die Fix-Freigabe aus Phase 2 deckt kein Deployment ab (`fixApprovalCoversDeployment() === false`).
Eine Deployment-Freigabe entsteht nur, wenn Fix-ID, Fix-Version,
Proposal-Fingerabdruck, Final-Diff-Fingerabdruck, Sandbox-Execution-ID,
Sandbox-Ergebnis `PASSED`, Base Commit, Ziel, Scope und Rollback-Ziel
zusammenpassen und der Administrator den zielgebundenen Satz wörtlich bestätigt
(„I confirm deployment of this exact approved and tested fix to Production.“).
Quelle ist serverseitig auf `admin_ui` festgelegt und in der Datenbank per
Prüfbedingung erzwungen.

## 4 · Fingerprint Binding

`deploymentFingerprint = f(FIX + VERSION + FINAL DIFF + BASE COMMIT + SANDBOX RESULT + TARGET + SCOPE + ROLLBACK)`.
Vor jedem Rollout wird der Fingerabdruck neu berechnet und mit der gespeicherten
Freigabe verglichen. Abweichung in Version, Diff, Fingerabdruck, Base Commit,
Sandbox-Ergebnis, Ziel oder Scope → `DEPLOYMENT_APPROVAL_INVALID` bzw.
`PRODUCTION_BASE_CHANGED`; es gibt keine automatische Anpassung, nur eine neue
Freigabe.

## 5 · Pre-flight Checks

13 Prüfungen, erste Verletzung blockiert: Fix-ID, Fix-Version, Proposal-Zustand,
gültige Phase-2-Fix-Freigabe, vorhandener Sandbox-Nachweis, Sandbox `PASSED`,
Diff-Integrität, Reproduktion des Fehlers, Pflichtprüfungen
(Typecheck/Lint/Tests/Build) mit echten Ausführungsdaten, gültige
Deployment-Freigabe, ausdrücklich bestätigtes Ziel, bekannter aktueller
Zielstand, bekanntes Rollback-Ziel, verfügbare Health Checks.

## 6 · Production Baseline

Der aktuelle Stand wird aus `git HEAD` gelesen. Weicht er vom freigegebenen Base
Commit ab → `PRODUCTION_BASE_CHANGED`, Rollout gestoppt; der Fix muss gegen den
aktuellen Stand neu validiert werden.

## 7 · Deployment Flow

`PRE_FLIGHT → APPROVAL_VERIFICATION → BASELINE_VERIFICATION → DEPLOY_START →
PATCH_APPLICATION → VERIFICATION → HEALTH_CHECK → SMOKE_TEST →
POST_DEPLOY_VERIFICATION → DEPLOYED`.
Für `target = PRODUCTION` endet der Ablauf nach der Baseline-Prüfung mit
`READY_FOR_DEPLOYMENT` und `awaitingHumanProductionAction = true` — ORB
veröffentlicht grundsätzlich nicht selbst.

## 8 · Health Checks

Dienst startbereit (kritisch), ORB-Core-Module im ausgerollten Stand vorhanden
(kritisch), keine unmittelbaren Fehler in der Verifikationspipeline. Kritischer
Fehlschlag verhindert die Smoke-Phase und löst die Rollback-Prüfung aus.

## 9 · Smoke Tests

`tests/orb-core-health.smoke.test.ts` prüft ausschliesslich die Kernfunktion
(Themen-/Domänenerkennung und Relevanzbewertung), unabhängig von jedem Fix.

## 10 · Rollback

Rollback-Ziel ist vor dem Rollout bekannt. Kriterien abschliessend: Zielsystem
nicht erreichbar, kritischer Health Check fehlgeschlagen, definierter Smoke Test
fehlgeschlagen, kritische Regression. Der Rollback stellt den vorherigen Stand
wieder her und verifiziert ihn gegen eine unveränderte Referenzkopie; Ergebnis
`ROLLED_BACK` (verifiziert) oder `ROLLBACK_REQUIRED` (nicht verifiziert). Kein
unbedingter automatischer Rollback.

## 11 · Database Migration Handling

Migrationen sind nur Bestandteil eines Rollouts, wenn sie ausdrücklich im Scope
freigegeben sind (`checkMigrationScope`). Migration im Scope ohne Freigabe →
blockiert; Freigabe ohne Migration im Scope → ebenfalls blockiert. Phase 4 führt
keine Produktionsmigration aus.

## 12 · Authorization

Jede Server-Funktion nutzt `requireSupabaseAuth` und `assertAdmin`; die
Oberfläche ist nie die Sicherheitsgrenze. `deploymentAuthorityFrom` verweigert
jede Autorität aus LLM-Ausgabe, Memory, Graph, Chat, System-Prompt, Autonomie
und Sandbox-Erfolg.

## 13 · Security Tests

`tests/orb-dev-rollout.test.ts` (47 Tests): keine Freigabe, Fix-Freigabe ohne
Deployment-Freigabe, geänderter Diff/Fingerabdruck/Version, geänderter
Zielstand, fehlgeschlagener Sandbox-Test/Typecheck/Lint/Regression/Build,
falsches Ziel, nicht freigegebene Migration, fehlendes Rollback-Ziel, fehlende
oder falsche Doppelbestätigung, behaupteter Status ohne Ausführungsdaten,
Autorisierung und Codegrenzen — jeweils blockiert.
`tests/orb-dev-rollout-execution.test.ts` (7 Tests, echte Ausführung):
DEPLOYED-Pfad, Rollback nach Smoke-Fehler, Rollback nach kritischem
Health-Fehler (jeweils verifizierter Vorstand), Production-Halt, kein
Rollout ohne Freigabe, geänderter Diff, geänderter Zielstand.
`tests/integration/db-orb-dev-rollout-security.test.ts` (12 Tests):
Zeilenschutz, Adminbindung, keine Rechte für nicht angemeldete Besucher,
Unveränderlichkeit, Ziel-/Ergebnis-/Quellenbeschränkung, höchstens eine gültige
Freigabe je Fix und Ziel.

## 14 · Audit

Alle Ereignisse (`DEPLOYMENT_APPROVAL_GRANTED`, `DEPLOYMENT_QUEUED`, …) landen
append-only im bestehenden Protokoll mit Zeit, Akteur, Aktion, Fix-ID, Zustand
vorher/nachher, Ergebnis und Metadaten (Fingerabdrücke, Execution-ID, Ziel,
Rollback-Ziel). Secrets werden vor der Speicherung redigiert; bestehende
Einträge sind unveränderlich.

## 15 · Known Limitations

- Der Rollout läuft in einer isolierten Kopie (`git archive` + `patch -p1`), da
  `git apply` in dieser Umgebung gesperrt ist; ein echter Produktions-Rollout
  bleibt eine menschliche Handlung ausserhalb von ORB.
- Der Serverprozess kann keine Prozesse starten; Ausführung nur über den
  externen Runner.
- Noch nicht im Repository eingetragene Testdateien werden für die Smoke-Phase
  unverändert in die Rollout-Umgebung kopiert.
- Der Textvergleich des Diffs bleibt informativ; verbindlich ist die
  Dateimengen-Integrität (unverändert aus Phase 3).

## 16 · Was NICHT implementiert wurde

Kein automatisches Deployment nach Sandbox-Erfolg, kein Deployment durch LLM,
Memory oder Chat-Nachricht, kein Deployment ohne separate Freigabe, keine
automatische Anpassung eines Fixes, keine Retry-Schleifen, kein unbedingter
automatischer Rollback, keine Produktionsmigration, keine Änderung an Chat,
Memory, Recall, Curiosity, Impulse, autonomen Fragen, Energie oder Thread
Matching.

## 17 · Final Test Results

- `bunx vitest run`: **1308/1308 grün** (82 Dateien, davon 54 neue Phase-4-Tests)
- `bun run test:db`: **102/102 grün** (davon 12 neue Phase-4-Tests)
- `bunx tsgo --noEmit`: fehlerfrei
- `bunx eslint` auf allen Phase-4-Dateien: fehlerfrei (vorbestehende Befunde in unberührten Dateien unverändert)
- `bun run build`: erfolgreich
- Kein Test entfernt, kein Test abgeschwächt.

## 18 · Final Status

**READY FOR MANUAL DEPLOYMENT APPROVAL.** Die Kette
`PROBLEM → ORB DETECTS → READ-ONLY ANALYSIS → FIX PROPOSAL → HUMAN FIX APPROVAL →
SANDBOX EXECUTION → TESTS → DIFF VERIFICATION → SANDBOX PASSED →
HUMAN DEPLOYMENT APPROVAL → PRE-FLIGHT → ROLLOUT → HEALTH CHECK → SMOKE TEST →
VERIFY` ist vollständig implementiert und getestet. Der letzte Schritt in
Production bleibt ausschliesslich eine menschliche Entscheidung.
