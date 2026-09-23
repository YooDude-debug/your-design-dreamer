# P23 – Forensik: echter `orb.code_analysis`-Aufruf (2026-09-23)

Modus: read-only. Kein Patch, keine Datenänderung, kein Deployment, 0 zusätzliche Modellaufrufe.
Evidenz ausschliesslich aus AI-Gateway-Protokollen (Request-Bodies), `orb_messages` und Code.

## 0. Kurzantwort

Das Werkzeug wurde **wirklich** angefordert, ausgeführt und sein Ergebnis dem Modell zurückgegeben.
Aber: **es wurde keine einzige Datei gelesen**, und das Ergebnis enthielt einen veralteten,
inzwischen falschen Befund („kein Werkzeug-Protokoll“). Die spätere „Selbstkorrektur“ von ORB
entstand in einem Folgezug **ohne** Werkzeug und ohne Zugriff auf das frühere Werkzeugergebnis.

| Klassifizierung | Wert | Evidenz |
|---|---|---|
| TOOL_REQUESTED | **YES** | Gateway `01a0cf4c-1ddf-7e15-bea3-7ec8f46af6b8` (17:24:30Z): Request enthält `tools:[orb_code_analysis]`, `tool_choice:"auto"`, Input `/codeanalyse` |
| TOOL_EXECUTED | **YES** | Folge-Request `01a0cf4c-2c58-7b34-9e1c-6a7247eb1cee` (17:24:35Z) enthält `function_call` `call_mElOHEFmMHBq9rSnSXG3x1Ds` + `function_call_output` mit `requestId orb_ca_ead1d5c9f1afb414bbcd835eddcd6100`, `status COMPLETED` |
| FILE_READ | **NO** | im selben Output: `"filesExamined":[]`, `"confidence":"none"`, kein `CODE_STRUCTURE`-Befund, alle Suchbegriffe (auch „core“) „kommt im Ziel nicht vor“ |
| RESULT_RETURNED | **YES** | `function_call_output` mit gleicher `call_id` im zweiten Request |
| MODEL_RECEIVED_RESULT | **YES** (Zug 17:24) / **NO** (Zug 17:55) | 17:24: Output im `input[]`. 17:55 (`01a0cf68-4198-772d-b20b-4ec80a221ec4`): kein `tools`, kein Output, nur gekürzter Gesprächsverlauf |

## 1. Beantwortung der 10 Fragen

1. **Tool-Call erzeugt?** Ja — das Modell lieferte einen `function_call` (`target: "src/orb-core/"`).
2. **Echte Call-ID?** Ja: `call_mElOHEFmMHBq9rSnSXG3x1Ds`; Anforderungskennung `orb_ca_ead1d5c9f1afb414bbcd835eddcd6100`.
3. **Executor ausgeführt?** Ja — die Ausgabe hat exakt die Form von `compact()` in `src/orb-core/llm/code-tool.server.ts:95–113` und stammt aus `runCodeAnalysis`.
4. **Datei gelesen?** Nein (`filesExamined: []`).
5. **Welche Datei?** Keine.
6. **Tool-Result an Modell?** Ja (Request 2).
7. **Modellaufrufe?** Für `/codeanalyse`: **2** (17:24:30Z 865/102 Tokens; 17:24:35Z 1376/98 Tokens). Für „Ja“ (17:37) und „Ja gezielt prüfen“ (17:55) je 1, ohne Werkzeug.
8. **Modell- vs. Tool-Aufrufe:** Modell = die zwei Gateway-Requests; Tool = 1 serverinterner Aufruf zwischen ihnen (kein Gateway-Eintrag, korrekt).
9. **Nur behauptet?** Nein für 17:24 — der Aufruf war echt. Die Aussage „ich habe es aufgerufen“ war wahr; die Aussage „kein tatsächlicher Analysezugriff“ ist inhaltlich ebenfalls zutreffend, weil nichts gelesen wurde.
10. **Warum P22-Test ≠ echter Chat?** Siehe Abschnitte 2–4.

## 2. Pfad und erste Abweichung

```text
Chat "/codeanalyse"            OK   (orb_messages 17:24:26, source user_stated)
→ prepareCodeToolRuntime       OK   (Marker + has_role admin, sonst kein tools-Feld)
→ generateReply / Tool-Def     OK   (Request 1 enthält tools)
→ Model Request → Tool Call    OK   (function_call)
→ Executor → orb.code_analysis OK   (status COMPLETED)
→ File Read                    ABWEICHUNG  filesExamined = []
→ Tool Result → Model          OK, aber Inhalt veraltet/leer
```

**Erste Abweichung: File Read.** `collectCodeFiles` (`src/orb-core/toolbox/code-read.server.ts:103–131`)
fängt jeden `stat`-Fehler still ab (`catch { continue; }`, Z. 116–117) und liefert eine leere Liste;
`searchCode` baut darauf auf und liefert ebenfalls leer. Es entsteht kein Fehler, sondern
`COMPLETED` mit leerem Ergebnis.

## 3. Warum keine Datei gelesen wurde

- BEWIESEN: Selbst Begriffe, die in `src/orb-core/` sicher vorkommen („core“), und `tools:` in
  `src/orb-core/llm/provider.server.ts:218` wurden nicht gefunden → das Dateisystem der
  ausführenden Laufzeit enthielt das Ziel nicht (Projektwurzel = `process.cwd()`, Z. 36–40).
- BEWIESEN: Das lokale Vorschau-Serverprotokoll der Sandbox enthält keinen dieser Aufrufe
  (46 Zeilen, kein Treffer) — die Anfrage lief nicht in dieser Sandbox-Instanz.
- WAHRSCHEINLICH: Der Chat lief in einer gehosteten Laufzeit (veröffentlichte App oder gehostete
  Vorschau), in der keine Quelldateien liegen — die in P22 bereits genannte Grenze
  („nur in der Vorschau“). Welche der beiden: UNBEKANNT (keine Host-Angabe im Protokoll).

## 4. Warum das Ergebnis trotzdem „kein Werkzeug-Protokoll“ meldete

`src/orb-core/toolbox/code-analysis.server.ts:267–300`: feste Sonde. Bei Fragen zu
„tool/werkzeug/wiring“ sucht sie `tools:`; **0 Treffer ⇒ Befund `CODE_NO_TOOL_PROTOCOL`**.
Da die Suche wegen fehlender Dateien immer 0 liefert, meldete die Analyse einen Befund, der
seit P22 falsch ist. „Keine Datei gefunden“ wird als „Protokoll fehlt“ gedeutet. Gleiches gilt
für `CODE_ACCESS_WITHOUT_UI`. Das Modell erhielt also ein echtes, aber irreführendes Ergebnis.

## 5. Warum ORB sich später „korrigierte“

- BEWIESEN: Die gespeicherte Antwort 17:24 lautete „…das Werkzeug ist hier aufrufbar, und ich
  habe es für `src/orb-core/` aufgerufen.“ — sachlich korrekt.
- BEWIESEN: Folgezüge „Ja“ und „Ja gezielt prüfen“ beginnen nicht mit dem Marker → kein
  Werkzeug (`code-tool.server.ts:40`). Request 17:55 enthält weder `tools` noch das frühere
  Werkzeugergebnis; der Verlauf enthält nur gekürzte Antworttexte.
- BEWIESEN: `runCodeToolLoop` beginnt jeden Zug mit nur der aktuellen Nachricht
  (`code-tool.server.ts:198–200`); Werkzeugergebnisse werden nicht in `orb_messages`
  gespeichert (`state_snapshot` enthält nur Zustandswerte).
- Folge: Im Folgezug sah das Modell weder Werkzeug noch Ergebnis und bezeichnete die frühere
  Aussage als falsch. Die „Korrektur“ ist eine Fehlinterpretation ohne Evidenz — der Aufruf war echt.

## 6. Differenz zum P22-Test

P22-Tests liefen mit Stub-Modell in der Sandbox, wo die Projektdateien vorhanden sind, und
prüften Wiring, Scope, Rechte, Idempotenz — nicht das Lesen in der gehosteten Laufzeit und
nicht die Bedeutung eines leeren Leseergebnisses. Dadurch blieben drei Punkte unsichtbar.

## 7. Befunde (keine Änderung vorgenommen)

- F1 BEWIESEN: Leere Dateiliste wird als `COMPLETED` statt als „nicht verfügbar“ gemeldet (stilles `catch`).
- F2 BEWIESEN: Die Sonde `CODE_NO_TOOL_PROTOCOL` wertet „nichts gefunden“ als „Protokoll fehlt“ und ist seit P22 inhaltlich überholt.
- F3 BEWIESEN: Werkzeugergebnisse überleben den Zug nicht; Folgezüge ohne Marker haben keinen Zugriff darauf.
- F4 WAHRSCHEINLICH: Ausführende Laufzeit ohne Quelldateien.

Mögliche Korrekturen nur beschrieben: leere Zielmenge als `FAILED`/`unavailable` melden;
Sonde nur bei `filesExamined > 0` auswerten; Werkzeugergebnis-Kennung am Antwortdatensatz
vermerken. Jede Umsetzung braucht eigene Freigabe.

ABSOLUTER STOPP.
