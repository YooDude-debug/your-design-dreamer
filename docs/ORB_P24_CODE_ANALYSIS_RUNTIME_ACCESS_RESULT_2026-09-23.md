# P24 – Codeanalyse: Runtime- und Dateizugriff (Untersuchung, 2026-09-23)

Modus: read-only. Kein Patch, kein Deployment, keine Veröffentlichung, 0 Modellaufrufe.

## A) In welcher Runtime läuft der echte Chat?

**Nicht in der Entwicklungsumgebung (Sandbox), sondern in einer gebauten, gehosteten Server-Laufzeit.**

- BEWIESEN: Jeder Modellaufruf schreibt `console.info("[orb.obs.model_call]", …)`
  (`src/orb-core/observability.server.ts:118–119`). Im Vite-Protokoll der Sandbox
  (`daemon_logs`, 46 Zeilen) gibt es **0** solche Zeilen, obwohl das Gateway für 17:24–17:55
  vier ORB-Aufrufe verzeichnet → die Aufrufe liefen nicht auf dem Sandbox-Server.
- BEWIESEN: Die Anfrage 17:24:30Z enthielt bereits das P22-Feld `tools` → der ausführende
  Build enthält den P22-Stand.
- BEWIESEN: Die Serverseite wird als Worker gebaut (`vite.config.ts:4`: „nitro … cloudflare as
  a default target“).
- WAHRSCHEINLICH: gehostete Vorschau (Build des aktuellen Stands). Seit P22 wurde von mir nichts
  veröffentlicht; eine Veröffentlichung durch Sie ist mir nicht bekannt, der Zeitpunkt der
  letzten Veröffentlichung ist über die verfügbaren Einstellungen nicht abrufbar → Published App
  UNBEKANNT, aber nur möglich, falls danach veröffentlicht wurde. Für den Befund C/D ist das
  gleichgültig: beide sind derselbe Worker-Typ.

## B) Wo liegen die Projektdateien?

- In der Sandbox unter `/dev-server/{src,tests,docs}` (BEWIESEN, dort liefen die P22-Tests).
- In der gehosteten Laufzeit liegt **nur das gebündelte JavaScript**. Quelldateien, `tests/`
  und `docs/` werden nicht mitgeliefert; das Dateisystem dort ist virtuell (BEWIESEN durch
  Plattform-Laufzeitmodell „virtual filesystem“, und durch P23: selbst `core` und
  `provider.server.ts:218 tools:` wurden nicht gefunden).

## C) Warum kann `orb.code_analysis` sie dort nicht lesen?

1. `projectRoot()` = `process.cwd()` (`code-read.server.ts:36–40`). Unter diesem Pfad existiert
   im Worker kein `src/`.
2. `collectCodeFiles` fängt den `stat`-Fehler des Wurzelziels still ab
   (`code-read.server.ts:114–118: catch { continue; }`) und gibt `[]` zurück. Der dafür
   vorgesehene `CodeAccessUnavailableError` (Z. 28–33, 46–52) wird dadurch **nie** ausgelöst.
3. `analyseTarget` läuft mit leerer Liste weiter; `runCodeAnalysis` setzt unbedingt
   `COMPLETED` (`code-analysis.server.ts` im Block nach `Promise.race`), `confidence: "none"`.
   Der vorhandene Zweig `ANALYSIS_UNAVAILABLE` ist erreichbar gebaut, aber praktisch tot.

Der P21-Zugriff ist also **nicht falsch verdrahtet**, sondern an eine Voraussetzung gebunden
(echtes Projektdateisystem), die nur in der Sandbox erfüllt ist.

## D) Art des minimalen Fixes

Eine reine Runtime-Verlagerung ist **nicht möglich**: Die gehostete Laufzeit kann die Sandbox
nicht erreichen, und es gibt keinen anderen Server mit den Dateien.
Technisch mögliche Wege (nur beschrieben, keine Wertung):

| Weg | Was | Folgen |
|---|---|---|
| D1 Bereitstellung beim Build | Beim Bauen werden ausschliesslich `src/`, `tests/`, `docs/` (gleiche Sperrliste, Maskierung wie P21) als serverseitiger, nicht öffentlicher Lesebestand in das Server-Bundle aufgenommen; `code-read` liest daraus statt aus `process.cwd()`. | Kein neuer Zugang, keine Secrets, kein beliebiges Dateisystem. Aber: Codeinhalt liegt als Kopie im Server-Bundle (widerspricht wörtlich „keinen Code kopieren“ → braucht Ihre ausdrückliche Entscheidung); Bundle wird grösser; Stand = Build-Stand. |
| D2 Lesen aus dem Code-Repository | Dateien über eine angebundene Quellcode-Verbindung lesen. | Braucht eine Verbindung/Zugangsdaten, die heute nicht existiert; neuer externer Pfad. |
| D3 Keine Bereitstellung | Codeanalyse bleibt auf die Sandbox beschränkt; gehostet wird ehrlich „nicht verfügbar“ gemeldet. | Kleinster Eingriff; Ziel „im echten Chat lesen“ wird nicht erreicht. |

**Unabhängig vom Weg zwingend:** Teil E.

## E) Leeres Ergebnis ≠ erfolgreiche Analyse

Heutige Zustände: `COMPLETED`, `ANALYSIS_DENIED`, `ANALYSIS_UNAVAILABLE`, `ANALYSIS_FAILED`.
Geforderte Zuordnung (Entwurf):

| Gefordert | Bedingung | heute |
|---|---|---|
| SUCCESS_WITH_FILES | `filesExamined.length > 0` | `COMPLETED` |
| NO_FILES_FOUND | Wurzel lesbar, Ziel existiert/leer, 0 Dateien | fälschlich `COMPLETED` |
| CODE_ACCESS_UNAVAILABLE | Projektwurzel/`src` nicht vorhanden | fälschlich `COMPLETED` (Zweig existiert, wird nie erreicht) |
| ACCESS_DENIED | Vertrag/Scope/Adminrolle | `ANALYSIS_DENIED` |
| ANALYSIS_FAILED | Timeout/Fehler | `ANALYSIS_FAILED` |

Minimale Änderungen (nicht angewendet):
1. `collectCodeFiles`: Fehler beim Wurzelziel nicht verschlucken; fehlende Projektwurzel →
   `CodeAccessUnavailableError`.
2. `runCodeAnalysis`: `COMPLETED`/`SUCCESS_WITH_FILES` nur bei `filesExamined > 0`,
   sonst `NO_FILES_FOUND`; ohne gelesene Datei keine Befunde/Vorschläge ausgeben.
3. Veraltete Aussage: `CODE_NO_TOOL_PROTOCOL` / `CODE_ACCESS_WITHOUT_UI`
   (`code-analysis.server.ts:267–330`) entstehen aus „0 Treffer“ und sind seit P22 überholt.
   Sie dürfen nur bei gelesenen Dateien entstehen (besser: entfallen); die Aussage „kein
   Werkzeug“ ist nur zulässig, wenn im Zug kein Werkzeug übergeben wurde
   (`prepareCodeToolRuntime` → `null`).
4. Werkzeugausgabe trägt einen eindeutigen Hinweis „0 Dateien gelesen – keine Analyse
   behaupten“, damit das Modell den echten Zustand nennt.
5. Test in einer Umgebung ohne Projektdateien (fake `cwd`) → muss `CODE_ACCESS_UNAVAILABLE` liefern.

Nicht berührt: Memory, Retrieval, Graph, Curiosity, Energy, Autonomie, P20,
Berechtigungen, Freigabe-Gates. Folgezüge ohne Marker bleiben werkzeuglos (P23 F3, getrennt).

ABSOLUTER STOPP.
