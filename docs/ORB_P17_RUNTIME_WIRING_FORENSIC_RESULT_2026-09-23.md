# ORB P17 – `orb.analysis` Runtime-Wiring Forensik

Datum: 2026-09-23 · Modus: **READ-ONLY** · Modellaufrufe: **0** · Kosten: 0,00 €
Geänderter Produktionscode: **keiner**. Geänderte Tests: **keine**. Kein Patch, kein Deployment.

Referenzen: `docs/ORB_TOOLBOX_INTEGRATION_RESULT_2026-09-23.md`,
`docs/ORB_ANALYSIS_ACCESS_DISCOVERY_RESULT_2026-09-23.md`,
`docs/ORB_P12_ANALYSIS_DISCOVERY_RESULT_2026-09-23.md`.

## Eindeutige Antwort

| Frage | Antwort | Beweisstelle |
|---|---|---|
| DISCOVERED | **YES** | `src/orb-core/toolbox/contract.ts:294` (`ORB_CAPABILITY_REGISTRY`, ein Eintrag `orb.analysis`) |
| RESOLVED | **YES** | `src/orb-core/toolbox/access.server.ts#resolveOrbCapability` → Deskriptor + `request()` |
| INJECTED | **NO** | kein Treffer für `tools`/`tool_choice` in `src/orb-core` (rg, 0 Treffer) |
| CALLABLE | **YES als TypeScript-Funktion / NO als Modell-Werkzeug** | `orb-sdk/orb-core.server.ts:91–133` vorhanden; keine Tool-Definition in der Modellanfrage |
| PASSED_TO_RUNTIME | **NO** | `src/orb-core/llm/provider.server.ts:80–89` und `src/orb-core/llm/openai.server.ts:101–108` senden keine Werkzeugliste |

Die Aussage des echten Laufs („kein aufrufbares `orb.analysis`-Tool bereitgestellt") ist
**sachlich korrekt** – sie ist keine Fehlfunktion des Modells.

## 1. Vollständiger Runtime-Pfad

| Stufe | Datei / Funktion | hinein | heraus | `orb.analysis` vorhanden? | callable? |
|---|---|---|---|---|---|
| 1 UI-Runtime | `src/routes/_authenticated/channels.orb.tsx:59–111` (`sendOrbInput`, `orbChatRequestDiagnostic`) | Nachrichtentext | Serverfunktionsaufruf | nein – die Route kennt nur den Chat und die Chat-Brücke | nein |
| 2 Serverzugänge Chat | `src/integrations/y-dude-orb/orb.functions.ts` (11 Serverfunktionen: Snapshot, Input, Curiosity, Learning, Feedback, Feed, Suggestion, Context, Voice) | Text/IDs | Ergebnis | **nein – keine der 11 Funktionen exponiert die Analyse** | nein |
| 3 SDK-Runtime | `src/orb-sdk/orb-core.server.ts` `createOrbCore()` | db, userId | Methodenobjekt inkl. `discoverAnalysisAccess`, `listAnalysisCapabilities`, `resolveAnalysisCapability`, `requestAnalysis` | **ja** | ja, aber nur serverintern per Codeaufruf |
| 4 Registry | `src/orb-core/toolbox/contract.ts:294` `ORB_CAPABILITY_REGISTRY` / `listOrbCapabilities()` / `findOrbCapability()` | – | ein Deskriptor `orb.analysis` | **ja** | Deskriptor, kein Aufruf |
| 5 Resolver | `src/orb-core/toolbox/access.server.ts#resolveOrbCapability` | `capabilityId` | Deskriptor + `request(db,userId,req)` bzw. `null` | **ja** | **ja** |
| 6 Adapter | `src/orb-core/toolbox/adapter.server.ts#runToolboxAnalysis` | `analysisType`, `source`, IDs | `ToolboxAnalysisResult` | ja | ja (nach Adminprüfung) |
| 7 Chat-Verarbeitung | `sendOrbInput` → `createOrbCore().process()` → `src/orb-core/engine.server.ts#processInput` / `process.server.ts` | Text, Bilder | Entscheidung, Erinnerungen, Prompt | **nein – `processInput` berührt weder Registry noch Resolver** | nein |
| 8 Prompt-Assembler | `src/orb-core/llm/prompt.server.ts#buildSpeakSystemPrompt` | Zustand, Erinnerungen, Interessen, Threads, Kontext | Systemtext | **nein – kein Wort über Fähigkeiten/Werkzeuge** (rg „tool", „Analyse": 0 Treffer) | nein |
| 9 Provider-Auswahl | `src/orb-core/llm/select.server.ts#generateReply` | `{system, text, images, obs}` | `{reply, status, meta}` | **nein – die Signatur hat keinen Werkzeug-Parameter** | nein |
| 10 Modellaufruf A | `src/orb-core/llm/provider.server.ts:80–89` | Body: `model`, `instructions`, `input`, `stream`, `store`, `reasoning` | Textstrom | **nein** | **nein** |
| 11 Modellaufruf B | `src/orb-core/llm/openai.server.ts:101–108` | Body: `model`, `messages`, `max_tokens` | Text | **nein** | **nein** |
| 12 Runtime Tool Context | *existiert nicht* | – | – | – | – |

Zweiter, getrennter Runtime-Pfad für technische Analyse (nicht `orb.analysis`):
`channels.orb.tsx` → `detectDeveloperDiagnosticIntent` (Client, unverbindlich) →
`src/lib/orb-chat-bridge.functions.ts#orbChatRequestDiagnostic` → serverseitige
Wiedererkennung + `isAdmin` → `src/orb-dev/chat-bridge.server.ts#runChatDiagnostic`.
Dieser Pfad geht **nicht** über Registry, Resolver oder Toolbox-Adapter.

## 2. Registry-Befund

`ORB_CAPABILITY_REGISTRY` enthält genau einen Eintrag mit `capabilityId = "orb.analysis"`,
`transport: "internal_server_call"`, `requiresAdminRole: true`, `readOnly: true`.
Importeure (vollständig, `rg`): `access.server.ts`, `src/orb-sdk/orb-core.server.ts`,
`tests/orb-analysis-access.test.ts`. **Kein Importeur im Chat-Verarbeitungspfad,
kein Importeur in der Sprachschicht, kein Importeur in einer Route.**

## 3. Resolver-Befund

`resolveOrbCapability("orb.analysis")` liefert einen auflösbaren, aufrufbaren Zugang;
unbekannte IDs liefern `null`. Funktioniert (13 P12-Tests grün). **Aufrufer zur Laufzeit: keiner.**
`resolveAnalysisCapability` des SDK ist von keiner Serverfunktion und keiner Route erreichbar.

## 4. Injection-Befund

`rg -n "tools|tool_choice|function_call"` über `src/orb-core`, `src/lib`, `src/routes`:
**0 Treffer.** Es gibt im gesamten Projekt keinen Ort, an dem eine Werkzeugliste
zusammengestellt, gefiltert oder an ein Modell übergeben wird. Die Injection fehlt
nicht teilweise – sie ist nirgends implementiert.

## 5. Tool-Context-Befund

Ein „Runtime Tool Context" existiert nicht. `generateReply` akzeptiert
`{ system, text, images, obs }`; beide Provider serialisieren genau diese Felder.
Der Systemtext beschreibt Zustand, Erinnerungen, Interessen, Threads, Modus –
**keine Fähigkeiten**. Das Modell hat daher weder Kenntnis von `orb.analysis`
noch einen Kanal, es aufzurufen.

## 6. Callable-Befund

* Serverintern per Code: **callable** (`createOrbCore(db,userId).requestAnalysis(...)`,
  Adminprüfung in `access.server.ts` aktiv).
* Über eine Serverfunktion / aus dem Client: **nicht callable.**
  `src/lib/orb-toolbox.functions.ts` enthält drei adminpflichtige Serverfunktionen
  (`orbToolboxCapabilities`, `orbToolboxAnalyze`, `orbToolboxRequestOperation`),
  hat aber **null Importeure** – keine Route, keine Komponente, kein Hook.
* Als Modell-Werkzeug: **nicht callable** (siehe 4./5.).

## 7. Exakte Bruchstelle

Zwei getrennte, jeweils exakt lokalisierbare Übergaben fehlen:

**B1 – Sprachschicht (Ursache des Symptoms):**
`src/orb-core/llm/select.server.ts#generateReply` (Signatur ohne Werkzeuge) und die
Anfragekörper in `provider.server.ts:80–89` / `openai.server.ts:101–108`.
Zwischen Stufe 7 (`processInput`) und Stufe 10/11 (Modellaufruf) wird die Registry
nie gelesen. Registry kennt `orb.analysis` → Runtime bekommt es nicht.

**B2 – Client-Erreichbarkeit:**
`src/integrations/y-dude-orb/orb.functions.ts` exportiert keine Analyse-Serverfunktion;
`src/lib/orb-toolbox.functions.ts` ist zwar vorhanden und adminsicher, wird aber von
keiner Oberfläche importiert. Selbst ein ausdrücklicher Benutzerwunsch erreicht
`orb.analysis` daher nicht – der Chat landet stattdessen in der Chat-Brücke.

## 8. Root Cause

Architektonisch beabsichtigt und dokumentiert, nicht defekt:
`orb.analysis` wurde in P10/P12 als **serverinterner, adminpflichtiger Codezugang mit
Verzeichnis und Resolver** gebaut – ausdrücklich ohne Aufruf aus dem normalen
Verarbeitungspfad (P12, Abschnitt „bewusst NICHT gebaut": Aufruf aus ORB heraus,
Oberfläche im Admin-Bereich). ORB Core besitzt zugleich **kein Tool-Calling-Protokoll**:
die Sprachschicht ist ein einmaliger, werkzeugloser Aufruf (`instructions` + `input`).
Damit ist die Fähigkeit *auffindbar und auflösbar*, aber weder in einen Runtime-Tool-Context
injiziert noch für das Modell aufrufbar. Das Symptom ist die korrekte Folge dieser Entscheidung.

Keine der Alternativhypothesen trifft zu: Name bekannt (nicht A), Adapter bekannt (nicht B),
registriert (nicht C), Berechtigung wird erst beim Anfordern geprüft und nicht vor der
Discovery (nicht F), kein falsches Interface gesucht (nicht G), kein Filter entfernt Einträge (nicht E).
Zutreffend: **D** (nur adminseitig exponiert, und diese Exposition ist zusätzlich unbenutzt),
**H** und **I** (Zugang existiert, ist aber nicht Teil der Runtime-Werkzeugliste – weil es keine gibt).

## 9. Minimal möglicher Fix – NUR BESCHREIBUNG, NICHT ANGEWENDET

Zwei voneinander unabhängige, je nach Zielsetzung wählbare Wege:

* **F1 (kleiner, ohne Modelländerung):** eine Serverfunktion in
  `src/integrations/y-dude-orb/orb.functions.ts` oder die Anbindung des vorhandenen,
  bisher unbenutzten `src/lib/orb-toolbox.functions.ts` an eine Adminoberfläche. Wirkung:
  ein Administrator kann `orb.analysis` ausdrücklich auslösen. Das Modell bleibt werkzeuglos.
  Kein neues Verzeichnis, keine neue Analysefunktion, keine Migration.
* **F2 (größer, echtes Tool-Calling):** `generateReply` um einen optionalen
  Werkzeugparameter erweitern, den Deskriptor aus `ORB_CAPABILITY_REGISTRY` in eine
  Werkzeugdefinition übersetzen, `tools` nur bei Administratorsitzung mitsenden und eine
  Rückschleife für Werkzeugaufrufe bauen. Wirkung: das Modell könnte `orb.analysis`
  nennen. Bewertung: **deutlich größerer Eingriff** in Prompt- und Antwortpfad,
  berührt Kosten, Latenz, Determinismus und P7/P9-Messstand; ohne eigene Freigabe
  nicht vertretbar.

Empfohlene Reihenfolge, falls freigegeben: erst F1, und nur bei ausdrücklichem
Bedarf später F2. **Nichts davon wurde umgesetzt.**

## 10. Sicherheitsauswirkung

Heutiger Zustand ist der sicherste: das Modell kann keine Fähigkeit auslösen, weil es
keine kennt. F1 ändert daran nichts – die Adminprüfung (`assertAdmin` / `isAdmin`,
`has_role`) liegt vor jedem Analyseaufruf und bleibt unangetastet. F2 wäre
sicherheitsrelevant: eine modellgesteuerte Auslösung müsste an eine geprüfte
Administratorsitzung gebunden bleiben, die Read-only-Grenzen des Vertrags
(`checkToolboxOperationAllowed`) und die menschliche Freigabe für jede Änderung
dürfen nicht durch Modelltext umgehbar werden. Kein Weg darf Credentials,
Tokens oder Chatinhalte in Analyseprotokolle bringen.

Nebenbefund ohne Änderung (außerhalb des P17-Auftrags, nur dokumentiert):
`src/orb-core/llm/openai.server.ts:107` sendet `max_tokens`, was der geltenden
Vorgabe „niemals `max_tokens`/`maxOutputTokens`" widerspricht. Vorbestehend, nicht angefasst.

## 11. Benötigte Tests (für einen späteren Fix, hier nur entworfen)

Für F1: Serverfunktion ohne Administratorrolle → saubere Ablehnung; mit Rolle →
`ToolboxAnalysisResult` mit `codeChanged=false`, `proposalCreated=false`,
`approvalCreated=false`, `deployed=false`, `modelCalls=0`; unbekannter Analysetyp →
Ablehnung durch die Eingabeprüfung; Ausfall des Adapters → Chat bleibt funktionsfähig;
normaler Chatpfad ruft die Analyse weiterhin nicht auf; keine zusätzlichen DB-Abfragen
im normalen Pfad (P9-Stand unverändert).

Für F2 zusätzlich: ohne Administratorsitzung wird **keine** Werkzeugliste mitgesendet;
Werkzeugliste enthält ausschließlich `orb.analysis`; ein vom Modell behaupteter
Werkzeugaufruf ohne Adminrolle wird serverseitig verworfen; ein Werkzeugaufruf erzeugt
keinen Patch und keine Freigabe; Vorher/Nachher-Messung der Modellaufrufe und
Antwortlatenz; vollständige Logik-, DB-/Sicherheitstests, Typecheck, Lint, Build.

## Abschluss

Forensik beendet. Kein Patch, keine Migration, kein Deployment, keine Testvorlage
geändert, kein Produktionscode angefasst. **ABSOLUTER STOPP** – jeder weitere Schritt
(insbesondere F1 oder F2) braucht eine ausdrückliche menschliche Freigabe.
