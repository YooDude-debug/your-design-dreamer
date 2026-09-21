# ORB PRODUCTION FORENSIC ANALYSIS — CASE 2

Analysedatum: 2026-09-21 · Modus: STRICT READ-ONLY · Umgebung: Production
Keine Code-, Daten-, Speicher-, Konfigurations- oder Schwellenänderung. Kein Deployment.
Nur lesende SQL-Abfragen (`orb_messages`, `orb_nodes`, `orb_connections`, `orb_questions`,
`orb_metrics`, `orb_candidates`, `orb_node_history`), gefiltert auf das betroffene Ereignis.
Referenzfall: `docs/ORB_AUTONOMOUS_QUESTION_EVENT_2026-09-20.md` (Case 1, unverändert).

Betroffener Nutzer: `9ce1d1b0-…97` (bekanntes ORB-Testkonto). Keine Fremddaten eingesehen,
keine Tabellen-Dumps, keine Secrets gelesen.

---

## 1. Executive Summary

Das Ereignis liegt **nicht** am 2026-09-20, sondern am **2026-09-19, 18:04–18:05 UTC**
(= 20:04–20:05 Berlin; Screenshot-Uhrzeit 20:20 ist der Betrachtungszeitpunkt).

Drei technisch getrennte Ereignisse, in dieser Reihenfolge belegt:

1. **Modellaussage** 18:04:31.689 UTC („… merke ich mir …“) — erzeugt, **bevor** irgendetwas
   persistiert war. Sie ist kein Persistenznachweis.
2. **Persistenz** 18:04:35.100 UTC — ein Knoten `132bf051-…` mit dem **Rohsatz** des Nutzers
   (importance 0.48 ≥ Schwelle 0.35, confidence 0.9, source `user_stated`, lifecycle `active`).
   Es wurden **keine** vier Einzelfakten gespeichert, sondern eine Äußerung.
3. **Abruf** 18:05:47.846 UTC — Antwort mit `recalled = 1`, `nodes_loaded = 3`; die Angaben
   Brokkoli/Schnitzel, RTX 5070, Schuhgröße 42 wurden aus dem Knoten reproduziert.

Die Zwischenfrage „Welche konkrete persönliche Information über dich soll ich mir merken?“
(18:05:12.998 UTC) war ein **echter eigener Beitrag ohne neue Nutzereingabe**, aber über den
**Curiosity-Zweig** (gap_kind `detail`, score 0.40446, energy 0.618) — **nicht** über den
Impuls-Zweig aus Case 1.

Endklassifikation: **A. CAUSALITY CONFIRMED** für die Kette Eingabe → Erkennung → Entscheidung →
Persistenz → Zustandsänderung → Abruf → Folgeverhalten. Einzige nicht bewiesene Teilstrecke ist
die Laufzeit-Zwischenstufe „Kandidatenerzeugung“ (existierte an diesem Tag noch nicht).

---

## 2. Case 2 Event Timeline (alle Zeiten UTC)

| # | Zeit | Quelle | Ereignis | Identifier |
|---|---|---|---|---|
| 1 | 17:57:43.801 | `orb_messages` | User: „Guten Abend. Ich heiße Mario und du“ | `fa767d56-…` |
| 2 | 18:01:39.458 | `orb_messages` | User: Ankündigung, persönliche Informationen zu nennen | `80a8f65c-…` |
| 3 | 18:01:39.459 | `orb_messages` | ORB `answer`: sagt ausdrücklich, dauerhafte Erinnerung nicht zusicherbar | `ca451909-…` |
| 4 | 18:01:42.809 | `orb_nodes` | Knoten aus (2) angelegt, importance 0.55 | `dac061cb-…` |
| 5 | **18:04:31.688** | `orb_messages` | **User: „Ich esse gerne Brokkoli, Schnitzel. Trinke Alkoholfreies Bier. Habe Schuhgröße 42, mein gaming PC hat eine Nvidia rtx 5070“** | `b610a162-…` |
| 6 | **18:04:31.689** | `orb_messages` | ORB `answer` „… für dieses Gespräch merke ich mir …“, snapshot `importance 0.35`, `recalled 0`, energy 0.618 | `ff3cb09b-…` |
| 7 | **18:04:35.100** | `orb_nodes` | **Persistenz**: Knoten mit Rohsatz aus (5); importance 0.48, confidence 0.9, `user_stated`, `active`, 0 Verbindungen | `132bf051-…` |
| 8 | 18:04:35.530 | `orb_metrics` | `kind = turn`, nodes_loaded 2, connections_loaded 0, ai_ms 2839 | `4cb2ff4d-…` |
| 9 | **18:05:12.998** | `orb_messages` | **Eigener Beitrag ohne Nutzereingabe**, `decision = ask`: „Welche konkrete persönliche Information über dich soll ich mir merken?“ | `1c088006-…` |
| 10 | 18:05:12.998 | `orb_questions` | Frage gespeichert: topic `erzähle`, gap_kind `detail`, score 0.40446, Grund „kennt die Aussage nur allgemein, ohne konkretes Detail … Relevanz 0.73, Neuheit 1.00, Neugier high“ | `145b70ef-…` |
| 11 | 18:05:15.454 | `orb_metrics` | `kind = proactive`, retrieval 82 ms, relevance 59 ms, nodes_loaded 3 | `037f0d8c-…` |
| 12 | 18:05:47.845 | `orb_messages` / `orb_questions` | User: „Mein Lieblingsessen. Meine Grafikkarte und meine Schuhgröße“; Frage `145b70ef-…` als `answered` markiert | `6067074e-…` |
| 13 | **18:05:47.846** | `orb_messages` | **Abruf**: ORB nennt Brokkoli/Schnitzel, RTX 5070, Schuhgröße 42; snapshot `recalled = 1` | `3fdce42f-…` |
| 14 | 18:05:51.624 | `orb_nodes` | Knoten aus (12) angelegt, importance 0.48 | `4e4167ac-…` |
| 15 | 18:05:51.729 | `orb_connections` | **Zustandsänderung**: Verbindung `132bf051 → 4e4167ac`, Gewicht heute 0.848 | `283725f0-…` |
| 16 | 18:05:52.377 | `orb_metrics` | `kind = turn`, nodes_loaded 3, db_queries 26 | `c7dae77b-…` |
| 17 | 18:06:30.259 | `orb_messages` | ORB erklärt erneut, dass „Merk dir das“ allein technisch nicht genügt | `eabc84cc-…` |
| 18 | 18:07:14.884 | `orb_messages` / `orb_questions` | Zweiter eigener Beitrag, gap_kind `grund`, score 0.37446, Neugier `very_high` | `da514bb1-…` / `96e14f0d-…` |
| 19 | 18:07:52.513 | `orb_connections` | weitere Verbindung `132bf051 → 1ac5eb3b` (Preis-Leistung), heute 0.943 | `be3ad945-…` |
| 20 | 2026-09-20 19:17:09 | `orb_nodes` | Knoten `132bf051` zuletzt aktiviert; `activation_count = 11` | — |

Nicht beobachtbar: clientseitige Idle-Zeiten, verworfene Presence-Prüfungen, Prompt-Inhalt
des LLM-Aufrufs, Sitzungs-/Conversation-ID (ORB-Chat führt keine eigene Session-ID) → **NOT PROVEN**.

---

## 3. Production Evidence (Beweisrang nach Abschnitt 8 der Anforderung)

1. Unveränderlicher DB-Zustand: `orb_nodes.132bf051-…` (created_at 18:04:35.100544,
   updated_at 2026-09-20 19:17:09, importance 0.48, confidence 0.9, activation_count 11,
   lifecycle `active`, source `user_stated`).
2. `orb_connections`: 3 Kanten an diesem Knoten, erste um 18:05:51.729.
3. `orb_questions.145b70ef-…`: asked_at 18:05:12.998, answered_at 18:05:47.845.
4. `orb_messages.state_snapshot`: `recalled 0` (18:04:31) vs. `recalled 1` (18:05:47);
   Frage-Snapshot mit `proactive true`, `explicit false`, `gap_kind detail`, `score 0.40446`,
   `question_id 145b70ef-…`, `scope orb_core_chat_only`, energy 0.618, curiosity 0.7475.
5. `orb_metrics`: `turn` 18:04:35.530, `proactive` 18:05:15.454, `turn` 18:05:52.377.
6. `orb_candidates` = 0 Zeilen, `orb_node_history` = 0 Zeilen (Context Intelligence wurde erst
   am 2026-09-20 veröffentlicht; für dieses Ereignis existierte der Pfad nicht).
7. Keine Server-Function-Logs mehr für den 2026-09-19 verfügbar (Aufbewahrungsfenster) → Lücke.
8. Screenshot: nur zur Identifikation des Ereignisses verwendet, nicht als Beweis.

---

## 4. Memory State Reconstruction

| Kategorie | Befund |
|---|---|
| **A. vorher bekannt** | KEINE der vier Angaben. Keine Suche auf `brokkoli`, `schuhgr`, `5070`, `alkoholfrei` liefert einen Knoten vor 18:04:35.100. Vorhanden war nur die Absichtserklärung `dac061cb-…` (18:01:42) und der Name-Knoten `c6d0f938-…`. |
| **B. im Gespräch entstanden** | Knoten `132bf051-…` (18:04:35.100) und `4e4167ac-…` (18:05:51.624) sowie Kante `283725f0-…`. |
| **C. Sitzungskontext** | Die Antwort 18:04:31.689 basierte ausschliesslich auf dem Kontextfenster (letzte 8 Nachrichten). `recalled = 0`. |
| **D. Memory Candidate** | Existiert für dieses Ereignis **nicht** (`orb_candidates` leer; Feature erst ab 2026-09-20). NOT PROVEN als Zwischenschritt. |
| **E. persistiert** | Ja, als **eine Äußerung**, nicht als vier Fakten. „alkoholfreies Bier“ existiert ausschliesslich als Teil dieses Rohsatzes, nicht als eigener Knoten. |
| **F. abgerufen** | Ja, 18:05:47.846 (`recalled = 1`, nodes_loaded 3), später weitere Aktivierungen bis 2026-09-20 19:17. |
| **G. nur Modellaussage** | Der Wortlaut „für dieses Gespräch merke ich mir“ selbst. Die Selbstaussage war zum Sendezeitpunkt korrekt zurückhaltend („dauerhafte Speicherung kann ich nicht garantieren“) und **kein** Persistenzbeweis. |

---

## 5. Causal Chain Analysis

| Übergang | Beleg | Zeit | Quelle | ID | Konfidenz | Alternativerklärung | Klasse |
|---|---|---|---|---|---|---|---|
| USER INPUT → MEMORY RECOGNITION | Nutzernachricht und 3.4 s später Knoten mit identischem Text; Eligibility-Filter lässt Aussagen (keine Frage/Aufforderung/Fragment) zu | 18:04:31.688 → 18:04:35.100 | `orb_messages`, `orb_nodes` | `b610a162`, `132bf051` | hoch | anderer Schreibpfad — ausgeschlossen, `source = user_stated` und Textgleichheit | **CONFIRMED** |
| MEMORY RECOGNITION → MEMORY DECISION | importance 0.48 ≥ 0.35; Knoten wurde tatsächlich erzeugt, `lifecycle active` | 18:04:35.100 | `orb_nodes` | `132bf051` | hoch | — | **CONFIRMED** |
| MEMORY DECISION → PERSISTENCE | Zeile existiert unverändert seit 18:04:35.100544 | 18:04:35.100 | `orb_nodes` | `132bf051` | hoch | — | **CONFIRMED** |
| PERSISTENCE → STATE CHANGE | erste Verbindung + Anstieg `activation_count`, `updated_at` bis 2026-09-20 | 18:05:51.729 ff. | `orb_connections`, `orb_nodes` | `283725f0` | hoch | — | **CONFIRMED** |
| STATE CHANGE → RETRIEVAL | `recalled = 1` und nodes_loaded 3 in genau dem Turn, der die Fakten nennt | 18:05:47.846 / 18:05:52.377 | `state_snapshot`, `orb_metrics` | `3fdce42f`, `c7dae77b` | hoch | Kontextfenster: der Rohsatz lag 4 Nachrichten zurück und wäre auch im Fenster gewesen → Abruf belegt, **Exklusivität** des Abrufs als Quelle nicht | **CONFIRMED** (Abruf) / **SUPPORTED** (Abruf als einzige Quelle) |
| RETRIEVAL → SUBSEQUENT BEHAVIOR | Fakten korrekt und vollständig genannt; späterer Zugriff bis 2026-09-20 19:17 (activation_count 11) | 18:05:47.846 ff. | `orb_messages`, `orb_nodes` | `3fdce42f` | hoch | — | **CONFIRMED** |
| (Zwischenschritt) Kandidatenerzeugung | keine Zeile | — | `orb_candidates` | — | — | Feature am 2026-09-19 nicht vorhanden | **NOT OBSERVABLE** |
| Eigener Beitrag 18:05:12 → Curiosity-Zweig | Snapshot mit `gap_kind detail`, `score 0.40446`, kein `impulse`-Objekt; `orb_metrics kind = proactive`; keine Nutzernachricht zwischen 18:04:31.689 und 18:05:12.998 | 18:05:12.998 | `orb_messages`, `orb_questions`, `orb_metrics` | `1c088006`, `145b70ef`, `037f0d8c` | hoch | Nutzereingabe — ausgeschlossen (keine Zeile) | **CONFIRMED** |

---

## 6. Alternative-Cause Analysis (nur architektonisch plausible)

| Alternative | Prüfung | Ergebnis |
|---|---|---|
| bereits vorhandene Erinnerung | keine passenden Knoten vor 18:04:35 | ausgeschlossen |
| Sitzungs-/Kontextfenster | **teilweise wirksam**: die Antwort 18:04:31.689 stammt nachweislich nur aus dem Fenster (`recalled 0`); für 18:05:47 liegt Abruf vor, das Fenster hätte den Rohsatz aber ebenfalls enthalten | für 18:04 bestätigt, für 18:05 nicht ausschliessbar als Nebenquelle |
| Prompt-/Kontext-Injection | Knoteninhalt ist wörtlich die Nutzereingabe; kein Systemtext | ausgeschlossen |
| Frontend-Zustand | UI-Label „NACHFRAGEN“ ist nur Anzeige von `decision = ask`, der Wert steht in der DB | ausgeschlossen als Ursache |
| Modell-Halluzination | Werte 42 / RTX 5070 / Brokkoli stimmen mit dem Nutzertext überein | ausgeschlossen für diese Angaben |
| doppelte Information | nur ein Knoten mit diesen Angaben | ausgeschlossen |
| asynchrone Verarbeitung | **bestätigt und relevant**: Persistenz 3.4 s nach der Antwort → die Antwort konnte die Persistenz nicht kennen | bestätigt |
| anderes Gespräch / anderer Schreibvorgang | alle Zeilen desselben Nutzers, lückenlose Zeitfolge | ausgeschlossen |
| Staging-Kontamination | Staging nutzt eigene Datenbank; `user_stated`-Herkunft und Zeitstempel konsistent | ausgeschlossen |
| unabhängiges Systemereignis | keine weiteren Schreibvorgänge im Fenster | ausgeschlossen |

---

## 7. Case 1 vs Case 2

| Dimension | Case 1 — bestätigt (2026-09-20, 07:26 UTC) | Case 2 — untersucht (2026-09-19, 18:04–18:05 UTC) |
|---|---|---|
| Trigger | Leerlauf-Beobachter im Browser, ca. 41 s Pause | Leerlauf-Beobachter, ca. 41 s Pause (18:04:31.689 → 18:05:12.998) |
| Ausgangszustand | energy 0, curiosity 1, uncertainty 0.939, trust 1 | energy 0.618, curiosity 0.7475, uncertainty 0.58, trust 0.48 |
| Relevante Eingabe | keine neue; Bezug auf Knoten „Nicht faktisch falsch“ | keine neue für die Frage; unmittelbar davor die Faktenäußerung |
| Erkennung | `detectGaps`: wichtige Angabe ohne Verknüpfung (importance ≥ 0.6, 0 Kanten) | Curiosity-Lücke `detail`: Aussage nur allgemein, Relevanz 0.73, Neuheit 1.00 |
| Interne Entscheidung | `decideImpulse`, impulse `missing_information`, P2, Wert 0.36288 (≥ 0.2) | Curiosity-Zweig, score 0.40446, Band `high`; **kein** `impulse`-Objekt im Snapshot |
| Zustandsübergang | curiosity −0.06, energy −0.03 (blieb 0) | energy 0.618 → 0.548, curiosity 0.7475 → 0.71, trust 0.48 → 0.56 |
| Persistenz | `orb_questions a95656dc-…` + `orb_messages 409fc08f-…` | `orb_nodes 132bf051-…` (Fakten) **plus** `orb_questions 145b70ef-…` + `orb_messages 1c088006-…` |
| Abruf | nicht Teil des Falls | belegt: `recalled 1`, nodes_loaded 3, activation_count bis 11 |
| Beobachtbare Folge | Nutzer antwortete, Frage 07:26:55 als beantwortet markiert | Nutzer antwortete 18:05:47, Frage als beantwortet markiert, Fakten korrekt reproduziert |
| Alternativursachen | ausgeschlossen (keine Nutzernachricht in der Lücke) | ausgeschlossen bis auf Kontextfenster als Nebenquelle beim Abruf |
| Beweisqualität | DB-Zeilen + Snapshots; keine Serverlogs | DB-Zeilen + Snapshots + Metriken (3 Einträge); keine Serverlogs |
| Kausalkette | Impulspfad vollständig belegt | Speicher- **und** Fragepfad belegt, Kandidatenstufe nicht existent |
| Reproduzierbarkeitsbeleg | Einzelereignis | zwei eigene Fragen in derselben Sitzung (18:05:12 und 18:07:14) → wiederholtes Muster im Curiosity-Zweig |

Kein gemeinsames Kausalmuster bei der Frageerzeugung: **Case 1 = Impuls-Zweig ohne
Energieprüfung bei energy 0; Case 2 = Curiosity-Zweig mit energy 0.618 über den Schwellen.**
Beide teilen nur den Auslöser (clientseitiger Leerlauf) und die Persistenzform der Frage.

---

## 8. Causal Graph (Case 2)

```text
USER INPUT  18:04:31.688  b610a162
   │ [PROVEN]
   ├─► MODELLAUSSAGE 18:04:31.689 ff3cb09b (recalled 0, reiner Kontext)   [PROVEN, keine Persistenz]
   ▼
MEMORY RECOGNITION (Eligibility: Aussage)                                 [SUPPORTED]
   │ [PROVEN]
   ▼
MEMORY DECISION (importance 0.48 ≥ 0.35)                                  [PROVEN]
   │ [PROVEN]
   ▼
PERSISTENCE 18:04:35.100  orb_nodes 132bf051                              [PROVEN]
   │ [PROVEN]
   ▼
STATE CHANGE 18:05:51.729 Kante 283725f0 · activation_count → 11          [PROVEN]
   │ [PROVEN]
   ▼
RETRIEVAL 18:05:47.846 recalled=1 · nodes_loaded 3                        [PROVEN]
   │ [PROVEN]
   ▼
OBSERVED BEHAVIOR: Fakten korrekt genannt                                 [PROVEN]

Nebenpfad ohne neue Eingabe:
IDLE ≈41 s ─► CURIOSITY GAP (detail, 0.40446) ─► decision "ask" 18:05:12.998   [PROVEN]
MEMORY CANDIDATE STAGE                                                    [UNPROVEN — nicht existent]
```

---

## 9. Evidence Gaps

1. Keine Server-Function-Logs für 2026-09-19 (Aufbewahrung) → LLM-Prompt und verworfene
   Presence-Prüfungen nicht rekonstruierbar.
2. Keine Conversation-/Session-ID im Datenmodell; Zuordnung erfolgt über Nutzer und Zeitfolge.
3. Laufzeit-Lückenliste (`detectedGaps`) und exakte Client-Idle-Zeit werden nicht persistiert.
4. Kein Verlauf der Knotengewichte/Verbindungszahl zum Erkennungszeitpunkt (`orb_node_history`
   existierte am 2026-09-19 noch nicht).
5. Ob die Antwort 18:05:47 die Fakten aus dem Abruf **oder** aus dem Kontextfenster formulierte,
   ist nicht trennbar — beides lag vor.

---

## 10. FINDINGS — NO CHANGE MADE

1. **FINDING — NO CHANGE MADE:** Selbstaussage vor Persistenz. Die Antwort „merke ich mir“ wird
   3.4 s **vor** dem Schreibvorgang gesendet; sie kann den Persistenzerfolg nicht kennen.
2. **FINDING — NO CHANGE MADE:** Persistenz speichert die **Rohäußerung**, nicht einzelne Fakten.
   Vier Angaben liegen in einem Knoten; einzelne Fakten sind nicht adressierbar, nicht einzeln
   gewichtbar und nicht einzeln widerlegbar.
3. **FINDING — NO CHANGE MADE:** Es gibt keine Conversation-/Session-ID; Forensik ist nur über
   Zeitstempel möglich.
4. **FINDING — NO CHANGE MADE:** Stille Presence-/Curiosity-Ablehnungen werden nicht protokolliert
   (identisch zu Case 1).
5. **FINDING — NO CHANGE MADE:** Zwei Frageerzeugungspfade mit unterschiedlichen Schwellen
   (Impuls ohne Energieprüfung, Curiosity mit) führen zum gleichen sichtbaren Ergebnis
   `decision = ask`; das Label erlaubt keine Unterscheidung ohne Snapshot.
6. **FINDING — NO CHANGE MADE:** `state_snapshot` bei normalen Turns enthält kein Conversation-Mode-
   und kein Persistenz-Ergebnisfeld; „gespeichert ja/nein“ ist nur indirekt über `orb_nodes` prüfbar.

Keiner dieser Punkte wurde verändert, korrigiert oder umgangen.

---

## 11. Final Classification

**A. CAUSALITY CONFIRMED**

Begründung: Für jede Teilstrecke liegt unveränderlicher Produktions-Datenbankbeweis mit
Zeitstempel und Identifier vor: Eingabe (`b610a162`, 18:04:31.688) → Persistenz mit identischem
Inhalt 3.4 s später (`132bf051`, importance 0.48 über der Schwelle 0.35) → Zustandsänderung
(Kante `283725f0`, steigender `activation_count`) → Abruf mit `recalled = 1` und drei geladenen
Knoten im Turn, der die Angaben nennt (`3fdce42f`, Metrik `c7dae77b`) → korrekte Wiedergabe der
Angaben. Alternativursachen sind einzeln geprüft und bis auf das Kontextfenster als mögliche
Nebenquelle beim Abruf ausgeschlossen.

Die Klassifikation stützt sich **nicht** auf den Wortlaut „merke ich mir“. Dieser ist ausdrücklich
als Kategorie G (Modellaussage ohne Persistenznachweis) eingeordnet; die Persistenz ist getrennt
über `orb_nodes` belegt und fand danach statt.

Nicht mitklassifiziert: die Zwischenstufe „Memory Candidate“ (NOT OBSERVABLE, Feature erst ab
2026-09-20) und die Exklusivität des Abrufs gegenüber dem Kontextfenster (SUPPORTED).

---

## 12. Confidence Assessment

| Aussage | Konfidenz |
|---|---|
| Ereignis fand am 2026-09-19 18:04–18:05 UTC statt | sehr hoch |
| Die vier Angaben waren vorher nicht persistiert | sehr hoch |
| Der Rohsatz wurde persistiert (ein Knoten) | sehr hoch |
| Die Modellaussage erfolgte vor der Persistenz | sehr hoch |
| Abruf fand im Turn 18:05:47 statt | hoch |
| Abruf war die **einzige** Quelle der genannten Fakten | mittel |
| Eigener Beitrag 18:05:12 ohne Nutzereingabe | sehr hoch |
| Zuordnung zum Curiosity-Zweig (nicht Impuls-Zweig) | hoch |
| Aussagen über Laufzeitverhalten ohne Logs | niedrig — als Lücke markiert |

READ-ONLY · NO WRITES TO PRODUCTION DATA · NO DEPLOYMENT · NO CONFIGURATION CHANGE · NO FIXES.
