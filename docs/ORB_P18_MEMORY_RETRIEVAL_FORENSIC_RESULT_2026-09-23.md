# P18 – Forensik des tatsächlichen Memory-Retrievals (READ-ONLY)

Datum: 2026-09-23 · Modus: **READ-ONLY** · Kein Patch, keine Migration, kein Deployment,
keine Datenmutation, 0 Modellaufrufe, keine Änderung an Memory, Graph, Relevanzformel
oder Schwellenwert.

## 0. Kurzantwort

Die Erinnerungen sind vorhanden. Der Ausschluss passiert an **zwei** getrennten Stellen,
nicht an einer:

1. **KANDIDATENSUCHE (Hauptursache, BEWIESEN).** Erinnerungen, die inhaltlich passen,
   werden gar nicht erst aus der Datenbank geholt. Wer nicht Kandidat ist, kann nicht
   bewertet werden – die Relevanzformel und der Filter sind daran unschuldig.
2. **HARTER FILTER `overlap > 0` (Folgestelle, BEWIESEN).** Erinnerungen, die als Kandidat
   ankommen, aber kein gemeinsames Inhaltswort und keinen gemeinsamen Informationsbereich
   haben, werden vor dem Modell verworfen.

## 1. Methode (nachvollziehbar, ohne Produktionsänderung)

- Datenexport: alle Knoten des betroffenen Nutzers (`9ce1d1b0-…`) – **119 Knoten,
  alle `lifecycle=active`** (107 memory, 11 decision, 1 perception). Nur SELECT.
- Nachbildung des Pfads mit dem **echten Produktionscode** (`normKey`, `topicOf`,
  `contentTokens`, `questionIntentOf`, `topicAffinity`, `similarity`, `memoryLevel`,
  `memoryRelevance`, `selectByLevel`, `selectReliableMemories`) sowie den fünf
  Kandidatenabfragen aus `retrieveCandidates` (`src/orb-core/engine.server.ts:647–729`):
  norm_key (1), topic (20), Informationsbereich der Frage (20), letzte Zugriffe (10),
  Inhaltssuche über max. 3 Suchwörter (20). Gewicht neutral 0.5 (wie ohne Kantenfund).
- Es wurde kein Chatlauf ausgelöst, keine Zeile geschrieben.

## 2. Relevante Knoten im Bestand (Auszug, wörtlich)

| ID (kurz) | topic (DB) | Bereich (recall.ts) | Inhalt |
|---|---|---|---|
| 132bf051 | hardware | hardware | „Ich esse gerne Brokkoli, Schnitzel. Trinke Alkoholfreies Bier. Habe Schuhgröße 42, mein gaming PC hat eine Nvidia rtx 5070“ |
| 4e4167ac | hardware | hardware | „Mein Lieblingsessen. Meine Grafikkarte und meine Schuhgröße“ |
| c6d0f938 | gute | – | „Guten Abend. Ich heiße Mario und du“ |
| 3ef66eb8 | korrekt | – | „Korrekt aber mein Name ist Mario, das kannst du dir gerne merken …“ |
| fac1e7a5 | jahre | alter | „Ich bin 36 Jahre“ |
| f6fdc5df | jahre | beruf | „Ich bin 36 Jahre Alt und was bin ich bin Beruf“ |
| 1db76f06 | gaming | – | „Ich bin Koch eigentlich der in der Freizeit sich für KI und Fullstack Anwendungen interessiert …“ |
| 05e1c1c6 | reisen | essen | „Ich reise gerne nach Griechenland, weil da schmeckt das Essen authentisch gut am Meer.“ |

Ein Wohnort-Knoten existiert im Bestand **nicht** (keine Stadt, kein „wohne in …“).

## 3. Ergebnis je Frage (A–L)

### 1. „Wie heiße ich?“
- A) JA – zwei Knoten. B) `c6d0f938`, `3ef66eb8`. C) siehe Tabelle.
- D/E) Bereich der Frage: **keiner** – für „Name“ existiert in `DOMAIN_PATTERNS` kein
  Eintrag. Es wird immer nur **ein** Bereich benutzt (erster Treffer, `infoDomainOf`).
- F) Thema der Frage: `heiße`. G/H/I/J) `c6d0f938` kommt über die Liste der letzten
  Zugriffe herein, similarity 0.200 → Score 0.0977 → **überlebt**. `3ef66eb8` („mein Name
  ist Mario“) ist Kandidat, hat aber **kein gemeinsames Inhaltswort** („name“ ≠ „heiße“)
  und keinen Bereich → overlap 0.000 → **verworfen am harten Filter**.
- K/L) an das Modell gehen 5 Erinnerungen, darunter „Ich heiße Mario und du“ – die Frage
  ist also beantwortbar, aber nur über den Zufall des jüngsten Zugriffs.

### 2. „Wie alt bin ich?“
- A) JA. B) `fac1e7a5` („Ich bin 36 Jahre“) und `f6fdc5df`.
- D) Bereich `alter` (P15 wirkt). F) Thema `alt`. 
- **Bruchstelle BEWIESEN:** `fac1e7a5` hat `topic='jahre'`, nicht `'alter'`. Die
  Bereichsabfrage sucht `topic = 'alter'` – dieser Knoten ist **NICHT-KANDIDAT** und wird
  nie bewertet. Erreicht wird nur `f6fdc5df` (similarity 0.250) über die Inhaltssuche.
- L) 6 Erinnerungen ans Modell, darunter „Ich bin 36 Jahre Alt und was bin ich bin Beruf“.

### 3. „Was arbeite ich?“
- A) JA – `1db76f06` („Ich bin Koch …“). D) Bereich der Frage: **keiner** – das Muster
  `beruf` verlangt „beruf/job/arbeite als“; „Was arbeite ich?“ trifft es nicht.
- F) Thema `arbeite`. Der Koch-Knoten hat `topic='gaming'` und enthält das Wort „arbeite“
  nicht → weder Themen- noch Bereichs- noch Inhaltstreffer → **NICHT-KANDIDAT**.
- L) genau **1** Erinnerung ans Modell („okay daran arbeite ich jetzt … phase 3“) – die
  Berufsangabe ist nicht dabei. **Das ist der gemeldete Ausfall.**

### 4. „Wo wohne ich?“
- A) **NEIN** – es gibt keinen Wohnort-Knoten. D) Bereich `wohnort` wird korrekt erkannt,
  aber kein Knoten trägt `topic='wohnort'`.
- L) 1 Erinnerung ans Modell (ein Patch-Text, siehe Abschnitt 5). Befund: **kein Datenfehler,
  keine Bruchstelle – die Information wurde nie gespeichert.**

### 5. „Was esse ich gerne?“ – härtester Fall
- A) JA. B) `132bf051`, zusätzlich `4e4167ac`, `05e1c1c6`.
- D) Bereich `essen` erkannt. F) Thema der Frage: **`null`**. Suchwörter: **leer** –
  „was/esse/ich/gerne“ sind Frage-, Stopp- bzw. Bewertungswörter, `contentTokens` ergibt [].
- **Bruchstelle BEWIESEN (Kandidatensuche):** es laufen nur zwei Abfragen (norm_key,
  letzte 10 Zugriffe) und die Bereichsabfrage `topic='essen'`. Kein einziger Knoten hat
  `topic='essen'`: das Sammel-Memory ist prioritätsgesteuert als **`hardware`** klassifiziert
  (in `TOPIC_KEYWORDS` steht `hardware` vor `essen`, „rtx“ gewinnt gegen „esse“), der
  Griechenland-Knoten als `reisen`.
- I/J) Ergebnis: **0 von 10 Kandidaten überleben, 0 Erinnerungen ans Modell.** Pikant:
  `topicAffinity("Was esse ich gerne?", "Ich esse gerne Brokkoli …")` **wäre 0.120** – der
  Knoten scheitert also nicht am Filter, sondern daran, dass er nie geladen wird.

### 6. „Welche Grafikkarte habe ich?“ – funktioniert
- Thema `hardware`, Bereich `hardware`; beide Sammelknoten sind Kandidat (sim 0.250 bzw.
  Affinität 0.120) → 4 Erinnerungen ans Modell, inklusive „Nvidia rtx 5070“.

### 7. „Welche Schuhgröße habe ich?“ – funktioniert
- Bereich: **keiner**, Thema `schuhgröße`; der Treffer kommt rein über die Inhaltssuche
  (`content ilike %schuhgröße%`): sim 0.250 / 0.100 → 4 Erinnerungen ans Modell.

## 4. Sammel-Memory – ausdrücklicher Test

`132bf051` enthält vier Fakten (Essen, Getränk, Schuhgröße, Grafikkarte), erhält aber
**genau ein** Thema (`hardware`) und **genau einen** Bereich (`hardware`). Belegte Folge:

| Frage | Kandidat? | overlap | ans Modell? |
|---|---|---|---|
| Grafikkarte | ja (Thema+Bereich) | 0.120 | ja |
| Schuhgröße | ja (Inhaltssuche) | 0.100 | ja |
| Essen | **nein** | – | **nein** |

Die weiteren Fakten desselben Knotens werden also ignoriert, sobald die Frage nicht das
gewinnende Thema betrifft und kein wörtliches Suchwort liefert. **BEWIESEN.**

## 5. Nebenbefunde (nicht angefasst)

- **Patch-Text als Erinnerung:** `e2fb4b1f` speichert einen Diff (`--- a/src/orb-core/memory.ts …`).
  Er trägt Bereich `alter` und erreicht bei mehreren Fragen den Modellkontext – inhaltlicher
  Ballast, technisch aber regelkonform gespeichert.
- 119 Knoten (nicht 113) beim Nutzer, alle aktiv; der frühere Zählstand ist damit nur
  gewachsen, nichts fehlt.
- Neutrales Kantengewicht 0.5 in der Nachbildung; echte Kanten können den **Rang**, nicht
  die Filterentscheidung verändern (overlap ist kantenunabhängig).

## 6. Klassifikation

- **DATA_PRESENT** – BEWIESEN (119 aktive Knoten, Inhalte wörtlich vorhanden).
- **DATA_RETRIEVAL_FAILED (Kandidatensuche)** – BEWIESEN für „Was esse ich gerne?“,
  „Was arbeite ich?“, „Wie alt bin ich?“ (Zweitkandidat `fac1e7a5`).
- **CONTEXT_INJECTION_FAILED (harter Filter)** – BEWIESEN für „mein Name ist Mario“.
- **Keine Information vorhanden** – BEWIESEN für „Wo wohne ich?“.
- WRONG_USER / WRONG_SESSION / WRONG_ENVIRONMENT / DATA_DELETED / GRAPH_RETRIEVAL_FAILED –
  **ausgeschlossen** (ein Nutzer, eine Datenbank, alle Knoten aktiv).

## 7. Exakte Bruchstellen (Code)

1. `src/orb-core/engine.server.ts:667–694` – Themen-/Bereichsabfragen vergleichen
   `topic` **exakt gleich**; ein Knoten hat aber nur **ein** Thema und dieses stammt aus
   `topicOf` (Erst-Treffer-Priorität), nicht aus dem Informationsbereich.
2. `src/orb-core/memory.ts:501–508` (`topicOf`) – Reihenfolge von `TOPIC_KEYWORDS`
   entscheidet bei Mehrfachfakten; `hardware` gewinnt gegen `essen`.
3. `src/orb-core/engine.server.ts:959` – `filter(c => c.overlap > 0)`: ohne Wortgleichheit
   und ohne Bereichsgleichheit ist Schluss, unabhängig von Wichtigkeit und Aktivierungszahl.
4. `src/orb-core/recall.ts:14–35` – kein Bereich für „Name“; `beruf` erkennt „Was arbeite
   ich?“ nicht.

## 8. Root Cause (nur soweit belegt)

Ein Knoten trägt **eine** Themen-Etikette, Fragen brauchen aber **mehrere** Zugänge.
Sammelnotizen mit mehreren persönlichen Fakten sind dadurch nur über ihr gewinnendes Thema
oder über wörtliche Suchwörter erreichbar. Fragen ohne Inhaltswort („Was esse ich gerne?“)
haben keinen dritten Weg und liefern 0 Erinnerungen.

## 9. Kein Fix

In P18 wurde nichts geändert und kein Patch vorgeschlagen. Jeder Eingriff (mehrere Themen
je Knoten, Bereichsspalte, zusätzliche Bereiche, Bereichsabgleich statt Themengleichheit)
ist eine Produktionsänderung und braucht eine eigene ausdrückliche Freigabe.

**ABSOLUTER STOPP.**
