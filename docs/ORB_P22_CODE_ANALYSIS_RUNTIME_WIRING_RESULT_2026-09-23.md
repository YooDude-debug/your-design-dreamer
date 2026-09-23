# P22 – Runtime-Wiring für `orb.code_analysis` (2026-09-23)

## Ergebnis
DISCOVERED: YES · RESOLVED: YES · INJECTED: YES · CALLABLE: YES · PASSED_TO_RUNTIME: YES
Kein Patch aus der Analyse, kein Deployment, keine Veröffentlichung, keine Migration, keine Datenänderung.

## Exakte Runtime-Änderung
- **Neu** `src/orb-core/llm/code-tool.server.ts`: ausdrückliche Erkennung (`Codeanalyse:` / `/codeanalyse` am Nachrichtenanfang), Admin-Prüfung (`has_role`) vor der Injection, Tooldefinition, Laufzeitkontext, begrenzte Schleife (MAX_TOOL_ROUNDS = 3, danach `tool_choice: "none"`).
- `src/orb-core/llm/provider.server.ts`: `gatewayCodeToolStep` – gleicher Endpunkt, gleiches Modell `openai/gpt-6-astra`, gleiches Streaming, zusätzlich `tools: [tool]`. Kein `max_tokens`. `OrbLlmMeta.codeTool` (nur Kennungen/Kennzahlen).
- `src/orb-core/llm/select.server.ts`: optionales `codeTool`; Fehler/Ausfall ⇒ unveränderter bisheriger Pfad.
- `src/orb-core/engine.server.ts`: `speak()` reicht `codeTool` nur durch, wenn gesetzt – der Normalaufruf ist wortgleich. `processInput` bereitet den Kontext nur im Nutzer-Antwortzweig und nur bei `source === "user_stated"` vor.

## Tooldefinition
Modellname `orb_code_analysis` (Punkte in Funktionsnamen unzulässig) → Laufzeit-Zuordnung auf `orb.code_analysis`. Parameter: `target`, `question`, `reason`. Genau ein Werkzeug; kein allgemeines Tool-System.

## Injection / Callable-Aufruf
Ausführung ausschliesslich über den bestehenden P21-Zugang `requestOrbCodeAnalysis` → `runCodeAnalysis` (Vertrag, Lesebereich, Maskierung, Idempotenz, Admin-Gate unverändert), `source: "admin_chat"`, `mode: "read_only"`. Anforderungskennung = Ereigniskennung + Aufrufindex ⇒ idempotent. Ergebnis (gekürzt, maskiert) als `function_call_output` zurück an das Modell.

## Security
- Admin-Gate doppelt: vor der Injection und erneut im P21-Zugang.
- Serverintern; keine neue Route, keine neue Serverfunktion, keine Credentials im Werkzeugkontext (Datei liest kein `process.env`).
- Normale Nachrichten, autonome Fragen, Neugier, proaktive Pfade und Gedächtnis erhalten kein Werkzeug (einzige Aufrufstelle, per Test geprüft).
- Unbekanntes Werkzeug, kaputte Argumente, Fehler ⇒ isoliert abgelehnt, ORB antwortet weiter.

## Keine Schreibrechte
Read-only-Grenze aus P21 unverändert (src/, tests/, docs/; `.env`, Pfade ausserhalb, `supabase/` abgelehnt – getestet). Ergebnis trägt `readOnly: true`, `patchApplied: false`.

## End-to-End-Nachweis (echtes Modell, nur lesend)
Frage: „Codeanalyse: Warum konnte ich `orb.analysis` bisher nicht als Tool aufrufen? …"
- Ereignis `evt_bb751d22-…`, 3 Modellaufrufe (2 Werkzeugrunden + Antwort).
- Aufruf 1 `orb_ca_ebb751d2…00`, Ziel `src/orb-core/llm`, COMPLETED, gelesen: openai/prompt/provider/select/code-tool.server.ts.
- Aufruf 2 `orb_ca_ebb751d2…01`, Ziel `src/orb-core/llm/code-tool.server.ts`, COMPLETED.
- Antwort bestätigt mit Zeilenbelegen: in der Sprachschicht existiert keine Anbindung für `orb.analysis`; nur das eine Werkzeug `orb.code_analysis` ist verdrahtet (P17-Befund B1 für `orb.analysis` bestätigt). Änderungsweg nur beschrieben (eigener Adapter `orb_analysis` → `orb.analysis`), nicht angewendet.

## Tests
- Neu `tests/orb-p22-code-tool-runtime.test.ts` (10): Tool-Scope, ausdrückliche Erkennung, Permission (Admin/Nicht-Admin/Ausfall), Idempotenz, echter Dateilesezugriff, Scope-Grenzen, Failure Isolation, Rundenbegrenzung, Wiring-Stelle, keine Schreib-APIs – 0 Modellaufrufe.
- `tests/orb-p21-code-analysis.test.ts`: zwei Erwartungen auf neuen Stand gesetzt (Befund „kein Werkzeug-Protokoll" ist seit P22 korrekt nicht mehr vorhanden).
- 1462 Logiktests grün, 102 DB-/Sicherheitstests grün, Typprüfung fehlerfrei, Lint sauber.

## Grenzen
- Veröffentlichte Umgebung besitzt keine Projektdateien ⇒ dort meldet die Codeanalyse `ANALYSIS_UNAVAILABLE` (P21-Grenze); funktionsfähig in der Vorschau/Entwicklung.
- Ausdrückliche Anforderung kostet bis zu 4 Modellaufrufe (nur mit Marker + Admin).
- Werkzeugpfad nutzt die bestehende Gateway-Sprachschicht, nicht den OpenAI-Experimentpfad.
- `orb.analysis` selbst ist weiterhin kein Modell-Werkzeug (nicht beauftragt).
