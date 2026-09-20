# ORB CORE – LOGIC OVERVIEW (READ-ONLY CODE REVIEW)

Datum: 20.09.2026 (UTC)
Art: rein beschreibende Landkarte des aktuell implementierten Codes.
Keine Änderung an Code, DB, RLS, Formeln oder Thresholds. Keine Bewertung,
keine Verbesserungsvorschläge (Ausnahme: Abschnitt 12 F listet nur Fakten).

---

## 1. INPUT

Einstieg: `src/orb-core/engine.server.ts` → `processInput(db, userId, text, opts)` (ab Zeile 812).

Schrittfolge (tatsächlicher Code):
1. Text trimmen und auf `MAX_INPUT_CHARS` begrenzen (`:826`).
2. ORB-Zustand laden bzw. anlegen (`:829-832`).
3. Abruf von Kandidaten: `retrieveCandidates` (`:597-679`) – mehrere begrenzte
   Abfragen parallel: exakter `norm_key`, `topic`, Frage-Domäne (`intentTopic`),
   letzte Zugriffe, `ilike`-Tokensuche. `CANDIDATE_LIMIT = 20` (`:128`).
4. Verbindungen der Kandidaten laden (`:838-852`, Limit `CANDIDATE_LIMIT * 3`),
   je Knoten bestes Gewicht bestimmen.
5. Relevanz pro Kandidat (`memoryRelevance`, `src/orb-core/memory.ts:461-468`),
   Ebene A/B/C (`memoryLevel`), Filter `overlap > 0` (`:892`), Auswahl
   `selectByLevel(scored, RECALL_LIMIT)` mit `RECALL_LIMIT = 6` (`:126,893`) und
   `LEVEL_LIMITS = { A: 4, B: 4, C: 2 }` (`memory.ts:494`).
6. `isLearningEvent`, `scoreImportance`, `isQuestion` (`text.includes("?")`),
   `topicOf`, danach `decide(...)` (`:896-905`).
7. Conversation Context: eine Abfrage auf `orb_messages`, `created_at desc`,
   `.limit(CONTEXT_WINDOW_MESSAGES)` = **8 Nachrichten**
   (`src/orb-core/context.ts:17`, `engine.server.ts:910-917`), chronologisch
   gedreht, durch `contextWindow(...)` gefiltert (`context.ts:25-33`).
   Der Kontext ist flüchtig: er wird im Prompt ausdrücklich als „keine
   dauerhafte Erinnerung" gekennzeichnet.
8. „Merk dir das"-Aufforderungen werden gegen genau dieses Fenster aufgelöst
   (`context.ts:127-161`, `resolveFromContext`).
9. Interessen (Top 8), Threads, Stil laden (`:947-963`); Prozess-/Guardrail-
   Kontext nur bei erkannter Absicht (`:1033-1058`).
10. Widerspruchsprüfung gegen die bereits geladenen Kandidaten (`:991-994`).
11. Belastbarkeitsfilter vor der Sprachschicht:
    `selectReliableMemories(recalled, correctedTerms)` (`:1008-1012`).
12. `speak(...)` (Sprachschicht) bzw. Neugier-Pfad bei „frag mich"
    (`:1067-1150`).
13. Persistenz von Knoten, Verbindungen, Interessen, Threads (`:1186-1400`).

Unterscheidung Aussage / Frage / Aufforderung / Fragment:
`src/orb-core/eligibility.ts:67-77` (`utteranceKind`), Reihenfolge ist die
Begründung: leer → `fragment`; `REQUEST_RE` (`:22`) → `request`;
`QUESTION_RE` (`:26`) → `question`; ohne bedeutungstragende Wörter bzw. ein
einzelnes Kurzwort ohne Ziffer → `fragment`; sonst `statement`.
Nur `statement` kann persönliche Tatsache werden (`isStorableStatement`,
`:84-86`, benutzt in `engine.server.ts:1250`).

## 2. MEMORY

Speicherbedingung (`engine.server.ts:1249-1287`): neuer Knoten nur, wenn
`isStorableStatement(memoryText)` **und** (`shouldPersist(importance)` oder
`shouldPersist(memoryImportance)` oder Antwort auf eine offene eigene Frage oder
eine aufgelöste Merk-Aufforderung).

Threshold: `shouldPersist(importance) = importance >= 0.35`
(`src/orb-core/core.ts:145-147`).

`scoreImportance` (`core.ts:95-135`): Basis 0.25; +0.1 bei Länge > 60; +0.1 bei
Länge > 200; +0.05 bei „?"; +0.2 bei Markern (merk, wichtig, immer, nie, fehler,
falsch, ziel, remember, important, mistake, goal – Teilstring-Treffer); +0.15 bei
persönlichen Mustern („ich heiße", „ich bin", „ich mag", …); +0.35 bei
Lernereignis; `clamp01`.

Confidence (`memory.ts:45-56`): `user_stated 0.9`, `inferred 0.65`,
`observed 0.5`; bei Wiederholung `min(0.85, base + 0.05*(hints-1))`.
Gesetzt beim Anlegen (`engine.server.ts:1265`), erhöht bei exaktem Treffer
(`:1236`). Confidence steuert **nicht** die Speicherung, sondern nur die
Sicherheitsformulierung (`phrasingFor`).

Wiedererkennung / Verstärkung:
- `norm_key` (`memory.ts:294-338`) ist ein sortierter, gestemmter Schlüssel,
  der Negation erhält („keine Pizza" ≠ „Pizza").
- Bei exaktem Treffer wird der bestehende Knoten verstärkt, kein Duplikat:
  `activation_count + 1`, `last_accessed_at = now`,
  `importance = max(alt, neu)`, Confidence-Anhebung (`:1227-1242`).
- Schlüsselkonflikt beim Insert (`23505`) → erneuter Insert mit
  `norm_key: null`; es wird bewusst **nicht** zusammengeführt (`:1273-1283`).
- Alle abgerufenen Knoten werden reaktiviert: `activation_count + 1`,
  `last_accessed_at = now`, `importance = max(alt, importance * 0.8)`
  (`:1191-1207`).

Widerspruch / Korrektur:
- Erkennung: `isCorrection` / `correctedTerm` (`eligibility.ts:52,89-105`).
- Wirkung: `recordFeedback(..., "negative")` auf betroffene Knoten
  (`:1212-1218`) – Gewicht sinkt, nichts wird gelöscht oder überschrieben.
- Mögliche Widersprüche werden als Verbindung mit
  `origin: "potential_contradiction"` markiert (`:1364-1380`, `:768-781`) und im
  Antworttext benannt; sie werden nie automatisch aufgelöst.
- `correctedTerms` unterdrücken betroffene Inhalte nur für den aktuellen Zug im
  Sprachkontext (`eligibility.ts:130-139`).

## 3. DECAY / FORGETTING

`core.ts:14-19, 65-89`:
```
W_MIN = 0.05, W_MAX = 1, STRONG_THRESHOLD = 0.5
effectiveRate = decayRate * (1 - 0.5 * clamp01(importance))
currentWeight = clamp(weight * exp(-effectiveRate * hours), W_MIN, W_MAX)
reactivate(input, delta) = clamp(currentWeight(input) + max(0, delta), W_MIN, W_MAX)
reinforcement(importance, reps=1) = clamp01(0.08 + 0.22*clamp01(importance)) * min(3, max(1, reps))
```
Verändert wird ausschliesslich das berechnete **Gewicht** einer Verbindung,
zusätzlich `importance`, `confidence`, `activation_count`, `last_accessed_at` der
Knoten. Eine Erinnerung verfällt nie vollständig: Untergrenze `W_MIN`. Es gibt in
`engine.server.ts` keinen `delete`-Aufruf auf `orb_nodes`/`orb_connections`
(VERGESSEN ≠ LÖSCHEN). Genutzte `decay_rate`-Werte: 0.05 für gewöhnliche
Erfahrung, 0.02 bei Lernbezug/Widerspruch/Proaktiv, 0.01 für die feste
Lern-Verbindung (`:1301, 1376, 1644, 2346`).

## 4. CONNECTIONS / MEMORY GRAPH

`touchConnection` (`engine.server.ts:728-805`): keine Selbstverbindung (`:737`);
Suche nach dem gerichteten Paar `(user_id, source, target)`; existiert es, wird
`weight = reactivate(...)`, `last_activated_at`, `activation_count + 1`,
`importance = max(alt, neu)` gesetzt; sonst Insert mit
`weight = min(1, 0.35 + delta)`, `activation_count = 1`, `metadata = {origin}`.

Verbunden werden:
- jeder abgerufene Knoten mit dem aktuellen Fokusknoten, `origin "experience"`
  (`:1290-1309`),
- Widerspruchspaare (`:1364-1380`),
- Lernknoten mit dem festen Zielknoten `norm_key "ziel-helf"` in
  `recordLearning` (`:1639-1644`),
- Knoten aus dem proaktiven Pfad (`:2338-2346`).

Darstellung: `isStrong(weight) = weight >= 0.5` (`core.ts:87-89`) entscheidet
durchgezogene vs. gestrichelte Linie. Der Verfall wirkt auf die Darstellung nur
indirekt, weil das Gewicht zum Abfragezeitpunkt berechnet wird. Reine
Visualisierung sind Zoom/Pan, Layout und Labels in `src/components/orb/`; echte
Core-Logik sind Gewicht, Wichtigkeit, Origin und Metadaten der Verbindung.

## 5. RECALL

Tatsächlich benutzte Relevanzformel: `memoryRelevance` (`memory.ts:461-468`):
```
sim * clamp(weight, W_MIN, 1) * (0.5 + 0.5*clamp01(importance))
    * recencyFactor(lastAccessedAt)            // exp(-hours/104), Boden 0.1
    * (1 + log10(1 + activationCount) * 0.3)
```
`sim` = `max(similarity(text, content), topicAffinity(...))`
(`engine.server.ts:869`), wobei `similarity` eine Jaccard-Ähnlichkeit über
gestemmte Tokens ist (`memory.ts:324-332`) und `topicAffinity` bei gleicher
Informationsdomäne den Boden `TOPIC_AFFINITY_FLOOR = 0.12` liefert
(`recall.ts:63-74`).

Kombination Kontext + Langzeitgedächtnis: Das 8-Nachrichten-Fenster ist
flüchtiger Kontext und geht getrennt in den Prompt (`context`), die abgerufenen
Knoten getrennt als `recalled`/`phrasings`. Nur explizite Merk-Aufforderungen
übertragen Kontextinhalt in eine dauerhafte Erinnerung.

Schutz vor ungeeignetem Kontext:
- `overlap === 0` fällt vor der Bewertung heraus (`:892`),
- `selectReliableMemories` (`eligibility.ts:130-139`) entfernt Inhalte, die als
  Frage, Aufforderung, Fragment oder Korrekturmeldung klassifiziert werden, sowie
  Inhalte mit einem gerade als Tippfehler benannten Wort. Diese Knoten bleiben
  gespeichert und werden weiterhin reaktiviert, gehen aber nicht als „aktive
  Erinnerung" an das LLM (`engine.server.ts:1008-1024`).

## 6. LANGUAGE / LLM

`src/orb-core/llm/prompt.server.ts:24-88` (`buildSpeakSystemPrompt`) übergibt:
Zustand (gerundet), Ziele, Entscheidung + Hinweis, `recalled` (fertige Texte),
Interessen (Top 5), `phrasings` inkl. Sicherheitsgrad, offene Threads,
max. 2 Widersprüche, flüchtigen `context`, Stilhinweis, harte Verhaltensregeln.

Nicht geschickt werden: rohe Datenbankzeilen und IDs, ungeprüfte Kandidaten
(`orb_candidates`), nicht belastbare Erinnerungen (Filter vor `phrasings`),
Formeln/Schwellen. Bilder gehen nur an OpenAI und werden nicht gespeichert
(`llm/openai.server.ts:48-49`, `llm/select.server.ts:10-13`).

Auswahl/Fallback (`llm/select.server.ts:26-75`): mit `OPENAI_API_KEY` ein
Versuch `gpt-4o-mini` (20 s, 300 Tokens, kein Retry); bei Fehler oder leerer
Antwort Fallback auf das Lovable Gateway mit `openai/gpt-6-astra`
(`llm/provider.server.ts:11`); ohne Schlüssel direkt Gateway ohne Bildpfad,
Bildkontext wird dann ausdrücklich als nicht verarbeitet gemeldet.

Entscheidung vs. Formulierung: Alle Entscheidungen über Abruf, Relevanz,
Speicherung, Belastbarkeit und `OrbDecision` liegen in `core.ts`/
`engine.server.ts`. Das LLM formuliert nur Text; es hat keinen Zugriff auf
Speicheroperationen.

## 7. LEARNING

1. Normale Speicherung: Schwelle 0.35 plus `isStorableStatement`
   (`engine.server.ts:1249-1287`).
2. Verstärkung: exakter `norm_key`-Treffer bzw. jeder Abruf erhöht
   `activation_count`/`importance`/Verbindungsgewicht (`:1191-1242`,
   `touchConnection`).
3. Korrektur/Widerspruch: `correctedTerm` → `recordFeedback` negativ
   (`:1212-1218`); Widerspruchsmarkierung auf Verbindungen (`:1364-1380`).
4. Ausdrückliches Lernereignis `recordLearning` (`:1552-1660`): umgeht die
   Schwelle, `importance 0.95`, `confidence 0.9`, Typ `decision`, erhöht
   `fear`/`uncertainty`, verbindet mit dem Zielknoten.
5. Hintergrundanalyse `analysis/apply.server.ts:analyzeAndPersist` (`:116-302`):
   KI-Kandidaten über das Kontextfenster, deterministische Prüfung
   (`validate.ts`), Protokoll in `orb_candidates` (Vorschlag / geprüft /
   gespeichert) und `orb_node_history` (`forget/reinforcement/update/
   contradiction`), Lifecycle-Abstufung über `weaken()` ohne Löschen; gedrosselt
   auf `ANALYSIS_MIN_INTERVAL_MS = 45 s`.
6. Feed-Beobachtung `feed.server.ts:observeFeed` – nur auf ausdrückliche
   Auslösung in der Oberfläche, nicht Teil von `processInput`.

## 8. CURIOSITY / PROACTIVE BEHAVIOR

- Wissenslücken entstehen auf zwei Wegen: thematisch in
  `curiosity.ts:deriveKnowledgeGaps` (Mindestkonfidenz 0.5, `presence.ts:63`)
  und strukturell in `gaps.ts:detectGaps` (`GAP_MIN_CONFIDENCE = 0.55`,
  `gaps.ts:98`).
- `impulse.ts:decideImpulse` (`:163-240`) prüft in dieser Reihenfolge:
  Nutzer-Unterdrückung, offene wartende Frage, Cooldown je Neugier-Band, kein
  Kandidat, Score unter `IMPULSE_MIN_SCORE = 0.2`. Priorität P4 fragt nie
  (`LOWEST_PROACTIVE_PRIORITY = "P3"`, `:41`).
- `presence.ts:shouldAskProactively` (`:102-124`) verlangt zusätzlich: Tab
  sichtbar, kein Tippen/Hören/Sprechen, Leerlauf zwischen 40 s und 15 min,
  Neugier-Band nicht „low", Cooldown abgelaufen.
- `engine.server.ts:askProactively` (`:2115-2279`) ist die serverseitige
  Endkontrolle: beide Entscheider werden aufgerufen, Unterdrückung gewinnt
  immer; nur bei `ASK` folgt `formulateQuestion` plus Duplikatsprüfung.
- Geltungsbereich fest verdrahtet: `CURIOSITY_SCOPE = "orb_core_chat_only"`,
  soziale Aktionen deaktiviert (`curiosity.ts:316`, `impulse.ts:243`,
  `presence.ts:237`).

## 9. STATE / PRESENCE

`OrbState` (`core.ts:32-39`): `curiosity, joy, fear, trust, uncertainty,
energy`, je 0..1. `nextState` (`:153-166`) rechnet sie regelbasiert fort,
ergänzt durch `continuityStateShift` (`:1403-1415`). `decide` (`:172-191`)
liefert `answer | ask | remind | warn | stay_silent` in der Regelreihenfolge
Energie → Fear → Unsicherheit → Anzahl Erinnerungen. `conversationDecision`
(`:202-213`) wandelt internes `stay_silent` bei Nutzereingabe immer in `answer`.
`faceFromState` (`:216-231`) berechnet Mimik allein aus dem Zustand.

## 10. DATA FLOW

```text
User Input (UI: channels.orb.tsx / OrbChat)
  → ServerFn sendOrbInput (integrations/y-dude-orb/orb.functions.ts, Auth)
  → SDK createOrbCore().processInput (orb-sdk/orb-core.server.ts)
  → Core processInput (orb-core/engine.server.ts)
      → Zustand laden
      → retrieveCandidates (norm_key, topic, Domäne, letzte, ilike)
      → Verbindungen + Gewicht (currentWeight)
      → memoryRelevance + Ebenen A/B/C → RECALL_LIMIT 6
      → scoreImportance / isLearningEvent / decide
      → Conversation Context (8 Nachrichten, flüchtig)
      → Widerspruchsprüfung, Guardrail/Prozess
      → selectReliableMemories (Frage/Aufforderung/Fragment/Korrektur heraus)
  → Sprachschicht speak (llm/select → OpenAI gpt-4o-mini, Fallback Gateway
      openai/gpt-6-astra)
  → Persistenz: Knoten, Verbindungen, Interessen, Threads, Zustand, Metriken
  → Response an UI
  → nachgelagert und still: analyzeOrbContext (Hintergrundanalyse, gedrosselt)
```

## 11. ARCHITECTURE BOUNDARY

- Core: `src/orb-core/*` (`core.ts`, `engine.server.ts`, `memory.ts`,
  `recall.ts`, `context.ts`, `eligibility.ts`, `curiosity.ts`, `gaps.ts`,
  `impulse.ts`, `presence.ts`, `process*.ts`, `continuity*.ts`, `analysis/*`,
  `feed.server.ts`).
- SDK: `src/orb-sdk/index.ts` (Typen/Kennwerte, browsersicher) und
  `src/orb-sdk/orb-core.server.ts` (einzige serverseitige Tür).
- Y-Dude Adapter: `src/integrations/y-dude-orb/orb.functions.ts` (ServerFns mit
  Auth-Middleware), `avatar.ts`, `use-orb-presence.ts`,
  `use-orb-avatar-mode.ts`.
- UI: `src/components/orb/*`, `src/routes/_authenticated/channels.orb.tsx`.
- Data Layer: `orb_nodes`, `orb_connections`, `orb_state`, `orb_messages`,
  `orb_metrics`, `orb_interests`, `orb_suggestions`, `orb_questions`,
  `orb_threads`, `orb_style`, `orb_candidates`, `orb_node_history` (Zugriff nur
  über den angemeldeten Client, RLS je Benutzer).
- LLM/Voice Provider: `src/orb-core/llm/{openai,provider,select,prompt}.server.ts`,
  `src/orb-core/voice.server.ts`.

## 12. IMPORTANT

**A) Echte ORB-Core-Logik**
`core.ts` (Verfall, Reaktivierung, Wichtigkeit, Entscheidung, Zustand),
`memory.ts` (norm_key, Ähnlichkeit, Relevanz, Ebenen), `recall.ts`,
`context.ts`, `eligibility.ts`, `engine.server.ts` (Ablauf, Persistenz,
Verbindungen, Reaktivierung, Feedback, proaktive Endkontrolle),
`curiosity.ts`, `gaps.ts`, `impulse.ts`, `presence.ts`, `process.ts`,
`analysis/validate.ts`.

**B) Nur Datenhaltung**
Alle `orb_*`-Tabellen inklusive `orb_candidates` (Protokoll) und
`orb_node_history` (Verlauf); `process.server.ts`/`continuity-store.server.ts`
und die Insert/Update-Abschnitte in `engine.server.ts` sind der Zugriffsweg
dorthin.

**C) Nur UI/Visualisierung**
`src/components/orb/*` (Spiderweb-Layout, Zoom/Pan, Scrollverhalten,
Composer, Avatar-Darstellung), `channels.orb.tsx`; `faceFromState` liefert die
Werte, ihre Darstellung ist UI. `isStrong` steuert nur Linienart.

**D) Nur Sprachgenerierung**
`llm/prompt.server.ts`, `llm/openai.server.ts`, `llm/provider.server.ts`,
`llm/select.server.ts`, `voice.server.ts`. Kein Einfluss auf Speicherung.

**E) Aktiv wirksame Formeln und Schwellen**
- `shouldPersist`: `importance >= 0.35`.
- `scoreImportance`: 0.25 / +0.1 / +0.1 / +0.05 / +0.2 / +0.15 / +0.35.
- `currentWeight`: `weight * exp(-decayRate*(1-0.5*importance)*hours)`,
  begrenzt auf `[0.05, 1]`.
- `reactivate`: verfallenes Gewicht + ΔW, begrenzt.
- `reinforcement`: `clamp01(0.08 + 0.22*importance) * min(3, reps)`.
- Reaktivierung der Knoten: `importance = max(alt, importance * 0.8)`.
- `memoryRelevance`: `sim * weight * (0.5+0.5*importance) * recency * (1 +
  log10(1+activations)*0.3)`, `recencyFactor = exp(-hours/104)`, Boden 0.1.
- `STRONG_THRESHOLD = 0.5`, `W_MIN = 0.05`, `W_MAX = 1`.
- `CONTEXT_WINDOW_MESSAGES = 8`, `CANDIDATE_LIMIT = 20`, `RECALL_LIMIT = 6`,
  `LEVEL_LIMITS A4/B4/C2`, `TOPIC_AFFINITY_FLOOR = 0.12`.
- Confidence: 0.9 / 0.65 / 0.5, Wiederholung bis 0.85; Lernereignis 0.95/0.9.
- Neugier/Impuls: `GAP_MIN_CONFIDENCE 0.55`, `PROACTIVE_MIN_CONFIDENCE 0.5`,
  `IMPULSE_MIN_SCORE 0.2`, Leerlauf 40 s bis 15 min, Cooldown je Band.
- Analyse-Drosselung: 45 s.
- Decay-Raten je Verbindung: 0.05 / 0.02 / 0.01.

**F) Vorhanden, aber nicht im Antwort-/Memory-Pfad benutzt**
- `core.ts:textOverlap` und `core.ts:relevanceScore` werden im Ablauf nicht
  aufgerufen; im Code nur von `tests/orb-core.test.ts` benutzt. Der Ablauf nutzt
  `similarity` + `topicAffinity` und `memoryRelevance`.
- `feed.server.ts:observeFeed` und `decideSuggestion` laufen nur auf
  ausdrückliche Auslösung in der Oberfläche, nicht in `processInput`.
- `analysis/*` (`analyzeAndPersist`) läuft nachgelagert und still nach der
  Antwort (`channels.orb.tsx:156-162`); ohne Analyse-Schlüssel oder innerhalb
  der 45-s-Drosselung ohne Wirkung; die gerade gegebene Antwort wird davon nie
  beeinflusst.
- `orb_candidates` und `orb_node_history` werden geschrieben, aber nicht gelesen,
  um eine Antwort oder einen Abruf zu bestimmen.
- `PROACTIVE_SOCIAL_ACTIONS_ENABLED` / soziale Aktionen sind fest ausgeschaltet.
- `conversationDecision` neutralisiert `stay_silent` im Gespräch; der Zustand
  wirkt dort also nur noch über `ask/remind/warn/answer`.

---

Keine Datei, keine Tabelle und kein Wert wurde für diesen Bericht verändert.
