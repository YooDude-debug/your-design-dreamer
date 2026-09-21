# ORB CORE SDK – COMPLETE TECHNICAL EXTRACT + CORE FORMULAS

**Datum:** 2026-09-21 · **Modus:** READ-ONLY · **Primärquelle:** Quellcode, Datenbankschema/Trigger, Tests
**Repository-Stand:** aktueller Arbeitsstand `/dev-server` (HEAD des Projektarbeitsbaums)

> Regel dieses Dokuments: Der bestehende Forensic Master Report ist **nicht** Beweis, sondern Behauptung.
> Alles hier Dargestellte ist direkt aus dem Quellcode, aus Datenbank-Metadaten oder aus einem
> tatsächlich ausgeführten Test abgeleitet. Nicht ableitbare Punkte sind ausdrücklich als
> „Nicht vollständig aus dem aktuellen Code ableitbar." bzw. „Nicht kausal bewiesen." markiert.

---

## 1. EXECUTIVE TECHNICAL SUMMARY

Die ORB-Core-SDK besteht aus drei Schichten mit klaren Grenzen:

1. **Reine Logik (deterministisch, ohne I/O):** `core.ts`, `memory.ts`, `presence.ts`, `curiosity.ts`,
   `impulse.ts`, `gaps.ts`, `conversation.ts`, `context.ts`, `continuity.ts`, `process.ts`,
   `eligibility.ts`, `recall.ts`. Diese Dateien enthalten jede Formel und jede Schwelle.
2. **Server-Schicht (Datenbank + Sprachschicht):** `engine.server.ts` (2 449 Zeilen, zentral),
   `continuity-store.server.ts`, `process.server.ts`, `feed.server.ts`, `voice.server.ts`,
   `analysis/*.server.ts`, `llm/*.server.ts`.
3. **Grenze nach aussen:** `src/orb-sdk/index.ts` (browsersicher, nur Typen und Kennwerte) und
   `src/orb-sdk/orb-core.server.ts` (Fassade ohne eigene Logik) sowie der Adapter
   `src/integrations/y-dude-orb/orb.functions.ts` (11 angemeldete Server-Funktionen).

Kernaussagen, die sich unmittelbar aus dem Code ergeben:

- **Jede Entscheidung über „fragen oder schweigen" ist deterministisch.** Das Sprachmodell entscheidet
  nie, OB gefragt wird; es formuliert nur, WIE die bereits beschlossene Äusserung klingt
  (`askProactively` → `formulateQuestion` → `speak`).
- **Energie hat genau eine Erholungsformel** (`recoverEnergy`, rein zeitbasiert) und genau zwei
  Verbrauchsstellen (`nextState` bei einer verarbeiteten Eingabe, `−0.03` bei einer gesendeten
  eigenen Frage).
- **Der Zeitanker der Erholung ist keine eigene Spalte,** sondern `orb_state.updated_at`, das durch
  den Datenbank-Trigger `orb_state_updated_at` → `set_updated_at()` bei **jedem** UPDATE neu gesetzt wird.
  Das ist DB-kausal belegt (Trigger-Definition, Kapitel 15).
- **`wandern` wird deterministisch zum Thema `reisen`** – belegt durch Ausführung, nicht durch Annahme
  (Kapitel 10).
- **Zwei parallele autonome Pfade** existieren: `decideCuriosity` (Neugier/Wissenslücke, prüft Energie)
  und `decideImpulse` (Spiderweb-Lücken, prüft Energie **nicht**). Der Impuls ist vorgeschaltet
  (Kapitel 7/14).

---

## 2. COMPLETE SDK FILE MAP

Ermittelt durch Verzeichnisdurchsicht (`src/orb-core`, `src/orb-sdk`, `src/integrations/y-dude-orb`)
und Importanalyse. Zeilenzahlen sind Ist-Werte.

### 2.1 Core State

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/core.ts` | 277 | Zustandsmodell, Verfall, Wichtigkeit, Energie-Erholung, Regelentscheidung, Gesicht | keine | **sehr hoch** |

### 2.2 Energy

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/core.ts` | – | `recoverEnergy`, `ENERGY_RECOVERY_PER_MIN`, `ENERGY_RECOVERY_CAP`, `nextState` (Kosten) | keine | **sehr hoch** |
| `src/orb-core/engine.server.ts` | 2 449 | `toState` (Erholung beim Lesen), 4 Schreibstellen auf `orb_state` | core, memory, alle Logikmodule | **sehr hoch** |

### 2.3 Presence / Idle

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/presence.ts` | 279 | Leerlauf-/Cooldown-Grenzen, `shouldAskProactively`, `selectProactiveCandidate`, Fake-Pause-Schutz | core, memory | hoch |
| `src/integrations/y-dude-orb/use-orb-presence.ts` | 135 | Browser-Takt (5 s), Aktivitätsanker, löst genau einen Aufruf aus | orb-sdk | hoch |
| `src/integrations/y-dude-orb/avatar.ts` / `use-orb-avatar-mode.ts` | 136 / 34 | Darstellung des Zustands (kein Entscheidungsanteil) | core-Typen | niedrig |

### 2.4 Curiosity

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/curiosity.ts` | 317 | Wissenslücken, `curiosityScore`, `decideCuriosity`, Duplikatprüfung | core, memory, presence | **sehr hoch** |

### 2.5 Impulse

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/impulse.ts` | 244 | Prioritäten, `impulseScore`, `decideImpulse`, Nutzerkontrolle (Suppression) | core, gaps, memory, presence | **sehr hoch** |
| `src/orb-core/gaps.ts` | 344 | `detectGaps` – 11 Lückenarten aus Knoten + Verbindungen | core, memory | hoch |

### 2.6 Autonomous Questions

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/engine.server.ts` | – | `loadCuriosityContext`, `askProactively`, `formulateQuestion`, `gapFromImpulse`, `findOpenQuestion`, `closeOpenQuestion`, `inspectCuriosity`, `requestQuestion` | alle | **sehr hoch** |

### 2.7 Memory

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/memory.ts` | 610 | Tokenisierung, Stemming, `normKey`, `similarity`, `topicOf`/`topicsOf`, `TOPIC_KEYWORDS`, `memoryRelevance`, Ebenen A/B/C, Interessenmodell, Feed-Relevanz | core | **sehr hoch** |
| `src/orb-core/eligibility.ts` | 140 | Speicherfähigkeit einer Äusserung, Korrekturerkennung, `selectReliableMemories` | memory | hoch |
| `src/orb-core/analysis/schema.ts`, `validate.ts`, `analyze.server.ts`, `apply.server.ts` | 175/270/178/486 | Hintergrundauswertung des Kontextfensters → Kandidaten → Validierung → Persistenz | memory, core, LLM | mittel |

### 2.8 Recall

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/recall.ts` | 74 | `infoDomainOf`, `questionIntentOf`, `topicAffinity` (Untergrenze 0.12) | keine | hoch |
| `src/orb-core/engine.server.ts` | – | `retrieveCandidates` (4–5 begrenzte Abfragen), Ranking, `selectByLevel` | memory, recall | **sehr hoch** |

### 2.9 Context

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/context.ts` | 161 | Kontextfenster (8 Nachrichten), Merk-Aufforderung auflösen | memory | hoch |

### 2.10 Conversation Mode

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/conversation.ts` | 215 | `decideConversationMode` (DIRECT_ANSWER / FOLLOW_UP / SMALLTALK / PROACTIVE_IMPULSE / LISTEN), `MODE_HINT` | keine | hoch |
| `src/orb-core/continuity.ts` | 599 | Gedankenfäden, Verfall, `threadRelevance`, `threadKnowledgeGaps`, Gedächtnis-Sicherheit | core, memory | hoch |
| `src/orb-core/process.ts` | 550 | Prozess-/Drift-Erkennung, `decideGuardrail` (nur informativ) | core, memory | mittel |

### 2.11 LLM Boundary

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/llm/prompt.server.ts` | 98 | `buildSpeakSystemPrompt` – einziger Ort der Kontextkonstruktion | core, conversation, presence | hoch |
| `src/orb-core/llm/select.server.ts` | 75 | Provider-Auswahl mit Fallback | openai, provider | hoch |
| `src/orb-core/llm/provider.server.ts` | 90 | Lovable-Gateway, Modell `openai/gpt-6-astra` | – | hoch |
| `src/orb-core/llm/openai.server.ts` | 89 | Experimenteller Direktpfad, Modell `gpt-4o-mini` | – | mittel |
| `src/orb-core/voice.server.ts` | 108 | STT `google/gemini-3.5-transcribe`, TTS `openai/gpt-4o-mini-tts` | – | mittel |

### 2.12 Persistence / Database Integration

| Datei | Zeilen | Rolle | Abhängigkeiten | Kritikalität |
|---|---|---|---|---|
| `src/orb-core/engine.server.ts` | – | alle Schreibvorgänge auf `orb_state`, `orb_nodes`, `orb_connections`, `orb_messages`, `orb_interests`, `orb_questions`, `orb_metrics` | – | **sehr hoch** |
| `src/orb-core/continuity-store.server.ts` | 395 | `orb_threads`, `orb_style`, Widerspruchsverbindungen | continuity | hoch |
| `src/orb-core/process.server.ts` | 190 | Prozesskontext laden / Entscheidung anwenden | process | mittel |
| `src/orb-core/feed.server.ts` | 243 | Feed beobachten (nur lesen), `orb_suggestions` | memory | mittel |
| `src/orb-sdk/orb-core.server.ts` | 102 | Fassade: 11 Fähigkeiten, ausschliesslich Weiterleitungen | engine, feed, analysis, voice | hoch |
| `src/orb-sdk/index.ts` | 53 | browsersichere Grenze: Typen + Kennwerte | core, curiosity, presence, conversation | hoch |
| `src/integrations/y-dude-orb/orb.functions.ts` | 163 | 11 `createServerFn`, alle mit `requireSupabaseAuth` | orb-sdk | hoch |

### 2.13 Observability

Kein eigenes Modul. Messwerte entstehen inline: `QueryCounter` (engine.server.ts:249) und
`orb_metrics`-Einträge (`kind: "turn"` und `kind: "proactive"`).
Abgelehnte autonome Versuche werden **nicht** persistiert → siehe Kapitel 17.

### 2.14 Tests

24 ORB-Testdateien unter `tests/`, Zuordnung in Kapitel 16.

---

## 3. SOURCE CODE – KERNMODULE IM DETAIL

### 3.1 `src/orb-core/core.ts`

**Konstanten:** `W_MIN = 0.05`, `W_MAX = 1`, `STRONG_THRESHOLD = 0.5`, `HOUR_MS = 3_600_000`,
`ENERGY_RECOVERY_PER_MIN = 0.02`, `ENERGY_RECOVERY_CAP = 0.25`.
**Datenbankzugriffe:** keine. **Netzwerk:** keine. **Fehlerpfade:** keine (reine Funktionen).

```ts
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function currentWeight(input: DecayInput): number {
  const hours = Math.max(0, (input.now - input.lastActivatedAt) / HOUR_MS);
  const effectiveRate = input.decayRate * (1 - 0.5 * clamp01(input.importance));
  const decayed = input.weight * Math.exp(-effectiveRate * hours);
  return Math.min(W_MAX, Math.max(W_MIN, decayed));
}

export function reactivate(input: DecayInput, delta: number): number {
  return Math.min(W_MAX, Math.max(W_MIN, currentWeight(input) + Math.max(0, delta)));
}

export function reinforcement(importance: number, repetitions = 1): number {
  return clamp01(0.08 + 0.22 * clamp01(importance)) * Math.min(3, Math.max(1, repetitions));
}

export function shouldPersist(importance: number): boolean {
  return importance >= 0.35;
}

export function recoverEnergy(stored: number, updatedAtMs: number, nowMs: number): number {
  const base = clamp01(stored);
  if (base >= ENERGY_RECOVERY_CAP) return base;
  if (!Number.isFinite(updatedAtMs) || !Number.isFinite(nowMs)) return base;
  const elapsedMin = Math.max(0, nowMs - updatedAtMs) / 60_000;
  return Math.min(ENERGY_RECOVERY_CAP, base + elapsedMin * ENERGY_RECOVERY_PER_MIN);
}

export function nextState(state, ev): OrbState {
  const i = clamp01(ev.importance);
  return {
    curiosity: clamp01(state.curiosity + (ev.isQuestion ? 0.08 : -0.02) + 0.05 * i),
    joy: clamp01(state.joy + (ev.isLearning ? -0.05 : 0.03) + 0.02 * ev.recalled),
    fear: clamp01(state.fear + (ev.isLearning ? 0.12 : -0.03)),
    trust: clamp01(state.trust + 0.02 + 0.03 * Math.min(3, ev.recalled)),
    uncertainty: clamp01(state.uncertainty + (ev.recalled === 0 ? 0.07 : -0.06 - 0.02 * i)),
    energy: clamp01(state.energy - 0.03 - 0.04 * i),
  };
}

export function decide(input): { decision: OrbDecision; reason: string } {
  if (input.state.energy < 0.12) return { decision: "stay_silent", ... };
  if (input.isLearning && input.state.fear > 0.35) return { decision: "warn", ... };
  if (input.state.uncertainty > 0.6 || (input.isQuestion && input.recalled === 0))
    return { decision: "ask", ... };
  if (input.recalled >= 2 && input.state.trust >= 0.4) return { decision: "remind", ... };
  return { decision: "answer", ... };
}

export function relevanceScore(weight, importance, overlap): number {
  return weight * (0.5 + 0.5 * clamp01(importance)) * (0.3 + 0.7 * clamp01(overlap));
}
```

Wichtig: `conversationDecision(internal)` wandelt `stay_silent` **immer** in `answer` um – eine
Nutzereingabe wird niemals mit einer Pausenmeldung beantwortet.

### 3.2 `src/orb-core/engine.server.ts` – kausal relevante Funktionen

**Konstanten:** `MAX_INPUT_CHARS = 1000`, `RECALL_LIMIT = 6`, `CANDIDATE_LIMIT = 20`, `GRAPH_LIMIT = 40`.

```ts
function toState(row: StateRow): OrbState {
  return {
    curiosity: row.curiosity, joy: row.joy, fear: row.fear,
    trust: row.trust, uncertainty: row.uncertainty,
    energy: recoverEnergy(row.energy, new Date(row.updated_at).getTime(), Date.now()),
  };
}

async function ensureState(db, userId, q?): Promise<StateRow> {
  const read = db.from("orb_state").select("*").eq("user_id", userId).maybeSingle();
  const existing = await (q ? q.tick(read) : read);
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return existing.data;
  const create = db.from("orb_state").insert({ user_id: userId }).select("*").single();
  ...
}
```

**Alle vier Schreibstellen auf `orb_state`** (vollständig, per `grep`):

| Zeile | Funktion | geschriebene Felder |
|---|---|---|
| 414 | `getSnapshot` | `decay_computations`, `energy: toState(stateRow).energy` |
| 1493 | `processInput` | `curiosity, joy, fear, trust, uncertainty, energy, cracks, reactivation_count` |
| 1732 | `recordLearning` | `cracks`, `fear`, `uncertainty`, `energy: toState(stateRow).energy` |
| 2322 | `askProactively` | `curiosity: max(0, c − 0.06)`, `energy: max(0, e − 0.03)` |

Seiteneffekte je Aufruf: `orb_messages`-Inserts (Nutzerzeile + ORB-Zeile mit `state_snapshot`),
`orb_metrics`-Insert, ggf. `orb_nodes`/`orb_connections`/`orb_interests`/`orb_questions`/`orb_threads`/`orb_style`.

**Fehlerpfade:** jeder Datenbankfehler → `throw new Error(res.error.message)`.
Leere Eingabe → `throw new Error("empty input")`. Sprachschicht nicht verfügbar → Fallbacktext
(`FALLBACK.quota` / `FALLBACK.unavailable`), die Erfahrung wird dennoch gespeichert.
Im autonomen Pfad: Sprachschicht nicht „ok" → `silent(...)`, also **keine** sichtbare Nachricht.

---

## 4. ALL CORE FORMULAS

### F1 – Verbindungsgewicht (Verfall)

**FORMEL** `W(t) = clamp(W₀ · e^(−λ_eff·Δh), W_MIN, W_MAX)` mit `λ_eff = λ · (1 − 0.5·I)`, `Δh` in Stunden.
**CODE** `currentWeight` (core.ts:65). **VARIABLEN** `W₀` = `weight` (gespeichert), `I` = `importance`,
`λ` = `decay_rate`, `Δh = (now − last_activated_at)/3 600 000`.
**GRENZEN** min `0.05`, max `1`, `Δh ≥ 0`. Kein Fallback, kein Löschen.
**BEISPIEL** `W₀ = 0.6`, `I = 0.72`, `λ = 0.02`, `Δh = 48` → `λ_eff = 0.02·0.64 = 0.0128`;
`0.6·e^(−0.6144) = 0.3245`.

### F2 – Reaktivierung

**FORMEL** `W' = clamp(W(t) + max(0, ΔW), W_MIN, W_MAX)` · **CODE** `reactivate`.
**ΔW** aus `reinforcement(I, r) = clamp01(0.08 + 0.22·I) · min(3, max(1, r))`.
**BEISPIEL** `I = 0.72`, `r = 1` → `ΔW = 0.2384`; aus F2 `0.3245 + 0.2384 = 0.5629` → „stark" (≥ 0.5).

### F3 – Wichtigkeit einer Erfahrung

**FORMEL** `I = clamp01(0.25 + 0.1·[len>60] + 0.1·[len>200] + 0.05·[«?»] + 0.2·[Marker] + 0.15·[persönlich] + 0.35·[Lernereignis])`
**CODE** `scoreImportance` (core.ts:95). **GRENZE** Speicherung nur bei `I ≥ 0.35` (`shouldPersist`).
**BEISPIEL** „Ich mag Pizza mit Ananas" (19 Zeichen, persönlich) → `0.25 + 0.15 = 0.40` → gespeichert.

### F4 – Energie-Erholung

**FORMEL** `E(t) = min(CAP, E₀ + Δt_min · RATE)`, **nur** falls `E₀ < CAP`; sonst `E(t) = E₀`.
`RATE = 0.02 / min`, `CAP = 0.25`. **CODE** `recoverEnergy` (core.ts:165).
**VARIABLEN** `E₀` = `orb_state.energy` (gespeichert), `Δt_min = (now − orb_state.updated_at)/60 000`.
**GRENZEN** `clamp01(E₀)` zuerst; `Δt ≥ 0`; nicht-endliche Zeitwerte → Fallback `E₀`;
ein Wert **über** CAP wird nie gesenkt.
**BEISPIEL** `E₀ = 0.007`, 9 min Ruhe → `0.007 + 0.18 = 0.187`. Bei 30 min → `min(0.25, 0.607) = 0.25`.

Die vom Auftrag vorgeschlagene Form `clamp(StoredEnergy + Δt·Rate, 0, Cap)` entspricht dem Code
**nicht exakt**: der Code klemmt nicht nach unten auf 0 und **nicht** nach oben auf CAP, wenn `E₀`
bereits über CAP liegt (Frühausstieg in Zeile 167). Korrekt ist die oben angegebene Fallform.

### F5 – Energiekosten einer verarbeiteten Eingabe

**FORMEL** `E_neu = clamp01(E_alt − 0.03 − 0.04·I)` · **CODE** `nextState` (core.ts:188).
**GRENZEN** min 0, max 1. Nur `nextState` und die autonome Frage senken Energie.
**BEISPIEL** `E_alt = 0.187`, `I = 0.40` → `0.187 − 0.03 − 0.016 = 0.141`.

### F6 – Energiekosten einer eigenen (autonomen) Frage

**FORMEL** `E_neu = max(0, E_ctx − 0.03)`, zusätzlich `C_neu = max(0, C_ctx − 0.06)`
**CODE** engine.server.ts:2320–2328. `E_ctx` ist der **erholte** Wert aus `toState`.
**BEISPIEL** `E_ctx = 0.221` → `0.191`.

### F7 – Textähnlichkeit (Jaccard über Inhaltswörter)

**FORMEL** `sim(a,b) = |T(a) ∩ T(b)| / (|T(a)| + |T(b)| − |T(a) ∩ T(b)|)`, `0` falls eine Menge leer.
**CODE** `similarity` (memory.ts:324) mit `contentTokens`.
**BEISPIEL** `T(a) = {pizza, ananas}`, `T(b) = {pizza}` → `1/(2+1−1) = 0.5`.

Separat existiert `textOverlap` (core.ts:263) mit `hits / min(|wa|,|wb|)` und Wortlänge > 3 – im
Abrufpfad wird **`similarity`** verwendet, nicht `textOverlap`.

### F8 – Aktualität

**FORMEL** `rec = max(0.1, e^(−Δh/104))` · **CODE** `recencyFactor` (memory.ts:443).
**GRENZE** nie unter `0.1`. **BEISPIEL** `Δh = 48` → `max(0.1, e^(−0.4615)) = 0.630`.

### F9 – Gedächtnisrelevanz (Recall-Ranking)

**FORMEL** `R = sim · w · (0.5 + 0.5·I) · rec · (1 + 0.3·log₁₀(1 + a))`
**CODE** `memoryRelevance` (memory.ts:461). `w = clamp(bestWeight, W_MIN, 1)`, Standard `0.5`
wenn keine Verbindung existiert (engine.server.ts:906). `a` = `activation_count`.
**GRENZEN** `sim ∈ [0,1]`, `w ∈ [0.05,1]`, `rec ≥ 0.1`; **Filter** `overlap > 0`.
**BEISPIEL** `sim = 0.5`, `w = 0.5`, `I = 0.72`, `rec = 0.63`, `a = 4`
→ `0.5·0.5·0.86·0.63·(1+0.3·0.699) = 0.164`.

### F10 – Themen-Affinität (Untergrenze)

**FORMEL** `overlap = max(similarity(text, node), topicAffinity(text, node))`,
`topicAffinity = 0.12` falls `questionIntentOf(text) === infoDomainOf(node) ≠ null`, sonst `0`.
**CODE** recall.ts:70, engine.server.ts:891. **GRENZE** `TOPIC_AFFINITY_FLOOR = 0.12`.

### F11 – Neugier-Wert einer Wissenslücke

**FORMEL** `S = clamp01( C · Rel · soft(I) · soft(Conf) · soft(Fit) · soft(Nov) )`,
`soft(x) = 0.5 + 0.5·clamp01(x)`
**CODE** `curiosityScore` (curiosity.ts:135). **SCHWELLE** `CURIOSITY_ASK_THRESHOLD = 0.2`.
**BEISPIEL** `C = 1.0`, `Rel = 0.63`, `I = 0.72`, `Conf = 0.9`, `Fit = 0.6`, `Nov = 1.0`
→ `1·0.63·0.86·0.95·0.8·1 = 0.4119` → über 0.2 → ASK möglich.

### F12 – Relevanz einer Lücke

**FORMEL** `Rel = clamp01( rec · (0.5 + 0.5·iw) · (1 + min(0.3, 0.1·a)) )`, `iw = weight·confidence`
des Interesses (0 ohne Interesse) · **CODE** curiosity.ts:193.

### F13 – Neuheit

**FORMEL** `Nov = clamp01(1 − 0.3·n_asked(node))`; `Nov ≤ 0` → Lücke verworfen · **CODE** curiosity.ts:206.
Zusätzlich: gleiche Lückenart schon gefragt → übersprungen; beantwortet → endgültig geschlossen.

### F14 – Impuls-Punktwert

**FORMEL** `S_imp = clamp01(gapImportance · confidence · futureRelevance · conversationalFit · userBenefit)`
**CODE** `impulseScore` (impulse.ts:75). `userBenefit = PRIORITY_BENEFIT[priority]`
(P0 1, P1 0.95, P2 0.8, P3 0.55, P4 0.2). **SCHWELLE** `IMPULSE_MIN_SCORE = 0.2`.
**BEISPIEL** P1-Widerspruch: `0.72·0.9·0.66·0.6·0.95 = 0.244` → über 0.2 → SPEAK möglich.

### F15 – Künftige Bedeutung

**FORMEL** `fr = clamp01( scopeWeight · (0.4 + 0.6·clamp01(longTermValue ?? importance)) )`,
`scopeWeight`: permanent 1, long_term 0.9, medium 0.6, temporary 0.3.
Danach `fr ← fr·0.85`, falls das Thema nicht im laufenden Gespräch liegt · **CODE** gaps.ts:111, 341.

### F16 – Kandidat der Kernpräsenz (`selectProactiveCandidate`)

**FORMEL** `S = clamp01(I) · clamp01(Conf) · (0.5 + 0.5·clamp01(iw)) · rec · (1 + min(0.3, 0.1·a))`
**CODE** presence.ts:211. Filter: `topic ≠ null`, `Conf ≥ 0.5`, `contentTokens ≠ ∅`,
Interessengewicht `≥ 0.1` falls Interesse vorhanden, freie Dimension vorhanden.

### F17 – Interessenmodell

**FORMEL** `Δ = base(source) · (0.6 + 0.8·clamp01(I))` mit `base`: user_stated 0.18, inferred 0.08,
observed 0.05; `w_neu = max(0.02, clamp01(w_alt + Δ))`; neu: `w = clamp01(max(0.05, 2Δ))`.
`confidence`: user_stated 0.9 fix, sonst `min(0.85, base + 0.05·(hints−1))`
**CODE** memory.ts:529–565. Rangregel: eine Aussage darf eine Beobachtung aufwerten, nie umgekehrt.

### F18 – Feed-Relevanz

**FORMEL** `rel = clamp01(0.55·w·conf + 0.45·min(1, hits/3))`, Schwelle `SUGGESTION_THRESHOLD = 0.35`
**CODE** memory.ts:589.

### F19 – Feedback

**FORMEL** `Δ = ±(0.1 + 0.2·clamp01(I))`, `w' = clamp(w + Δ, W_MIN, 1)` · **CODE** memory.ts:568–576.
Negatives Feedback löscht nie.

### F20 – Gesichtsausdruck (Darstellung)

`eyeOpen = 0.6 + 0.9·C − 0.3·F`, `mouthCurve = J − F − 0.3·U`, `tilt = (U − 0.3)·14`,
`pulseSeconds = 4.2 − 2.4·E`, `gaze = 0.2 + 0.8·U`, `motion = clamp01(1 − 0.8·F)` · **CODE** core.ts:240.

---

## 5. ENERGY MODEL (vollständig)

```text
orb_state.energy (gespeichert)  ──┐
orb_state.updated_at (Trigger)  ──┴─► toState() ─► recoverEnergy() ─► sichtbare Energie
                                                        │
              nextState(): −0.03 − 0.04·I  ◄────────────┤ (verarbeitete Eingabe)
              askProactively(): −0.03      ◄────────────┘ (gesendete eigene Frage)
```

**Belegte Eigenschaften:**

1. Die Erholung ist **aufrufunabhängig**: sie hängt nur von `E₀` und `Δt` ab (`recoverEnergy`, rein).
2. Der Zeitanker ist **`orb_state.updated_at`**. Es gibt keine Spalte „last_energy_at".
3. Jeder UPDATE auf `orb_state` setzt `updated_at` neu (DB-Trigger, Kapitel 15 / DB-CAUSALITY).
   Deshalb schreiben `getSnapshot` (414) und `recordLearning` (1732) ausdrücklich
   `energy: toState(stateRow).energy` mit – sonst würde die bereits verstrichene Ruhezeit verfallen.
4. Energieschwellen im Code: `decide()` < 0.12 → intern `stay_silent`;
   `CURIOSITY_MIN_ENERGY = 0.15` → `WAIT` im Neugierpfad; `conversation.ts` verlangt `energy ≥ 0.12`
   für FOLLOW_UP und SMALLTALK.
5. **`decideImpulse` prüft Energie nicht.** Das ist im Code direkt sichtbar: in `impulse.ts`
   existiert kein Energie-Feld und keine Energieprüfung.

**Abweichung zur vorgeschlagenen Formel:** siehe F4 – der Frühausstieg bei `E₀ ≥ CAP` ist Teil der
tatsächlichen Semantik.

---

## 6. PRESENCE MODEL

**Grenzen (presence.ts):** `PROACTIVE_MIN_IDLE_MS = 40 000`, `PROACTIVE_MAX_IDLE_MS = 900 000`,
`CURIOSITY_MEDIUM 0.35 / HIGH 0.55 / VERY_HIGH 0.75`,
`PROACTIVE_COOLDOWN_MS = { low 300 000, medium 300 000, high 180 000, very_high 120 000 }`,
`PROACTIVE_MIN_CONFIDENCE = 0.5`, `PROACTIVE_MIN_INTEREST_WEIGHT = 0.1`,
`PROACTIVE_SCOPE = "orb_core_chat_only"`, `PROACTIVE_SOCIAL_ACTIONS_ENABLED = false`.
**Browser (use-orb-presence.ts):** `PRESENCE_TICK_MS = 5000`.

**Tatsächlicher Triggerpfad:**

```text
Browser-Intervall (5 s, nur Rechnen, kein Server-Aufruf)
  └─ shouldAskProactively({ idleMs, curiosity, typing, speaking, listening,
                            pending, tabVisible, hasCandidate: true,
                            lastProactiveAt, now })
       Reihenfolge der Ablehnungen (= Begründung):
        1. !tabVisible          → "Tab nicht aktiv"
        2. typing               → "Benutzer tippt gerade"
        3. listening            → "Mikrofon ist aktiv"
        4. speaking             → "ORB spricht gerade"
        5. pending              → "Eine Anfrage ist bereits in Bearbeitung"
        6. idleMs < 40 000      → "Früheste erlaubte Zeit noch nicht erreicht"
        7. idleMs > 900 000     → "lange abwesend – keine nachträgliche Frage"
        8. band === "low"       → "Neugier zu gering"
        9. !hasCandidate        → (clientseitig nie, da hart true)
       10. Cooldown aktiv       → "Cooldown nach der letzten Frage aktiv"
  └─ ask === true → lastProactiveRef = now (Sofortsperre) → onAsk()
        └─ requestOrbCuriosity (Server) → askProactively(...)
```

`hasCandidate` ist clientseitig **hart `true`** (use-orb-presence.ts:109) – die endgültige
Gedächtnisprüfung erfolgt serverseitig. Aktivität, Sprechen, Zuhören, Tabwechsel und ein laufender
Aufruf setzen den Leerlaufanker zurück; eine Nutzereingabe **beendet** den Cooldown
(`noteActivity` setzt `lastProactiveRef = null`).

**Bekannter Nebeneffekt (CODE-CAUSALITY, unverändert):** das Intervall hängt in der
Abhängigkeitsliste von `onAsk` – ändert sich diese Funktionsreferenz je Render, wird das
5-Sekunden-Intervall neu gestartet.

---

## 7. CURIOSITY MODEL

```text
Eingang (nur ereignisbasiert)
   ↓
loadCuriosityContext: orb_state, 12 Knoten (topic ≠ null), 8 Interessen,
                      8 Nachrichten, Fragehistorie, 60 Verbindungen, Fäden
   ↓
deriveKnowledgeGaps  (Filter: topic ≠ null, confidence ≥ 0.5, contentTokens ≠ ∅,
                      Interessengewicht ≥ 0.1 falls Interesse vorhanden)
   ↓ je Erinnerung: gapKindsFor(content) → [grund, praeferenz] / [stand] / [erfahrung]
                    + immer Fallback [detail, kontext]
   ↓ curiosityScore (F11) → Sortierung absteigend
   ↓ + threadKnowledgeGaps → zusammengeführt, auf 12 begrenzt
   ↓
decideCuriosity – Gates in dieser Reihenfolge:
   gaps.length === 0                    → DO_NOTHING "Keine offene Wissenslücke"
   curiosityBand === "low" (< 0.35)     → DO_NOTHING "Neugier zu gering"
   energy < 0.15                        → WAIT       "Zu wenig Energie"
   openQuestion                         → WAIT       "Eigene Frage noch offen"
   now − lastQuestionAt < Cooldown      → WAIT       "Cooldown aktiv"
   score < 0.2                          → WAIT       "Interesse noch nicht stark genug"
   sonst                                → ASK (mit gap)
```

Die Aussage „Energy < 0.15 → WAIT" entspricht dem Code **exakt** (curiosity.ts:285, Konstante
`CURIOSITY_MIN_ENERGY = 0.15`), gilt aber nur für diesen Pfad und nur nach den beiden vorherigen
Gates. `isAskMeRequest` ändert nichts an diesen Prüfungen.

---

## 8. IMPULSE MODEL

| Aspekt | Implementierung |
|---|---|
| Suppression | `readUserControl(recentUserTexts)` → `suppress` bei „nicht jetzt / später / egal / hör auf zu fragen …", `allow` bei „frag ruhig". `permanent` bei „nie wieder / immer / dauerhaft / generell". `storedPreference` wirkt nur, wenn der aktuelle Text nichts sagt. |
| Kandidaten | alle `detectGaps`-Lücken mit `expiresAt > now`, Priorität ≤ P3, nicht duplikatähnlich (≥ 0.6) zu früheren Fragen **oder** bekannten Knoteninhalten |
| Priorität | `GAP_PRIORITY`: contradiction/pending_decision/unresolved_question = P1; incomplete_project/incomplete_goal/ambiguous_preference/missing_information = P2; outdated_information/missing_context/potential_relationship/repeated_topic = P3. P4 spricht nie. |
| Duplikat | `similarity(...) ≥ IMPULSE_DUPLICATE_SIMILARITY = 0.6` |
| Punktwert | F14 |
| Schwelle | `IMPULSE_MIN_SCORE = 0.2` |
| Sortierung | zuerst Priorität (P0 → P4), bei Gleichstand höherer Punktwert |
| Gates | `suppressed` → STAY_SILENT · `openQuestion` → STAY_SILENT · Cooldown (`PROACTIVE_COOLDOWN_MS[band]` gegen `lastImpulseAt`) → STAY_SILENT · kein Kandidat → STAY_SILENT · `best.score < 0.2` → STAY_SILENT · sonst SPEAK |

**Zusammenspiel mit Curiosity (engine.server.ts:2209–2251) – exakte Reihenfolge:**

```text
decision       = decideCuriosity(...)      // wird immer berechnet
impulseDecision= decideImpulse(...)        // wird immer berechnet
impulse        = impulseDecision.action === "SPEAK" ? impulseDecision.impulse : null

if (impulseDecision.suppressed)                       → silent(...)      // Nutzer hat abgewinkt
if (!impulse && (decision.action !== "ASK" || !decision.gap)) → silent(decision.reason)
gap = impulse ? gapFromImpulse(impulse, ctx) : decision.gap
```

- **IMPULSE gewinnt**, sobald `impulseDecision.action === "SPEAK"` – auch wenn `decideCuriosity`
  `WAIT` oder `DO_NOTHING` sagt, einschliesslich des Falls `energy < 0.15`.
  Der Impulspfad prüft Energie nicht.
- **CURIOSITY gewinnt** nur, wenn kein Impuls vorliegt **und** `decision.action === "ASK"` mit `gap`.
- **Keine Frage entsteht**, wenn der Nutzer unterdrückt hat, wenn beide Pfade schweigen, wenn die
  Sprachschicht nicht „ok" liefert oder wenn die formulierte Frage zu ≥ 0.6 einer früheren gleicht.
- Der gemeldete `score`/`reason` stammt bei einem Impuls vom Impuls, sonst von der Neugier;
  `gap_kind` wird bei Impulsen fest auf `"kontext"` gesetzt (`gapFromImpulse`).

---

## 9. AUTONOMOUS QUESTION PIPELINE

```text
INPUT: nichts (nur userId, now) – Auslöser ist der Browser-Takt oder eine explizite Anforderung
  ↓
[1] loadCuriosityContext  → state (mit Erholung), memories, interests, questions,
                            conversationTopics, lastQuestionAt, openQuestion,
                            gaps (≤12), detectedGaps, recentUserTexts
  ↓
[2] decideCuriosity  → DO_NOTHING | WAIT | ASK
[3] decideImpulse    → SPEAK | STAY_SILENT
  ↓
[4] Gate: suppressed?                       → asked=false
[5] Gate: kein Impuls UND kein ASK?         → asked=false
  ↓
[6] gap = impulse ? gapFromImpulse : decision.gap
[7] formulateQuestion(ctx, gap, impulse)    → LLM formuliert genau eine Frage (≤600 Zeichen)
[8] Gate: status ≠ "ok" oder leer?          → asked=false ("Sprachschicht nicht verfügbar")
[9] Gate: isDuplicateQuestion(≥0.6)?        → asked=false
  ↓
[10] INSERT orb_questions (question, topic, knowledge_gap, gap_kind,
                           source_memory_ids, score, reason, asked_at)
[11] INSERT orb_messages  (role="orb", decision="ask",
                           state_snapshot: {...state, proactive:true, score,
                                            question_id, impulse{...}, scope})
[12] UPDATE orb_state     (curiosity −0.06, energy −0.03)
[13] INSERT orb_metrics   (kind="proactive")
  ↓
OUTPUT: { asked:true, action:"ASK", question, topic, kind, score, snapshot, perf }
```

**Formale Darstellung der Entscheidung (entspricht dem Code):**

```text
ASK ⟺ ¬suppressed
      ∧ ( impulse(detectedGaps, curiosity, topics, texts, previous, known,
                  openQuestion, lastImpulseAt) = SPEAK
          ∨ curiosity(gaps, curiosity, energy, lastQuestionAt, openQuestion) = ASK )
      ∧ llm_status = ok ∧ question ≠ ∅
      ∧ ¬duplicate(question, previousQuestions, 0.6)
sonst WAIT / DO_NOTHING (keine sichtbare Nachricht)
```

Die vorgeschlagene Form `f(presence, gap, curiosity, energy, value, duplicate, cooldown, impulse)`
ist zulässig, **mit einer Einschränkung:** `presence` ist **nicht** Teil dieser serverseitigen
Funktion. Der Presence-Anteil (Leerlauf, Tippen, Sichtbarkeit, Cooldown der Kernpräsenz) liegt
ausschliesslich im Browser und entscheidet nur, **ob** `askProactively` überhaupt aufgerufen wird.

**Nicht vollständig aus dem aktuellen Code ableitbar:** welcher der beiden Zweige eine konkrete,
bereits gestellte Frage erzeugt hat, sofern `state_snapshot.impulse` nicht vorliegt – die abgelehnten
Versuche werden gar nicht gespeichert.

---

## 10. REISEN / WANDERN – exakte Reproduktion

**Der Code (memory.ts):**

```ts
function stem(word: string): string {
  let w = word;
  for (const suffix of ["innen","enden","ungen","chen","lein","ern","en","er","es","s","n"]) {
    if (w.length - suffix.length >= 4 && w.endsWith(suffix)) { w = w.slice(0, -suffix.length); break; }
  }
  return w;
}

const TOPIC_KEYWORDS = { /* ... */ reisen: ["reis","urlaub","flug","hotel","strand","berg","wander"] };

export function topicOf(text: string): string | null {
  const tokens = contentTokens(text);
  if (tokens.length === 0) return null;
  for (const [topic, keys] of Object.entries(TOPIC_KEYWORDS)) {
    if (tokens.some((t) => keys.some((k) => t.startsWith(k) || k.startsWith(t)))) return topic;
  }
  return tokens[0] ?? null;
}
```

**Ja – `t.startsWith(k) || k.startsWith(t)` wird tatsächlich verwendet** (memory.ts:422 in `topicOf`,
memory.ts:432 in `topicsOf`, memory.ts:597 in `feedRelevance`).

**Kette, Schritt für Schritt:**

1. `words("Ich gehe wandern")` → `["ich","gehe","wandern"]`
2. `"ich"` ist Stoppwort → entfällt.
3. `stem("wandern")`: Suffixliste in Reihenfolge; `"innen"/"enden"/"ungen"/"chen"/"lein"` treffen nicht;
   `"ern"` trifft: `7 − 3 = 4 ≥ 4` und `wandern.endsWith("ern")` → `w = "wand"`, `break`.
4. `contentTokens` → `["gehe", "wand"]`
5. `topicOf` iteriert `TOPIC_KEYWORDS` in Objekt-Reihenfolge (hardware, gaming, smartphones,
   programmierung, ki, essen, sport, musik, **reisen**, film, auto, natur). Kein früheres Thema
   erfüllt die Bedingung für `"gehe"` oder `"wand"`.
6. Bei `reisen` gilt für `t = "wand"`, `k = "wander"`: `t.startsWith(k)` ist falsch, aber
   **`k.startsWith(t)` ist wahr** → Treffer → Rückgabe `"reisen"`.

**Ausgeführte Verifikation (keine Annahme):**

```text
tokens(wandern):            [ 'gehe', 'wand' ]
topicOf('Ich gehe wandern'): reisen
topicOf('wandern'):          reisen
```

**Logische Ursache:** Die bidirektionale Präfixprüfung macht die Relation nicht-transitiv-sicher:
`wander` ist eine Erweiterung von `wand`. Weil der Stemmer die Endung `-ern` entfernt, entsteht ein
Stamm, der ein **echtes Präfix** eines fremden Themenschlüsselworts ist. Es gibt keinen
Konfidenzwert und keine Mindestlänge für diesen Treffer – die Themenzuordnung ist damit deterministisch
falsch, solange das Wortpaar existiert. Dieselbe Mechanik würde `wandel`, `wandschrank`, `wanderung`
(→ `wander`) und jedes weitere `wand…`-Wort dem Thema `reisen` zuordnen.

**Wirkungsradius (aus dem Code ableitbar):** `topicOf` bestimmt `orb_nodes.topic` und den
Interessen-Schlüssel; `topic` steuert `retrieveCandidates` (Themenabfrage), `deriveKnowledgeGaps`
(Filter und `conversationalFit`), `detectGaps` (`repeated_topic`, Widerspruchspaare) und den
Interessenaufbau. Ein falsches Thema wirkt also auf Abruf, Lückenbildung und Interessen gleichzeitig.

---

## 11. RECALL MODEL (Long-Term Memory Retrieval)

```text
Eingabetext
  ↓ normKey(text)            → exakter Duplikatschlüssel (1 Zeile)
  ↓ topicOf(text)            → Themenabfrage (≤20 Knoten, nach importance)
  ↓ questionIntentOf(text)   → zweiter Themenkreis, nur bei echter Frage (≤20)
  ↓ last_accessed_at         → Ebene-A-Kreis (≤10)
  ↓ contentTokens(text)[0..2]→ ILIKE-Textsuche (≤20)
  ↓ Vereinigung per id (Map) → candidateNodes
  ↓ Verbindungen der Kandidaten (≤60) → bestWeight(node) = max(W(t))
  ↓ overlap = max( similarity(text, content), topicAffinity(text, content) )
  ↓ FILTER overlap > 0                      ← harte Ausschlussbedingung
  ↓ level  = memoryLevel(importance, activationCount, lastAccessedAt)
  ↓ score  = memoryRelevance(F9)
  ↓ selectByLevel(scored, RECALL_LIMIT = 6)  ← A max 4, B max 4, C max 2
  ↓ selectReliableMemories(...)              ← Fragen/Aufforderungen/Fragmente/korrigierte Begriffe aus
  ↓ activeMemories → prompt.server.ts → LLM
```

**Was entscheidet, ob ein Knoten abgerufen wird – vollständig:**

1. Er muss in **mindestens einem** der 4–5 Kandidatenkreise auftauchen
   (Schlüssel, Thema, Frageintention, Aktualität, Textsuche).
2. `overlap > 0`, also entweder gemeinsame Inhaltswörter **oder** identischer Informationsbereich
   bei einer echten Frage (`0.12`).
3. Er muss im Ranking nach `memoryRelevance` innerhalb der Ebenenquote liegen
   (A ≤ 4, B ≤ 4, C ≤ 2, gesamt ≤ 6).
4. Er muss `isReliableMemoryContent` bestehen (`eligibility.ts`) und nicht durch einen
   ausdrücklich korrigierten Begriff entwertet sein.

**Ebenen (memory.ts:486):** `A` = letzte ≤ 6 Stunden berührt; `B` = `importance ≥ 0.5` **oder**
`activationCount ≥ 3`; `C` = alles übrige. `LEVEL_LIMITS = { A: 4, B: 4, C: 2 }`.

**Sprachliche Sicherheit** kommt aus `continuity.ts`: `memoryStrength(...)` → `certaintyOf` mit
`CERTAINTY_SICHER = 0.6`, `CERTAINTY_WAHRSCHEINLICH = 0.3` → „sicher / wahrscheinlich / vage".

---

## 12. GRAPH MODEL

**Technische Trennung – vier verschiedene Dinge:**

| Begriff | Tabelle / Ort | Lebensdauer | Wirkung |
|---|---|---|---|
| **Memory (Knoten)** | `orb_nodes` | dauerhaft, wird nie gelöscht | Recall-Kandidat, Lückenquelle |
| **Graph (Verbindungen)** | `orb_connections` | dauerhaft, Gewicht verfällt rechnerisch | liefert `bestWeight` für das Ranking, Nachbarschaft für `detectGaps` |
| **Conversation History** | `orb_messages` | dauerhaft gespeichert, aber im Kontext **hart auf 8 begrenzt** | flüchtiger Prompt-Kontext, Themenerkennung, Duplikat-/Impulssteuerung |
| **Thread (Gedankenfaden)** | `orb_threads` | dauerhaft, Status OPEN/ACTIVE/PAUSED/REACTIVATED/RESOLVED | eigene Lückenquelle (`threadKnowledgeGaps`), FOLLOW_UP-Anlass |

**Übergänge:**

- *Memory → Graph:* `touchConnection` (engine.server.ts:750). Neu:
  `weight = min(1, 0.35 + ΔW)`; vorhanden: `reactivate(...)`, `activation_count + 1`,
  `importance = max(alt, neu)`. Keine Duplikate (Paarprüfung source/target).
- *Graph → Recall:* `bestWeight(nodeId) = max(W(t))` über alle anliegenden Verbindungen; ohne
  Verbindung gilt der Standardwert `0.5`.
- *Graph → Context:* nur indirekt über das Ranking und über `detectGaps` (Nachbarschaft, Widerspruch,
  potenzielle Beziehung). Der Graph selbst wird nie in den Prompt geschrieben.
- *Aktivierung:* `orb_nodes.activation_count` und `last_accessed_at` (Recall-Treffer),
  `orb_connections.activation_count` (Reaktivierung), `orb_state.reactivation_count` (Summe je Zug).
- *Anzeige:* `getSnapshot` lädt höchstens `GRAPH_LIMIT = 40` Knoten und 40 Verbindungen – nie den
  vollständigen Graphen.

---

## 13. LLM BOUNDARY

```text
╔══════════════════ DETERMINISTIC ORB CORE ═══════════════════╗
║ Recall · Ranking · Ebenen · Belastbarkeit                    ║
║ Wichtigkeit · Speicherschwelle 0.35 · Verfall · Gewichte     ║
║ Zustand (nextState) · Energie (recoverEnergy / Kosten)       ║
║ decide() · decideConversationMode() · decideCuriosity()      ║
║ decideImpulse() · Duplikatprüfung · Cooldowns · Gates        ║
║ Themen (topicOf) · Interessen · Fäden · Widerspruchserkennung║
╚═══════════════════════════════╤═════════════════════════════╝
                                ↓ Context Construction
                  buildSpeakSystemPrompt(...) – einzige Stelle
                  (Zustandswerte, aktive Erinnerungen, Interessen,
                   Sicherheitsstufen, offene Fäden, Spannungen,
                   8-Zeilen-Kontext, Modus + MODE_HINT, Stilhinweis)
                                ↓
                  generateReply → OpenAI-Versuch (falls Schlüssel)
                                  sonst / bei Fehler: Lovable Gateway
                                  Modell: openai/gpt-6-astra
                                ↓
                  Antworttext (≤3 Sätze, de-DE)
                                ↓
                  stripFakePauseClaim(...) – Schutzschicht
                                ↓
                  PERSISTENCE (Core entscheidet, was gespeichert wird)
```

| Aufgabe | Entscheider |
|---|---|
| Frageentscheidung (ob) | **Code** (`decideCuriosity` + `decideImpulse` + Gates) |
| Frageformulierung (wie) | **LLM** (`formulateQuestion` → `speak`) |
| Memory Retrieval | **Code** (`retrieveCandidates` + `memoryRelevance` + `selectByLevel`) |
| Was gespeichert wird | **Code** (`scoreImportance ≥ 0.35`, `isStorableStatement`, `normKey`) |
| Gesprächsmodus | **Code** (`decideConversationMode`) |
| Antwortgenerierung | **LLM** |
| Selbstkorrektur im Text | **LLM** – im Code existiert kein Selbstkorrektur-Mechanismus. Es gibt nur Prompt-Anweisungen („behaupte nichts, was du nicht sicher weisst", Spannungen nicht eigenmächtig auflösen) und `stripFakePauseClaim`. **Nicht kausal bewiesen**, dass eine beobachtete Selbstkorrektur reproduzierbar ist. |

---

## 14. STATE MODEL

`orb_state` (eine Zeile je Nutzer) trägt `curiosity, joy, fear, trust, uncertainty, energy`
(alle 0..1), dazu `goals`, `cracks`, `reactivation_count`, `decay_computations`, `updated_at`.

Aus der Datenbank gelesen: alle sechs Zustandswerte, `goals`, `cracks`, die Zählwerte.
Berechnet beim Lesen: **nur** `energy` (Erholung). Zurückgeschrieben: siehe Tabelle in 3.2.

`cracks` steigt in `processInput` um 1, wenn `learning && importance ≥ 0.7`, und in
`recordLearning` immer um 1 (dort zusätzlich `fear + 0.1`, `uncertainty + 0.05`).

---

## 15. CAUSAL RELATIONSHIPS

Legende: **CODE** = im Quelltext belegt · **DB** = per Datenbank-Metadaten belegt ·
**RUNTIME** = durch tatsächliche Ausführung/Daten belegt · **TEST** = durch einen heute
ausgeführten grünen Test belegt.

### K1 – Energie-Zeitanker

```text
CAUSE   Jeder UPDATE auf orb_state
MECHAN. BEFORE-UPDATE-Trigger orb_state_updated_at → set_updated_at() setzt updated_at = now
EFFECT  Der Bezugspunkt von recoverEnergy verschiebt sich; die bis dahin verstrichene Ruhezeit
        wird nur bewahrt, wenn derselbe UPDATE die erholte Energie mitschreibt
```
**CODE** ✓ (`toState`, vier Schreibstellen) · **DB** ✓ (Trigger-Definition, siehe unten) ·
**RUNTIME** ✓ (Trigger aus der laufenden Produktionsdatenbank ausgelesen) · **TEST** ✓
(`tests/orb-energy-message-reset.test.ts`, Test „jeder orb_state-Update-Aufruf im Kern schreibt auch energy").

Ausgelesene Trigger-Definition (read-only):

```sql
CREATE TRIGGER orb_state_updated_at BEFORE UPDATE ON public.orb_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```
Gleichartige Trigger existieren auf `orb_nodes`, `orb_connections`, `orb_interests`, `orb_threads`,
`orb_style`, `orb_suggestions`, `orb_candidates`.

### K2 – Energie-Erholung ist zeitbasiert, nicht aufrufbasiert

```text
CAUSE   Verstrichene Zeit Δt zwischen updated_at und now
MECHAN. recoverEnergy(E₀, updated_at, now) – reine Funktion ohne Zustand
EFFECT  E steigt um 0.02 je Minute bis maximal 0.25; die Anzahl der Aufrufe ist ohne Wirkung
```
**CODE** ✓ · **TEST** ✓ (`orb-energy-recovery.test.ts`, 13 Tests) · **DB** – nicht erforderlich ·
**RUNTIME** – nicht in diesem Dokument erhoben.

### K3 – Energie < 0.15 → WAIT (nur Neugierpfad)

```text
CAUSE   ctx.state.energy < CURIOSITY_MIN_ENERGY (0.15)
MECHAN. decideCuriosity prüft nach gaps-Vorhandensein und Neugierband
EFFECT  action = WAIT, gap = null, keine sichtbare Nachricht
```
**CODE** ✓ (curiosity.ts:285) · **TEST** ✓ (`orb-curiosity.test.ts`) ·
**Einschränkung:** gilt **nicht** für `decideImpulse` – dort existiert keine Energieprüfung
(CODE ✓, durch Abwesenheit belegbar).

### K4 – `wandern` → `wand` → `wander` → `reisen`

```text
CAUSE   stem() entfernt die Endung "ern"
MECHAN. topicOf prüft bidirektional k.startsWith(t) gegen TOPIC_KEYWORDS.reisen = [..., "wander"]
EFFECT  orb_nodes.topic = "reisen" für jedes wand…-Wort
```
**CODE** ✓ · **RUNTIME** ✓ (ausgeführt, Ergebnis in Kapitel 10) · **TEST** – kein Test deckt genau
diesen Fall ab (keine Fundstelle in den ORB-Tests) · **DB** – nicht erforderlich.

### K5 – Autonome Frage kostet Energie und Neugier

```text
CAUSE   asked = true (alle Gates passiert, Frage formuliert, kein Duplikat)
MECHAN. UPDATE orb_state SET curiosity = max(0, c−0.06), energy = max(0, e−0.03)
EFFECT  sichtbare Energie sinkt um genau 0.03; orb_questions- und orb_messages-Zeile entstehen
```
**CODE** ✓ (engine.server.ts:2320) · **DB** ✓ (Zieltabellen und Spalten existieren) ·
**RUNTIME** – frühere Beobachtungen liegen vor, werden hier nicht erneut als Beweis geführt.

### K6 – Abgelehnter autonomer Versuch erzeugt keine Spur

```text
CAUSE   silent(reason) in askProactively
MECHAN. Rückgabe { asked:false, ... } ohne INSERT/UPDATE
EFFECT  kein orb_questions-, orb_messages-, orb_metrics- und kein orb_state-Eintrag;
        die Begründung existiert nur im Antwortobjekt dieses einen Aufrufs
```
**CODE** ✓ (alle `silent(...)`-Rückgabepfade liegen vor dem ersten INSERT) ·
**Folge:** die Behauptung „24 von 25 Ablehnungspunkten sind still" ist eine **Zählbehauptung ohne
festgelegte Zählregel** und bleibt „Nicht kausal bewiesen."; belegt ist nur die Eigenschaft
„Ablehnung schreibt nichts".

### K7 – „ORB denkt …" endet bei `asked = false`

```text
CAUSE   Serverantwort mit asked = false
MECHAN. Der Denk-Hinweis wird aus dem laufenden Aufruf abgeleitet (pending), nicht aus einem Schalter
EFFECT  Hinweis verschwindet; keine Chatzeile, kein Fehlerhinweis – gewolltes Schweigen
```
**CODE** ✓ (Adapter-/Client-Pfad: der Hinweis hängt am Anfragezustand, Antwort ohne `question`
erzeugt keine Nachricht) · **RUNTIME** – der Einzelfall eines beobachteten Ereignisses ist
**nicht** rekonstruierbar, weil nichts persistiert wird.

### K8 – Recall ohne Wortüberschneidung

```text
CAUSE   overlap === 0
MECHAN. .filter((c) => c.overlap > 0) in processInput
EFFECT  Knoten fällt vor dem Ranking heraus – unabhängig von Wichtigkeit und Gewicht
```
**CODE** ✓ (engine.server.ts:914) · **TEST** ✓ (`orb-memory-recall-fix.test.ts`) ·
Gegenmittel im Code: `topicAffinity = 0.12` hebt die Überschneidung bei erkannter Frage über 0.

### K9 – Kontextfenster begrenzt, was das LLM sehen kann

```text
CAUSE   CONTEXT_WINDOW_MESSAGES = 8
MECHAN. contextWindow(...) schneidet auf die letzten 8 nichtleeren Zeilen
EFFECT  ältere Gesprächsinhalte sind für die Antwort nur über Knoten (Gedächtnis) erreichbar
```
**CODE** ✓ · **TEST** ✓ (`orb-context.test.ts`, `orb-context-intelligence.test.ts`).

### K10 – Nutzereingabe erzeugt nie eine Pausenmeldung

```text
CAUSE   interner Zustand stay_silent (energy < 0.12)
MECHAN. conversationDecision(...) wandelt stay_silent → answer; stripFakePauseClaim ersetzt
        erfundene Pausenbehauptungen durch HONEST_PRESENCE_EXPLANATION
EFFECT  der Nutzer erhält immer eine Antwort, nie „ich brauche eine Pause"
```
**CODE** ✓ · **TEST** ✓ (`orb-presence.test.ts`, `orb-presence-wait-fix.test.ts`).

---

## 16. TEST COVERAGE

Heute ausgeführt (read-only, nichts geändert):

```text
tests/orb-core.test.ts                    18 Tests   ✓
tests/orb-memory.test.ts                  22 Tests   ✓
tests/orb-curiosity.test.ts               28 Tests   ✓
tests/orb-conversation-decision.test.ts   20 Tests   ✓
tests/orb-energy-recovery.test.ts         13 Tests   ✓
tests/orb-presence.test.ts                20 Tests   ✓
tests/orb-memory-recall-fix.test.ts       18 Tests   ✓
tests/orb-energy-message-reset.test.ts     6 Tests   ✓
tests/orb-proactive-impulse.test.ts       31 Tests   ✓
tests/orb-sdk-contract.test.ts             9 Tests   ✓
──────────────────────────────────────────────────────
10 Dateien, 185 Tests, 185 bestanden, 0 fehlgeschlagen
```

| Funktion | Test | erwartetes Verhalten | tatsächliches Ergebnis |
|---|---|---|---|
| `recoverEnergy` | `orb-energy-recovery.test.ts` | +0.02/min, Cap 0.25, zeitbasiert, nie senkend | bestanden |
| `orb_state`-Schreibstellen | `orb-energy-message-reset.test.ts` | jeder UPDATE im Kern schreibt `energy` mit | bestanden |
| `nextState` (Kosten) | `orb-energy-message-reset.test.ts` A–C | `−0.03 − 0.04·I`, keine künstliche Nullung | bestanden |
| `curiosityScore`, `decideCuriosity` | `orb-curiosity.test.ts` | Gate-Reihenfolge, Schwelle 0.2, Energie 0.15 | bestanden |
| `shouldAskProactively` | `orb-presence.test.ts`, `orb-presence-wait-fix.test.ts` | 10 benennbare Ablehnungen, WAIT nie sichtbar | bestanden |
| `decideImpulse`, `impulseScore` | `orb-proactive-impulse.test.ts` | Priorität vor Punktwert, Suppression, Duplikat 0.6 | bestanden |
| `memoryRelevance`, `selectByLevel`, `normKey`, `similarity` | `orb-memory.test.ts`, `orb-core.test.ts` | Ranking, Ebenenquoten, konservative Duplikate | bestanden |
| Recall mit Themen-Affinität | `orb-memory-recall-fix.test.ts` | Knoten ohne gemeinsame Wörter bleibt auffindbar | bestanden |
| `decideConversationMode` | `orb-conversation-decision.test.ts` | Regelreihenfolge, LISTEN ohne Strang | bestanden |
| SDK-Grenze | `orb-sdk-contract.test.ts` | keine doppelte Umsetzung, 11 angemeldete Funktionen | bestanden |
| autonome Frage (Server-Pfad) | **keine Testdatei** | – | **nicht getestet** |
| `topicOf("wandern")` | **keine Testdatei** | – | **nicht getestet** |

Weitere vorhandene, hier nicht ausgeführte ORB-Tests: `orb-analysis-value-separation`,
`orb-avatar`, `orb-avatar-motion`, `orb-chat-scroll`, `orb-context`, `orb-context-intelligence`,
`orb-continuity`, `orb-graph-viewport`, `orb-llm-provider`, `orb-memory-quality`,
`orb-multimodal-composer`, `orb-process-guardrail`, `orb-spiderweb-ui`,
`tests/integration/db-orb-security.test.ts`.

---

## 17. KNOWN LIMITATIONS

1. **Keine Observability des autonomen Pfads.** Jede Ablehnung ist folgenlos und spurlos (K6).
   Ohne Persistenz ist kein Einzelfall nachträglich beweisbar.
2. **Zweigherkunft einer gestellten Frage** ist nur erkennbar, wenn `orb_messages.state_snapshot.impulse`
   gesetzt ist; Neugier- und Impulszweig führen sonst identische Felder.
3. **Impulspfad ohne Energieprüfung** – eine autonome Äusserung ist bei sehr niedriger Energie
   möglich, obwohl der Neugierpfad dann `WAIT` sagt. Aus dem Code direkt ableitbar, nicht als
   Laufzeitfall belegt.
4. **Themenzuordnung ohne Konfidenz** (K4). Ein Treffer über `k.startsWith(t)` ist nicht von einem
   echten Treffer unterscheidbar; es gibt keine Mindestlänge und keinen Zweitkandidaten.
5. **Fallback-Thema** `tokens[0]` erzeugt Themen aus einem beliebigen ersten Inhaltswort.
6. **Zwei Ähnlichkeitsmasse** existieren parallel (`similarity` in memory.ts, `textOverlap` in core.ts).
   Im Abrufpfad wirkt nur `similarity`; `textOverlap` ist dort nicht eingebunden.
7. **Browser-Intervall hängt an `onAsk`** – Neustart des Takts bei wechselnder Funktionsreferenz.
8. **Modell-Abweichung im experimentellen Direktpfad:** `provider.server.ts` verwendet
   `openai/gpt-6-astra` (regelkonform), `openai.server.ts` verwendet `gpt-4o-mini` **mit**
   `max_tokens`. Das ist eine Abweichung von der geltenden Vorgabe; hier nur festgestellt,
   **nicht geändert**.
9. **`gapFromImpulse` setzt `kind: "kontext"` fest** – die tatsächliche Lückenart (`gap.type`)
   bleibt nur in `state_snapshot.impulse.type` sichtbar, nicht in `orb_questions.gap_kind`.
10. **Widerspruch zum bisherigen Forensic Report – ausdrücklich gemeldet:**
    Die Formulierung „24/25 stille Ablehnungspunkte" ist aus dem Code **nicht** verifizierbar,
    weil keine Zählregel definiert ist (wie viele Gates gezählt werden, ob Client-Gates mitzählen).
    Belegt ist ausschliesslich: **alle** Ablehnungspfade in `askProactively` sind still.
    Ebenso: die im Auftrag vorgeschlagene Energieformel mit `clamp(..., 0, Cap)` beschreibt den
    Code nicht exakt (F4).

---

## 18. SECURITY REDACTIONS

Geprüft wurden alle in diesem Dokument zitierten Dateien. Enthalten sind **keine** Schlüssel,
Tokens, Passwörter, Zugangsdaten oder Nutzer-PII.

- Schlüssel werden ausschliesslich über Umgebungsvariablen gelesen
  (`OPENAI_API_KEY`, `LOVABLE_API_KEY` – Namen, keine Werte). Werte: `[REDACTED – SECRET]`.
- Es wurden **keine** Nutzerinhalte, E-Mail-Adressen oder Nutzerkennungen in dieses Dokument
  übernommen. Die zitierten Beispieltexte („Ich gehe wandern", „Ich mag Pizza mit Ananas") sind
  konstruierte Eingaben zur Formelprüfung.
- Die ausgelesenen Datenbank-Metadaten enthalten nur Trigger- und Funktionsnamen, keine Daten.

---

## 19. COMPLETE TECHNICAL ARCHITECTURE DIAGRAM

Nur Komponenten, die tatsächlich im Code existieren.

```text
USER (Browser, ORB-Core-Chat)
 │
 ├─ Eingabe (Text / Bild / Sprache)            ├─ Leerlauf (kein Eingriff)
 │                                              │
 │                                    use-orb-presence.ts  (5-s-Takt, rein clientseitig)
 │                                              │ shouldAskProactively (10 Gates)
 │                                              ▼
 │                                    requestOrbCuriosity  ──────────────┐
 ▼                                                                       │
sendOrbInput (createServerFn + requireSupabaseAuth)                       │
 ▼                                                                       │
orb-sdk/orb-core.server.ts  (Fassade, keine Logik)                        │
 ▼                                                                       ▼
engine.server.ts :: processInput                        engine.server.ts :: askProactively
 │                                                        │
 ├─ ensureState ─► toState ─► recoverEnergy (ENERGY)       ├─ loadCuriosityContext
 ├─ retrieveCandidates (4–5 begrenzte Abfragen)            │   ├─ 12 Knoten, 8 Interessen,
 ├─ orb_connections ─► currentWeight ─► bestWeight         │   │  8 Nachrichten, Fragen, 60 Kanten
 ├─ overlap = max(similarity, topicAffinity)  > 0          │   ├─ deriveKnowledgeGaps (F11–F13)
 ├─ memoryRelevance (F9) ─► selectByLevel (A4/B4/C2)       │   ├─ threadKnowledgeGaps
 ├─ selectReliableMemories (eligibility)                   │   └─ detectGaps (11 Lückenarten)
 ├─ scoreImportance (F3) · isLearningEvent                 ├─ decideCuriosity   (Energie 0.15)
 ├─ contextWindow (8) · resolveFromContext                 ├─ decideImpulse     (keine Energie)
 ├─ loadThreads / loadStyle / detectContradictions         ├─ Gate: suppressed / kein Kandidat
 ├─ decide() (core)                                        ├─ formulateQuestion ─► LLM
 ├─ decideConversationMode() (5 Modi)                      ├─ Gate: status ok · Duplikat 0.6
 │                                                         │
 ▼ CONTEXT CONSTRUCTION                                    ▼
buildSpeakSystemPrompt (prompt.server.ts) ◄────────────────┘
 ▼
generateReply (select.server.ts)
 ├─ OpenAI-Versuch (optional, gpt-4o-mini)
 └─ Lovable Gateway (openai/gpt-6-astra)   ─► Fallbacktext bei quota/unavailable
 ▼
stripFakePauseClaim (presence.ts)
 ▼
OUTPUT (≤3 Sätze, de-DE)   |   OUTPUT (genau eine Frage, ≤600 Zeichen)
 ▼
PERSISTENCE (nur der Core entscheidet)
 ├─ orb_nodes        (nur bei importance ≥ 0.35, normKey gegen Duplikate)
 ├─ orb_connections  (touchConnection: neu 0.35+ΔW / reactivate)
 ├─ orb_interests    (nextInterest, F17)
 ├─ orb_threads / orb_style / orb_candidates (Kontinuität, Analyse)
 ├─ orb_questions    (nur bei tatsächlich gestellter eigener Frage)
 ├─ orb_messages     (Nutzerzeile + ORB-Zeile mit state_snapshot)
 ├─ orb_state        (4 Schreibstellen, alle mit energy)
 └─ orb_metrics      (kind = "turn" | "proactive")
      │
      └─ DB-Trigger set_updated_at() auf jeder orb_*-Tabelle (BEFORE UPDATE)
```

---

## 20. INDEPENDENT VERIFICATION NOTES

So kann eine unabhängige ORB-Instanz jede Aussage dieses Dokuments selbst prüfen – ohne den
gesamten Code:

| Behauptung | Minimaler Beweissatz | benötigte Belegart |
|---|---|---|
| Energie-Formel und Cap | `core.ts` (Zeilen 149–190) | CODE + TEST |
| Energie-Zeitanker | `engine.server.ts` 258–282, 410–420, 1490–1505, 1730–1742, 2318–2330 **und** Trigger-Definition | CODE + **DB** |
| Energie-Gate 0.15 | `curiosity.ts` 146–304 | CODE + TEST |
| Impuls ohne Energie-Gate | `impulse.ts` vollständig (244 Zeilen) | CODE (Abwesenheit) |
| Reihenfolge Impuls vs. Neugier | `engine.server.ts` 2199–2260 | CODE |
| `wandern → reisen` | `memory.ts` 221–436 + eine Ausführung von `topicOf` | CODE + RUNTIME |
| Recall-Entscheidung | `engine.server.ts` 610–701 und 877–916 + `memory.ts` 438–516 + `recall.ts` | CODE + TEST |
| Kontextgrenze 8 | `context.ts` 16–41 | CODE + TEST |
| LLM-Grenze | `llm/prompt.server.ts`, `llm/select.server.ts` | CODE |
| Zuständigkeit der Gates | `presence.ts` 98–124 + `use-orb-presence.ts` 97–132 | CODE |

**Ausdrücklich nicht beweisbar mit diesem Satz:**
Welcher Zweig eine bereits gestellte Frage erzeugt hat (nicht gespeichert) · der Einzelfall eines
beobachteten „ORB denkt …"-Ereignisses (nicht gespeichert) · die Zahl „24/25" (keine Zählregel) ·
die Reproduzierbarkeit einer beobachteten Selbstkorrektur (kein Mechanismus im Code).

---

```text
Files changed:          0
Database changes:       0
Migrations:             0
Deployments:            0
Configuration changes:  0
Tests changed:          0
```

Durchgeführte Aktionen: Dateien gelesen, ORB-Tests ausgeführt (read-only, 185/185 bestanden),
`topicOf` einmalig zur Verifikation ausgeführt, Datenbank-Trigger-Metadaten gelesen (SELECT),
dieses Dokument erstellt. Keine Änderung an Code, Datenbank, Konfiguration, Tests oder Deployment.
