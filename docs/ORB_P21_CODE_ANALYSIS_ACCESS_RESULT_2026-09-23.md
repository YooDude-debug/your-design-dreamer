# P21 – ORB CODE ANALYSIS ACCESS (`orb.code_analysis`)

Datum: 2026-09-23 · Modus: Umsetzung auf freigegebenem Auftrag · READ-ONLY
Referenzen: P17 Runtime-Wiring, P18/P19/P20 Memory-Retrieval

**Kein Deployment. Keine Veröffentlichung. Keine Migration. Keine Datenmutation.
Kein Patch aus der Analyse. 0 Modellaufrufe.**

---

## 1. Neue und erweiterte Dateien

Neu:

| Datei | Zweck |
|---|---|
| `src/orb-core/toolbox/code-contract.ts` | Vertrag: Fähigkeitskennung, READ/WRITE-Grenze, Lesebereich, Secret-Maskierung, Anforderungs-/Ergebnisform, Selbstfeststellung |
| `src/orb-core/toolbox/code-read.server.ts` | begrenzter, rein lesender Dateizugriff (lesen, auflisten, suchen, Referenzen verfolgen) |
| `src/orb-core/toolbox/code-analysis.server.ts` | Analyseausführung: Vertragsprüfung → Idempotenz → Administratorprüfung → lesende Analyse |
| `tests/orb-p21-code-analysis.test.ts` | 12 Testfälle (Pflichtpunkte 1–14 + Idempotenz + Beobachtbarkeit + End-to-End) |

Erweitert (minimal):

| Datei | Änderung |
|---|---|
| `src/orb-core/toolbox/contract.ts` | Registry-Eintrag `orb.code_analysis` (`kind`, `scope`), `OrbCapabilityId` als Union |
| `src/orb-core/toolbox/access.server.ts` | Resolver löst beide Fähigkeiten auf; `requestOrbCodeAnalysis` |
| `src/orb-sdk/orb-core.server.ts` | `requestCodeAnalysis(...)` als einzige SDK-Tür |
| `src/lib/orb-toolbox.functions.ts` | `orbToolboxCodeAnalyze` (Admin + Prüfprotokoll), `orbToolboxCodeWriteDenied` |
| `tests/orb-analysis-access.test.ts` | Erwartung „genau eine Fähigkeit" → beide Kennungen (nur Test) |

Es entsteht **keine zweite Analysearchitektur**: gleicher Toolbox-Pfad, gleicher
Resolver, gleiches Verzeichnis, keine neue Tabelle, keine Migration, kein neues
Memory-/Graph-System, kein neues Modell, kein allgemeines Tool-Calling.

## 2. Capability Contract

```
{ capability: "orb.code_analysis", mode: "read_only",
  target: "src/orb-core/...", question: "...", reason: "...",
  requestId: "orb_ca_xxxxxxxx", source: "orb_internal" }
```

Ergebnis (strukturiert): `requestId`, `capability`, `mode`, `source`, `target`,
`question`, `status`, `timestamp`, `durationMs`, `filesExamined`, `findings`
(je Befund `code`, `severity`, `summary`, `evidence[]`), `evidence`
(`file`, `line`, `symbol`, `excerpt`), `confidence`, `unknowns`,
`proposedChange`, `affectedTests`, `failureKind` sowie die unveränderlichen
Nachweise `readOnly: true`, `codeChanged/dbChanged/patchApplied/migrationRun/
deployed/approvalCreated/secretsAccessed: false`, `modelCalls: 0`.

Jeder Befund trägt Datei + Zeile + nächstliegendes Symbol. Fehlt Evidenz, wird
der Punkt als `unknowns` geführt – keine freie Behauptung.

## 3. Runtime-Wiring

```
ORB (SDK: createOrbCore().requestCodeAnalysis)
 → access.server.ts#requestOrbCodeAnalysis / resolveOrbCapability("orb.code_analysis")
 → code-analysis.server.ts#runCodeAnalysis   (Vertrag → Idempotenz → has_role)
 → code-read.server.ts                       (Datei lesen / auflisten / suchen)
 → strukturierter Befund
 → menschliche Freigabe (getrennt, unverändert)
```

Admin-Weg zusätzlich: `orbToolboxCodeAnalyze` (Serverfunktion, `requireSupabaseAuth`
+ `assertAdmin`). Kein öffentlicher Endpunkt, kein `api/public`-Pfad.

## 4. Security

- Ausführung nur im geschützten internen Serverkontext; bestehende
  `has_role`-Prüfung unverändert, fehlende Rolle ⇒ `ANALYSIS_DENIED`.
- Kein beliebiger Dateisystemzugriff: Lesebereich fest `src`, `tests`, `docs`;
  absolute Pfade, `..`, Backslashes und Null-Bytes werden abgelehnt.
- Ausgeschlossen: `.env*`, `.git`, `node_modules`, Build-Ausgaben, `.lovable`,
  `.workspace`, `.agents`, `.claude`, `*.pem/key/p12/pfx`, `secrets.*`.
- Zugangsdaten werden vor jeder Ausgabe maskiert (`sk-…`, `sb_secret_…`, JWT,
  `Bearer …`, `whsec_…`, `ghp_…`, sowie Zuweisungen an `*KEY*`, `*SECRET*`,
  `*TOKEN*`, `*PASSWORD*`, `SERVICE_ROLE_KEY`).
- Obergrenzen: 240 kB je Datei, 40 Zieldateien, 600 Suchdateien, 80 Treffer,
  240 Zeichen je Auszug, Zeitgrenze 15 s.
- Keine Chattexte, keine personenbezogenen Inhalte im Ergebnis oder Protokoll.

## 5. Read/Write-Grenze

READ erlaubt: `read_file`, `list_directory`, `search_code`, `follow_reference`,
`read_test`, `read_report`.

WRITE gesperrt: `write_file`, `apply_patch`, `migration`, `deployment`,
`publish`, `secret_access` – `checkCodeOperationAllowed` lehnt jede dieser
Operationen mit Begründung ab; `requestCodeWriteOperation` liefert stets
`allowed: false`. `code-read.server.ts` enthält keinen Schreibaufruf,
`code-analysis.server.ts` keinen Tabellenzugriff (im Test nachgewiesen).

## 6. Human-Approval-Gates

`ANALYSE ≠ FREIGABE`, `PROPOSAL ≠ PATCH`, `PATCH ≠ DEPLOYMENT`. Jeder
`proposedChange` trägt `requiresHumanApproval: true` und `applied: false`;
`approvalCreated` ist immer `false`. Die Codeanalyse erzeugt selbst keinen
Fix-Vorschlag in der Reparaturstrecke und keine Freigabe.

Auslösung: nur `orb_internal`, `admin_ui`, `admin_chat` mit technischem Grund
(≥ 12 Zeichen). Normale Nachrichten, autonome Fragen, Neugier, Gedächtnis,
Graph, Prompt und Modell sind ausdrücklich gesperrt; `engine.server.ts`
importiert die Codeanalyse nicht (im Test nachgewiesen).

## 7. End-to-End-Test (echt, ohne Produktionsänderung)

Frage: „Warum kann ich `orb.analysis` aktuell nicht als Tool aufrufen?"
Ziel: `src/orb-core/llm` · Status `COMPLETED` · `confidence: high`

- gelesen: `openai.server.ts`, `prompt.server.ts`, `provider.server.ts`,
  `select.server.ts`
- `CODE_STRUCTURE`: 11 öffentliche Symbole mit Datei/Zeile
  (z. B. `provider.server.ts:33 speakViaLovableGateway`,
  `select.server.ts:25 OrbLlmResult`)
- `CODE_NO_TOOL_PROTOCOL` (error): keine Werkzeugliste (`tools` / `tool_choice`)
  in den Modellanfragen; Evidenz `openai.server.ts:103`
- `CODE_ACCESS_WITHOUT_UI` (warning): `src/lib/orb-toolbox.functions.ts` ohne
  Importeur im Projektcode
- `affectedTests`: `tests/orb-analysis-access.test.ts`,
  `tests/orb-p21-code-analysis.test.ts`
- `proposedChange`: F1/F2 nur **beschrieben**, `applied: false`

Damit ist der P17-Befund selbstständig und mit Code-Evidenz nachvollzogen.

## 8. Tests

Pflichtpunkte 1–14 abgedeckt (Discovery, erlaubte Read-only-Analyse, echte
Dateien, Fehler nachvollzogen, Datei/Funktion als Evidenz, Secrets unzugänglich,
Schreiben/Patch/Deployment verweigert, fehlende Berechtigung abgelehnt, normale
Nachricht und autonome Frage ohne Wirkung, Fehler blockiert nicht, Freigabe
bleibt erforderlich) plus Idempotenz und Beobachtbarkeit.

Ergebnis: **1452 Logiktests grün** (91 Dateien, 12 neu), **102 DB-/Sicherheits-
tests grün**, `tsgo --noEmit` fehlerfrei, Lint sauber.

## 9. Beobachtbarkeit und Idempotenz

Jedes Ergebnis trägt `requestId`, `timestamp`, `capability`, `source`, `target`,
`status`, `durationMs`, `failureKind`. Der Admin-Weg schreibt zusätzlich einen
Eintrag in das vorhandene anfügende Prüfprotokoll – nur technische Kennungen,
keine Inhalte, keine Schlüssel. Gleiche `requestId` liefert dasselbe Ergebnis
ohne zweite Ausführung (Ablage für 50 Kennungen im Prozess).

## 10. Fehlerisolation

`ANALYSIS_UNAVAILABLE` (kein Dateizugriff / Ziel existiert nicht),
`ANALYSIS_DENIED` (Vertrag, Quelle, Berechtigung), `ANALYSIS_FAILED`
(Zeitüberschreitung, Analysefehler). Es wird nie geworfen; ORB arbeitet normal
weiter.

## 11. Risiken und bekannte Grenzen

- Der Dateizugriff setzt ein Laufzeitumfeld mit lesbarem Projektverzeichnis
  voraus. Im veröffentlichten Worker-Umfeld kann er fehlen; die Analyse meldet
  dann `ANALYSIS_UNAVAILABLE` (nicht geprüft, da kein Deployment).
- Die Idempotenzablage liegt im Prozessspeicher, nicht in der Datenbank; nach
  einem Neustart ist eine gleiche Kennung wieder ausführbar (eine
  Auftragstabelle wäre eine Migration und ist nicht freigegeben).
- Die Secret-Maskierung ist bewusst grob; sie kann harmlose Zeilen maskieren.
- Die Analyse ist deterministische Codesuche, kein Sprachverständnis: die
  Trefferqualität hängt von den Begriffen der Frage ab (`unknowns` weist das aus).
- Weiterhin offen (eigene Freigabe nötig): F1/F2 aus P17, Admin-Ansicht für
  Analysen, `max_tokens` in `openai.server.ts:107` (vorbestehend),
  historische Fehlervorlage in `src/orb-dev/fixes/*`.

**ABSOLUTER STOPP nach erfolgreichem Test.**
