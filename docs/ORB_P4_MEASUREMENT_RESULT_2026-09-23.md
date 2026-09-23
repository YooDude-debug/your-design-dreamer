# ORB CORE – P4 MEASUREMENT RESULT

**Datum:** 2026-09-23
**Art:** READ-ONLY / Messphase. Keine Optimierung, keine Änderung an ORB-Logik.
**Referenz:** `docs/ORB_P3_OBSERVABILITY_RESULT_2026-09-23.md`
**Am Code geändert:** nichts. Die Messung nutzt ausschliesslich die P3-Kennungen;
das Messskript wurde nach der Auswertung wieder entfernt.

Jeder Abschnitt trennt **BEOBACHTUNG** (gemessen) von
**BEWERTUNG/HYPOTHESE** (nicht bewiesen).

---

## 1. Zeitraum der Messung

| Quelle | Zeitraum |
| --- | --- |
| Produktionskennzahlen (`orb_metrics`, `orb_messages`) | 2026-09-16 → 2026-09-23 09:45 UTC (letzte 7 Tage) |
| Gateway-Protokoll | 2026-09-23 00:00 → 09:46 UTC |
| Pfadmessung mit P3-Kennungen (Attrappe) | 2026-09-23 09:48 UTC |

**BEOBACHTUNG:** Die P3-Observability ist nicht veröffentlicht. Es liegen
deshalb **keine** P3-Protokollzeilen aus der Produktion vor; die Korrelation
Ereignis → Modellaufruf wurde in der Vorschau-/Testumgebung gemessen, die
Produktionszahlen kommen wie bisher aus `orb_metrics`.

## 2. Anzahl untersuchter ORB Events

**BEOBACHTUNG (Produktion, 7 Tage):**

| Ereignisart | Anzahl |
| --- | --- |
| `turn` (Nachricht) | 390 |
| `analysis` (Hintergrund-Auswertung) | 252 |
| `proactive` (autonome Frage) | 24 |
| **Summe** | **666** |

**BEOBACHTUNG (Pfadmessung):** 9 Ereignisse, davon 6 Nachrichten und
3 autonome Vorgänge; 6 Modellaufrufe.

## 3./4./5. Model Calls pro Event und Verteilung

**BEOBACHTUNG (Pfadmessung, alle Werte aus P3-Protokollzeilen):**

| Szenario | Pfad | Model Calls | davon erfolgreich | DB Requests | Ergebnis |
| --- | --- | --- | --- | --- | --- |
| A Nachricht, Sprachschicht ohne Zugang | turn_reply | 0 | 0 | 14 | answer |
| B Nachricht, Modell per Attrappe | turn_reply | 1 | 1 | 14 | answer |
| C Nachricht mit 12 Erinnerungen | turn_reply | 1 | 1 | 19 | remind |
| D Nachricht, Modellfehler 500 | turn_reply | 1 | 0 | 14 | answer |
| E Nachricht, Guthabensperre 402 | turn_reply | 1 | 0 | 14 | answer |
| F Nachricht, wenig Energie (0,05) | turn_reply | 1 | 1 | 14 | stay_silent |
| G Autonome Frage, leerer Graph | proactive_question | 0 | 0 | 7 | silent:no_candidate |
| H Autonome Frage, 12 Erinnerungen | proactive_question | 1 | 1 | 10 | asked |
| I Autonome Frage, wenig Energie | proactive_question | 0 | 0 | 7 | silent:no_candidate |

Verteilung der gemessenen 9 Ereignisse:

| Model Calls / Event | Anzahl | Fälle |
| --- | --- | --- |
| 0 | 3 | A (kein Zugang), G und I (kein zugelassener Kandidat) |
| 1 | 6 | alle übrigen |
| > 1 | **0** | – |

**BEOBACHTUNG:** In keinem gemessenen Pfad entstand mehr als **ein** Modellaufruf
pro Ereignis. Auch bei HTTP 500 und 402 blieb es bei genau einem Aufruf – es gibt
keinen Wiederholversuch.

**BEWERTUNG/HYPOTHESE:** Dass in der Produktion nie mehr als ein Aufruf je
Ereignis entsteht, ist damit **nicht** bewiesen; gemessen wurden neun Pfade, nicht
alle Kombinationen (z. B. Bildanhänge, Sprachpfad, Moderation).

## 6. Call Types

**BEOBACHTUNG:** Alle 6 Aufrufe der Pfadmessung: `call_type = user_visible`,
`source = orb_event`, Modell `openai/gpt-6-astra`, Endpunkt `/responses`.
`development_test` / `unattributed` trat nur bei Aufrufen ohne Ereigniskontext auf
(in P3 nachgewiesen). Es wurden keine neuen Kategorien erfunden.

## 7. Verarbeitungspfade

**BEOBACHTUNG:** Zwei Pfade lösen Modellaufrufe aus:
`turn_reply` (Antwort auf eine Nachricht, einschliesslich Erinnerungsabruf und
stiller Zug) und `proactive_question` (autonome Frage). Der dritte
Produktionspfad `analysis` (252 Ereignisse) läuft über den eigenen
OpenAI-Zugang (`gpt-4o-mini`, nicht über den Lovable-Gateway) und erzeugt keine
Lovable-Credits.

**BEOBACHTUNG (wichtig):** Szenario **I** zeigt: bei zu wenig Energie entstehen
**0** Modellaufrufe – die rechnerische Prüfung liegt nachweislich vor der
Formulierung (Bestätigung der P0-1-Feststellung).

**BEOBACHTUNG:** Szenario **F** zeigt: ein als „still" markierter Zug erzeugt
trotzdem **einen** Modellaufruf. Das deckt sich mit P2; laut P2 wird der Text bei
einer Nachricht aber immer in eine echte Antwort umgewandelt, ist also nicht
verworfen.

## 8. DB Requests pro Event

**BEOBACHTUNG (Produktion, 7 Tage, `orb_metrics.db_queries`):**

| Ereignisart | n | Mittel | Median | Min | Max |
| --- | --- | --- | --- | --- | --- |
| turn | 390 | 20,13 | 19 | 11 | 43 |
| analysis | 252 | 3,00 | 3 | 3 | 3 |
| proactive | 24 | 9,92 | 10 | 9 | 10 |

Verteilung `turn` (Auszug): 11–13 → 20 Fälle; 14–16 → 132 Fälle; 17–22 → 138;
23–29 → 46; 30–38 → 52; 40 → 1; 43 → 1.

**BEOBACHTUNG (Pfadmessung):** Grundlast einer Nachricht 14 Abfragen; mit
12 Erinnerungen 19; autonomer Vorgang 7 (still) bzw. 10 (Frage gestellt).

**BEOBACHTUNG:** Die Zahl wächst mit dem Erinnerungsbestand des Nutzers
(14 → 19 bei 12 Knoten). `analysis` ist mit konstant 3 Abfragen die günstigste
Ereignisart.

## 9. Auffällige Ausreisser

**BEOBACHTUNG:**
- Zwei Nachrichten mit 40 bzw. 43 Datenbankabfragen (doppelte Grundlast).
- 09:15–09:17 UTC: 9 Gateway-Aufrufe, zu denen es **kein** ORB-Ereignis gibt
  (letztes Produktionsereignis 08:17 UTC). Das sind meine eigenen Mess- und
  Prüfläufe (in P2 bereits als solche identifiziert).
- 09:39:21–09:39:33 UTC: 5 echte Aufrufe, je 0,0172 Credits (≈ 0,086 gesamt).
  Das war der versehentlich gegen den echten Dienst gelaufene P3-Vergleichstest
  (in P3 offengelegt). In P4 selbst wurde **kein** echter Modellaufruf erzeugt –
  die gesamte Pfadmessung lief über eine Attrappe.

**BEWERTUNG/HYPOTHESE:** Die Ausreisser mit 40/43 Abfragen entstehen
vermutlich bei vielen gleichzeitig erkannten Erinnerungen bzw. Verbindungen –
**nicht bewiesen**, dafür fehlt die Zuordnung Ereignis → einzelne Abfrage.

## 10. Eindeutig zuordenbare Calls

**BEOBACHTUNG:** Alle 6 Aufrufe der Pfadmessung sind vollständig zuordenbar
(Ereignis-Kennung, Aufrufkennung, Sequenznummer, Pfad, Erfolg, Dauer, Fehlerart).
Für künftige Produktionsläufe gilt dieselbe Zuordnung, sobald die
P3-Observability veröffentlicht ist.

## 11. Nicht eindeutig zuordenbare Calls

**BEOBACHTUNG:** Die bekannten **134** historischen Modellaufrufe bleiben
**nicht vollständig zuordenbar**. Sie wurden in P4 **nicht** nachträglich
zugeordnet und dürfen nicht als unnötig gelten. Auch die heutigen 9 Aufrufe von
09:15–09:17 UTC bleiben ohne ORB-Ereignis; sie sind als eigene Prüfläufe
plausibel, aber nicht je Aufruf bewiesen.

## 12. Technische Kostenindikatoren

**BEOBACHTUNG (Gateway-Protokoll, 2026-09-23):** 131 Aufrufe, Modell
`openai/gpt-6-astra`, Endpunkt `responses`, ausschliesslich Status 200.
Kosten je Aufruf 0,0172–0,0246 Credits; Dauer 1,9–4,4 s; Eingabe 385–444,
Ausgabe 9–34 Token.

**BEWERTUNG/HYPOTHESE:** Eine Hochrechnung auf Tages- oder Monatskosten wird
**nicht** gemacht – der Zeitraum der Verbrauchsanzeige ist weiterhin unbekannt
(„ZEITRAUM FEHLT" aus P2 gilt fort).

## 13. Teststatus

| Prüfung | Ergebnis |
| --- | --- |
| Logiktests | 1371 / 1371 grün |
| Datenbank-/Sicherheitstests | 102 / 102 grün |
| Typprüfung (`tsgo --noEmit`) | fehlerfrei |
| Lint der berührten Dateien | sauber (globaler Lint-Lauf enthält nur die bekannten Altlasten in `backups/`, `release/`, `remotion/` u. a.) |
| Build | erfolgreich |

Keine Regression. Am Produktionscode wurde in P4 nichts verändert.

## 14. Konkrete Beobachtungen (Zusammenfassung)

1. Höchstens **1** Modellaufruf je Ereignis in allen 9 gemessenen Pfaden.
2. **Kein** Wiederholversuch bei HTTP 500 und 402.
3. Die Energieprüfung liegt vor der Formulierung: wenig Energie → 0 Aufrufe.
4. Ein „stiller" Zug erzeugt dennoch 1 Aufruf.
5. Datenbanklast: Nachricht 14 (Grundlast) bis 19 (12 Erinnerungen); Produktion
   im Mittel 20,13, Median 19, Maximum 43.
6. `analysis` ist mit konstant 3 Abfragen und ohne Lovable-Credits die
   günstigste Ereignisart.
7. Autonome Vorgänge sind selten (24 in 7 Tagen) und kosten 7–10 Abfragen.

## 15. Offene Fragen / fehlende Messdaten

- Keine P3-Daten aus der Produktion, solange die Observability nicht
  veröffentlicht ist – die Verteilung „>1 Aufruf je Ereignis" ist für echte
  Nutzung noch unbelegt.
- Einzelne Datenbankabfragen tragen keine Ereignis-Kennung; die 40/43-Ausreisser
  sind nicht aufgeschlüsselt.
- Zeitraum der Lovable-Verbrauchsanzeige weiterhin unbekannt.
- Sprach-, Bild- und Moderationspfade sind nicht gemessen.
- Die 134 historischen Aufrufe bleiben ungeklärt.

---

## Ableitbare Möglichkeiten – NICHT umgesetzt

Nur zur Entscheidungsvorlage; in P4 wurde nichts geändert.

| Möglichkeit | Beweisgrad | Bemerkung |
| --- | --- | --- |
| Datenbank-Grundlast einer Nachricht (14 Abfragen) prüfen | BEOBACHTUNG | Welche davon wirklich nötig sind, ist **nicht** bewiesen |
| Momentaufnahme nach dem Zug (9 Leseabfragen, P2) | HYPOTHESE | Ob die Oberfläche alle braucht, ist offen |
| Stille Züge ohne Formulierung | HYPOTHESE, **abgeraten** | Laut P2 würden sichtbare Antworten entfallen |
| Ausreisser 40/43 Abfragen untersuchen | HYPOTHESE | Braucht Abfragezählung je Pfad |
| P3-Observability veröffentlichen, um echte Daten zu erhalten | – | Erfordert ausdrückliche Freigabe (Phase-4-Rollout) |

**STOPP.** Keine Optimierung, keine ChatBridge, keine P5-Änderung begonnen.
