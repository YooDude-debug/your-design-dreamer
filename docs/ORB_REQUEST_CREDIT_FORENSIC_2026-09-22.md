# ORB CORE – REQUEST / CREDIT USAGE FORENSIC AUDIT (READ-ONLY)

Datum: 2026-09-23 · Art: rein lesend. Keine Codeänderung, keine Migration, keine SQL-Schreibzugriffe,
keine Konfigurationsänderung, keine Schwellen/Formeln berührt. PRODUCTION CHANGED: NO.

Messfenster
- AI-Gateway-Protokoll: 2026-09-16T08:52Z – 2026-09-23T08:52Z (7 Tage)
- ORB-Kennzahlen (`orb_metrics`): 2026-09-19T17:57Z – 2026-09-23T08:17Z (≈3,6 Tage; Tabelle beginnt erst hier)
- Vom Nutzer gemeldete Usage-Anzeige: Database 114 · AI 30,1 (gpt-6-astra 27,5; gemini-3.6-flash 1,02;
  gpt-5.4-mini 0,65; gemini-3.7-flash 0,54; gpt-4o-mini-tts 0,24) · Compute 10,7 · Network 3,72 ·
  Realtime 0,06 · Storage 0,02 · Connectors 0. Der Zeitraum dieser Anzeige ist nicht ausgewiesen →
  eine exakte Zuordnung Anzeige ↔ Protokoll ist **NICHT BEWIESEN – HYPOTHESE**.

---

## 1. EXECUTIVE SUMMARY

1. Die AI-Kosten stammen fast vollständig aus **einem** Codepfad: `speakViaLovableGateway`
   (`src/orb-core/llm/provider.server.ts`, Modell `openai/gpt-6-astra`, Endpunkt `/v1/responses`).
   Es ist die einzige Stelle im Repository, die dieses Modell verwendet.
2. **Jede** Benutzernachricht im ORB-Chat kostet genau einen Astra-Aufruf – auch dann, wenn der Core
   danach entscheidet, inhaltlich still zu bleiben. 166 von 414 ORB-Antworten (40,1 %) haben die
   Entscheidung `stay_silent`, wurden aber vorher vom Modell formuliert.
3. Der Pfad „eigene Frage“ (`formulateQuestion`) ruft das Modell **vor** der Duplikatprüfung auf.
   Eine als Duplikat verworfene Frage ist bereits bezahlt und im Gespräch unsichtbar.
4. Kein Beweis für ein klassisches Polling gegen Server/AI: der Präsenz-Takt (5 s) läuft rein im
   Browser und erzeugt pro Takt keinen Request. Autonome Anfragen sind mit 24 Versuchen in 3,6 Tagen
   messbar selten.
5. Größter Datenbanktreiber ist die Menge der Abfragen **pro Gesprächszug**: durchschnittlich
   20,1 Datenbankabfragen je `turn` (7 849 von 8 843 gezählten Abfragen).
6. Die Hintergrundanalyse (`analysis/`) läuft über den **eigenen** OpenAI-Schlüssel
   (`api.openai.com`, `gpt-4o-mini`) und belastet die Lovable-Credits nicht. Sie erzeugt aber je
   Benutzerzug einen zusätzlichen Server-Aufruf (252 Ereignisse) → Compute/Network.

---

## 2. AKTUELLER VERBRAUCH (gemessen)

AI-Gateway (7 Tage, Protokoll):

| Größe | Wert |
|---|---|
| Requests gesamt | 703 |
| davon `openai/gpt-6-astra` (`responses`) | 669 |
| Kosten je Astra-Aufruf (beobachtet) | 0,0254 – 0,0816 Credits |
| Dauer je Astra-Aufruf | 1 459 – 5 533 ms |
| Tokens je Aufruf | 529–1 133 in / 21–145 out |
| Sonstige (TTS `gpt-4o-mini-tts`) | 0,005 Credits je Aufruf, Einzelfälle |

ORB-Ereignisse (`orb_metrics`, 3,6 Tage):

| kind | Ereignisse | mit AI-Aufruf | Ø DB-Abfragen | DB-Abfragen gesamt | Ø AI-Dauer | Ø Knoten | Ø Beziehungen |
|---|---|---|---|---|---|---|---|
| turn | 390 | 390 | 20,1 | 7 849 | 3 745 ms | 12,3 | 37,6 |
| analysis | 252 | 252 | 3,0 | 756 | 297 ms | 0 | 0 |
| proactive | 24 | 24 | 9,9 | 238 | 2 542 ms | 10,0 | 41,8 |

Nachrichten (`orb_messages`, 804 Zeilen): 390 `user`; ORB 414 – davon `stay_silent` 166,
`remind` 128, `answer` 71, `ask` 49. Gespeicherte autonome Fragen: 25.

Tagesverlauf (Ereignisse): 19.09. 59 · 20.09. 97 · 21.09. 264 · 22.09. 147 · 23.09. 99 (bis 08:17).
Spitzenstunde 2026-09-22 19:00Z: 28 turns (611 DB-Abfragen) + 20 Analysen + 1 proaktiv.

---

## 3. HAUPTVERURSACHER

| Rang | Verursacher | Datei | Beweislage |
|---|---|---|---|
| 1 | Ein Astra-Aufruf je Benutzerzug, unabhängig von der Entscheidung | `engine.server.ts:1183-1228` (`speak`) | HIGH (gemessen: 390 turns = 390 AI-Aufrufe) |
| 2 | Formulierung vor Duplikat-/Fehlerprüfung (bezahlt, unsichtbar) | `engine.server.ts:1150-1158`, `2304-2321` | HIGH (Code bewiesen; 25 gespeicherte Fragen vs. 49 `ask`-Nachrichten und 24 Versuche) |
| 3 | 20,1 DB-Abfragen je Zug (Knoten + 37,6 Beziehungen) | `engine.server.ts` (56 `.from()`-Stellen: orb_nodes 19, orb_connections 8, orb_state 6, orb_questions 6, orb_interests 6, orb_messages 5) | HIGH (gemessen) |
| 4 | Zweiter Serverzug je Nachricht durch `analyzeContext` | `channels.orb.tsx:164-170`, `apply.server.ts` | HIGH (252 Ereignisse, Drosselung 45 s vorhanden) |
| 5 | Nicht zuordenbare Astra-Aufrufe (669 vs. 414 nachweisbar) | – | **NICHT BEWIESEN – HYPOTHESE** (siehe §10) |

---

## 4. GEFUNDENE REQUEST-„LOOPS“

Es wurde **kein** sich selbst nachladender Endlos-Loop gefunden. Belegte wiederkehrende Muster:

| # | Muster | Datei / Funktion | Auslöser | Frequenz | Typ | notwendig? | Sicherheit |
|---|---|---|---|---|---|---|---|
| L1 | Zug → Antwort → `analyzeContext` → ggf. `invalidateQueries(["orb","snapshot"])` → Snapshot-Abfrage | `channels.orb.tsx:164-170` | jede Nachricht | 1 Zusatzaufruf + evtl. 1 Snapshot je Nachricht | Compute + DB | teilweise (Analyse ja, sofortiges Invalidieren nicht immer) | HIGH |
| L2 | Präsenz-Takt 5 s → Vorfilter → nur bei Freigabe genau 1 Anfrage | `use-orb-presence.ts:129-174` | Leerlauf ≥ 40 s, Cooldown 120–300 s | gemessen 24 Anfragen / 3,6 Tage | AI + DB | ja (Kernverhalten) | HIGH – **kein** Polling |
| L3 | Curiosity im Zug: `formulateQuestion` (AI) → Duplikat → trotzdem `speak` (AI) | `engine.server.ts:1150-1187` | Zug mit freigegebener eigener Frage | bis 2 AI-Aufrufe in einem Zug | AI | nein (Reihenfolge) | HIGH (Code) |
| L4 | Feed-Live-Abfrage alle 10 s, solange der Feed offen ist | `live-feed.ts:40`, `feed.tsx` | geöffneter Feed | 360 Anfragen/Std./Tab | DB/Network | teilweise | HIGH |
| L5 | Heartbeats: `touch_last_seen` 120 s, aktiver Chat 15 s | `use-last-seen-heartbeat.ts:11`, `push-active-chat.ts:18` | angemeldete Sitzung / offener Chat | 30 + 240 Aufrufe/Std. | DB | teilweise | HIGH |
| L6 | Admin-Seiten mit festem Takt (20 s / 60 s) | `admin.livetest.tsx`, `admin.health.tsx`, `admin.users.tsx` | geöffneter Admin-Tab | 180 / 60 Anfragen/Std. | DB/Compute | nein (nur bei offenem Tab) | HIGH |
| L7 | Fehler → Wiederholung → Fehler | – | – | – | – | – | **nicht gefunden**: `retry: 1` global (`router.tsx`), Sprachschicht und Analyse haben ausdrücklich keine Wiederholung |

Reine Browser-Timer ohne Request (Globus 1 s, Werbepause 1 s, Videodrift 500 ms, Mond 600 ms) sind
für Credits ohne Bedeutung.

---

## 5. AI-VERBRAUCH IM DETAIL

| Komponente | Modell | Weg | Trigger | AI-Aufrufe je Ereignis | gemessen (3,6 Tage) | Reduktionspotenzial |
|---|---|---|---|---|---|---|
| Antwort im Zug (`speak`) | openai/gpt-6-astra | Lovable-Gateway | jede Benutzernachricht | 1 | 390 | mittel (stille Züge) |
| Eigene Frage (`formulateQuestion`) | openai/gpt-6-astra | Lovable-Gateway | Zug mit Freigabe / autonomer Versuch | 1, zusätzlich zu `speak` möglich | 24 proaktiv | mittel (Reihenfolge Duplikatprüfung) |
| Hintergrundanalyse | gpt-4o-mini | eigener OpenAI-Schlüssel | nach jeder Nachricht, 45 s gedrosselt | 1 | 252 | klein (keine Lovable-Credits) |
| Sprachausgabe | gpt-4o-mini-tts | Gateway | nur Knopfdruck / eigene Frage | 1 | Einzelfälle | klein |
| Spracheingabe | google/gemini-3.5-transcribe | Gateway | nur Aufnahme | 1 | Einzelfälle | klein |
| Moderation Text/Bild/Audio | gpt-5.4-mini, gemini-3.6/3.7-flash | Gateway | Upload/Beitrag | 1–2 | – | außerhalb ORB |

Prüffragen des Auftrags:
- Derselbe Kontext mehrfach analysiert? **Ja, teilweise**: `speak` sendet Zustand, Erinnerungen und
  Kontext bei jedem Zug erneut (529–1 133 Eingabetokens); die Analyse betrachtet zusätzlich 24
  Nachrichten. Technisch nötig (zustandsloser Endpunkt, `store: false`), aber Umfang reduzierbar.
- AI bei jeder kleinen Zustandsänderung? **Nein** – nachweislich nur bei Nachricht oder freigegebener
  eigener Frage.
- AI für deterministisch lösbare Aufgaben? **Ja, ein Fall**: bei `stay_silent` wird eine Antwort
  formuliert, die der Core danach als „still“ behandelt (40 % der ORB-Nachrichten).
- Doppelte AI-Aufrufe je Ereignis? **Ja, möglich**: L3 (Frage + Antwort in einem Zug).
- Unnötige Wiederholungen? **Nein** – keine Retry-Logik in der Sprachschicht.

---

## 6. DATENBANK-VERBRAUCH

| Tabelle | Operation | Trigger | Frequenz | Zweck | redundant? | Idee |
|---|---|---|---|---|---|---|
| orb_nodes | read (19 Stellen) | jeder Zug | Ø 12,3 Knoten + mehrfache Abfragen | Recall, Kandidaten | teilweise (mehrere Abfragen je Zug auf dieselbe Menge) | eine Abfrage je Zug, im Speicher filtern |
| orb_connections | read/write (8) | jeder Zug | Ø 37,6 Beziehungen | Graph, Spiderweb | nein | Beziehungsschreibvorgänge bündeln |
| orb_state | read/write (6) | jeder Zug, jeder Versuch | 1–2 je Ereignis | Energie/Neugier | nein (Energie hängt an `updated_at`) | unverändert lassen |
| orb_messages | read/write (5) | jeder Zug | 8-Nachrichten-Kontext + Insert | Gesprächskontext | nein | – |
| orb_metrics | write | jedes Ereignis | 666 in 3,6 Tagen | Diagnose | nein | Aufbewahrung begrenzen |
| orb_questions/-interests/-suggestions/-threads/-style | read/write | Zug bzw. Versuch | je 1–6 | Kernverhalten | nein | – |
| profiles (`touch_last_seen`) | write via RPC | Heartbeat 120 s | 30/Std./Sitzung | Präsenz | teilweise | Takt an Sichtbarkeit koppeln (bereits vorhanden) |
| Feed-Abfragen | read | Live-Feed 10 s | 360/Std./Tab | Neue Beiträge | teilweise | Ereignis statt Takt (Realtime vorhanden) |

Die Kategorie „Database 114“ der Anzeige ist bei Lovable Cloud überwiegend eine Instanz-Größe/-Laufzeit
und nicht die Anzahl Abfragen; die gemessenen 8 843 ORB-Abfragen in 3,6 Tagen allein erklären den Wert
**NICHT BEWIESEN – HYPOTHESE**. Benötigte Messung: Kostenaufschlüsselung der Kategorie Database nach
Instanzstunden vs. Abfragen.

---

## 7. COMPUTE-VERBRAUCH

- Jede Benutzernachricht erzeugt **mindestens zwei** Serverfunktionsaufrufe: `sendOrbInput` und
  `analyzeOrbContext` (`channels.orb.tsx:164`); bei geänderten Erinnerungen zusätzlich
  `getOrbSnapshot`. → bis zu 3 Aufrufe je Nachricht (gemessen: 390 Züge, 252 Analysen).
- Lange Aufrufdauer erhöht Compute: Ø 3 745 ms AI-Zeit je Zug, Gateway-Spitze 5 533 ms.
- Keine rekursiven oder wiederholenden Serverprozesse gefunden; keine Cron-/Hintergrundjobs im ORB.
- Kein `retry` in Sprachschicht, Analyse oder Stimme (je genau ein Versuch).

## 8. NETWORK-VERBRAUCH

- Größter ORB-Anteil: Snapshot-Antworten (Zustand, Erinnerungen, Interessen, Threads, Vorschläge,
  Kennzahlen) nach jedem Zug — `queryClient.setQueryData` vermeidet hier bereits eine Zusatzabfrage,
  das Invalidieren nach der Analyse hebt das teilweise auf.
- Bildanhänge werden als base64 gesendet (bis `ORB_IMAGE_MAX_BYTES` je Bild) – nur bei Nutzung.
- Live-Feed (10 s) und Heartbeats sind kleine, aber häufige Nutzlasten.
- Genaue Byte-Größen liegen nicht vor: **NICHT BEWIESEN – HYPOTHESE**. Benötigte Messung: Netzwerk-Log
  mit Antwortgrößen je Endpunkt über eine typische Sitzung.

## 9. REDUNDANTE REQUESTS (belegt)

1. AI-Formulierung für Züge, die als `stay_silent` enden (166 Fälle, 40,1 %).
2. AI-Formulierung für Fragen, die anschließend als Duplikat verworfen werden (Code bewiesen).
3. Snapshot-Invalidierung unmittelbar nach `setQueryData` desselben Zugs, wenn die Analyse etwas ändert.
4. Mehrfache `orb_nodes`-Abfragen innerhalb eines Zugs (19 Abfragestellen, Ø 20,1 Abfragen je Zug).
5. Feste Zeittakte in Admin-/Feed-Ansichten, auch wenn sich nichts geändert hat.

## 10. WAHRSCHEINLICHE URSACHEN (mit Unsicherheit)

- 669 Astra-Aufrufe stehen 414 nachweisbaren ORB-AI-Ereignissen (390 turn + 24 proaktiv) gegenüber.
  Differenz ≈ 255. Mögliche Erklärungen: (a) Doppelaufrufe im Zug (L3), (b) Sitzungen in Vorschau-/
  Entwicklungsumgebung, die dieselbe Gateway-Abrechnung nutzen, (c) Aufrufe, die vor dem Schreiben der
  Kennzahl abbrachen, (d) das Protokollfenster (7 Tage) ist größer als `orb_metrics` (3,6 Tage).
  **NICHT BEWIESEN – HYPOTHESE.** Benötigte Messung: Astra-Aufrufe je Tag gegen `orb_metrics` je Tag im
  identischen Fenster, plus eine Kennzahl, die AI-Aufrufe pro Zug zählt (heute nur Dauer, nicht Anzahl).
- Die Zuordnung der Anzeige-Kategorien (Database 114, Compute 10,7, Network 3,72) zu einzelnen
  Funktionen ist aus den vorhandenen Daten nicht möglich: **NICHT BEWIESEN – HYPOTHESE.**

## 11. SICHERE OPTIMIERUNGEN (ohne Verhaltensänderung)

- **S1** Duplikat- und Leerprüfung **vor** dem Sprachaufruf: gleiche Entscheidung, eingesparte Kosten
  (`engine.server.ts:1150`, `2304`). Verhalten identisch, weil die Prüfung heute schon existiert.
- **S2** `orb_nodes` je Zug einmal laden und im Speicher weiterverwenden; Formeln, Schwellen und
  Auswahl bleiben unverändert.
- **S3** Beziehungsschreibvorgänge (`touchConnection`) je Zug in einem Aufruf bündeln.
- **S4** Snapshot nach der Analyse nur invalidieren, wenn die Analyse Werte liefert, die im Snapshot
  sichtbar sind (heute wird bei jeder Änderung neu geladen).
- **S5** Feste Takte in Admin-/Feed-Ansichten an Sichtbarkeit und tatsächliche Änderungen koppeln
  (Realtime ist vorhanden).
- **S6** `orb_metrics` mit Aufbewahrungsgrenze; Diagnose bleibt erhalten.

## 12. OPTIMIERUNGEN MIT RISIKO

- **R1** Bei `stay_silent` keinen Sprachaufruf: spart bis 40 % der Züge, verändert aber den Wortlaut
  stiller Rückmeldungen → berührt Gesprächsverhalten, nur mit ausdrücklicher Freigabe.
- **R2** Kürzerer Kontext im Prompt (weniger Erinnerungen/Nachrichten): spart Eingabetokens, kann die
  Antwortqualität und Recall-Treffer verändern → verboten ohne eigene Testreihe.
- **R3** Analyse seltener als 45 s: verlangsamt das Gedächtniswachstum.
- **R4** Cooldowns verlängern: verändert Präsenz und autonome Fragen (Kernverhalten) – nicht empfohlen.

## 13. PRIORISIERTER PLAN

| Prio | Maßnahme | Problem | Ursache | Datei / Funktion | heutiger Pfad | erwartete Reduktion | Risiko | Tests | Rollback |
|---|---|---|---|---|---|---|---|---|---|
| P0 | S1 | bezahlte, unsichtbare Fragen | Formulierung vor Prüfung | `engine.server.ts` `processInput`/`askProactively` | AI → Duplikatprüfung → verworfen | Astra-Aufrufe −2…−8 % (Schätzbereich) | niedrig | Regression Curiosity/Impulse, Duplikattests | Reihenfolge zurücknehmen |
| P0 | S4 | doppelte Snapshot-Ladung | Invalidieren nach `setQueryData` | `channels.orb.tsx:164-170` | Zug → Analyse → Invalidieren → Snapshot | DB/Network je Nachricht −1 Abfrage in vielen Fällen | niedrig | UI-Test Snapshot-Aktualität | Aufruf wiederherstellen |
| P1 | S2 | 20,1 Abfragen je Zug | mehrere `orb_nodes`-Abfragen | `engine.server.ts` Recall-Pfad | mehrfach lesen | DB-Abfragen je Zug −20…−40 % (Schätzbereich) | mittel | volle ORB-Regression, Recall-Fälle | Abfragen wiederherstellen |
| P1 | S3 | viele Einzelschreibvorgänge | `touchConnection` je Beziehung | `engine.server.ts` | Ø 37,6 Beziehungen | DB-Schreibvorgänge je Zug deutlich weniger | mittel | Graph-/Verbindungstests | Einzelaufrufe wiederherstellen |
| P2 | S5 | Takt statt Ereignis | fixe Intervalle | `live-feed.ts`, `admin.*` | 10 s / 20 s / 60 s | Feed-DB-Abfragen −50…−80 % bei offenem Tab | mittel | Feed-Aktualität, Admin-Ansichten | Intervall wiederherstellen |
| P2 | S6 | wachsende Diagnosedaten | keine Grenze | `orb_metrics` | unbegrenzt | Storage klein | niedrig | Kennzahlen-Ansicht | – |
| P3 | R1/R2 | stille Züge, Promptgröße | Verhalten | `engine.server.ts`, `prompt.server.ts` | 1 AI je Zug | AI bis −40 % (R1) | hoch | eigene Freigabe + Testmatrix | Rücknahme |

## 14. ERWARTETE EINSPARUNG (nur Bereiche, keine erfundenen Zielwerte)

| Kategorie | aktuell (Anzeige) | Ziel nach P0+P1 | Begründung |
|---|---|---|---|
| AI | 30,1 | 27–29 | P0 entfernt nur unsichtbare Aufrufe; die 390 Züge bleiben |
| AI (zusätzlich mit R1, nur nach Freigabe) | 30,1 | 18–22 | 40 % der Züge sind `stay_silent` |
| Database | 114 | 95–110 | P1 senkt Abfragen je Zug; Instanzanteil bleibt |
| Compute | 10,7 | 9–10,5 | ein Aufruf je Nachricht weniger |
| Network | 3,72 | 3,2–3,7 | weniger Snapshot-Übertragungen |
| Realtime | 0,06 | 0,06 | unberührt |

Alle Zahlen sind Bereiche. Ohne Kostenaufschlüsselung je Endpunkt sind exakte Zielwerte
**NICHT BEWIESEN – HYPOTHESE**.

## 15. TESTPLAN (für eine spätere, getrennt freizugebende Umsetzung)

| Test | Aufbau | erwartete Requests | AI | DB | erwartetes ORB-Verhalten | Regressionsrisiko |
|---|---|---|---|---|---|---|
| A Leerlauf | ORB-Seite offen, 10 min ohne Eingabe | 0 je Takt, max. 1 Versuch je Cooldown | 0–1 | 0 je Takt | Präsenz-Takt nur im Browser | Präsenz |
| B normale Unterhaltung | 5 Nachrichten | ≤ 2 Serveraufrufe je Nachricht | 1 je Nachricht | ~20 je Zug | Antwort wie heute | Gesprächsmodus |
| C Memory Recall | Frage zu gespeicherter Erinnerung | 1 Zug | 1 | 1 Knotenabfrage nach S2 | Erinnerung im Prompt | Recall |
| D Gap Detection | Lücke erzeugen | 1 Zug | 1 | wie B | Lücke erkannt, keine Zusatz-AI | Gaps |
| E autonome Nachfrage | Leerlauf ≥ 40 s bei hoher Neugier | 1 Versuch | 1 nur bei Freigabe | ~10 | Frage oder Stille mit Grund | Curiosity/Impulse |
| F mehrere Nachrichten in Folge | 3 Nachrichten < 45 s | Analyse gedrosselt | 3 | 3× Zug | nur eine Analyse | Analyse-Drosselung |
| G längere Leerlaufzeit | > 15 min | 0 | 0 | 0 | keine Frage (Obergrenze) | Präsenz |
| H AI-Ausfall | Gateway 402/5xx | 1 | 1 fehlgeschlagen | wie B | Hinweis, keine Wiederholung | Fehlerpfad |
| I Netzausfall | Verbindung unterbrochen | 1 | 0 | 0 | Fehlermeldung, kein Loop | Retry-Verhalten |
| J Reconnect | Tabwechsel/Rückkehr | 1 Snapshot | 0 | 1 | Leerlauf neu bewertet, keine Nachfrage | Präsenz |
| K Stimme aus | Textmodus | wie B | 1 | wie B | keine TTS-Kosten | Stimme |
| L Stimme an | Antwort vorlesen | +1 TTS | 1 + TTS | wie B | Sprachausgabe nur auf Auslösung | Stimme |

## 16. OFFENE FRAGEN / FEHLENDE MESSDATEN

1. Zeitraum der Usage-Anzeige (ohne ihn keine exakte Zuordnung).
2. Kostenaufschlüsselung Database nach Instanzstunden vs. Abfragen.
3. Anzahl AI-Aufrufe je ORB-Ereignis (heute wird nur die Dauer gespeichert) → erklärt die Differenz
   669 vs. 414.
4. Trennung Vorschau-/Entwicklungs-Sitzungen von Produktionssitzungen in der Gateway-Abrechnung.
5. Antwortgrößen je Endpunkt für eine belastbare Network-Aussage.

---

READ-ONLY bestätigt: keine Datei außer diesem Bericht geschrieben, keine Migration, kein SQL-Schreibzugriff,
keine Optimierung umgesetzt. PRODUCTION CHANGED: NO.
