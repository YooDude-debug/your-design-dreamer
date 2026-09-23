# ORB CORE – REQUEST OPTIMIZATION P0 (RESULT)

Datum: 2026-09-23
Umfang: ausschliesslich **P0-1** und **P0-2**. Keine weiteren Optimierungen.
Status: **READY FOR MANUAL REVIEW** – nichts veröffentlicht, keine Migration, keine
Schwellen-, Formel- oder Logikänderung.
Grundlage: `docs/ORB_REQUEST_CREDIT_FORENSIC_2026-09-22.md`.

---

## 1. Ausgangszustand

Aus der Forensik (gemessen, Zeitraum 2026-09-19 → 2026-09-23, ≈3,6 Tage):

| Grösse | Wert |
| --- | --- |
| Chat-Züge (`turn`) | 390 (je 1 AI-Aufruf) |
| Ø Dauer pro Zug | 3745 ms |
| Ø DB-Abfragen pro User-Nachricht | 20,1 |
| DB-Abfragen gesamt / davon `turn` | 8843 / 7849 |
| Autonome Frageversuche (`proactive`) | 24 |
| Als „silent“ verworfene Antworten | 166 von 390 |
| Gespeicherte autonome Fragen | 25 |
| AI-Gateway-Aufrufe (7 Tage) | 703, davon 669 `openai/gpt-6-astra` |

Kein nachgewiesener Dauerloop. Der 5-Sekunden-Takt läuft nur im Browser.

---

## 2. Implementierte Änderungen

### P0-1 – Prüfung vor der Formulierung: **NICHT IMPLEMENTIERT (dokumentiert)**

Die Reihenfolge im Code ist bereits die geforderte. Vor der kostenpflichtigen
Formulierung laufen: Energie, Neugier, Cooldown, Gap-Ableitung
(`deriveKnowledgeGaps`, `threadKnowledgeGaps`), `detectGaps`, `decideCuriosity`,
`decideImpulse` (inkl. Vergleich mit allen früheren Fragen über
`previousImpulses`) und die Endfreigabe `finalAutonomyGate`. Erst danach
`formulateQuestion`.

Danach verbleibt genau eine Prüfung: `isDuplicateQuestion(spoken.question, …)`.
Sie vergleicht den **vom Modell erzeugten Satz** mit der Fragenhistorie und
benötigt diesen Text zwingend. Ein Vorziehen wäre nur durch eine **neue,
erfundene Prüfregel** möglich. Nach der ausdrücklichen Vorgabe („Wenn die
Prüfung selbst einen AI-Aufruf benötigt bzw. den erzeugten Text braucht: NICHT
optimieren, keine neue Logik erfinden, stattdessen dokumentieren.") wurde hier
nichts verändert.

Folge: Es wird durch P0-1 **kein** Modellaufruf eingespart. Diese Zahl ist
bewusst 0 und nicht geschätzt.

### P0-2 – Kein doppeltes Nachladen: **IMPLEMENTIERT**

Bewiesen doppelt innerhalb **eines** Verarbeitungsvorgangs im Pfad
„ausdrückliche Aufforderung" (`isAskMeRequest`) in `processInput`:

| Daten | erste Abfrage | zweite Abfrage | identisch? |
| --- | --- | --- | --- |
| `orb_state` (`ensureState`) | Zug-Beginn | `loadCuriosityContext` | ja |
| `orb_messages` (role, body, neueste zuerst, Limit 8) | Kontextfenster | `loadCuriosityContext` | ja |
| `orb_interests` (*, weight desc, Limit 8) | Zug | `loadCuriosityContext` | ja |
| `orb_threads` (`loadThreads`) | Zug | `loadCuriosityContext` | ja |

Zwischen beiden Ladevorgängen findet in diesem Pfad **kein Schreibvorgang**
statt (geprüft über den gesamten Bereich). `loadCuriosityContext` nimmt jetzt
einen optionalen Parameter `preloaded: CuriosityPreloaded | null` und verwendet
die bereits geladenen Werte weiter; ohne diesen Wert lädt die Funktion
unverändert selbst.

Ausdrücklich **nicht** zusammengelegt:
- Schnappschuss am Ende des Zuges (liegt **nach** den Schreibvorgängen, andere Daten),
- Gedankenfäden 12 (UI) vs. 60 (Matching) – unterschiedliche Mengen,
- `orb_nodes`, `orb_questions`, `orb_connections` – werden im Zug nicht vorab
  in identischer Form geladen und bleiben komplett erhalten,
- die eigenständigen Pfade `inspectCuriosity` und `askProactively` – dort gibt
  es keine bereits geladenen Daten.

Kein globaler Cache, keine Memoization über die Anfrage hinaus, keine
Semantik-, RLS-, Struktur- oder Reihenfolgeänderung.

---

## 3. Betroffene Dateien

| Datei | Art der Änderung |
| --- | --- |
| `src/orb-core/engine.server.ts` | `LoadedThread`-Import, neuer Typ `CuriosityPreloaded`, optionaler Parameter in `loadCuriosityContext`, Weitergabe an der Aufrufstelle im `isAskMeRequest`-Pfad |
| `tests/orb-request-optimization-p0.test.ts` | neu, 10 Regressionstests (Reihenfolge P0-1, Weitergabe P0-2, kein Cache, keine entfernte Abfrage) |
| `docs/ORB_REQUEST_OPTIMIZATION_P0_RESULT_2026-09-23.md` | dieser Bericht |

Keine Migration, keine DB-Struktur-, Policy- oder Konfigurationsänderung.

---

## 4. BEFORE / AFTER Requests

Messbar ist die statisch bewiesene Abfragezahl je Pfad. Produktionszahlen nach
der Änderung liegen noch nicht vor (kein neuer Messzeitraum) – sie sind
ausdrücklich **nicht** angegeben, um keine Schätzung als Messwert auszugeben.

| Pfad | DB-Abfragen BEFORE | AFTER | Differenz |
| --- | --- | --- | --- |
| Zug mit ausdrücklicher Aufforderung („frag mich") | n | n − 4 | **−4** |
| Normaler Zug (ohne Aufforderung) | unverändert | unverändert | 0 |
| Autonome Frage (`askProactively`) | unverändert | unverändert | 0 |
| `inspectCuriosity` | unverändert | unverändert | 0 |

Network, Compute, Realtime: keine Änderung an Endpunkten, Nutzlasten, Taktung
oder Abo-Verhalten. Latenz: die vier entfallenden Abfragen liefen parallel in
einem `Promise.all`; erwartbar ist eine geringe Verbesserung, gemessen wurde
sie nicht.

---

## 5. BEFORE / AFTER AI Calls

| Grösse | BEFORE | AFTER |
| --- | --- | --- |
| AI-Aufrufe pro User-Nachricht | 1 | 1 |
| AI-Aufrufe pro autonomem Frageversuch | 1 (nur bei Zulassung durch die Endfreigabe) | 1 (unverändert) |
| Verworfene Frageformulierungen | wie bisher (Ähnlichkeitsprüfung nach der Formulierung) | unverändert |
| Formulierung bei stillen Zügen | vorhanden | **vorhanden (ausdrücklich nicht geändert)** |

Es wurden **keine** AI-Aufrufe hinzugefügt und keine entfernt.

---

## 6. BEFORE / AFTER DB Calls

Siehe Abschnitt 4. Ø 20,1 DB-Abfragen pro User-Nachricht (gemessen BEFORE)
bleiben für den normalen Zug unverändert; die Einsparung betrifft
ausschliesslich den Aufforderungspfad mit −4 Abfragen (`orb_state`,
`orb_messages`, `orb_interests`, `orb_threads`).

---

## 7. Eingesparte AI-Aufrufe

**0** – begründet, nicht versäumt: P0-1 war nach Prüfung des Codes nicht
umsetzbar, ohne eine neue Prüfregel zu erfinden (Abschnitt 2).

---

## 8. Eingesparte DB-Aufrufe

**4 pro Verarbeitungsvorgang im Aufforderungspfad** (bewiesen identische
Abfragen, keine Schreibvorgänge dazwischen). Keine Einsparung in anderen
Pfaden, weil dort keine bewiesene Dopplung vorliegt.

---

## 9. Tests

| Test | Ergebnis |
| --- | --- |
| A – normale Unterhaltung (Antwort, Memory, Graph) | grün, unverändert |
| B – autonome Frage (Auslösung, Entscheidungsregeln) | grün, unverändert |
| C – Duplikat (kein zusätzlicher Aufruf, Prüfung greift) | grün; Reihenfolge belegt |
| D – Memory Retrieval | grün, keine zusätzlichen/fehlenden Erinnerungen |
| E – Graph/Topic/Relation | grün, unverändert |
| F – Silent Response | grün, exakt erhalten (Sprachaufruf bleibt) |
| G – Fehlerfall | grün, kein Endlos-Retry, Fehlerpfad unverändert |

Gesamtlauf:
- `bunx vitest run` → **1357 / 1357 grün** (84 Dateien, davon 10 Tests neu)
- `bun run test:db` → **102 / 102 grün**
- `bunx tsgo --noEmit` → fehlerfrei
- `bunx eslint` auf den berührten Dateien → sauber
- `bun run build` → erfolgreich

Kein Test entfernt, abgeschwächt oder übersprungen.

---

## 10. Regressionsergebnis

Ausdrücklich bestätigt:
- ORB Memory funktioniert weiterhin,
- ORB Graph funktioniert weiterhin,
- Gap Detection unverändert,
- Curiosity unverändert,
- Energy unverändert,
- Proactive Questioning unverändert,
- Silent-Verhalten unverändert,
- Conversation-Verhalten unverändert,
- keine neuen Request-Loops entstanden,
- keine zusätzlichen AI Calls entstanden.

Keine Änderung an Thresholds, Formeln, Scoring, Entscheidungslogik,
Ereignisreihenfolge, Prompt, Modell, Kontextgrösse, 5-Sekunden-Takt,
Memory-, Graph- oder Energy-System. Keine neuen Produktfeatures.

---

## 11. Offene Punkte

1. **UNGEKLÄRT:** 669 protokollierte `openai/gpt-6-astra`-Aufrufe gegenüber 414
   nachweisbaren Ereignissen. Die Differenz bleibt ungeklärt und darf **nicht**
   als unnötige Aufrufe interpretiert oder durch Annahmen erklärt werden.
   Benötigte Messung: Zählung der Modellaufrufe **je Ereignis** in `orb_metrics`
   (heute wird nur die Dauer erfasst).
2. **Fehlende Messdaten:** Der Zeitraum der Lovable-Verbrauchsanzeige
   (Database 114, AI 30,1, Compute 10,7, Network 3,72, Realtime 0,06) ist nicht
   bekannt; eine Zuordnung BEFORE/AFTER auf Credit-Ebene ist daher nicht möglich.
3. **AFTER-Produktionsmessung** steht aus: erst nach einem neuen Messzeitraum
   lassen sich reale Werte gegenüberstellen.
4. **P0-1 bleibt offen** und wäre nur mit ausdrücklich freigegebener neuer
   Vorprüf-Logik umsetzbar – nicht Teil dieses Changes.
5. Die grosse Einsparung „keine Formulierung bei stillen Zügen" (166 von 390
   Zügen) ist weiterhin **nicht** umgesetzt und benötigt eine eigene Freigabe.

---

**STOPP nach P0-1 (dokumentiert) und P0-2 (umgesetzt). Keine weiteren
Optimierungen, keine Architekturänderung, keine Veröffentlichung.**
