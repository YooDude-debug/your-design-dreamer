# ORB P16 – Reparatur-/Diagnosetests an den behobenen Fehler angepasst

Datum: 2026-09-23 · Referenz: `docs/ORB_P15_INFORMATION_DOMAIN_PATCH_RESULT_2026-09-23.md`
Status: abgeschlossen · **kein Deployment, keine Veröffentlichung, keine Änderung an ORB-Produktionslogik**

---

## 1 · Die 10 betroffenen Tests

`tests/orb-dev-sandbox-execution.test.ts` (3)

1. „reproduziert den bekannten Fehler, wendet den Patch an und besteht die Regression“
2. „verweigert die Ausführung ohne gültige Freigabe“
3. „verweigert die Ausführung nach nachträglicher Diff-Änderung“

`tests/orb-dev-rollout-execution.test.ts` (7)

4. STAGING: DEPLOY → HEALTH → SMOKE → VERIFY → DEPLOYED, Live-Code unverändert
5. STAGING mit Fehlerinjektion: FAILURE → DETECT → ROLLBACK → VERIFY PREVIOUS STATE
6. kritischer Health-Fehler löst denselben kontrollierten Rollback aus
7. PRODUCTION: ORB veröffentlicht nicht selbst – Halt vor der Veröffentlichung
8. ohne Deployment-Freigabe passiert nichts
9. nach der Freigabe geänderter Diff blockiert den Rollout
10. veränderter Zielstand seit dem Sandbox-Test blockiert den Rollout

## 2 · Ursprüngliche Funktion (geprüfte Eigenschaft)

| Test | Eigentlich geprüfte Eigenschaft |
| --- | --- |
| 1 | Reproduktionspflicht + Patch-Anwendung + Diff-Integrität + Testpipeline in der Sandbox |
| 2, 3 | Freigabe-Bindung (Fingerabdruck), keine Ausführung ohne gültige Freigabe |
| 4 | vollständiger Rollout-Ablauf, Live-Code bleibt unverändert |
| 5, 6 | Fehlererkennung → kontrollierter Rollback → Nachweis des Vorzustands |
| 7 | Production wird nicht selbst veröffentlicht (Human-Gate) |
| 8, 9, 10 | Deployment-Freigabe, Diff-Bindung, Basisstand-Bindung |

Keiner dieser Tests prüft ORB-Fachlogik. Der frühere Erinnerungsfehler diente ausschliesslich als **Vorlage für einen reproduzierbaren Ausgangszustand**.

## 3 · Warum die alte Vorlage nach P15 ungültig war

`buildCase()`/`approvedFix()` riefen `diagnoseMemoryRecallCase()` und `proposalFromDiagnosis()` auf. Seit P15 ist die Ursache behoben, die Diagnose meldet korrekt `ROOT_CAUSE_PLAUSIBLE`, und `proposalFromDiagnosis()` verweigert – wie vorgesehen – den Vorschlag. Damit fehlte die Vorlage; zusätzlich wäre der Patch nicht mehr anwendbar und der frühere Fehler im Basisstand nicht mehr reproduzierbar. Das ist **korrektes Verhalten der Diagnose**, kein Fehler.

## 4 · Neue Testvorlage

Neu: `tests/helpers/orb-dev-synthetic-fix.ts` (reine Testdatei, kein Produktionscode)

- `SYNTHETIC_DIFF`: anwendbarer Patch, der **ausschliesslich zwei neue Dateien** anlegt – `src/orb-core/sandbox-probe.p16.ts` (Marker-Funktion, keine ORB-Logik) und `tests/orb-sandbox-probe.regression.test.ts`.
- Reproduktionsnachweis: im unveränderten Basisstand fehlt das geprüfte Modul → der mitgelieferte Test scheitert (`failureConfirmed = true`); nach dem genehmigten Patch ist er grün.
- `syntheticProvenDiagnosis(level)`: synthetische Diagnose mit einstellbarer Ursachenklasse – ausschliesslich für die Klassifikationsprüfung.
- `syntheticProposal(fixId, operations?)`: Fix-Vorschlag, erzeugt **keine** Freigabe.

Beide Dateien existieren nur innerhalb der isolierten Sandbox-/Rollout-Kopie. Der Produktionscode wird **nicht** in den alten Fehlerzustand zurückversetzt, es gibt keinen neuen Produktions-Fallback und keine Abschwächung der Diagnose.

## 5 · Nachweis der unveränderten Produktionslogik

- Geändert: `tests/orb-dev-sandbox-execution.test.ts`, `tests/orb-dev-rollout-execution.test.ts`, neu `tests/helpers/orb-dev-synthetic-fix.ts`, neu dieser Bericht.
- **Nicht geändert:** `src/orb-core/**` (Relevanzformel, Relevanzfilter, Informationsbereichserkennung, Memory, Graph, Autonomie, Curiosity, Energy, Prompt/Modell), `src/orb-dev/**` (Diagnose, Vorschlag, Freigabe, Sandbox, Rollout, Richtlinien), Datenbank, Schema, Migrationen.
- Beide Testdateien prüfen nach jedem Durchlauf `git status --porcelain` bzw. `git status --porcelain src/orb-core`: der Arbeitsbaum bleibt unverändert.

## 6 · Vorher / Nachher der 10 Tests

| Test | vorher | nachher |
| --- | --- | --- |
| 1 | rot – „Ursache ist ROOT_CAUSE_PLAUSIBLE – kein Fix-Vorschlag erlaubt.“ | grün (synthetische Vorlage, `PASSED`, Sandbox aufgeräumt) |
| 2, 3 | rot – gleiche Ursache | grün (`APPROVAL_INVALID`, kein Patch) |
| 4 | rot – gleiche Ursache | grün (`DEPLOYED`, `liveCodeChanged = false`) |
| 5, 6 | rot – gleiche Ursache | grün (`ROLLED_BACK`, Rollback verifiziert) |
| 7 | rot – gleiche Ursache | grün (`READY_FOR_DEPLOYMENT`, wartet auf Menschen) |
| 8 | rot – gleiche Ursache | grün (`DEPLOYMENT_APPROVAL_REQUIRED`) |
| 9 | rot – gleiche Ursache | grün (`DEPLOYMENT_APPROVAL_INVALID`) |
| 10 | rot – gleiche Ursache | grün (`PRODUCTION_BASE_CHANGED`) |

Zusätzlich 4 neue Tests („Ursachenklassifikation bleibt streng (P16)“) im Sandbox-Testfile.

## 7 · Regressionsnachweise A–G

| Punkt | Nachweis | Ergebnis |
| --- | --- | --- |
| A · P15-Fix aktiv | `tests/orb-p15-information-domain.test.ts` (13 Tests) unverändert | grün |
| B · „Wie alt bin ich?“ | Informationsbereich `alter`, Relevanz 0.120, Erinnerung gefunden | grün |
| C · „Wo wohne ich?“ | Informationsbereich `wohnort`, Relevanz 0.120, Erinnerung gefunden | grün |
| D · unpassende Erinnerung | weiterhin 0.000, verworfen | grün |
| E · echte Fehlererkennung | synthetische Diagnose `ROOT_CAUSE_PROVEN` → Vorschlag entsteht | grün |
| F · behobener Fehler | `diagnoseMemoryRecallCase()` ≠ `ROOT_CAUSE_PROVEN` → **kein** Vorschlag | grün |
| G · Human Approval | ohne Freigabe ungültig; Quelle `llm` ungültig; nur `admin_ui` gültig | grün |

## 8 · Human-Approval-Gates (unverändert)

- Diagnose liefert ausschliesslich Befunde; Vorschläge nur bei bewiesener Ursache.
- Kein Patch wird automatisch angewendet: Sandbox verlangt Freigabe + exakten Fingerabdruck.
- Rollout verlangt eine getrennte Deployment-Freigabe; PRODUCTION hält vor der Veröffentlichung an.
- Freigabequellen `llm`, `memory`, `graph`, `system_prompt`, `autonomous` bleiben verboten.

## 9 · Testresultate

- Logiktests: **1419 grün** in 89 Dateien (vorher 10 rot).
- Datenbank-/Sicherheitstests: **102 grün**.
- Typprüfung (`tsgo --noEmit`): fehlerfrei. Lint (`src/orb-core`, `src/orb-dev`, `src/orb-sdk`, `tests`): sauber. Build: OK.
- P16 selbst erzeugte **0 Modellaufrufe** (0,00 €). Hinweis: der vorbestehende Test `tests/orb-request-optimization-p1.test.ts` führt weiterhin echte Modellaufrufe im vollständigen Durchlauf aus – unverändert und nicht Teil von P16.

## 10 · Offene Punkte

- `src/orb-dev/fixes/memory-recall-age.patch.ts` und der Diagnosefall `ORB-DIAG-MEMORY-RECALL-AGE` bleiben als historische Vorlage im Code; sie werden von keinem Test mehr als Ausführungsgrundlage benutzt. Eine Ausmusterung wäre eine Produktionsänderung und braucht eine eigene Freigabe.
- Ältere offene Punkte aus P7/P9/P11 (Untererfassung der DB-Zählung, 40/43-Fälle, 134 historische Modellaufrufe) sind unverändert.

**STOPP** – keine weiteren Änderungen ohne neue Freigabe.
