# ORB CORE – P2 FORENSIC TRACE (MODEL-CALL CORRELATION + DB ATTRIBUTION)

Datum: 2026-09-23
Art: **READ-ONLY** – keine Code-, DB-, RLS-, Prompt- oder Modelländerung, kein Patch, kein Deployment
Referenzen: `docs/ORB_REQUEST_CREDIT_FORENSIC_2026-09-22.md`,
`docs/ORB_REQUEST_OPTIMIZATION_P0_RESULT_2026-09-23.md`,
`docs/ORB_REQUEST_OPTIMIZATION_P1_RESULT_2026-09-23.md`

---

# Executive Summary

1. **Die Differenz 669 vs. 414 ist in ihrer Ursache jetzt zum größten Teil
   belegt – aber nicht restlos pro Aufruf zuordenbar.** Bewiesen ist:
   die Gateway-Protokolle umfassen ein **größeres Zeitfenster** als die
   ORB-Ereignisdaten, und **Programmläufe gegen eine Test-Datenbank erzeugen
   echte Modellaufrufe ohne jede Datenbankspur**. Beide Mechanismen sind
   heute direkt nachweisbar (siehe „669 vs 414 Analyse").
2. **Ein Ereignis = höchstens ein Modellaufruf.** Im Code gibt es genau drei
   Aufrufstellen der Sprachschicht (`engine.server.ts:1211`, `:1232`, `:2269`);
   die ersten beiden liegen in einem `if/else` (schließen sich aus), die dritte
   ist der proaktive Pfad. Es gibt **keine Wiederholungen** (`select.server.ts`:
   „Keine automatischen Wiederholungen") und **keine internen Bewertungs-,
   Memory-, Graph- oder Ähnlichkeits-Modellaufrufe** – diese Schritte sind
   deterministisch.
3. **Wichtige Korrektur des früheren Berichts:** Die 166 Nachrichten mit
   `decision = stay_silent` sind **keine verworfenen, unsichtbaren Antworten**.
   Alle 166 haben einen gefüllten Text (Ø 166 Zeichen) und wurden dem Benutzer
   ausgeliefert. `stay_silent` ist eine **interne Steuergröße**, die
   `conversationDecision()` (`core.ts:226–237`) ausdrücklich in „answer"
   umwandelt: „die Nutzereingabe hat Vorrang". **Die angenommene Einsparung
   „keine Formulierung bei stillen Zügen" existiert in dieser Form nicht.**
4. **`gpt-6-astra` wird ausschließlich vom ORB-Chat benutzt** – über den
   Endpunkt `/responses`, und ORB ist der einzige Aufrufer dieses Endpunkts
   (`provider.server.ts:36`). Alle anderen Modelle im Protokoll gehören zu
   Moderation, Übersetzung und Stimme.
5. **Datenbank:** Nach P0/P1 verbleiben gemessen 24–27 Abfragen pro Zug im
   Testaufbau (Produktion Ø 20,1). Der größte klar abgrenzbare Block ist die
   **Momentaufnahme nach dem Zug: 9 Leseabfragen**, die nach dem Schreiben
   erfolgen.

# Ausgangsdaten

## Gateway-Protokoll (gemessen, Fenster 2026-09-16T00:00Z – 2026-09-23T09:28Z)

| Größe | Wert |
| --- | --- |
| Anfragen insgesamt | **739** |
| davon `responses` (alle `openai/gpt-6-astra`) | **705** |
| davon `chat_completions` (`google/gemini-3.7-flash`) | 3 |
| davon `audio_speech` (`openai/gpt-4o-mini-tts`) | 28 |
| Rest (Transkription) | 3 |
| Anfragen mit Status `error` | **0** |

Pro Tag (`responses` + andere, gemessen):

| Tag | Gateway-Anfragen | ORB-Ereignisse in der DB |
| --- | --- | --- |
| 2026-09-16 | 3 | 0 |
| 2026-09-17 | 0 | 0 |
| 2026-09-18 | 0 | 0 |
| 2026-09-19 | 189 (180 `responses`) | 59 |
| 2026-09-20 | 60 | 62 |
| 2026-09-21 | 208 | 150 |
| 2026-09-22 | 153 | 86 |
| 2026-09-23 (bis 09:28Z) | 126 | 57 |
| **Summe** | **739** | **414** |

## ORB-Ereignisse (gemessen, `orb_metrics` / `orb_messages`)

| Größe | Wert |
| --- | --- |
`orb_metrics` `turn` | 390
`orb_metrics` `proactive` | 24
**Summe nachweisbarer Modell-Ereignisse** | **414**
`orb_metrics` `analysis` | 252 (eigener OpenAI-Zugang, **keine** Lovable-Credits)
`orb_messages` Rolle `orb` | 414 (exakt gleich)
erster Datensatz | 2026-09-19 **17:57:43Z**
letzter Datensatz | 2026-09-23 **08:17:55Z**
Ø DB-Abfragen je `turn` | 20,1 (Median 19, min 11, max 43)
Ø DB-Abfragen je `proactive` | 9,9

Bemerkenswert: **2026-09-20 sind es 60 Gateway-Anfragen zu 62 ORB-Ereignissen –
Verhältnis ≈ 1:1.** Das ist der direkte Beweis, dass der laufende Betrieb
**einen** Modellaufruf pro Ereignis erzeugt und die Überschüsse anderer Tage
nicht aus dem normalen Chatbetrieb stammen.

# Event → Model Call Mapping

Was das Protokoll **nicht** liefert: Event-ID, Conversation-ID, User-ID,
aufrufende Funktion. Die Gateway-Einträge enthalten `log_id`, `run_id`,
Zeitstempel, Modell, Endpunkt, Dauer, Token, Kosten – **keine** Anwendungs-IDs
(`payload_state: redacted` bei allen geprüften Einträgen). Eine Zuordnung
Einzelaufruf ↔ Einzelereignis ist daher **technisch nicht möglich**; korreliert
werden kann nur über Zeitfenster, Anzahl und Codepfad.

Codeseitig ist die Zuordnung dagegen vollständig:

| Ereignis | Aufrufstelle | Modell | Zweck | Aufrufe/Ereignis | Ergebnis |
| --- | --- | --- | --- | --- | --- |
| User-Nachricht, normaler Weg | `engine.server.ts:1232` | gpt-6-astra | Gesprächsbeitrag formulieren | **1** | sichtbar ausgeliefert |
| User-Nachricht, eigener Impuls zugelassen | `engine.server.ts:1211` (`else`-Zweig) | gpt-6-astra | Gesprächsbeitrag formulieren | **1** | sichtbar |
| User-Nachricht, eigener Impuls **freigegeben** | – (`selfQuestion`-Zweig) | – | Frage steht bereits als Text | **0** | sichtbar, ohne Modellaufruf („interne Frage ohne Sprachaufruf") |
| Proaktive Frage (autonom / „frag mich") | `engine.server.ts:2269` | gpt-6-astra | Frage formulieren | **1** | sichtbar **oder** verworfen (Ähnlichkeitsvergleich) |
| Hintergrundauswertung (`analysis`) | `analysis/analyze.server.ts` | gpt-4o-mini | Bewertung | 1 | **nicht über den Gateway** (eigener OpenAI-Zugang) |
| Stimme (Vorlesen) | `voice.server.ts:88` | gpt-4o-mini-tts | Sprachausgabe | 1 je Abspielung | 28 Aufrufe im Fenster |
| Moderation / Übersetzung | `moderation.server.ts`, `translate.server.ts`, `content-moderation.server.ts` | gpt-5.4-mini, gemini-3.6/3.7-flash | Prüfen / Übersetzen | 1 je Vorgang | 3 Aufrufe im Fenster |

# 669 vs 414 Analyse

Rechnung mit den aktuellen Zahlen (das frühere „669" ist die
`gpt-6-astra`-Zahl eines etwas kürzeren Fensters; jetzt sind es 705):

| Rechnung | Wert |
| --- | --- |
| ORB-Textaufrufe (`responses`) im Fenster | 705 |
| nachweisbare ORB-Ereignisse in der DB | 414 |
| **Differenz** | **291** |

Aufgeschlüsselt nach Zeitfenstern (gemessen):

| Fenster | `responses` | ORB-Ereignisse | Differenz |
| --- | --- | --- | --- |
| vor dem ersten Datensatz (bis 2026-09-19 17:57:48Z) | 129 (40 vor 09:50Z + 89 danach) | **0** | 129 |
| Datenfenster 2026-09-19 17:57:43Z – 2026-09-23 08:17:56Z | 548 | 414 | 134 |
| nach dem letzten Datensatz (08:17:56Z – 09:25Z) | 36 | **0** | 36 |

## Bewiesene Mechanismen

**(M1) Protokollfenster > Datenfenster – BEWEISGRAD HIGH.**
Der ORB-Kern wurde am 2026-09-19 gebaut (`engine.server.ts` erster Commit
`5c95c5b7`, 09:50Z; Tabellen aus Migration 0042, Commit `e0bba0c6`, 06:42Z).
Die ältesten erhaltenen ORB-Datensätze beginnen erst 17:57:43Z. In den 129
Aufrufen davor existiert **keine** Datenzeile. Diese Aufrufe stammen aus der
Entwicklungs- und Testphase desselben Tages.

**(M2) Programmläufe gegen eine Test-Datenbank – BEWEISGRAD HIGH.**
Im Entwicklungsraum sind sowohl `OPENAI_API_KEY` als auch `LOVABLE_API_KEY`
gesetzt (nur Vorhandensein geprüft, keine Werte gelesen). Läuft `processInput`
in einem Test gegen den protokollierenden Datenbank-Ersatz, entsteht ein
**echter** Modellaufruf, aber **keine** Zeile in `orb_messages`/`orb_metrics`.
Direkter Nachweis von heute: zwischen 08:17:56Z und 09:25Z stehen **36
Gateway-Aufrufe** gegenüber **0** ORB-Ereignissen; die Einträge um
09:15:44Z–09:17:08Z treten in Dreiergruppen mit exakt zwei wiederkehrenden
Eingabelängen (434 / 444 Token) auf – das entspricht den drei Messtests der
P1-Prüfung mit ihren zwei festen Testsätzen (z. B. `log_id`
`01a0cd8d-ef27-7a9a-9bd9-38a8f4e3c5b9`, 09:17:08Z, 434 in / 18 out,
0,02096 Credits).
**Offen ausgewiesen:** diese Aufrufe hat die P1-Prüfung selbst verursacht
(Größenordnung ~0,02 Credits je Aufruf). Ab jetzt lassen sich solche Messungen
kostenfrei fahren, indem die Schlüssel für den Testlauf leer gesetzt werden –
genau so wurden die Traces in diesem Bericht erhoben (0 Modellaufrufe).

**(M3) Ausgeschlossene Ursachen – BEWEISGRAD HIGH.**

| Vermutung | Befund |
| --- | --- |
| mehrere Modellaufrufe pro Ereignis | **ausgeschlossen**: `if/else`, genau eine Aufrufstelle je Weg |
| Wiederholungen (Retry) | **ausgeschlossen**: keine Retry-Logik; 0 Fehlerantworten im Protokoll |
| interne Bewertung / Memory / Graph / Ähnlichkeit per Modell | **ausgeschlossen**: alle deterministisch im Code |
| Moderation/Übersetzung verfälschen die Zahl | **ausgeschlossen**: anderer Endpunkt, andere Modelle, nur 3 Aufrufe |
| Fehler-Fallback erzeugt Zusatzaufruf | **teilweise**: fällt OpenAI aus, ersetzt der Gateway-Aufruf den OpenAI-Aufruf – er kommt **nicht hinzu** |
| Doppelte Events / Zählfehler in `orb_metrics` | **ausgeschlossen**: `orb_messages` (414) und `orb_metrics` (414) stimmen exakt überein |

## Verbleibend nicht beweisbar

Die **134 Zusatzaufrufe innerhalb des Datenfensters** lassen sich mit den
vorhandenen Protokollen **nicht einzeln zuordnen**. Mechanismus M2 (Testläufe
im Entwicklungsraum, die nichts persistieren) erklärt sie plausibel – an den
Entwicklungstagen 09-19/09-21/09-22/09-23 wurde jeweils die gesamte Testkette
mehrfach ausgeführt, während der ruhige Tag 09-20 ein Verhältnis von 1:1 zeigt.
**Das ist eine HYPOTHESE, nicht bewiesen**, weil im Gateway-Protokoll keine
Anwendungs-ID mitläuft.

> **„Nicht vollständig beweisbar mit den aktuell verfügbaren Logs."**
> Nötige Messung für den Vollbeweis: eine mitgeführte Kennung je Modellaufruf
> (Ereignis-ID / Umgebung) und ein Zähler „Modellaufrufe pro Ereignis" in
> `orb_metrics`. Beides ist **nicht implementiert** und wird hier nur empfohlen.

# Modell-Call-Kategorien

| Kategorie | Aufrufe (Fenster) | Zuordnung | Beweisgrad |
| --- | --- | --- | --- |
| A normale Chat-Antwort | 390 (= `turn`) | `engine.server.ts:1211/1232` | HIGH |
| B autonome / angeforderte Frage | 24 (= `proactive`) | `engine.server.ts:2269` | HIGH |
| C interne Bewertung | **0** über den Gateway (252 über eigenen OpenAI-Zugang) | `analysis/analyze.server.ts` | HIGH |
| D Memory-bezogen | **0** | deterministisch | HIGH |
| E Graph-bezogen | **0** | deterministisch | HIGH |
| F Ähnlichkeitsprüfung | **0** | `similarity()`, `isDuplicateQuestion()` – reine Berechnung | HIGH |
| G Retry | **0** | keine Retry-Logik, 0 Fehler im Protokoll | HIGH |
| H Fehler-/Fallback-Aufruf | Anzahl unbekannt (ersetzt den OpenAI-Aufruf, addiert nicht) | `select.server.ts:49` | MEDIUM |
| I **UNKNOWN** | **291** (129 vor Datenbeginn, 134 im Datenfenster, 36 danach) | nicht einzeln zuordenbar | – |

# gpt-6-astra Nutzung

- **705 von 739** Gateway-Anfragen (95,4 %) sind `openai/gpt-6-astra`, alle über
  `/responses`, alle aus der ORB-Sprachschicht.
- Einzelkosten der eingesehenen Einträge: **0,0186 – 0,0450 Credits**,
  Eingabe 345–954 Token, Ausgabe 10–38 Token, Dauer 1.378–3.905 ms.
- Nicht-ORB: 28 Sprachausgaben (0,0055 je Aufruf), 3 Übersetzungen (0,0049),
  3 Transkriptionen.
- Das Modell ist damit der einzige relevante Kostenträger, und seine Anzahl
  hängt **1:1 an der Zahl der Gesprächsbeiträge** (plus die unter „669 vs 414"
  beschriebenen Nicht-Produktionsläufe).

# Silent Responses

**Korrektur gegenüber dem P0/Forensik-Bericht.** Gemessen in `orb_messages`
(Rolle `orb`):

| `decision` | Anzahl | leere Texte | Ø Textlänge |
| --- | --- | --- | --- |
| stay_silent | 166 | **0** | 166 Zeichen |
| remind | 128 | 0 | 418 |
| answer | 71 | 0 | 185 |
| ask | 49 | 0 | 113 |

- **Wo wird entschieden?** `decide()` (`core.ts:196–216`) liefert die interne
  Steuergröße; `stay_silent` entsteht bei `energy < 0.12`. Diese Entscheidung
  fällt **vor** dem Modellaufruf.
- **Was passiert damit?** `conversationDecision()` (`core.ts:226–237`) setzt
  `stay_silent` **immer** auf `answer` um: „Sendet der Benutzer eine Nachricht,
  hat die normale Gesprächsverarbeitung immer Vorrang." Der Text wird formuliert
  **und ausgeliefert**; gespeichert wird lediglich das interne Etikett.
- **Konsequenz:** Es gibt **keine** 166 bezahlten, unsichtbaren Antworten. Eine
  Optimierung „kein Modellaufruf bei stillen Zügen" würde **sichtbare Antworten
  entfernen** und damit ORB-Verhalten verändern – sie ist **keine** reine
  Einsparung. Der frühere Bericht hat diesen Punkt falsch bewertet; er gilt
  hiermit als widerlegt.
- Echtes „still" existiert nur im **proaktiven** Pfad (`engine.server.ts:2349`)
  – und dort ausschließlich als Ergebnis: Gate nicht erlaubt (**vor** dem
  Modellaufruf, kostenfrei), Sprachschicht nicht verfügbar, oder
  Ähnlichkeitsvergleich (**nach** dem Modellaufruf). Nur der letzte Fall kostet
  einen Aufruf ohne sichtbares Ergebnis; er betrifft höchstens einen Teil der
  24 proaktiven Ereignisse.

**Keine Änderung implementiert.**

# Autonome Fragen

Reihenfolge im Code (unverändert, P0-1 bleibt unberührt):

| Schritt | vor/nach Modellaufruf | braucht das fertige Modellresultat? |
| --- | --- | --- |
| Wissenslücke erkennen (`detectGaps`) | vor | nein |
| Kandidat wählen, Themen-/Kontextprüfung | vor | nein |
| Energie- und Neugier-Schwellen, Cooldown | vor | nein |
| Duplikatprüfung der **Kandidaten** (`isDuplicateQuestion`, `engine.server.ts:1181`) | vor | nein |
| Impulsvergleich, Endfreigabe (`finalAutonomyGate`, `:2376`) | vor | nein |
| **Formulierung durch das Modell (`:2269`)** | – | – |
| Ähnlichkeitsvergleich des **fertigen Satzes** (`:2391`) | nach | **ja** |
| Ausgabe oder Verwerfen (`:2396`) | nach | ja |

Bestätigt: **alle** rechnerischen Prüfungen liegen vor dem kostenpflichtigen
Aufruf. Der einzige Schritt danach vergleicht den **formulierten Satz** mit den
bereits gestellten Fragen und benötigt dieses Ergebnis zwingend. Eine
Vorverlagerung wäre eine neue Regel – **nicht Teil dieser Untersuchung.**

# Database Request Attribution

Gemessen (Testaufbau, Modellaufruf deaktiviert, daher 0 Credits). Zuordnung je
Abfrage:

| # | Funktion / Zweck | Tabelle | Operation | Bewertung |
| --- | --- | --- | --- | --- |
| 1 | Zustand lesen (`ensureState`) | orb_state | select | notwendig |
| 2–5 | Kandidatensuche (`retrieveCandidates`: norm_key, Thema, Absicht, letzter Zugriff / Inhalt) | orb_nodes | select ×4 | notwendig (verschiedene Suchen, P1-C) |
| 6 | Verbindungen der Kandidaten | orb_connections | select | notwendig (nur bei Treffern) |
| 7 | Gesprächsfenster (8 Nachrichten) | orb_messages | select | notwendig |
| 8 | Interessen (8) | orb_interests | select | notwendig |
| 9 | Gedankenfäden (Anzeige, 12) | orb_threads | select | notwendig |
| 10 | Vergleichsmenge Fadenzuordnung (60) | orb_threads | select | notwendig (anderer Filter, P1-C) |
| 11 | Stilprofil | orb_style | select | notwendig |
| 12 | offene Rückfrage (nur ohne „frag mich") | orb_questions | select | notwendig |
| 13 | Knoten anlegen **oder** verstärken | orb_nodes | insert/update | notwendig (nach P1 genau **ein** Schreibvorgang) |
| 14 | Verbindungen setzen | orb_connections | insert/update | notwendig (Existenzabfrage nach P1 entfällt bei neuem Knoten) |
| 15 | Interesse fortschreiben | orb_interests | upsert | notwendig |
| 16 | Stilprofil fortschreiben | orb_style | insert | notwendig |
| 17 | Zustand schreiben | orb_state | update | notwendig |
| 18 | Nachrichtenpaar schreiben | orb_messages | insert (1 Aufruf, 2 Zeilen) | notwendig |
| 19 | Messwerte schreiben | orb_metrics | insert | Protokollierung – **notwendig für Diagnose**, fachlich verzichtbar |
| 20–27 | **Momentaufnahme nach dem Zug** (`getSnapshot`) | orb_state, orb_nodes, orb_connections, orb_messages, orb_interests, orb_suggestions ×2, orb_threads, orb_style | select ×9 | **UNKNOWN** – liest den Zustand *nach* den Schreibvorgängen für die Oberfläche; ob die Oberfläche alle neun Teile bei jedem Zug benötigt, ist nicht bewiesen |

Produktion Ø 20,1 (Median 19) je Zug; der Testaufbau zeigt 24–27, weil dort
jeder Zweig mit Treffern durchlaufen wird.

# Request Traces

Alle drei Traces sind **gemessen** (protokollierender Datenbank-Ersatz, keine
Produktionsdaten berührt, keine Modellaufrufe).

```text
TRACE A – normale Nachricht ohne Erinnerungstreffer (24 DB-Aufrufe)
Browser (Chat senden)
 └─ Server-Funktion → processInput
     ├─ LESEN  orb_state, orb_nodes ×4, orb_messages, orb_interests,
     │         orb_threads ×2, orb_style, orb_questions          (11)
     ├─ MODELL 1 × gpt-6-astra /responses
     ├─ SCHREIBEN orb_style, orb_state, orb_messages, orb_metrics (4)
     └─ LESEN  Momentaufnahme: orb_state, orb_nodes, orb_connections,
               orb_messages, orb_interests, orb_suggestions ×2,
               orb_threads, orb_style                             (9)
 └─ Antwort an den Browser → Anzeige (KEIN Folge-Request aus dem Zustand)

TRACE B – Nachricht mit Erinnerungstreffer (26 DB-Aufrufe)
wie A, zusätzlich: orb_connections lesen (Kandidaten) + orb_nodes update
(Reaktivierung, nach P1 genau ein Schreibvorgang)

TRACE C – „Frag mich was." / autonome Frage (27 DB-Aufrufe)
wie B, zusätzlich: orb_nodes/orb_questions/orb_connections für den
Fragekontext; nach P0-2 KEIN zweites Laden von Zustand, Fenster,
Interessen, Fäden
```

**Ergebnis zur Loop-Frage:** In allen drei Traces gibt es **keine Kette**
„Request → State Update → Request → State Update". Die Abfragen sind
aufeinanderfolgende, unabhängige Verarbeitungsschritte **innerhalb eines**
Serveraufrufs; danach endet die Kette mit der Antwort. Die einzige Rückkopplung
ist die Hintergrundauswertung (`analysis`), die pro Nachricht **einen** zweiten
Serveraufruf mit 3 DB-Abfragen erzeugt (gemessen: `db_queries` = 3, konstant)
und **nicht** über den Lovable-Gateway läuft.

# Credit Attribution

- Zuordnung einzelner Aufrufe zu Kategorien über das Protokoll: **nicht
  möglich** (keine Anwendungs-IDs, `payload_state: redacted`).
- Zuordnung über den Code: 95,4 % aller Gateway-Anfragen sind der ORB-Chat.
- Einzelkosten sind belegt (0,0186–0,0450 Credits je Chat-Aufruf).
- **ZEITRAUM FEHLT:** Der Messzeitraum der Lovable-Verbrauchsanzeige
  (Database 114, AI 30,1, Compute 10,7, Network 3,72) ist weiterhin unbekannt.
  Deshalb **keine** Credits pro Tag/Stunde und **keine** Zuordnung
  Anzeige ↔ Protokoll.

# Sicher bewiesene Ergebnisse

1. Ein ORB-Ereignis erzeugt höchstens **einen** Modellaufruf; der freigegebene
   eigene Impuls im Zug erzeugt **keinen**.
2. Es gibt keine Retry-, Bewertungs-, Memory-, Graph- oder
   Ähnlichkeits-Modellaufrufe. 0 Fehleranfragen im Protokoll.
3. `gpt-6-astra` gehört zu 100 % dem ORB-Chat; ORB ist der einzige Nutzer von
   `/responses`.
4. 414 Ereignisse in `orb_metrics` und 414 ORB-Nachrichten stimmen exakt
   überein – die Ereigniszählung ist fehlerfrei.
5. Am ruhigen Tag 2026-09-20 liegt das Verhältnis Gateway:Ereignis bei 60:62
   ≈ 1:1 – der Produktivbetrieb erzeugt keine Zusatzaufrufe.
6. Die ORB-Daten beginnen erst am 2026-09-19 17:57:43Z; 129 Modellaufrufe
   liegen davor.
7. Testläufe des Kerns gegen einen Datenbank-Ersatz erzeugen echte
   Modellaufrufe ohne Datenspur (heute: 36 Aufrufe, 0 Ereignisse).
8. Die 166 `stay_silent`-Nachrichten wurden **ausgeliefert** (0 leere Texte).
9. Alle rechnerischen Prüfungen autonomer Fragen liegen vor der Formulierung;
   nur der Ähnlichkeitsvergleich des fertigen Satzes liegt danach.
10. Keine Request-Kette/Loop in den drei Traces; die Momentaufnahme nach dem Zug
    kostet 9 Leseabfragen.

# Unbewiesene Hypothesen

| Hypothese | Beweisgrad | fehlende Messung |
| --- | --- | --- |
| Die 134 Zusatzaufrufe im Datenfenster stammen aus Test-/Verifikationsläufen ohne Persistenz | MEDIUM | Kennung der Umgebung je Modellaufruf |
| Die Momentaufnahme nach dem Zug ist teilweise verzichtbar | LOW | Nachweis, welche Teile die Oberfläche je Zug wirklich verwendet |
| Fehler-Fallback OpenAI → Gateway trat im Fenster auf | MEDIUM | Zählung der Fallbacks (Feld `meta.fallbackUsed` wird nicht gespeichert) |

# UNKNOWN / fehlende Daten

1. Anwendungs-/Ereignis-ID im Gateway-Protokoll: **fehlt**.
2. Zähler „Modellaufrufe pro Ereignis" in `orb_metrics`: **fehlt**.
3. Umgebungskennung (Produktion / Vorschau / Test): **fehlt**.
4. Messzeitraum der Verbrauchsanzeige: **fehlt** („ZEITRAUM FEHLT").
5. ORB-Daten vor 2026-09-19 17:57Z: **existieren nicht**.
6. Speicherung von `fallbackUsed` je Zug: **fehlt**.

# Potenzielle zukünftige Optimierungen

Nur Analyse, **nichts umgesetzt**:

1. **Messbarkeit** (kein Verhaltenseingriff): Modellaufrufzähler, Fallback-Flag
   und Umgebungskennung in `orb_metrics` – schließt die restliche Lücke
   endgültig.
2. **Testläufe ohne Modellaufruf**: Prüfläufe des Kerns ohne gesetzte Schlüssel
   ausführen; erzeugt 0 Credits (in diesem Bericht bereits so gemacht). Reine
   Arbeitsweise, keine Codeänderung.
3. **Momentaufnahme nach dem Zug** (9 Leseabfragen): nur nach Nachweis, welche
   Teile die Oberfläche je Zug benötigt.
4. **Proaktive Formulierung**: der einzige echte „bezahlt, aber verworfen"-Fall
   ist der Ähnlichkeitsvergleich nach der Formulierung; eine Vorverlagerung
   erfordert eine **neue Regel** und ist damit ausdrücklich außerhalb des
   bisherigen Auftrags.
5. **„Silent-AI-Optimierung": entfällt** – sie würde sichtbare Antworten
   entfernen (siehe „Silent Responses").

# Priorisierung für nächsten Schritt

| Rang | Maßnahme | Nutzen | Risiko |
| --- | --- | --- | --- |
| 1 | Messbarkeit ergänzen (Aufrufzähler, Fallback-Flag, Umgebung) | löst die Restlücke, ermöglicht echte Credit-Zuordnung | sehr niedrig (nur Protokoll) |
| 2 | Arbeitsweise: Prüfläufe ohne Modellschlüssel | vermeidet Credits bei Tests sofort | keines |
| 3 | Momentaufnahme nach dem Zug untersuchen | bis zu 9 Leseabfragen je Zug | mittel (Oberfläche betroffen) |
| 4 | Proaktive Vorprüfung (neue Regel) | wenige Aufrufe | mittel (Verhaltensänderung) |
| – | Silent-AI-Optimierung | **entfällt, widerlegt** | hoch |

# Entscheidungsmatrix

| Problem | Beweisgrad | mögliche Ursache | mögliche Optimierung | erwartetes Risiko | jetzt ändern? |
| --- | --- | --- | --- | --- | --- |
| Redundanter DB-Read (Fragepfad) | HIGH | doppeltes Laden | Weitergabe geladener Werte | niedrig | **bereits P0** |
| Doppelter Knoten-Write bei exaktem Treffer | HIGH | zwei Schreibvorgänge auf dieselbe Zeile | einen Schreibvorgang weglassen | niedrig | **bereits P1** |
| Verbindungs-Existenzabfrage bei neuem Knoten | HIGH | Abfrage ohne möglichen Treffer | Abfrage entfällt | niedrig | **bereits P1** |
| „Silent AI Call" (166) | **HIGH – widerlegt** | Fehlinterpretation des internen Etiketts | **keine** – Antworten sind sichtbar | hoch (Verhaltensverlust) | **NO – entfällt** |
| Momentaufnahme 9 Leseabfragen je Zug | MEDIUM | Oberfläche liest den Endzustand vollständig | gezieltes Nachladen | mittel | **NO – erst Nachweis** |
| Ähnlichkeitsvergleich nach Formulierung (proaktiv) | HIGH | Prüfung braucht den fertigen Satz | neue Vorprüfregel | mittel | **NO – neue Regel nötig** |
| 291 nicht zuordenbare Modellaufrufe | **MEDIUM** (Mechanismen M1/M2 belegt, Einzelzuordnung nicht) | Protokollfenster > Datenfenster; Testläufe ohne Persistenz | Messbarkeit ergänzen | niedrig | **NO – erst Messung** |
| Ø 20,1 DB-Abfragen je Nachricht | HIGH (gemessen) | viele eigenständige Verarbeitungsschritte | keine beweisbare Redundanz mehr offen | – | **NO** |
| Hintergrundauswertung = 2. Serveraufruf je Nachricht | HIGH | getrennter Auswertungspfad | Zusammenlegung | mittel | **NO** |

---

**STOPP.** Keine Codeänderung, kein Patch, keine Migration, keine Optimierung.
Der nächste Implementierungsschritt erfolgt erst nach Prüfung dieses Berichts.
