# P25 – Codeanalyse: gehosteter Lesezugang (D1) + ehrliche Zustände (E)

Freigabe: D1 + E (Mario J., 2026-09-23). Kein Deployment, keine Veröffentlichung, kein Auto-Patch.

## Änderungen

| Datei | Zweck |
|---|---|
| `vite-plugins/orb-code-snapshot.ts` (neu) | Build-Plugin: erzeugt `virtual:orb-code-snapshot` aus `src/`, `tests/`, `docs/`. Gleiche Scope-/Sperrregeln wie P21 (`normalizeCodeTarget`), Maskierung per `redactSecrets` **vor** dem Einbetten, nur `.ts/.tsx/.md/.sql/.css` ≤ 240 kB, keine JSON-Daten, keine Zeitstempel (reproduzierbar, SHA-256 in `meta`). Browser-Umgebung erhält einen leeren Stub. |
| `vite.config.ts`, `vitest.config.ts` | Plugin registriert. |
| `src/orb-core/toolbox/code-snapshot.server.ts` (neu), `code-snapshot.d.ts` | Lazy-Laden des Bestands, nur serverseitig. |
| `src/orb-core/toolbox/code-read.server.ts` | Quellenabstraktion: echte Dateien (Entwicklung) → sonst Lesebestand (gehostet) → sonst `CodeAccessUnavailableError`. Kein stilles `[]` mehr bei fehlendem Codezugang. Fehlende Einzeldatei = „existiert nicht“, nicht „kein Zugang“. |
| `src/orb-core/toolbox/code-contract.ts` | Zustände: `SUCCESS_WITH_FILES`, `NO_FILES_FOUND`, `CODE_ACCESS_UNAVAILABLE`, `ACCESS_DENIED`, `ANALYSIS_FAILED`; Feld `codeSource`. |
| `src/orb-core/toolbox/code-analysis.server.ts` | Erfolg nur bei ≥ 1 gelesener Datei; sonst `NO_FILES_FOUND` ohne Befunde/Vorschläge. `CODE_NO_TOOL_PROTOCOL` nur noch, wenn `src/orb-core/llm` tatsächlich gelesen wurde; `CODE_ACCESS_WITHOUT_UI` nur mit gelesenen Dateien. |
| `src/orb-core/llm/code-tool.server.ts` | Werkzeugausgabe enthält `codeSource`, `filesRead` und einen ausdrücklichen Hinweis: ohne gelesene Datei keine Analyse behaupten, Status nennen, Werkzeug ist vorhanden. |
| Tests | `tests/orb-p25-code-hosted-access.test.ts` (neu, 9); P21/P22-Statusnamen angepasst. |

Nicht berührt: Memory, Retrieval, Graph, Curiosity, Energy, Autonomie, P20, Admin-Prüfung, Freigabe-Gates, Modell, Modellaufrufzahl.

## Nachweise

- Produktions-Build (`vite build`, Worker-Ziel): **erfolgreich**.
  - Lesebestand liegt ausschliesslich in `dist/server/_virtual_orb-code-snapshot-*.mjs` (8,58 MB, 2,32 MB gzip, ~955 Dateien).
  - `dist/client` (öffentliche Ressourcen): **0** Treffer auf Bestandsinhalte.
  - Kein `sk-…`-Schlüsselmuster im Bestand.
  - Kein Download-Endpunkt, keine Route, kein Schreibpfad hinzugefügt.
- Tests: **1471/1471** in 93 Dateien grün; Typecheck, Lint und Vorschau-Build grün.

| Test (Auftrag) | Ergebnis |
|---|---|
| 1 Gehostete Laufzeit | Simuliert: Analyse mit erzwungener Quelle = Lesebestand (`codeSource: "snapshot"`). Echter gehosteter Lauf: **nicht von mir ausführbar** (siehe unten). |
| 3–5 Echte Datei `src/orb-core/llm/provider.server.ts` | `SUCCESS_WITH_FILES`, `filesExamined = [provider.server.ts]`, Evidence mit Datei/Zeile, Befund `CODE_TOOL_PROTOCOL_PRESENT`, kein `CODE_NO_TOOL_PROTOCOL`. |
| 6 Keine Schreiboperation | Keine Schreibfunktionen in Lesepfad/Plugin; Flags `codeChanged/patchApplied/deployed=false`. |
| 7 Secrets unerreichbar | `.env`, `node_modules/…`, JSON-Daten ⇒ nicht lesbar; Maskierung vor dem Einbetten. |
| 8 Keine Projektdateien | `CODE_ACCESS_UNAVAILABLE`, 0 Dateien, keine Befunde, keine Vorschläge. |
| Leeres Ziel | `NO_FILES_FOUND` statt Erfolg. |
| Ohne Admin | `ACCESS_DENIED`. |

## Offen / nicht verifiziert

- **Echter Chattest in der gehosteten Vorschau: NICHT durchgeführt.** Er braucht Ihre Admin-Sitzung in der gehosteten Vorschau und löst echte Modellaufrufe aus. Bitte nach dem Neuaufbau der Vorschau senden:
  „Codeanalyse: Prüfe src/orb-core/llm/provider.server.ts und erkläre, ob die aktuelle Sprachschicht orb.analysis als Modellwerkzeug anbietet. Nichts ändern.“
  Erwartung: Werkzeugstatus `SUCCESS_WITH_FILES`, `codeSource: snapshot`, ≥ 1 Datei gelesen. Danach Forensik aus den Gateway-Protokollen möglich.
- Die veröffentlichte App ist unverändert (keine Veröffentlichung).
- Der Lesebestand zeigt den Stand beim Build, nicht Live-Änderungen.
- Die Worker-Bundlegrösse wächst um ca. 2,3 MB (gzip); das Plattformlimit wurde nicht separat geprüft.
- Weiterhin offen: P23 F3 (Werkzeugergebnisse nicht über Folgezüge erhalten), zusätzliche Modellaufrufe durch die Werkzeugschleife (P22), `max_tokens` in `openai.server.ts`.

ABSOLUTER STOPP.
