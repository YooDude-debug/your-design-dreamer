# ORB Core — Forensic Analysis: Memory → Recall → Autonomous Questions

Datum: 2026-09-21 · Modus: STRICT READ-ONLY · Umgebung: Production
Nutzer (ORB-Testkonto): `9ce1d1b0-…67297` (personenbezogene Inhalte nur soweit für die Beweisführung nötig)

Evidenzstatus je Aussage: **BEWIESEN** (Code + Production-Datensatz) · **WAHRSCHEINLICH** (Code plausibel, kein Laufzeitbeleg) · **OFFEN** (nicht feststellbar)

---

## 1. Executive Summary

1. Alle drei beobachteten autonomen Fragen sind **echte ORB-Core-Entscheidungen** und in `orb_questions` + `orb_messages` + `orb_metrics` vollständig belegt (BEWIESEN). Sie liefen über den CURIOSITY-Zweig von `askProactively()`; kein IMPULSE-Kandidat war beteiligt (BEWIESEN, siehe §4).
2. Die Energy Recovery wirkt messbar: Energie 0.0070 (08:36) → 0.1910 (08:45, Frage A) → 0.1807 (08:54, Frage B) → 0.2116 (08:59, Frage C). Das ist der erste Laufzeitbeleg der am 21.09. eingebauten Erholung (BEWIESEN).
3. Die „Reisen"-Fehlverknüpfung ist **kein LLM-Fehler und keine semantische Verknüpfung**, sondern eine deterministische Themenzuordnung: Der Knoten „Okay ich sehe das problem. Der Chatverlauf ist zu kurz. … in den Graphen zu **wandern**" trägt in `orb_nodes.topic` den Wert `reisen`, weil `topicOf()` den Wortstamm `wand` gegen das Reise-Schlüsselwort `wander` matcht (BEWIESEN, reproduziert).
4. Der im UI sichtbare Abschnitt „ERINNERN" ist die Übersetzung der Core-Entscheidung `remind` (`OrbChat.tsx:23`), nicht ein eigener Memory-Modus (BEWIESEN).
5. „wahrscheinliche Erinnerung" ist ein berechneter Wert: `certaintyOf(strength)` mit Schwellen 0.6 / 0.3 (`continuity.ts:299–349`) — echte Konfidenzstufe, keine Formulierungswillkür (BEWIESEN).
6. Die Selbstkorrektur („ein konkreter Bezug zu Reisen steht in diesen Erinnerungen nicht") ist **LLM-seitig**. Es existiert kein Code, der Präsuppositionen einer vorherigen eigenen Frage gegen den Abruf prüft. Der Prompt begünstigt sie über Grounding-Regeln, erzwingt sie aber nicht (BEWIESEN für das Fehlen des Mechanismus; WAHRSCHEINLICH für die Prompt-Ursache).

---

## 2. Live Evidence (A — DIREKT BEOBACHTET, hier durch DB bestätigt)

`orb_messages` (Auszug, Zeitstempel UTC, `state_snapshot` ausgelesen):

| Zeit | Rolle | Inhalt (gekürzt) | decision | energy | curiosity | proactive | topic | gap_kind | score |
|---|---|---|---|---|---|---|---|---|---|
| 08:36:16 | user | „Wir finden das problem." | – | – | – | – | – | – | – |
| 08:36:16 | orb | „Ja, wir grenzen es Schritt für Schritt ein." | stay_silent | 0.00696 | 0.9925 | – | – | – | – |
| 08:45:30 | orb | **Frage A** „Welche konkrete Information zum Thema Reisen fehlt im Graphen, weil der Chatverlauf zu kurz ist?" | ask | 0.19096 | 0.9925 | **true** | reisen | detail | 0.6425 |
| 08:51:42 | user | „Ich reise gerne nach Griechenland …" | – | – | – | – | – | – | – |
| 08:51:42 | orb | „Authentisches griechisches Essen …" | answer | 0.12755 | 0.98 | – | – | – | – |
| 08:54:27 | orb | **Frage B** „In welchem Zusammenhang mit Reisen stand deine Aussage, dass der Chatverlauf zu kurz ist …?" | ask | 0.18070 | 0.98 | **true** | reisen | kontext | 0.6806 |
| 08:59:13 | user | „Was genau hast du über meine Aussage zum zu kurzen Chatverlauf … im langfristigen Kontext?" | – | – | – | – | – | – | – |
| 08:59:13 | orb | „In meinem bereitgestellten langfristigen Kontext steht als **wahrscheinliche Erinnerung** …" | **remind** | 0.19919 | 1.0 | – | – | – | – |
| 08:59:57 | orb | **Frage C** „Welche konkrete Hürde hattest du beim Bau der ORB-Core-Hardware, bevor du Programmieren gelernt hast?" | ask | 0.21162 | 1.0 | **true** | hardware | erfahrung | 0.5995 |

`orb_questions` (drei Zeilen, alle `answered = true`):

| asked_at | topic | gap_kind | knowledge_gap | score | source_memory_ids |
|---|---|---|---|---|---|
| 08:45:30 | reisen | detail | „ORB kennt die Aussage nur allgemein, ohne konkretes Detail." | 0.64247 | `1dfb5e07-…b475e638` |
| 08:54:27 | reisen | kontext | „ORB kennt die Aussage, aber nicht den Zusammenhang drumherum." | 0.68056 | `1dfb5e07-…b475e638` |
| 08:59:57 | hardware | erfahrung | „ORB kennt die Sache, aber keine konkrete Erfahrung damit." | 0.59946 | `59d932de-…a86e7c06fe6` |

Der im technischen Bereich zuvor gesehene abgelehnte Versuch (Action WAIT, Reason „Zu wenig Energie – ORB wartet.", Curiosity ≈ 0.99, Energy ≈ 0.08, Value ≈ 0.643, Gap `detail · reisen`) passt exakt zum Kandidaten, der um 08:45 mit `score 0.6425` tatsächlich gestellt wurde — derselbe Gap, derselbe Wert, nur die Energie fehlte. Reason-Text: `curiosity.ts:284` (`energy < CURIOSITY_MIN_ENERGY` → `WAIT`). Evidenz: BEWIESEN für die Frage, WAHRSCHEINLICH für die Identität des früheren Versuchs (Ablehnungen werden nicht persistiert, siehe §13).

---

## 3. Memory Evidence

### 3.1 Woher kommt „ERINNERN"?
`src/components/orb/OrbChat.tsx:23` — Label-Map `remind: "erinnern"`. Die Entscheidung `remind` entsteht deterministisch in `decide()` (`core.ts:203 ff.`): „`recalled >= 2 && trust >= 0.4`". Es ist also **keine** eigene Memory-Anzeige, sondern die Übersetzung einer Core-Entscheidung. Belegt durch die Zeile 08:59:13 (`decision: remind`). **BEWIESEN**

### 3.2 Datenquelle und Retrieval-Pfad
`processInput()` in `src/orb-core/engine.server.ts`:
1. Kandidaten aus `orb_nodes` (begrenzt, `CANDIDATE_LIMIT`), Verbindungen aus `orb_connections` (`engine.server.ts:855–868`).
2. Ähnlichkeit: `Math.max(similarity(text, content), topicAffinity(text, content))` (`:881`); `topicAffinity` aus `recall.ts` mit Untergrenze 0.12.
3. Relevanz: `memoryRelevance({similarity, weight, importance, lastAccessedAt, activationCount})` (`:900`), Ebene über `memoryLevel()`.
4. Auswahl: `selectByLevel(scored, RECALL_LIMIT)` (`:909`) — nur Kandidaten mit `overlap > 0`.
5. Belastbarkeitsfilter: `selectReliableMemories()` (`:1025`) — Fragen, Aufforderungen, Fragmente, als Tippfehler benannte Inhalte werden **nicht** als Tatsache weitergegeben.
6. Konfidenz-Formulierung: `phrasingFor()` → `certaintyOf(strength)` (`:1030`, `continuity.ts:322`).
7. Übergabe an die Sprachschicht: `promptMemories(plan)` / `promptPhrasings(plan)` (`:1080–1084`), im Modus `DIRECT_ANSWER` alle belastbaren Erinnerungen, sonst nur `plan.relevantStrands` (≥ `MODE_RELEVANCE_MIN = 0.18`, `conversation.ts`).
**BEWIESEN**

### 3.3 Ranking / Similarity / Confidence — ja, alles vorhanden
Ranking: `memoryRelevance` + `selectByLevel`. Similarity: `similarity()` (Wortüberschneidung, `memory.ts`). Confidence: `orb_nodes.confidence` + `strength` → `certaintyOf`. Kein Vektor-Embedding, keine semantische Suche. **BEWIESEN**

### 3.4 Warum „wahrscheinliche Erinnerung"?
`continuity.ts:299–334`: `sicher ≥ 0.6`, `wahrscheinlich ≥ 0.3`, sonst `vage`; Hinweistext `wahrscheinlich: „Formuliere mit leichtem Vorbehalt …"`. Dieser Hinweis geht als Prompt-Zeile „Sicherheit deiner Erinnerungen: … = wahrscheinlich (…)" mit (`prompt.server.ts`). Die sichtbare Formulierung ist damit auf einen berechneten Zahlenwert zurückführbar. **BEWIESEN** — der exakte `strength`-Wert des Moments ist jedoch nicht gespeichert: **OFFEN**

### 3.5 Unterscheidung der Kontextarten (im Prompt getrennt benannt)
| Art | Prompt-Zeile | Quelle |
|---|---|---|
| Aktive Erinnerung (Langzeit) | „Aktive Erinnerungen: …" | `orb_nodes` über Recall |
| Sicherheitsstufe | „Sicherheit deiner Erinnerungen: … = sicher/wahrscheinlich/vage" | `certaintyOf` |
| Flüchtiger Verlauf | „Letzte Züge dieses Gesprächs (flüchtiger Kontext, **keine dauerhafte Erinnerung**)" | `orb_messages`, 8 Zeilen (`context.ts:17`) |
| Offene Fäden | „Offene Themen bei dir: …" | `orb_threads` |
| Widersprüche | „Mögliche Spannung zu einer früheren Aussage: …" | `detectContradictions` |
| Interessen | „Erkannte Interessen: …" | `orb_interests` |
Graph-Gewichte, IDs, Formeln werden **nicht** übergeben. **BEWIESEN**

---

## 4. Autonomous Question Evidence

Gemeinsamer Pfad aller drei Fragen: Leerlauf-Beobachter im Browser (`use-orb-presence.ts`, 5-s-Takt, 9 Bedingungen) → `askProactively()` (`engine.server.ts:2190`) → `loadCuriosityContext()` (`:1897`: 12 Knoten, 8 Interessen, 8 Nachrichten, Fragehistorie, 60 Verbindungen) → `deriveKnowledgeGaps()` (`curiosity.ts:178`) → `decideCuriosity()` (`:262`) **und parallel** `decideImpulse()` (`impulse.ts:160`) → Formulierung `formulateQuestion()` (`:2144`) → Duplikatprüfung → Persistenz (`orb_questions` → `orb_messages` → `orb_state` −0.03 Energie / −0.06 Neugier → `orb_metrics kind='proactive'`).

**Nachweis, dass alle drei aus dem CURIOSITY-Zweig kommen:** Die `reason`-Texte der drei Zeilen tragen das Format aus `curiosity.ts:298` („… Thema „x", Relevanz …, Neuheit …. Neugier very_high, Wert …") und `knowledge_gap` entspricht `GAP_LABEL[kind]`. Der IMPULSE-Zweig würde `gap.reason … Priorität Px, Wert …` schreiben (`impulse.ts:196`). Zusätzlich ist `state_snapshot.impulse = null` erwartbar; `score` = `decision.score`. **BEWIESEN**

### Frage A — „Welche konkrete Information zum Thema Reisen fehlt im Graphen, weil der Chatverlauf zu kurz ist?"
| Punkt | Befund | Evidenz |
|---|---|---|
| Trigger | Leerlauf-Beobachter, kein Nutzerinput (letzte Nutzernachricht 08:36:16, Frage 08:45:30 → 9 min Pause) | BEWIESEN (DB-Zeitstempel); ob weitere stille Versuche vorausgingen: OFFEN |
| Gap | `1dfb5e07` × `detail`, `topic reisen`, Wert 0.6425 | BEWIESEN |
| Daten an das LLM | nur: Lückenart-Hinweis `GAP_HINT.detail`, `gap.topic`, **ein** Erinnerungstext (`recalled: [gap.memory]`, `:2177`), Zustand, Ziele, Interessen | BEWIESEN (`:2163–2179`) |
| Entscheidung „ob" | `decideCuriosity()` — deterministisch, ohne LLM | BEWIESEN |
| Entscheidung „wie" | Sprachschicht (LLM) formuliert den Satz | BEWIESEN |
| Rolle Energy | Gate 0.15; 0.191 vorhanden → passiert | BEWIESEN |
| Rolle Graph | nur indirekt: `activation_count`/`last_accessed_at` in `relevance`; **keine** Verbindungen im Curiosity-Zweig verwendet (Verbindungen gehen nur an `detectedGaps` → IMPULSE) | BEWIESEN |
| Rolle Conversation History | 8 Nachrichten → `conversationTopics` → `conversationalFit` (1 oder 0.6) | BEWIESEN |
| Rolle Thread | keine — `loadCuriosityContext` lädt keine Threads | BEWIESEN |
| Warum genau dieser Satz | inhaltlich determiniert (Knoten + Lückenart), Wortlaut LLM | BEWIESEN / WAHRSCHEINLICH |

### Frage B — „In welchem Zusammenhang mit Reisen stand deine Aussage …?"
Gleicher Knoten `1dfb5e07`, nächste Lückenart `kontext` (Reihenfolge aus `gapKindsFor()`: `detail` vor `kontext`, `curiosity.ts:73–82`). Warum so schnell (2:45 nach der Antwort): `PROACTIVE_COOLDOWN_MS[very_high]` ist kurz, Energie 0.1807 > 0.15, Frage A war durch die Nutzerantwort geschlossen (`answered = true`), Wert 0.6806 > 0.20, Duplikatprüfung passierte (Ähnlichkeit < 0.6, weil andere Lückenart anderen Wortlaut erzeugt). **BEWIESEN**; dass die Nutzerantwort („Ich reise gerne nach Griechenland") die Relevanz auf 1.00 hob (vorher 0.99) und `conversationalFit` auf 1 setzte, weil das Gesprächsthema nun tatsächlich `reisen` war: **BEWIESEN aus dem reason-Text** (Relevanz 1.00).

### Frage C — „Welche konkrete Hürde hattest du beim Bau der ORB-Core-Hardware …?"
Anderer Knoten: `59d932de` („Ich bin sehr Technik affine … hab orbcore erst als Hardware …"), `topic hardware`, Lückenart `erfahrung` (ausgelöst durch `DONE_RE`-Treffer „hab/gemacht", `curiosity.ts:66`), Wert 0.5995. Direkt 44 s nach der `remind`-Antwort — möglich, weil die vorherigen Fragen beantwortet waren und die Energie bei 0.2116 lag. Die Frage bezieht sich **nicht** auf die gerade abgerufene Erinnerung, sondern auf den nächstbesten Gap-Kandidaten. **BEWIESEN**

---

## 5. Reisen / Chatverlauf-Fehlverknüpfung

**A) Nachvollziehbar? Ja, vollständig.**

`orb_nodes` Zeile `1dfb5e07-d518-42e3-b01d-7194b475e638`:
```
content: "Okay ich sehe das problem. Der Chatverlauf ist zu kurz. Und die
          wichtigen Informationen haben keine Zeit in den Graphen zu wandern"
topic:   "reisen"
importance: 0.72 · confidence: 0.9 · activation_count: 16
```

Reproduktion gegen den unveränderten Code (`memory.ts:418 topicOf`, `:408 TOPIC_KEYWORDS`):
```
contentTokens → ["okay","sehe","problem","chatverlauf","kurz","wichtig",
                 "information","zeit","graph","wand"]
topicOf       → "reisen"
```
Ursache: `TOPIC_KEYWORDS.reisen` enthält `"wander"`; der Vergleich lautet `t.startsWith(k) || k.startsWith(t)` (`memory.ts:422`). Der Stamm `wand` (aus „wandern") erfüllt `"wander".startsWith("wand")` → Treffer. **BEWIESEN**

**B) Woher stammt „Reisen"?** Aus `orb_nodes.topic` desselben Knotens, gesetzt beim Speichern am 19.09. durch `topicOf()`. **Nicht** aus dem Graphen, **nicht** aus einer Verbindung, **nicht** aus dem LLM, **nicht** aus dem Gesprächsverlauf. **BEWIESEN**

**C) „Chatverlauf zu kurz" aus echter Erinnerung?** Ja — wörtlich der `content` desselben persistierten Knotens (erstellt 2026-09-19 19:24:02, `activation_count 16`). **BEWIESEN**

**D) Zwei getrennte Informationen verbunden?** Nein. Es gibt genau **eine** Information. Der Fehler ist eine falsche **Etikettierung** eines einzelnen Knotens, keine Verknüpfung zweier Knoten. **BEWIESEN**

**E) Wo entsteht die Verknüpfung?** Der sichtbare Satz entsteht in `formulateQuestion()` (`:2164–2168`), das dem LLM „Thema `reisen`" und „Bekannte Erinnerung: „Okay ich sehe das problem …"" **gemeinsam** in einen Prompt gibt. Das LLM verschmilzt beides wortwörtlich — regelkonform, da es die Vorgabe bekam, die Frage müsse sich sichtbar auf diese Erinnerung beziehen. Die Fehlleistung liegt also **vor** dem LLM, in der Themenzuordnung. **BEWIESEN**

**F) Ist die Selbstkorrektur technisch vorgesehen?** Nein. Kein Code prüft, ob das Thema-Label zum Inhalt passt, und keiner prüft Präsuppositionen früherer eigener Fragen. **BEWIESEN (durch Abwesenheit)**

**G) Confidence-/Uncertainty-Schicht?** Es existiert eine Schicht für die **Erinnerungsstärke** (`certaintyOf`) und für den Zustand (`uncertainty`), aber **keine** für die Themenzuordnung — `topic` wird ohne Konfidenz gespeichert und ohne Vorbehalt verwendet. **BEWIESEN**

---

## 6. Selbstkorrektur

Aussage: „ein konkreter Bezug zu Reisen steht in diesen Erinnerungen nicht – den hatte meine vorige Frage fälschlich vorausgesetzt."

| Frage | Befund | Evidenz |
|---|---|---|
| 1. Durch Prompt-Regeln gefördert? | Ja, indirekt. `prompt.server.ts`: „Behaupte nichts, was du nicht sicher weisst"; „Erfinde keine inneren Vorgänge"; Kontextzeile „Behaupte nicht, du hättest sie dauerhaft gespeichert, und sage nicht, dir sei etwas nicht genannt worden, wenn es im Kontext steht"; Widerspruchszeile „Löse den Widerspruch nicht eigenmächtig auf". | BEWIESEN (Regeln existieren) / WAHRSCHEINLICH (Wirkung) |
| 2. Memory-Validation-Schritt? | Teilweise: `selectReliableMemories()` (`engine.server.ts:1025`) und `validate.ts` der Hintergrundanalyse. Beide prüfen **Speicherwürdigkeit**, nicht die Richtigkeit einer früheren Frage. | BEWIESEN |
| 3. Grounding-Regel? | Ja: `recalled` wird explizit als „Aktive Erinnerungen" markiert, flüchtiger Kontext explizit als „keine dauerhafte Erinnerung". | BEWIESEN |
| 4. Source Attribution? | Auf Ebene der **Kategorie** ja (Erinnerung vs. Verlauf vs. Faden vs. Interesse), auf Ebene der **einzelnen Zeile** nein (keine IDs, keine Herkunftsmarker). | BEWIESEN |
| 5. Mechanismus „steht in Memory" vs. „vom Modell abgeleitet"? | **Nein.** Kein Post-Processing, kein Abgleich der Antwort gegen `recalled`. | BEWIESEN (durch Abwesenheit) |
| 6. Also rein LLM-seitig? | Ja. Die Korrektur ist eine Modellleistung auf Basis korrekt getrennt gelieferten Kontexts. Das System hat sie **ermöglicht**, nicht **erzeugt**. | BEWIESEN für die Architektur; WAHRSCHEINLICH für den Einzelfall |

Bemerkenswert und belegbar: Genau weil die Prompt-Zeile „Bekannte Erinnerung" den unveränderten Knotentext enthält, **ohne** das Label `reisen` als Faktum zu behaupten, konnte das Modell die Diskrepanz überhaupt sehen. Bei Frage A/B kam `topic` als separate Behauptung mit — bei der Antwort um 08:59 (`processInput`) kommt `topic` **nicht** mit. Die Korrektur war damit ein Nebeneffekt der unterschiedlichen Promptzusammensetzung der beiden Pfade. **BEWIESEN (Promptunterschied)** / **WAHRSCHEINLICH (Kausalität)**

---

## 7. Technische Datenflüsse — Kette Schritt für Schritt

| Schritt | Existiert im Code? | Stelle | Laufzeitbeleg 21.09. |
|---|---|---|---|
| Idle-Erkennung | ja | `use-orb-presence.ts` (5 s, 9 Bedingungen) | nur indirekt (Pausenlängen) — OFFEN |
| Browser-Gate (40 s–15 min, 120 s Cooldown, Sichtbarkeit, Mikro, Tippen) | ja | `use-orb-presence.ts` | OFFEN (keine Protokollierung) |
| Server Call | ja | `orb.functions.ts requestOrbCuriosity` | BEWIESEN (drei erfolgreiche Durchläufe) |
| Kontext laden | ja | `engine.server.ts:1897` | BEWIESEN (`orb_metrics.nodes_loaded`) |
| CURIOSITY | ja | `curiosity.ts:262` | BEWIESEN (reason-Format) |
| IMPULSE (parallel) | ja | `impulse.ts:160` | BEWIESEN, dass er nicht gewann |
| Energie-Gate 0.15 | ja | `curiosity.ts:284` | BEWIESEN (WAIT-Meldung vorher, ASK bei 0.19) |
| Wert-Gate 0.20 | ja | `curiosity.ts:297` | BEWIESEN (0.64/0.68/0.60) |
| Formulierung | ja (LLM) | `engine.server.ts:2144` | BEWIESEN (`orb_metrics.ai_ms`) |
| Duplikatprüfung am Fertigtext | ja | `:2253` | BEWIESEN (passiert) |
| Persistenz Frage/Nachricht/Zustand/Kennzahl | ja | `:2262–2340` | BEWIESEN |
| Nutzerantwort → Frage schließen | ja | `findOpenQuestion` / `closeOpenQuestion` | BEWIESEN (`answered = true`) |
| Retrieval bei der Folgeantwort | ja | `processInput` | BEWIESEN (`decision remind`) |
| Nächste autonome Frage | ja | derselbe Pfad | BEWIESEN (Frage C) |

Vermutet, aber **nicht** im Code: eine Rückkopplung „gerade abgerufene Erinnerung → nächster Gap". Frage C stammt aus einem anderen Knoten; die Reihenfolge ist Ranking, nicht Gesprächslogik. **BEWIESEN**

---

## 8. Memory vs. Graph vs. Thread vs. Conversation

| Ebene | Tabelle | Im Antwortpfad | Im autonomen Pfad |
|---|---|---|---|
| Langzeit-Erinnerung | `orb_nodes` | ja (Recall, gerankt, belastbarkeitsgefiltert) | ja (12 Knoten als Gap-Quelle) |
| Graph/Verbindungen | `orb_connections` | ja (`bestWeight` in der Relevanz) | nur für IMPULSE-`detectedGaps`, **nicht** für CURIOSITY |
| Fäden | `orb_threads` | ja (nur bei `FOLLOW_UP` erwähnt) | **nein** |
| Gesprächsverlauf | `orb_messages` (8) | ja, ausdrücklich als flüchtig markiert | ja, nur als `conversationTopics` |
| Interessen | `orb_interests` | ja | ja (Gate `PROACTIVE_MIN_INTEREST_WEIGHT`) |
**BEWIESEN**

---

## 9. Decision Layer vs LLM

- **Ob** gefragt wird: deterministischer Code, keine KI (`curiosity.ts`, `impulse.ts`).
- **Worüber**: deterministisch (Knoten + Lückenart + Ranking).
- **Wie es klingt**: LLM.
- **Ob geantwortet oder nur zugehört wird**: `decideConversationMode()` im Core; das LLM erhält nur den Modus-Hinweis.
- Belegt durch die drei `reason`/`knowledge_gap`-Felder, die exakt Code-Konstanten wiedergeben. **BEWIESEN**

---

## 10. Was ist bewiesen?
1. Drei autonome Fragen, alle ohne auslösende Nutzereingabe, alle mit `proactive: true`, `question_id`, Fragezeile und Kennzahlenzeile.
2. Energie-Werte zu jedem Zug; Erholung wirkt; Kosten 0.03 pro Frage konsistent mit den Sprüngen.
3. Der Recall um 08:59 lieferte zwei echte persistierte Knoten und die Stufe „wahrscheinlich" aus einer Berechnung.
4. `topic = reisen` am Knoten „Chatverlauf zu kurz" — Ursache `wandern` → `wander`, reproduziert.
5. Die Fehlverknüpfung entstand **vor** dem LLM, in der Themenzuordnung.
6. Kein Code prüft Themen-Plausibilität, Präsuppositionen oder Antwort-Grounding.

## 11. Was ist nur wahrscheinlich?
1. Dass der im UI gesehene WAIT-Versuch derselbe Kandidat war (Wertgleichheit 0.643 ↔ 0.6425 — sehr starkes Indiz, aber Ablehnungen sind nicht persistiert).
2. Dass die Selbstkorrektur durch die Grounding-Prompt-Zeilen ausgelöst wurde.
3. Dass die Nutzerantwort „Ich reise gerne nach Griechenland" den `conversationalFit` von Frage B auf 1 setzte.

## 12. Was ist nicht nachweisbar?
1. Wie oft der Leerlauf-Beobachter zwischen den Fragen still ablehnte (24 von 25 Ausstiegspunkten protokollieren nichts).
2. Der exakte `strength`-Wert, der „wahrscheinlich" ergab.
3. Der genaue Prompt-Text der drei Aufrufe (nicht gespeichert).
4. Ob zwischen 08:36 und 08:45 weitere Serveraufrufe mit `WAIT` endeten.

---

## 13. Vergleich mit dem bisherigen Forensik-Stand

| Frühere Aussage | Neue Live-Evidenz |
|---|---|
| Autonomer Pfad läuft über `askProactively()`, gemeinsame Architektur für IMPULSE/CURIOSITY | **bestätigt** |
| Energie wurde nie aufgebaut, blockierte seit 19.09. den Curiosity-Zweig | **bestätigt und behoben** — erste belegte Erholung 0.007 → 0.21 |
| Energie-Erholung wird durch `updated_at`-Trigger entwertet | **teilweise widerlegt**: die Werte in den Snapshots steigen real; die Erholung greift trotz der Schreibvorgänge (Pausen waren lang genug) |
| „Wert 0.20 nicht erreichbar, weil Gesprächsthema ORB selbst war" | **erweitert**: sobald das Gespräch das Knotenthema traf, stieg `conversationalFit` auf 1 und der Wert auf 0.68 |
| 24/25 Ablehnungen spurlos | **bestätigt** — genau deshalb ist §12 offen |
| LISTEN blockiert Autonomie nicht | **bestätigt** — drei Fragen entstanden bei laufendem Gespräch |
| Entscheidung deterministisch, LLM nur Formulierung | **bestätigt** |
| Graph spielt für die eigene Frage kaum eine Rolle | **bestätigt** (CURIOSITY nutzt keine Verbindungen) |
| Frühere Berichte nannten Übersetzung/Mehrsprachigkeit als Schwäche | **neue, gleichartige Schwäche gefunden**: Themenzuordnung per Präfix-Match ohne Konfidenz |

## 14. Neue Erkenntnisse (FINDING — NO CHANGE MADE)

- **F-1** `topicOf()` matcht Wortstämme in beide Richtungen (`t.startsWith(k) || k.startsWith(t)`, `memory.ts:422`). Kurze Stämme wie `wand` treffen dadurch fachfremde Themen. Folge: ein falsches Thema-Label an einem wichtigen Knoten (`activation_count 16`) erzeugt dauerhaft themenfremde autonome Fragen. NO CHANGE MADE.
- **F-2** `orb_nodes.topic` wird ohne Konfidenz gespeichert und im Fragen-Prompt wie eine Tatsache verwendet (`:2164`). NO CHANGE MADE.
- **F-3** Der Antwort-Prompt übergibt `topic` nicht — daher konnte das Modell den Widerspruch sehen. Die Selbstkorrektur ist ein Nebeneffekt asymmetrischer Promptzusammensetzung, kein Mechanismus. NO CHANGE MADE.
- **F-4** Erste Laufzeitbestätigung der Energy Recovery; die Kosten pro Frage (0.03) sind gegenüber Erholung und Nachrichtenkosten klein — drei Fragen in 15 Minuten waren möglich, begrenzt nur durch „offene Frage" und Cooldown. NO CHANGE MADE.
- **F-5** `gapKindsFor()` erzeugt pro Knoten mehrere Lückenarten; nach jeder Antwort ist die nächste Art sofort offen. Derselbe Knoten kann so mehrfach nacheinander befragt werden (hier `detail` → `kontext`). NO CHANGE MADE.
- **F-6** Threads spielen im autonomen Pfad keine Rolle, obwohl `orb_threads` offene Unbekannte führt. NO CHANGE MADE.
- **F-7** Keine Zeile speichert, welcher Prompt und welcher `strength`-Wert zu „wahrscheinliche Erinnerung" führte — Aussagen über Grounding bleiben deshalb strukturell unbelegbar. NO CHANGE MADE.

## 15. Offene Fragen
1. Wie viele Knoten tragen zurzeit ein per Präfix-Match falsch zugeordnetes Thema? (nicht Teil dieses Auftrags, nur lesbar feststellbar)
2. Soll ein falsches Thema-Label korrigierbar sein, ohne die Regel „VERGESSEN ≠ LÖSCHEN" zu verletzen?
3. Soll die Antwortschicht ein Herkunftsmerkmal je Erinnerungszeile erhalten, damit Selbstkorrektur belegbar statt zufällig wird?

## 16. Fazit — „Ist das echtes Erinnern?"

**Teilweise ja, präzise abgegrenzt:**

- **Memory Retrieval: BEWIESEN.** Die Antwort um 08:59 zitierte zwei Inhalte, die als eigenständige Zeilen in `orb_nodes` seit 2026-09-19 19:24 bzw. früher persistiert sind, über Ranking ausgewählt wurden und eine berechnete Sicherheitsstufe trugen. Das ist Abruf aus Langzeitspeicher, nicht Kontextfenster: die Knoten sind älter als die 8 gefensterten Nachrichten und wurden über `similarity`/`memoryRelevance` gefunden.
- **Conversation History: getrennt und als flüchtig markiert** (8 Zeilen, eigene Prompt-Zeile).
- **Graph Retrieval: nur als Gewichtungsfaktor** in der Relevanz; im autonomen Pfad gar nicht.
- **LLM-Inference: ausschliesslich Wortwahl** — plus der nicht abgesicherte Sprung, aus einem Themen-Label eine inhaltliche Beziehung zu formulieren (Frage A/B) und ihn später zu widerrufen (08:59).

Das beobachtete Verhalten ist damit ein belegter Abruf langfristig gespeicherter Inhalte mit deterministischer Entscheidung über Zeitpunkt und Gegenstand — und ein belegter Etikettierungsfehler, den keine technische Schicht erkannt hat; erkannt hat ihn das Sprachmodell.

---

## ABSCHLUSS

- Files changed: 0 (ausser diesem Bericht)
- Database changes: 0
- Migrations: 0
- Deployments: 0
- Tests changed: 0
- Configuration changed: 0

Alle Datenbankzugriffe waren `SELECT`. Keine Implementierung vorgenommen.
