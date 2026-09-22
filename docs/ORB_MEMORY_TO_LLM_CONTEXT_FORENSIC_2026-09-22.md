# ORB CORE – MEMORY → LLM CONTEXT FORENSIC AUDIT

Datum: 2026-09-22 · Modus: **READ-ONLY** · 0 Codeänderungen · 0 Tests geändert · 0 SQL-Schreibzugriffe · 0 Migration · 0 Deployment

Klassifikation je Aussage: **CODE-BEWIESEN**, **DB-BEWIESEN**, **RUNTIME-BEWIESEN**, **TEST-BEWIESEN**, **WAHRSCHEINLICH**, **OFFEN**.

---

## 1. Ausgangslage

Geprüft, nicht übernommen:

| Behauptung aus früheren Berichten | Befund gegen den aktuellen Code/DB |
|---|---|
| Bestand > 40, 72 `orb_nodes` | **DB-BEWIESEN, aktualisiert:** 75 Knoten für den Hauptnutzer (`9ce1d1b0-…`), alle `lifecycle = active`, 0 mit `topic IS NULL` |
| `GRAPH_LIMIT = 40` begrenzt nur Snapshot/Graph | **CODE-BEWIESEN bestätigt** (§13) |
| Recall nutzt einen eigenen Retrieval-Pfad | **CODE-BEWIESEN bestätigt** (§5) |
| Recall nutzt „eine eigene Abfrage mit LIMIT 60" | **WIDERLEGT** (§14) – es gibt keine `LIMIT 60`-Abfrage im Recall. Der Recall besteht aus bis zu fünf Teilabfragen mit `CANDIDATE_LIMIT = 20` bzw. `CANDIDATE_LIMIT / 2 = 10`. Die „60" im alten Bericht entspricht keiner Stelle im heutigen Recall-Pfad (`limit(60)` existiert nur in der Verbindungs-/Lückensuche des autonomen Pfads). |
| `selectByLevel(…, 6)` | **CODE-BEWIESEN bestätigt**, `RECALL_LIMIT = 6` (§8, §14) |

## 2. Architektur des Recall-Pfads (CODE-BEWIESEN)

```text
Nutzereingabe (max 1000 Zeichen)
 → retrieveCandidates()            engine.server.ts:622-703   bis zu 5 Teilabfragen
 → Dedup über Map<id>              engine.server.ts:695-702
 → Bewertung je Knoten             engine.server.ts:885-916   overlap, level, score
 → .filter(overlap > 0)            engine.server.ts:917
 → selectByLevel(scored, 6)        memory.ts:555-570          A≤4, B≤4, C≤2, Gesamt 6
 → selectReliableMemories()        eligibility.ts:130-141
 → activeMemories: string[]        engine.server.ts:1039
 → promptMemories(plan)            engine.server.ts:1089-1090 DIRECT_ANSWER: alle; sonst max 2 Stränge
 → buildSpeakSystemPrompt()        llm/prompt.server.ts:57-59 „Aktive Erinnerungen: …"
 → Sprachmodell
```

Kein Schritt lädt den vollständigen Graphen; es gibt keinen Fallback „wenn nichts gefunden, nimm die wichtigsten Knoten".

## 3. Testfälle (Produktionsdaten, READ-ONLY, Inhalte gekürzt)

| Fall | ID | Inhalt (gekürzt) | norm_key (gekürzt) | topic | importance | activation | lifecycle | last_accessed_at | Ebene |
|---|---|---|---|---|---|---|---|---|---|
| **A** abrufbar | `132bf051-…` | „Ich esse gerne … Schuhgröße 44 und eine NVIDIA RTX 5070 zum Gaming" | `5070-alkoholfrei-…-schuhgröße-trinke` | hardware | 0.48 | 14 | active | 2026-09-22 07:06 | **A** |
| **B** vorhanden, nicht nutzbar | `fac1e7a5-…` | „Ich bin 36 Jahre" | – | **jahre** | 0.40 | 2 | active | 2026-09-21 18:25 | **C** |
| **C** nur indirekt passend | `4050e1e9-…` | „,I feel good' https://youtube…" | `com-feel-good-http-www-youtube` | hardware | 0.40 | 1 | active | 2026-09-20 21:03 | **C** |

Ebenenverteilung des Gesamtbestands (DB-BEWIESEN, Zeitpunkt der Prüfung): **A 34 · B 30 · C 11 · Summe 75**.

## 4. Storage

Alle drei Fälle: **STORAGE = YES**. Sie liegen in `orb_nodes`, `lifecycle = active`, mit Thema, Wichtigkeit und Zugriffszeit. Es gibt keinen Speicher-Cap, kein Pruning, kein DELETE für Knoten (bereits DB-/CODE-BEWIESEN im Wachstums-Audit, hier erneut geprüft: `rg` findet im ORB-Core genau ein `.delete()`, und das betrifft `orb_questions`).

## 5. Storage → Candidate Search (CODE-BEWIESEN)

`retrieveCandidates(db, userId, text, q)` baut aus der Eingabe:
`key = normKey(text)`, `topic = topicOf(text)`, `intentTopic = questionIntentOf(text)`, `tokens = contentTokens(text).slice(0, 3)`.

| # | Abfrage | WHERE | ORDER BY | LIMIT |
|---|---|---|---|---|
| 1 | Schlüsseltreffer | `user_id`, `norm_key = key` | – | 1 |
| 2 | Thema | `user_id`, `topic = topicOf(text)` | `importance desc` | 20 |
| 3 | Frage-Informationsbereich (nur falls ≠ Thema) | `user_id`, `topic = questionIntentOf(text)` | `importance desc` | 20 |
| 4 | Aktualität (Ebene A) | `user_id` | `last_accessed_at desc` | **10** (`CANDIDATE_LIMIT / 2`) |
| 5 | Textsuche | `user_id`, `or(content.ilike.%t%)` für bis zu 3 Tokens | `importance desc` | 20 |

Danach: Dedup über `Map<id>`, kein weiteres `slice`. `lifecycle` wird **nicht** gefiltert (also auch `forgotten` wäre Kandidat); `user_id` ist überall gesetzt; Verbindungen werden mit `limit(CANDIDATE_LIMIT * 3 = 60)` nachgeladen — das ist die Gewichtsquelle, kein Kandidatenkreis.

**Wird ein gespeichertes Memory gar nicht erst Kandidat? JA.** Nachweis mit den echten Funktionen (Bun-Skript unter `/tmp`, reine Berechnung, keine Schreibvorgänge):

| Eingabe | `topicOf` | `questionIntentOf` | Tokens | Folge für Fall B („Ich bin 36 Jahre", topic `jahre`) |
|---|---|---|---|---|
| „Wie alt bin ich?" | **`wie`** | `null` | `wie`, `alt` | Abfrage 2 sucht `topic = 'wie'` → Treffer nein; Abfrage 3 entfällt; Abfrage 5 sucht `%wie%`/`%alt%` → „Ich bin 36 Jahre" enthält keins von beiden; Abfrage 4 liefert nur die 10 jüngsten Knoten, Fall B liegt nicht darunter → **kein Kandidat** |
| „Wie alt bin ich nochmal, weißt du das?" | `wie` | `null` | `wie`, `alt`, `nochmal` | identisch → **kein Kandidat** |
| „Welche Grafikkarte habe ich?" | `hardware` | `hardware` | `welche`, `grafikkarte` | Abfrage 2 trifft alle hardware-Knoten, darunter Fall A und Fall C → **Kandidat** |

Zwei Mechanismen wirken zusammen: `topicOf()` liefert für Frageformulierungen ein Füllwort-Thema (`wie`), und `questionIntentOf()` kennt nur vier Informationsbereiche (`hardware`, `projekte`, `beruf`, `essen` – `recall.ts:14-28`). Alles ausserhalb dieser vier Bereiche hat keinen themenbasierten Recall-Pfad.

## 6. Candidate Filtering (CODE-BEWIESEN)

| Filter | INPUT | CONDITION | OUTPUT | Fall A | Fall B | Fall C |
|---|---|---|---|---|---|---|
| Überschneidung (`engine.server.ts:917`) | `overlap = max(similarity(text, content), topicAffinity(text, content))` | `overlap > 0` | Kandidat bleibt | „Welche Grafikkarte habe ich?" → **0.120** → bleibt | „Wie alt bin ich?" → **0.000** → würde auch als Kandidat **hier** scheitern | „Welche Grafikkarte habe ich?" → **0.000** → **entfernt** |
| Ebenenauswahl | `selectByLevel` | A≤4, B≤4, C≤2, Gesamt ≤6 | max 6 | Ebene A, Rang hoch → bleibt | n/a | Ebene C → ohnehin unerreichbar (§8) |
| Belastbarkeit (`eligibility.ts:130-141`) | Inhalt | `utteranceKind === "statement"` und keine Korrektur und kein als Tippfehler benanntes Wort enthalten | bleibt | belastbar (geprüft: `true`) | belastbar | belastbar |
| Gesprächsmodus (`engine.server.ts:1089-1090`) | Modus | `DIRECT_ANSWER` → alle aktiven Erinnerungen; sonst nur `relevantStrands` (Themenbezug **oder** `relevance ≥ 0.18`), hart auf **2** begrenzt | ≤6 bzw. ≤2 | Frage → `DIRECT_ANSWER` → alle | n/a | n/a |

Es gibt **keine** Relevanzuntergrenze im Recall selbst (nur `> 0`), keinen `reliability`-Schwellenwert, keine Duplikatunterdrückung und keinen `lifecycle`-Filter im Kontextpfad.

## 7. Relevance / Ranking (CODE-BEWIESEN)

`memoryRelevance` (`memory.ts:516-523`):
`sim · clamp(weight, W_MIN..1) · (0.5 + 0.5·importance) · recencyFactor · (1 + log10(1+activation)·0.3)`, `recencyFactor = max(0.1, exp(−h/104))`.

Entscheidend: **`sim` ist ein Faktor.** Bei `sim = 0` ist der Gesamtwert 0, unabhängig von Wichtigkeit, Häufigkeit und Aktualität. Es gibt keinen additiven Anteil, der eine wichtige Erinnerung ohne Wortüberschneidung retten könnte.

| Fall | Eingabe | overlap | score | Rangfolge | Ergebnis |
|---|---|---|---|---|---|
| A | „Welche Grafikkarte habe ich?" | 0.120 | > 0, Ebene A | unter den ersten 4 der Ebene A | **ausgewählt** |
| B | „Wie alt bin ich?" | 0.000 | – | nicht bewertet, weil kein Kandidat | **nie im Ranking** |
| C | „Welche Grafikkarte habe ich?" | 0.000 | 0 | vor dem Ranking entfernt | **verworfen** |

`similarity()` ist ein Jaccard-Mass über `contentTokens` (`memory.ts:324-332`). „Wie alt bin ich?" und „Ich bin 36 Jahre" haben null gemeinsame Inhaltstoken — kein Synonym-, Stamm- oder Bedeutungsabgleich. `topicAffinity()` (`recall.ts:70`) greift nur, wenn **beide** Seiten einem der vier Informationsbereiche zugeordnet werden.

## 8. Recall Levels (CODE-BEWIESEN)

`memoryLevel` (`memory.ts:541-546`): A = letzte Berührung ≤ 6 h; sonst B bei `importance ≥ 0.5` **oder** `activation_count ≥ 3`; sonst C.
`LEVEL_LIMITS = { A: 4, B: 4, C: 2 }`, `RECALL_LIMIT = 6`.

`selectByLevel()` füllt streng in der Reihenfolge A → B → C und bricht ab, sobald 6 erreicht sind.

**Kann ein gespeichertes Memory allein wegen der Ebene niemals in den aktiven Kontext gelangen? JA.** Nachweis mit der echten Funktion: bei je 6 Kandidaten der Ebenen A und B und einem Kandidaten der Ebene C mit dem **höchsten** Punktwert (0.99) lautet die Auswahl `a0, a1, a2, a3, b0, b1` — der C-Kandidat kommt nicht vor. Im Bestand existieren 34 Knoten der Ebene A; sobald vier von ihnen Kandidaten mit `overlap > 0` sind, bleiben genau zwei Plätze für Ebene B und keiner für Ebene C. Betroffen sind heute 11 Knoten (Ebene C).

## 9. Active Memories (CODE-BEWIESEN)

Entstehungsstelle: `engine.server.ts:1035-1039` — `selectReliableMemories(recalled…)` → `activeMemories = […].map(r => r.node.content)`. Übernommen wird der **vollständige Inhalt**, ungekürzt, in Rangfolge der Auswahl; nichts wird zusammengefasst, keine Themen werden verschmolzen, es gibt kein weiteres Limit und kein weiteres Ranking.

Zahlenkette am Beispiel „Welche Grafikkarte habe ich?" (rekonstruiert, WAHRSCHEINLICH in der Grössenordnung, da die Teilabfragen zeitpunktabhängig sind):

```text
STORAGE          75 Knoten
→ Kandidaten     ≤ 1 + 20 + 0 + 10 + 20 = 51 (nach Dedup deutlich weniger)
→ nach overlap>0 nur Knoten mit Wortüberschneidung oder gleichem Informationsbereich
→ nach Ranking   ≤ 6 (A≤4, B≤4, C≤2)
→ belastbar      ≤ 6
→ active         ≤ 6   (im Modus DIRECT_ANSWER), sonst ≤ 2
```

Für „Wie alt bin ich?": `STORAGE 75 → Kandidaten ohne Fall B → Ranking ohne Fall B → active memories ohne Fall B`.

## 10. Context Builder (CODE-BEWIESEN)

`promptMemories(plan)` (`engine.server.ts:1089-1090`):
- `mode === "DIRECT_ANSWER"` → **alle** aktiven Erinnerungen (max 6).
- sonst → `plan.relevantStrands`: gefiltert über `isRelevantStrand` (Themenübereinstimmung **oder** `relevance ≥ MODE_RELEVANCE_MIN = 0.18`), sortiert nach Relevanz, **`slice(0, MODE_MAX_STRANDS = 2)`**; im Modus `LISTEN` **leer**.

**Kann ein Memory den Recall überstehen und erst hier verschwinden? JA, CODE-BEWIESEN** — in jedem Modus ausser `DIRECT_ANSWER`: von bis zu 6 aktiven Erinnerungen erreichen höchstens 2 den Prompt, im Modus `LISTEN` keine. Eine Nutzerfrage führt jedoch über `needsDirectAnswer()` (`conversation.ts:99-101`, Fragezeichen oder W-Wort) zuverlässig zu `DIRECT_ANSWER`; dieser Verlustpfad betrifft daher Aussagen, nicht Fragen.

Kein Token-Budget, keine Truncation der Erinnerungsinhalte, keine Kürzung im Kontextpfad. Gekürzt wird nur Begleitmaterial: Sicherheitsangaben und Widersprüche auf 60 Zeichen, Interessen auf 5 Einträge, Gesprächskontext auf 8 Nachrichten à 160 Zeichen.

## 11. LLM Input (CODE-BEWIESEN)

`buildSpeakSystemPrompt()` (`llm/prompt.server.ts:57-59`) setzt eine **System-Prompt-Zeile**:

```text
Aktive Erinnerungen: „<Inhalt 1>“; „<Inhalt 2>“; …
```

und ohne Treffer ausdrücklich:

```text
Du hast zu dieser Eingabe keine passende Erinnerung.
```

Die Erinnerungen gehen also als Systemkontext, als Klartext, vollständig und ohne IDs/Gewichte/Formeln mit. Ein weiteres Limit existiert an dieser Stelle nicht. Rekonstruierter Beispielausschnitt (anonymisiert, ohne Schlüssel oder Zugangsdaten):

```text
System: … Handlungsentscheidung: answer … Gesprächsmodus: DIRECT_ANSWER …
        Aktive Erinnerungen: „Ich esse gerne … NVIDIA RTX 5070 zum Gaming“.
        Sicherheit deiner Erinnerungen: „Ich esse gerne …“ = … 
User:   Welche Grafikkarte habe ich?
```

Für „Wie alt bin ich?" enthält derselbe Prompt stattdessen den Satz „Du hast zu dieser Eingabe keine passende Erinnerung." — das Modell kann das Alter also nicht wissen, ohne zu raten.

## 12. Produktionsbeispiele

**Erfolgreicher Fall (Fall A).** Nutzerfrage nach der Grafikkarte → `topicOf` und `questionIntentOf` beide `hardware` → Kandidat über Abfrage 2 → `overlap 0.120 > 0` → Ebene A, Rang unter den ersten vier → belastbar → aktive Erinnerung → Systemzeile „Aktive Erinnerungen" → Modell kann antworten. Zusatzbeleg: der Knoten trägt `activation_count 14` und wurde zuletzt 2026-09-22 07:06 berührt, also im Betrieb wiederholt erfolgreich abgerufen (DB-BEWIESEN).

**Fehlgeschlagener Fall (Fall B).** Nutzerfrage nach dem Alter → Kandidatensuche findet den Knoten „Ich bin 36 Jahre" nicht (Thema `jahre` gegen Suchthema `wie`, keine Tokenüberschneidung, nicht unter den 10 jüngsten) → kein Ranking → keine aktive Erinnerung → Prompt enthält „keine passende Erinnerung".

Nicht belegbar: dass ORB diese Frage im Betrieb tatsächlich gestellt bekam und falsch antwortete. Die Kette ist mit den echten Funktionen und den echten Zeilen nachgerechnet, aber ein konkretes Gesprächsprotokoll dazu wurde hier nicht herangezogen → dieser Punkt bleibt **OFFEN** (§15).

**Einschränkung der Beweisführung:** Die Sprachschicht-Protokolle enthalten die gesendeten Prompts nicht dauerhaft in auswertbarer Form für diesen Zweck; der Prompt-Inhalt ist daher aus dem Code rekonstruiert, nicht aus einer Aufzeichnung gelesen.

## 13. Kein Einfluss von `GRAPH_LIMIT = 40` auf den Recall (CODE-BEWIESEN)

`GRAPH_LIMIT` (`engine.server.ts:133`) wird ausschliesslich in `getSnapshot()` verwendet — für `orb_nodes` (~:356) und `orb_connections` (~:363). `retrieveCandidates()` und der gesamte Kontextpfad verwenden es nicht; `rg` bestätigt, dass keine Recall-Funktion darauf zugreift. **Snapshot-Limit 40 ≠ Recall-Limit.** Der Graph zeigt 40, der Recall arbeitet auf dem vollen Bestand von 75 Zeilen — begrenzt nur durch die fünf Teilabfragen und ihre eigenen Limits.

## 14. Recall-Limits — Neuprüfung

- **`LIMIT 60` im Recall: existiert nicht** (WIDERLEGT). `limit(60)` kommt im Modul nur in der Verbindungsabfrage des autonomen Pfads vor; der Kontextpfad lädt Verbindungen mit `CANDIDATE_LIMIT * 3 = 60`, aber das ist die Gewichtsquelle für `memoryRelevance`, kein Kandidatenkreis für Erinnerungen.
- **`selectByLevel(…, 6)`:** die **6** ist `RECALL_LIMIT`, die harte Obergrenze der Erinnerungen, die in einem Zug in den Sprachkontext gelangen können — verteilt nach A≤4, B≤4, C≤2 mit Abbruch bei 6.
- **Danach folgen:** Belastbarkeitsfilter (kein Limit), Modusauswahl (`DIRECT_ANSWER`: unverändert; sonst `slice(0, 2)`; `LISTEN`: 0), Prompt-Zusammenbau (kein weiteres Limit).

## 15. Root Cause je Fall

| Fall | STORAGE | RETRIEVAL | CONTEXT | LLM INPUT | LLM USED | FIRST FAILURE POINT | Klasse |
|---|---|---|---|---|---|---|---|
| **A** „… RTX 5070 …" | YES | YES | YES | YES | **UNKNOWN** (Modellverhalten nicht Gegenstand) | – | **J) kein Problem** |
| **B** „Ich bin 36 Jahre" | YES | **NO** | NO | NO | NO (nicht im Kontext) | **Candidate Search** — Thema `jahre` gegen Suchthema `wie`, `questionIntentOf` kennt nur 4 Bereiche, keine Tokenüberschneidung, nicht unter den 10 jüngsten | **B) Candidate Search Problem** |
| **C** „,I feel good' …" | YES | **NO** | NO | NO | NO | **Filtering** — Kandidat über Thema `hardware`, aber `overlap = 0` → `.filter(overlap > 0)`; zusätzlich Ebene C ohne erreichbaren Platz | **C) Filtering Problem** (+ **E) Recall Level** als zweite, unabhängige Sperre) |
| **Struktureller Befund** Ebene C | YES | teils YES | **NO** | NO | NO | **selectByLevel** — 4 A + 2 B füllen die 6 Plätze; C bleibt aussen, auch mit höherem Punktwert | **E) Recall Level Problem** |
| **Struktureller Befund** Modus | YES | YES | **NO** | NO | NO | **Context Builder** — ausser `DIRECT_ANSWER` nur 2 Stränge, `LISTEN` keine | **F) Context Builder Problem** (bewusstes Design, Folge dokumentiert) |

**Erster Punkt, an dem eine relevante Erinnerung verloren geht — zusammengefasst:** bei Fragen ausserhalb der vier Informationsbereiche schon in der **Kandidatensuche**; bei gefundenen Kandidaten ohne Wortüberschneidung im **`overlap > 0`-Filter**; bei alten, unwichtigen Erinnerungen in **`selectByLevel`**. Kein Fall verliert die Erinnerung erst im Prompt-Aufbau oder im Modell. Die Klasse **I) LLM BEHAVIOR** ist für die untersuchten Fälle **nicht** zutreffend, weil die Inhalte den Prompt nachweislich nie erreichen.

## 16. Beweise (Kurzliste)

1. `engine.server.ts:622-703` — fünf Teilabfragen, Limits 1/20/20/10/20, kein `lifecycle`-Filter, kein `LIMIT 60`.
2. `engine.server.ts:885-917` — `overlap = max(similarity, topicAffinity)`, `.filter(overlap > 0)`.
3. `memory.ts:516-523` — `sim` als Faktor; `sim = 0` ⇒ `score = 0`.
4. `memory.ts:541-570` — Ebenen und `LEVEL_LIMITS {A:4,B:4,C:2}`; ausgeführt: C-Kandidat mit Punktwert 0.99 wird bei 6 A/B-Kandidaten nicht ausgewählt.
5. `recall.ts:14-28, 70` — `questionIntentOf`/`topicAffinity` kennen genau vier Informationsbereiche.
6. Ausgeführte Sonde mit den echten Funktionen: „Wie alt bin ich?" → `topicOf = wie`, `intent = null`, Tokens `wie/alt`, `overlap = 0.000` gegen „Ich bin 36 Jahre"; „Welche Grafikkarte habe ich?" → `hardware/hardware`, `overlap = 0.120` gegen Fall A.
7. `eligibility.ts:114-141` — Belastbarkeitsfilter; alle drei Fälle sind belastbar, dieser Filter ist hier nicht die Ursache.
8. `engine.server.ts:1089-1090` + `conversation.ts:120-158` — Modusabhängige Begrenzung auf 2 Stränge bzw. 0 bei `LISTEN`.
9. `llm/prompt.server.ts:57-59` — Erinnerungen als System-Prompt-Zeile, vollständig, kein weiteres Limit.
10. `engine.server.ts:133, ~356, ~363` — `GRAPH_LIMIT` nur im Snapshot.
11. DB: 75 Knoten, Ebenen A 34 / B 30 / C 11, alle `active`, 0 ohne Thema.
12. `engine.server.ts:1307-1318, 1392` — der Schlüsseltreffer `exact` wird **nur** im Speicherpfad verwendet (Reaktivierung, Wichtigkeit), er verschafft im Recall-Ranking keinen Vorrang.

## 17. Verbleibende Unsicherheiten

1. **OFFEN:** Kein aufgezeichnetes Gesprächsbeispiel, in dem ORB nachweislich nach dem Alter gefragt wurde und falsch antwortete. Die Kette ist rechnerisch belegt, der Betriebsvorfall nicht.
2. **OFFEN:** Die tatsächliche Kandidatenzahl je Eingabe ist zeitpunktabhängig (Abfrage 4 „10 jüngste") und wurde nicht je Produktionsanfrage protokolliert — es gibt keine Recall-Observability.
3. **OFFEN:** Modellverhalten bei vorhandenem Kontext (Klasse I) ist hier nicht untersucht; für Fall A steht `LLM USED = UNKNOWN`.
4. **WAHRSCHEINLICH:** Die Füllwort-Themen (`wie`, `jahre`, `könn`, `prei` …) stammen aus derselben Quelle wie die bereits dokumentierten Faden-Füllworttitel; ihr Umfang im Bestand wurde hier nicht vollständig quantifiziert.
5. **OFFEN:** Die Sprachschicht-Protokolle enthalten den gesendeten Prompt nicht in auswertbarer Form; der Prompt ist rekonstruiert.

## 18. Möglicher Minimal-Fix (nur Skizze, nicht umgesetzt, keine Empfehlung)

Jeder Punkt wäre ein eigener, getrennt testbarer Schritt:

- **Kandidatensuche (Fall B):** Frage-Informationsbereiche (`recall.ts`) über die vier bestehenden hinaus erweitern, oder für Fragen zusätzlich den vorhandenen Recall-Pfad über `norm_key`/Textsuche mit Wortstämmen statt vollständiger Tokens nutzen. Kleinster Eingriff wäre eine zusätzliche, begrenzte Kandidatenabfrage — ohne Änderung von Rangfolge oder Schwellen.
- **Überschneidungsfilter (Fall C):** `overlap > 0` bleibt sinnvoll; die eigentliche Frage ist, ob `similarity` als reiner Tokenvergleich für Frage-Antwort-Paare genügt. Eine Änderung hier berührt jedoch unmittelbar `memoryRelevance` und damit die autonomen Fragen — hohes Risiko.
- **Ebenen (struktureller Befund):** Entweder `RECALL_LIMIT` und `LEVEL_LIMITS` entkoppeln, oder Ebene C einen garantierten Platz geben. Beides verändert den Sprachkontext aller Antworten — muss vorher entschieden, nicht nebenbei gemacht werden.
- **Observability:** Ein interner Recall-Nachweis (Kandidatenzahl, ausgewählte Ebenen, Gründe) würde künftige Fälle ohne Nachrechnen belegbar machen.

## 19. Abgrenzung / Nicht geändert

0 Codeänderungen, 0 SQL-Schreibzugriffe, 0 Migration, 0 Schwellenwertänderungen, 0 Retrieval-/Memory-/Context-/LLM-Änderungen, 0 Tests geändert, 0 Datenbereinigung, 0 Deployment. Ausgeführt wurden ausschliesslich lesende SQL-Abfragen und eine rein rechnende Sonde unter `/tmp` mit den echten Kernfunktionen.

---

**READY FOR FIX DESIGN** — die Ursachen sind für alle drei untersuchten Fälle bis zum ersten Verlustpunkt belegt: Fall B scheitert in der Kandidatensuche, Fall C im Überschneidungsfilter (zusätzlich an der Ebenenauswahl), Fall A funktioniert korrekt. Die frühere Angabe „Recall LIMIT 60" ist widerlegt.
