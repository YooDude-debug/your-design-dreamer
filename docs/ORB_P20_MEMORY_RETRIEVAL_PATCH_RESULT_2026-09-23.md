# P20 – Memory Retrieval Multi-Domain Patch (umgesetzt)

Datum: 2026-09-23 · Freigabe: P19-Design · Referenz: `docs/ORB_P19_MEMORY_RETRIEVAL_FIX_DESIGN_RESULT_2026-09-23.md`

**Kein Deployment, keine Veröffentlichung, keine Migration, keine Datenmutation, 0 Modellaufrufe.**
Keine Abweichung vom P19-Design (Details in Abschnitt 8, Punkt G3).

---

## 1. Geänderte Dateien

| Datei | Art |
| --- | --- |
| `src/orb-core/recall.ts` | Bereichserkennung (Teil 1 + Teil 3) |
| `src/orb-core/engine.server.ts` | Kandidatensuche `retrieveCandidates` (Teil 2), ein Import |
| `tests/orb-p20-multi-domain-recall.test.ts` | neu, 21 Regressionstests |
| `tests/orb-memory-recall-fix.test.ts` | eine strukturelle Zusicherung an die neue Abfrageform angepasst |

Nicht angefasst: `src/orb-core/memory.ts`, `core.ts`, Graph-, Curiosity-, Energy-, Autonomie-, Prompt-, Modell- und ChatBridge-Dateien, DB-Schema, Migrationen, Memory-Inhalte.

---

## 2. Exakte Änderungen

### Teil 1 – alle passenden Bereiche statt nur des ersten (`recall.ts`)

- Neu `infoDomainsOf(text): string[]` — sammelt **alle** Treffer aus `DOMAIN_PATTERNS`. Ohne Treffer: leeres Array (kein Bereich wird erfunden).
- `infoDomainOf` (erster Treffer) bleibt wortgleich erhalten; alle bisherigen Aufrufer sind unverändert.
- `topicAffinity` prüft jetzt `infoDomainsOf(memory).includes(intent)` statt Gleichheit des ersten Treffers. **Rückgabewert weiterhin nur `0` oder `TOPIC_AFFINITY_FLOOR = 0.12`.**

### Teil 2 – Kandidatensuche über den Bereichsinhalt (`engine.server.ts`)

- Neu `domainKeywords(domain)` in `recall.ts`: feste Leitwortliste je Bereich (5–7 Wörter, ausschliesslich Wörter, die bereits in `DOMAIN_PATTERNS` stehen). Unbekannter Bereich oder `null` → leere Liste.
- In `retrieveCandidates` ersetzt der Bereichszweig `eq("topic", intentTopic)` durch
  `.or("topic.eq.<bereich>,content.ilike.%<leitwort>%, …")` — gleiche Nutzerbegrenzung `eq("user_id", userId)`, gleiche Sortierung nach `importance`, gleiche Obergrenze `CANDIDATE_LIMIT` (20), **eine** Abfrage wie zuvor.
- Die Bedingung lautet jetzt `if (intentTopic)` statt `if (intentTopic && intentTopic !== topic)`, weil die Abfrage inhaltlich mehr abdeckt als die Themenabfrage.

### Teil 3 – belegte Wortlücken (`recall.ts`)

- Neuer Bereich `name`: `name|namen|heiße|heisse|heißt|heisst|heißen|heissen`.
- Bereich `beruf` ergänzt um `arbeite|arbeitest|arbeitet` (ohne „als") und `koch|köchin|koechin`.
- Keine weiteren Bereiche, keine Synonym-Engine.

---

## 3. Vorher/Nachher-Messung (echte Inhalte aus dem Bestand, read-only gelesen)

Relevanzwert = `max(similarity, topicAffinity)` aus der **bestehenden** Berechnung. „nicht geholt" = die Erinnerung erreichte die Bewertung nie.

| Frage | Bereich | Erinnerung | vorher | nachher | erkannte Bereiche |
| --- | --- | --- | --- | --- | --- |
| Was esse ich gerne? | essen | `132bf051` Sammelnotiz | **nicht geholt (0 Kandidaten)** | **0.120 → durchgelassen** | hardware, essen |
| Was esse ich gerne? | essen | `4e4167ac` | nicht geholt | 0.120 → durchgelassen | hardware, essen |
| Welche Schuhgröße habe ich? | – (wörtlich) | `132bf051` | 0.100 | **0.100 unverändert** | hardware, essen |
| Welche Schuhgröße habe ich? | – | `4e4167ac` | 0.250 | **0.250 unverändert** | hardware, essen |
| Welche Grafikkarte habe ich? | hardware | `132bf051` | 0.120 | **0.120 unverändert** | hardware, essen |
| Welche Grafikkarte habe ich? | hardware | `4e4167ac` | 0.250 | **0.250 unverändert** | hardware, essen |
| Was arbeite ich? | beruf | `1db76f06` „Ich bin Koch …" | **nicht geholt** | **0.120 → durchgelassen** | beruf |
| Was arbeite ich? | beruf | `f6fdc5df` | nicht geholt | 0.120 → durchgelassen | beruf, alter |
| Wie heiße ich? | name | `c6d0f938` „Ich heiße Mario" | 0.200 | **0.200 unverändert** | name |
| Wie heiße ich? | name | `3ef66eb8` „mein Name ist Mario" | **nicht geholt** | **0.120 → durchgelassen** | name |
| Wie alt bin ich? | alter | `f6fdc5df` (bisher funktionierender Fall) | 0.250 | **0.250 unverändert** | beruf, alter |
| Wie alt bin ich? | alter | `fac1e7a5` „Ich bin 36 Jahre" | nicht geholt | 0.120 → durchgelassen | alter |
| Wo wohne ich? | wohnort | – | **0 Kandidaten** | **0 Kandidaten** | – |

**Modellkontext:** unverändert begrenzt auf `RECALL_LIMIT = 6` über `selectByLevel`; es wandern keine zusätzlichen Erinnerungen ungefiltert in den Kontext.

**Hinweis zur Schuhgröße:** der Fall bleibt bewusst ein **wörtlicher** Treffer (0.100 / 0.250 statt 0.120). Die Sammelnotiz wird für die Schuhgrößenfrage weiterhin über die vorhandene Wortsuche gefunden; ein eigener Bereich „Schuhgröße" wurde nicht eingeführt (P19 erlaubte nur `name` und `beruf`).

---

## 4. Regressionstests (Pflichtfälle 1–13)

Neue Datei `tests/orb-p20-multi-domain-recall.test.ts`:

- Sammelnotiz wird unter **essen** und **hardware** erkannt; `infoDomainOf` liefert weiter `hardware`.
- Ohne Treffer: leere Bereichsliste („wandern", Leertext).
- Pflichtfälle: Essen, Grafikkarte, Beruf („Was arbeite ich?" × Koch), Name („Wie heiße ich?" × beide Varianten), Alter — je `topicAffinity = 0.12` und `overlap > 0`.
- „Mein Name ist Mario" und „Ich heiße Mario" liegen im selben Bereich.
- Schuhgrößenfrage: Affinität 0, wörtliche Ähnlichkeit > 0 (unverändert).
- **Gegenproben:** Altersfrage × reine RTX-Notiz = 0; Essensfrage × reine RTX-Notiz = 0; Grafikkartenfrage × reine Essensnotiz = 0; Wohnortfrage ohne Wohnortnotiz = 0 gegen alle geprüften Notizen; Aussagen lösen keinen Bereichs-Recall aus.
- Struktur: Bereichsabfrage nutzt ausschliesslich `domainKeywords`, bleibt nutzerbezogen und bei `CANDIDATE_LIMIT`.

**Ergebnisse:**

| Prüfung | Ergebnis |
| --- | --- |
| Gesamte Logiktests | **1440 grün / 90 Dateien** (vorher 1419) |
| DB-/Sicherheitstests | **102 grün / 11 Dateien** |
| `tsgo --noEmit` | fehlerfrei |
| Lint (`src/orb-core`, `src/orb-sdk`, `tests`) | sauber |
| Build | OK |

---

## 5. Nachweis: Relevanzfilter unverändert

- Harter Filter im Code unverändert: `.filter((c) => c.overlap > 0)` und `const overlap = Math.max(similarity(text, n.content), topicAffinity(text, n.content));` — per Test auf den Quelltext zugesichert.
- `memoryRelevance` (`memory.ts`) wurde nicht angefasst; Untergrenze **0.12** und Speicherschwelle **0.35** numerisch geprüft.
- Der Wert 0.120 stammt aus der bestehenden Untergrenze + bestehender Formel, **nicht** aus einer neuen Sonderregel: `topicAffinity` gibt weiterhin nur `0` oder `TOPIC_AFFINITY_FLOOR` zurück.
- Wörtliche Treffer ranken weiterhin höher als die Untergrenze (Test).
- Beweis der Wirkungsrichtung: alle Verbesserungen in Abschnitt 3 entstehen durch „nicht geholt → geholt", **kein** bereits geholter Fall hat seinen Wert oder seine Filterentscheidung geändert.

---

## 6. Keine Memory-Daten verändert

- Nur lesende SQL-Abfragen (`select`) zur Messung; kein `insert`, `update`, `delete`.
- `orb_nodes.topic` wird weiterhin genauso geschrieben wie bisher (`topicOf` unverändert); kein Backfill, keine Neuberechnung bestehender Knoten.
- Speicherpfad, Duplikatschlüssel (`normKey`), Gewichte und Verbindungen unverändert.

---

## 7. Sicherheitsprüfung

| Punkt | Ergebnis |
| --- | --- |
| Zusätzliche Berechtigungen | keine |
| Neue öffentliche Route | keine |
| Datenmutation | keine |
| Neue Credentials/Secrets | keine |
| Admin-Gate | unverändert |
| Nutzerisolation | jede Kandidatenabfrage weiterhin `eq("user_id", userId)` (per Test gezählt) |
| Abfragegrösse | unverändert `CANDIDATE_LIMIT = 20`, keine Vollabfrage |
| Eingabesicherheit | Leitwörter sind feste Literale im Code, nie Benutzertext → keine Einschleusung in den `or`-Filter |

---

## 8. Verbleibende bekannte Grenzen

- **G1:** `orb_nodes.topic` bleibt einwertig. Die Mehrfachzuordnung wirkt nur zur Laufzeit; die Themenabfrage und das Interessenmodell sehen weiter genau ein Thema.
- **G2:** Die Bereichsabfrage nutzt `content ilike %wort%` ohne Index — bei 119 Knoten unkritisch, wächst linear. Indexvariante = Schemaänderung, nicht durchgeführt (P19, Variante 3).
- **G3:** Abweichung vom Design nur in der Formulierung, nicht in der Wirkung: die Bereichsabfrage enthält zusätzlich `topic.eq.<bereich>` im gleichen `or`, damit der bisherige Themenzugang erhalten bleibt (keine zusätzliche Abfrage).
- **G4:** „Wo wohne ich?" bleibt ohne Treffer — es existiert keine Wohnortnotiz. **Nicht** durch einen erfundenen Eintrag ersetzt.
- **G5:** Separat gemeldet, nicht Teil dieses Patches: Knoten `e2fb4b1f` speichert Programm-/Patchtext und gelangt mehrfach in den Kontext.
- **G6:** Offen aus früheren Phasen: historische Fehlervorlage im Code, P7-Untererfassung der DB-Zählung, 40/43-Fälle, 134 historische Modellaufrufe, fehlende Admin-Ansicht für Analysen.

**ABSOLUTER STOPP.** Kein Deployment, keine Veröffentlichung.
