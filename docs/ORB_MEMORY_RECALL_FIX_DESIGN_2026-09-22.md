# ORB CORE – MEMORY RECALL FIX DESIGN (2026-09-22)

Status: **DESIGN ONLY** – kein Code, kein SQL, keine Migration, kein Deployment.
Grundlage: `docs/ORB_MEMORY_TO_LLM_CONTEXT_FORENSIC_2026-09-22.md`.
Alle Aussagen unten sind gegen den aktuellen Code geprüft (Stellen genannt) und
durch eine reine Rechenprobe ausserhalb des Projekts belegt (read-only).

---

## 1. Confirmed Root Cause

Probe (deterministisch, ohne Datenbank, ohne LLM):

| Frage | `topicOf` | `questionIntentOf` | `contentTokens` | sim zu „Ich bin 36 Jahre.“ | `topicAffinity` |
| --- | --- | --- | --- | --- | --- |
| „Wie alt bin ich?“ | **`wie`** | `null` | `["wie","alt"]` | 0.000 | 0 |
| „Welche Grafikkarte habe ich?“ | `hardware` | `hardware` | `["welche","grafikkarte"]` | – | 0.12 (zu RTX) |
| „Wie heisst mein Hund?“ | **`natur`** | `null` | `["wie","heisst","hund"]` | 0.000 | 0 |

Bestätigte Ursachenkette für „Wie alt bin ich?“:

1. `topicOf()` (`src/orb-core/memory.ts` ~470) findet kein Schlüsselwort und
   nimmt den **ersten Inhaltsstamm** – das ist das Fragewort `wie`. Die
   Kandidatenabfrage läuft damit auf `.eq("topic","wie")`
   (`retrieveCandidates`, `src/orb-core/engine.server.ts` ~640) und trifft nichts.
2. `questionIntentOf()` (`src/orb-core/recall.ts` 53) kennt nur vier Bereiche
   (hardware, projekte, beruf, essen) – „Alter“ fehlt, also `null`, also kein
   zweiter Kandidatenkreis.
3. Die Textsuche nutzt `contentTokens(text).slice(0,3)` – das erste Token ist
   `wie`, d. h. ein Slot der drei `ilike`-Muster wird durch ein Funktionswort
   verbraucht.
4. Im Ranking gilt `overlap = max(similarity, topicAffinity)` und danach
   `.filter(c => c.overlap > 0)` (engine ~894–917). Ohne gemeinsames Wort und
   ohne erkannten Bereich ist `overlap = 0` → Kandidat **verworfen**.
5. `recalled = []` → der System-Prompt erhält keine aktive Erinnerung.

Das Problem liegt damit vollständig in **CANDIDATE SEARCH + FILTERING**, nicht
im LLM.

Zusatzbefund (neu, konsistent mit obiger Probe): Fragewörter stehen **nicht** in
`STOPWORDS`, sie sind reguläre Inhaltswörter. Sie schaden dreifach: falsches
Topic, verbrauchter `ilike`-Slot, aufgeblähter Jaccard-Nenner in `similarity`
(`memory.ts` 324).

## 2. Current Recall Architecture (bestätigt)

```
STORAGE (orb_nodes)
 → CANDIDATE SEARCH   retrieveCandidates(): 4–5 begrenzte Queries
                      norm_key(1) · topic(20) · intentTopic(20)
                      · recency(10) · content ilike(20), user_id-scoped
 → FILTERING          overlap = max(similarity, topicAffinity) > 0
 → RELEVANCE          memoryRelevance = sim × weight × imp × recency × activation
 → ACTIVE MEMORIES    selectByLevel(scored, RECALL_LIMIT=6), LEVEL_LIMITS A4/B4/C2
                      danach selectReliableMemories() (eligibility.ts)
 → CONTEXT            promptMemories → „Aktive Erinnerungen“, max 5 × 60 Zeichen
 → LLM
```

Bestätigung der fünf Engpässe aus dem Auftrag:

1. **Bestätigt** – `DOMAIN_PATTERNS` in `recall.ts` 14–28 enthält genau vier Bereiche.
2. **Bestätigt** – harter Ausschluss `.filter(c => c.overlap > 0)` (engine ~917).
3. **Bestätigt** – `RECALL_LIMIT = 6` (engine ~130), Verteilung A4/B4/C2.
4. **Bestätigt** – kein `LIMIT 60` im Recall; 60 ist ausschliesslich
   `THREAD_MATCH_CANDIDATE_LIMIT` (`continuity-store.server.ts`), also Threads.
5. **Bestätigt** – `GRAPH_LIMIT = 40` wird nur für den angezeigten Teilgraphen
   verwendet, nicht im Recall-Pfad.

## 3. Design A – Question Words

**Mechanismus heute:** `contentTokenPairs()` filtert `STOPWORDS` und
`AFFECT_WORDS`; Fragewörter fehlen in beiden Listen. `topicOf()` fällt auf
`pairs[0].stem` zurück.

**Ansatz (deterministisch, ohne Semantik):** eine eigene, kleine Liste
`QUESTION_WORDS` (wie, was, wer, wen, wem, wann, wo, woher, wohin, warum, wieso,
weshalb, welche/r/s/n/m, wieviel, womit, wozu) mit zwei Wirkungen:

- A1 – **Topic-Neutralität:** Fragewörter dürfen nie Fallback-Topic werden. Wenn
  nach Abzug der Fragewörter kein Inhaltswort bleibt, ist `topicOf` = `null`
  (statt falsch). Nebeneffekt: eine Query weniger statt einer Treffer-losen.
- A2 – **Recall-Tokens:** Fragewörter werden in der `ilike`-Tokenauswahl und im
  `similarity`-Vergleich übersprungen; damit wandert der freie Slot auf `alt`,
  `hund` usw.

Bewusst getrennt zu halten: `normKey()`/`keyTokens()` (Duplikaterkennung) und
`scoreImportance()`. Wird dort mitgefiltert, ändern sich Duplikatschlüssel
historischer Knoten – **ausserhalb des Scope**.

**Nebenwirkungen:** „Wie heisst mein Hund?“ verliert das falsche Topic `natur`
(Treffer wäre Zufall gewesen); Aussagen, die mit einem Fragewort beginnen
(„Was für ein Tag“), verlieren ein wertloses Fallback-Topic.

**Bestehende Tests:** `tests/orb-topic-classification.test.ts`,
`tests/orb-memory.test.ts` (Topics/Normalisierung), `tests/orb-memory-recall-fix.test.ts`.
Diese müssen unverändert grün bleiben – insbesondere
`topicOf("Welche GPU habe ich?") === "hardware"`, d. h. das Fragewort darf den
Schlüsselwort-Treffer nicht blockieren.

## 4. Design B – Zero Word Overlap (drei Varianten, ohne Empfehlung)

### B-A) Zusätzliche deterministische Recall-Signale
`overlap = max(similarity, topicAffinity, signal)` mit kleinen, geprüften
Signalen: gleiches `topic` von Frage und Knoten (Topic-Floor), Frage-Attribut
gegen Knotenmuster (z. B. Alter/Datum/Zahl), und aktive Ebene-A-Knoten mit
Mindest-`importance`.
Architektur: nur Filter-/Scoring-Stufe, keine neue Query. Genauigkeit: mittel.
Performance: unverändert (rein rechnerisch). Risiken: zu viele Floors machen
den Filter wirkungslos. False Positives: thematisch nahe, inhaltlich falsche
Knoten. False Negatives: Attribute ohne Muster. Komplexität: niedrig.
Auswirkung auf bestehende Logik: `memoryRelevance` unverändert.

### B-B) Bessere Intent-/Topic-Erkennung
`DOMAIN_PATTERNS` in `recall.ts` um klar abgrenzbare Bereiche erweitern (alter,
name, wohnort, familie, gesundheit, sprache, zeit) und – symmetrisch – dieselben
Muster auf Knotenseite (`infoDomainOf`) nutzen, plus Fragewort-Neutralität aus
Design A.
Architektur: eine Datei, unveränderte Stufenlogik. Genauigkeit: hoch für
abgedeckte Bereiche, null für nicht abgedeckte. Performance: unverändert (eine
Query mehr nur wenn ein Bereich erkannt wurde). Risiken: Listenpflege, stiller
Nicht-Treffer bei neuen Themen. False Positives: gering (Wortgrenzen). False
Negatives: alles aussserhalb der Liste. Komplexität: niedrig–mittel.

### B-C) Zweistufiges Retrieval
Stufe 1 = heutiger Recall. Nur wenn Stufe 1 **leer** bleibt und die Eingabe eine
Frage ist: Stufe 2 = eine zusätzliche gezielte, nutzergebundene Abfrage
(Ebene A/B nach `importance`+`last_accessed_at`, hartes Limit, z. B. 10) mit
abgesenkter, aber bestehender Bewertung.
Architektur: neue Stufe hinter `retrieveCandidates`, Stufen bleiben getrennt.
Genauigkeit: rettet auch unbekannte Themen. Performance: eine Extra-Query
ausschliesslich im Leerfall. Risiken: „irgendeine“ Erinnerung im Kontext, wenn
keine passt → muss über Mindestrelevanz und klare Prompt-Kennzeichnung begrenzt
werden. False Positives: höchstes Risiko der drei. False Negatives: niedrigstes.
Komplexität: mittel. Auswirkung: Persistenz, Schwelle 0.35, Duplikate,
Energie/Autonomie bleiben unberührt.

Kombinierbar: A+B ohne Konflikt; C nur zusätzlich als Notausgang.

## 5. Design C – Six-Memory Selection

Heute: `selectByLevel` sortiert je Ebene nach `score` und füllt strikt A → B → C
mit Kappen 4/4/2. `memoryLevel` stuft alles, was in 6 h berührt wurde, als A ein.

Beobachtete Schwächen (keine Zahlenerhöhung nötig):

- **Verdrängung:** viele frische, aber belanglose A-Knoten (Produktion: 34 A)
  belegen alle vier A-Plätze; ein hochrelevanter B/C-Knoten mit deutlich
  höherem `score` bekommt keinen Platz. Der Ebenen-Vorrang schlägt die Relevanz.
- **Tie-Breaker:** fehlt vollständig; bei gleichem `score` entscheidet die
  Kandidatenreihenfolge (Map-Insertion) – nicht deterministisch nachvollziehbar.
- **Lifecycle:** `recencyFactor` steckt bereits in `score`; die Ebenen bewerten
  Aktualität damit ein zweites Mal.
- `selectReliableMemories` läuft **nach** der Kappung, d. h. ein aussortierter
  Knoten verschenkt einen der sechs Plätze.

Designoptionen (ohne Empfehlung):
C1 relevanzgeführte Auswahl mit Ebenen nur noch als weiche Quote (Mindestplatz
je Ebene, Rest global nach `score`).
C2 Reihenfolge tauschen: Belastbarkeitsfilter **vor** `selectByLevel`, damit
alle sechs Plätze belastbar belegt werden.
C3 expliziter, dokumentierter Tie-Breaker (`score`, dann `importance`, dann
`last_accessed_at`, dann `id`) für reproduzierbare Auswahl.
C4 Ebenenkappen unverändert, aber Überlauf-Regel: ein Knoten mit `score`
deutlich über dem schwächsten gewählten A-Knoten darf ihn ersetzen.

## 6. Alternatives (verworfen bzw. nicht im Scope)

- Embeddings/Vektorsuche: verletzt „deterministisch, kein LLM im Retrieval“.
- LLM-basierte Frageklassifikation: LLM würde fehlerhaftes Retrieval ersetzen.
- Volltext-/Trigram-Index in der Datenbank: Migration, ausserhalb dieses Scope.
- Historische `topic`-Werte nachbereinigen: Datenänderung, ausserhalb Scope.

## 7. Risks

- Fragewort-Filter greift zu breit → Aussagen verlieren gültige Topics (Test 10).
- Neue Bereichsmuster überschneiden sich → falscher Bereich gewinnt
  (Reihenfolge in `DOMAIN_PATTERNS` ist Priorität).
- Absenken des Overlap-Filters → irrelevante Erinnerungen im Prompt.
- Auswahländerung (Design C) kann bestehende, heute korrekte Antworten
  verschieben → Regression 10 ist Pflicht.
- Kein Eingriff in Energie, Autonomie, Threads, Persistenz, Schwelle 0.35.

## 8. Performance Considerations

Heute 4–5 begrenzte Queries je Eingabe. Design A reduziert eher (kein
Treffer-loses `topic="wie"`). Design B-B fügt nur bei erkanntem Bereich eine
Query hinzu (wie heute). Design B-C fügt genau eine Query hinzu, und nur wenn
Stufe 1 leer ist. Design C ist rein rechnerisch, O(n log n) über ≤ ~60 Kandidaten.
Prompt-Grösse bleibt unverändert (max. 5 × 60 Zeichen).

## 9. Regression Test Matrix

| # | Fall | Eingabe | Erwartung |
| --- | --- | --- | --- |
| 1 | Fragewort + Attribut | „Wie alt bin ich?“ | „Ich bin 36 Jahre.“ wird Kandidat, `overlap > 0`, gelangt in `recalled` |
| 2 | bestehender Erfolgsfall | „Welche Grafikkarte habe ich?“ | RTX-Erinnerung weiterhin gefunden, `topicAffinity` = Floor |
| 3 | Frage mit Topic-Wort | „Was esse ich gerne?“ | Essens-Erinnerung gefunden, Bereich `essen` |
| 4 | Frage ohne gemeinsames Wort | „Wo wohne ich?“ vs. „Ich lebe in Berlin.“ | Kandidat überlebt den Filter (Variante B) |
| 5 | mehrere mögliche Memories | „Wie alt bin ich?“ mit Alters- und Geburtsjahr-Knoten | beide Kandidaten, stärkerer zuerst |
| 6 | irrelevantes Memory | „Wie alt bin ich?“ vs. „Ich mag Pizza.“ | `overlap = 0`, verworfen |
| 7 | kein Memory vorhanden | Frage ohne passenden Knoten | `recalled = []`, kein erfundener Kandidat |
| 8 | mehrere relevante Memories | Hardware-Frage mit 3 Hardware-Knoten | ≤ 6 gewählt, höchster `score` enthalten (Design C) |
| 9 | Fragewort erzeugt kein Topic | `topicOf("Wie alt bin ich?")` | `null`, **nicht** `"wie"`; `topicOf("Wie heisst mein Hund?")` ≠ `natur` per Fragewort |
| 10 | keine Regression | Schwelle `shouldPersist(0.35)`, `scoreImportance`, `normKey`, `isSameMemory`, `memoryRelevance`, `selectReliableMemories`, Suppression, Threads, Autonomie | unverändert grün |

Zusätzlich: Test 1 und 4 müssen **vor** dem Fix rot sein (Beweis der Ursache),
Test 2, 3, 10 vor und nach dem Fix grün.

## 10. Recommended Minimal Architecture

Kleinste Änderung mit nachweisbarer Wirkung, Stufen bleiben getrennt:

1. **Design A** (Fragewörter neutral: Topic-Fallback + Recall-Tokens + `similarity`)
   – behebt die falsche Query `topic="wie"` und den verbrauchten Suchslot.
2. **Design B-B** (Bereichsmuster in `recall.ts` erweitern, symmetrisch auf
   Frage- und Knotenseite) – liefert für „Alter“ den Kandidaten und den
   Topic-Floor, ohne den harten `overlap > 0`-Filter aufzugeben.
3. **Design C2 + C3** (Belastbarkeitsfilter vor der Kappung, expliziter
   Tie-Breaker) – ohne die Zahl 6 zu ändern.

B-A und B-C bleiben als spätere Stufe optional und werden hier **nicht**
mitgeplant.

## 11. Explicit Non-Goals

- Alle 75 Erinnerungen an das LLM senden.
- `GRAPH_LIMIT` erhöhen (recall-irrelevant).
- Ein „Recall-LIMIT 60“ erhöhen (existiert nicht).
- `RECALL_LIMIT = 6` erhöhen.
- Änderungen an Schwelle 0.35, Wichtigkeits-/Relevanzformel, Verfall, Energie,
  Autonomie, Duplikaterkennung (`normKey`), Threads, Schema, RLS, UI.
- Embeddings, Vektorsuche, LLM im Retrieval.
- Historische Daten bereinigen oder migrieren.
- Deployment.

## 12. Implementation Order

1. Regressionstests aus Abschnitt 9 schreiben – Test 1 und 4 rot bestätigen.
2. Design A (Fragewort-Neutralität) umsetzen; Tests 9, 10 prüfen.
3. Design B-B (Bereichsmuster) umsetzen; Tests 1–5 prüfen.
4. Design C2/C3 (Filterreihenfolge, Tie-Breaker) umsetzen; Tests 6–8 prüfen.
5. Volle Verifikation: Logiktests, DB/Security, typecheck, lint, build.
6. Diff-Kontrolle gegen die Non-Goals, Bericht, Stopp bei
   READY FOR MANUAL REVIEW – kein Deployment.

---

**READY FOR IMPLEMENTATION** – Design vollständig und gegen den aktuellen Code
geprüft (Codestellen und Probewerte oben). Keine Code-, SQL-, Migrations- oder
Deployment-Änderung in diesem Schritt.
