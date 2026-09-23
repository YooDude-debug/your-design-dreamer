# ORB CORE – REQUEST OPTIMIZATION P1 – ERGEBNIS

Datum: 2026-09-23
Status: **ABGESCHLOSSEN – READY FOR MANUAL REVIEW** (nicht veröffentlicht, keine Migration)
Referenzen: `docs/ORB_REQUEST_CREDIT_FORENSIC_2026-09-22.md`,
`docs/ORB_REQUEST_OPTIMIZATION_P0_RESULT_2026-09-23.md`

---

## 1. Ausgangszustand

Aus der Forensik (gemessen, Fenster 2026-09-19 → 2026-09-23, ca. 3,6 Tage):

| Größe | Wert |
| --- | --- |
| DB-Requests insgesamt (ORB) | 8.843 |
| davon Turn-Pfad | 7.849 |
| Ø DB-Abfragen pro User-Nachricht | 20,1 |
| Turns | 390 |
| AI-Aufrufe im Turn-Pfad | 390 (1 pro Turn) |
| Ø Turn-Dauer | 3.745 ms |

`engine.server.ts` enthält 56 `.from()`-Stellen; die häufigsten Tabellen:
`orb_nodes` 19, `orb_connections` 8, `orb_state` 6, `orb_questions` 6,
`orb_interests` 6, `orb_messages` 5.

## 2. P0-Ergebnis (Vorbedingung geprüft)

P0-Bericht gelesen. P0-2 umgesetzt (−4 DB-Abfragen im `isAskMeRequest`-Pfad),
P0-1 bewusst nur dokumentiert (0 eingesparte Modellaufrufe). **Keine
Regression, kein verändertes ORB-Verhalten** → P1 durfte fortgesetzt werden.

## 3. Identifizierte DB-Redundanzen

| # | Datei / Funktion | Tabelle | Redundanz | Bewertung |
| --- | --- | --- | --- | --- |
| R1 | `engine.server.ts` / `processInput`, Reaktivierungsschleife | `orb_nodes` | Ist die reaktivierte Zeile zugleich der genaue Treffer (`exact`), schreibt der unmittelbar folgende Block „2. Knoten" dieselbe Zeile mit denselben bzw. umfassenderen Werten (`activation_count` = derselbe Ausgangswert + 1, identischer Zeitstempel, `importance = max(alt, importance) ≥ max(alt, importance*0.8)`, zusätzlich `confidence`) und überschreibt den ersten Schreibvorgang vollständig. | **zusammengeführt** (beweisbar identisches Endergebnis) |
| R2 | `engine.server.ts` / `touchConnection` | `orb_connections` | Existenzabfrage vor dem Anlegen einer Verbindung, obwohl der Zielknoten im selben Verarbeitungsvorgang neu eingefügt wurde und dieselbe Richtung noch nicht berührt war → es kann beweisbar keine Zeile geben. | **entfernt** (nur in diesem beweisbaren Fall) |
| R3 | `loadThreads` vs. `loadMatchCandidates` | `orb_threads` | Unterschiedliche Filter (RESOLVED ausgeschlossen) und unterschiedliche Limits → **nicht dieselben Daten**. | **NICHT zusammengelegt** (P1-C) |
| R4 | `retrieveCandidates` (mehrere `orb_nodes`-Abfragen) | `orb_nodes` | Semantisch verschiedene Suchen (norm_key, topic, intentTopic, last_accessed, content ilike). | **NICHT zusammengelegt** (P1-C) |
| R5 | `upsertInterest` | `orb_interests` | Liest die themenspezifische Zeile, die von der Top-8-Liste nicht garantiert abgedeckt ist. | **NICHT zusammengelegt** (P1-C) |
| R6 | Schnappschuss am Ende des Zuges | mehrere | Liefert den Zustand **nach** den Schreibvorgängen. | **NICHT zusammengelegt** |

Writes (P1-D/E/F): außer R1 wurde **kein** Write zusammengefasst. Die zeitliche
Reihenfolge von Memory, Graph, autonomen Fragen, Conversation, Energy und
Event-Logging bleibt unverändert; es wurde **kein Debounce und kein Delay**
eingeführt.

## 4. Durchgeführte Änderungen

1. **R1** – Reaktivierungsschleife überspringt den Schreibvorgang, wenn
   `exact && node.id === exact.id`. Der Reaktivierungszähler (`reactivations`)
   wird unverändert hochgezählt, `turn.reactivated` bleibt gleich.
2. **R2** – `touchConnection` erhält den optionalen Eingabewert
   `targetIsNew?: boolean`. Ist er gesetzt, entfällt die Existenzabfrage; es
   wird derselbe Datensatz angelegt wie bisher. Übergeben wird er
   ausschließlich aus dem Zweig, in dem der Fokusknoten in diesem Vorgang neu
   eingefügt wurde (`learnedNew`). Der Pfad `persistContradictions` nutzt die
   Abkürzung **nicht**.

Kein globaler Cache, keine Änderung an Schema, RLS, Schwellen, Formeln,
Reihenfolge, Prompts, Modell oder Silent-Logik. **Keine Migration nötig.**

## 5. Betroffene Dateien

- `src/orb-core/engine.server.ts` (Reaktivierungsschleife, `touchConnection`,
  Aufrufstelle der Verbindungsschleife)
- `tests/orb-request-optimization-p1.test.ts` (neu, Messung + Regressionsschutz)
- `tests/helpers/fake-supabase.ts` (Testhilfe um `not()` ergänzt – nur Tests)
- `docs/ORB_REQUEST_OPTIMIZATION_P1_RESULT_2026-09-23.md` (dieser Bericht)

## 6. BEFORE/AFTER-Messung (gemessen, nicht geschätzt)

Messverfahren: protokollierender Datenbank-Ersatz (`tests/helpers/fake-supabase.ts`),
identisches Testszenario, einmal gegen den Stand **vor** den Änderungen
(isolierte Kopie unter `/tmp/p1before`, beide Änderungen zurückgenommen) und
einmal gegen den aktuellen Stand. Ohne Modellschlüssel entsteht kein
Modellaufruf, daher keine Credits.

Szenario 1 – Nachricht wiederholt eine bereits gespeicherte Aussage (genauer Treffer):

| Metrik | BEFORE | AFTER | Reduktion |
| --- | --- | --- | --- |
| DB-Aufrufe insgesamt | 29 | 28 | −1 |
| Reads | 22 | 22 | 0 |
| Writes | 7 | 6 | **−1** |
| `orb_nodes`-Updates | 2 | 1 | **−1** |
| AI-Aufrufe | 1 | 1 | 0 |

Szenario 2 – neue Aussage wird gelernt, eine passende Erinnerung wird reaktiviert:

| Metrik | BEFORE | AFTER | Reduktion |
| --- | --- | --- | --- |
| DB-Aufrufe insgesamt | 32 | 31 | −1 |
| Reads | 23 | 22 | **−1** |
| Writes | 9 | 9 | 0 |
| `orb_connections`-Selects | 3 | 2 | **−1** |
| AI-Aufrufe | 1 | 1 | 0 |

Netzwerk, Compute, Realtime, Fehlerquote: unverändert (keine neuen Aufrufe,
keine entfernten Aufrufe außer den oben genannten). Latenz: nicht belastbar
messbar in diesem Aufbau (die Laufzeit wird von der Sprachschicht dominiert) –
**NICHT GEMESSEN**.

## 7. DB-Einsparung (Reads)

- R2: **1 Read pro reaktivierter Erinnerung**, wenn der Fokusknoten in diesem
  Zug neu gelernt wurde. Im gemessenen Szenario 1 Read; die Zahl skaliert mit
  der Anzahl der reaktivierten Erinnerungen (bis zu 6 pro Zug, Obergrenze der
  Recall-Auswahl). Eine Hochrechnung auf die Produktion wäre eine Schätzung und
  wird hier **nicht** als gemessener Wert dargestellt.

## 8. Write-Einsparung

- R1: **1 Write pro Zug**, in dem eine bereits gespeicherte Aussage erneut
  gesagt wird (exakter Treffer und gleichzeitig reaktiviert). Gemessen: 2 → 1
  `orb_nodes`-Updates.
- Gleichwertigkeit im Test belegt: der verbliebene Schreibvorgang enthält
  `activation_count` = Ausgangswert + 1, gesetzte `confidence` und
  `importance ≥` dem Wert des entfallenen Schreibvorgangs.

## 9. Credit-Auswirkung

Die Einsparung liegt vollständig im Datenbankbereich. **Keine** Veränderung der
AI-Aufrufe (1 pro Zug, unverändert). Eine exakte Credit-Zahl lässt sich aus der
Lovable-Anzeige nicht auf einzelne Abfragen herunterbrechen (der Messzeitraum
der Anzeige ist weiterhin unbekannt) → **NICHT BEWEISBAR**, nur die oben
gemessenen Request-Differenzen sind belegt.

## 10. Performance-Auswirkung

Pro betroffenem Zug entfällt ein Schreib- bzw. Lesevorgang; die Turn-Dauer wird
von der Sprachschicht dominiert (Ø 3.745 ms), daher ist keine messbare
Latenzänderung zu erwarten und keine wurde gemessen.

## 11. Regressionstests

| Bereich | Ergebnis |
| --- | --- |
| Memory (Speichern, Recall) | unverändert |
| Graph (Knoten, Verbindungen, Gewichte) | unverändert |
| Gap Detection | unverändert |
| Curiosity | unverändert |
| Energy (Schwellen, Erholung, Kosten) | unverändert |
| Autonome / proaktive Fragen | unverändert |
| Conversation-Verhalten | unverändert |
| Silent Response (inkl. Modellformulierung) | unverändert – die Optimierung „Silent → keine Formulierung" ist **weiterhin NICHT implementiert** |
| Verlorene oder doppelte Writes | keine (Gleichwertigkeit im Test belegt) |
| Zusätzliche AI-Aufrufe | keine |
| Neue Request-Loops | keine |
| Cross-User-Datenvermischung | ausgeschlossen (kein globaler Cache, alle Werte bleiben im Vorgangskontext) |
| RLS | unverändert aktiv |
| Datenbankmigration | nicht erforderlich |

Prüfläufe:

- `bunx vitest run` → **1360 / 1360 grün** (3 neue P1-Tests)
- `bun run test:db` → **102 / 102 grün**
- `bunx tsgo --noEmit` → fehlerfrei
- `bun run lint` → berührte Dateien sauber (nur die bereits vorher bestehenden
  Fehler in unberührten Dateien / Ordnern `backups/`, `release/`, `remotion/`)
- `bun run build` → erfolgreich

Testabdeckung A–N: A/B (normale Unterhaltung, mehrere Nachrichten),
C/D (Memory Retrieval + Save), E/F (Graph Retrieval + Update), G (Gap
Detection), H (autonome Frage), I (Energy), J (Silent) sind durch die
bestehenden Suiten abgedeckt; K/L/M/N (Idle, Fehlerfall, Reconnect, parallele
Requests) berühren die geänderten Pfade nicht und bleiben durch die bestehenden
Tests abgedeckt.

## 12. Offene Punkte

- **669 protokollierte Modellaufrufe vs. 414 nachweisbare Ereignisse: weiterhin
  UNGEKLÄRT.** P1 liefert dazu keine neuen Erkenntnisse und die Differenz darf
  nicht als unnötiger Verbrauch gedeutet werden. Nötige Messung: Zählung der
  Modellaufrufe pro Ereignis in `orb_metrics`.
- Messzeitraum der Lovable-Verbrauchsanzeige unbekannt → keine Zuordnung
  Requests ↔ Credits möglich.
- Ø 20,1 DB-Abfragen pro Nachricht bleiben strukturell bestehen; die übrigen
  Abfragen sind nach P1-C nicht beweisbar redundant.

## 13. Empfehlung für P2

Nur als Empfehlung, **nicht umgesetzt**:

1. Zählung der AI-Aufrufe pro Ereignis in `orb_metrics` ergänzen, um die
   Differenz 669/414 messbar zu klären (reine Messung, kein Verhaltenseingriff).
2. Recall-Reaktivierungen (bis zu 6 Updates pro Zug) als einen Mehrzeilen-Write
   zusammenfassen – erfordert vorher den Nachweis, dass Reihenfolge und
   Einzelwerte erhalten bleiben.
3. Erst danach – und nur mit ausdrücklicher Freigabe – die große Einsparung
   „Silent Response ohne Modellformulierung" bewerten.

**STOPP.** Keine weiteren Optimierungen, keine Modell- oder Prompt-Änderung,
keine neuen Features, kein Deployment.
