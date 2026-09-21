# ORB CROSS-CASE AUTONOMY ARCHITECTURE — CASE 1 vs CASE 2

DATE: 2026-09-21 · MODE: STRICT READ-ONLY · ENVIRONMENT: PRODUCTION + SOURCE
NO source, database, memory, configuration, threshold, formula or prompt was changed. No deployment, no migration, no autonomous action triggered.

---

## 1. Executive Summary

Case 1 (IMPULSE, energy 0, score 0.36288) and Case 2 (CURIOSITY, energy 0.618, score 0.404) are **not two architectures**. Both events were produced by **one single server function**, `askProactively()` in `src/orb-core/engine.server.ts:2187`, invoked through **one single trigger** (the client idle observer `useOrbPresence`, `src/integrations/y-dude-orb/use-orb-presence.ts:97-132`) via **one server function** (`requestOrbCuriosity` → `evaluateCuriosity` → `askProactively`).

Inside that one function, IMPULSE and CURIOSITY are **two evaluators over the same loaded context**, whose results are merged into one `gap` variable at `engine.server.ts:2239`. Everything after that line — question formulation, duplicate check, persistence, message dispatch, state change, metrics — is **identical, shared code**.

Runtime evidence confirms this, independently of source similarity: both Production messages carry the same dispatcher fingerprint (`proactive: true`, `scope: orb_core_chat_only`, `question_id`, `decision: "ask"`), both have a matching `orb_questions` row and a matching `orb_metrics` row of `kind = "proactive"`. The only field that differs is `state_snapshot.impulse`, which is the exact discriminator the shared dispatcher writes at `engine.server.ts:2297-2299`.

**Verdict: A. COMMON ARCHITECTURE CONFIRMED** — with one narrowing qualification recorded in §19: the common layer is a single function, not a generic autonomy framework; there is no scheduler, no event bus and no autonomy controller in the implementation.

---

## 2. Research Question

Does ORB possess a shared mechanism that converts an internally recognised relevant state into an autonomous action, with IMPULSE and CURIOSITY acting as different triggers/evaluators feeding it? Prove or disprove from code and Production evidence.

---

## 3. Case 1 Reconstruction (reference case, unmodified)

Source: `docs/ORB_AUTONOMOUS_QUESTION_EVENT_2026-09-20.md`.

| Field | Value |
|---|---|
| ORB message | `409fc08f-f3b0-4224-b6bd-c060ad689cfe`, 2026-09-20 07:26:11.726 UTC, decision `ask` |
| Text | „Worauf bezieht sich „Nicht faktisch falsch“?“ |
| Question row | `a95656dc-7575-4676-8f4a-cc519bcf5aff`, gap_kind `kontext`, topic `faktisch`, score 0.36288 |
| Reason | „„Nicht faktisch falsch“ ist wichtig, aber mit nichts verknüpft. Priorität P2, Wert 0.36.“ |
| Source node | `5d140b55-db57-4beb-a3d4-d7c434d96b40` (importance 0.8, confidence 0.9), 0 connections at detection |
| Snapshot | energy **0**, curiosity **1**, `impulse: {type: missing_information, priority: P2, form: question}` |
| Path | IMPULSE (`decideImpulse`), no new user input |

## 4. Case 2 Reconstruction (reference case, unmodified)

Source: `docs/ORB_FORENSIC_CASE2_PERSONAL_MEMORY_2026-09-21.md`.

| Field | Value |
|---|---|
| ORB message | `1c088006-ceea-4d1c-868a-856a7f953a8e`, 2026-09-19 18:05:12.998 UTC, decision `ask` |
| Text | „Welche konkrete persönliche Information über dich soll ich mir merken?“ |
| Question row | `145b70ef-53ce-48b8-9ba7-eeffab1b743d`, gap_kind `detail`, topic `erzähle`, score 0.4044583393318627 |
| Reason | „ORB kennt die Aussage nur allgemein, ohne konkretes Detail. Thema „erzähle“, Relevanz 0.73, Neuheit 1.00. Neugier high, Wert 0.40.“ |
| Source node | `dac061cb-d71b-4d53-a5fe-6308ceb8489a` |
| Snapshot | energy **0.618**, curiosity **0.7475**, `impulse: null` |
| Path | CURIOSITY (`decideCuriosity` / `deriveKnowledgeGaps`), no new user input |

A third, structurally identical event exists in Production and is used below as an independent replication of Case 2: message `da514bb1-e651-4a6a-975a-e71e08d49841`, 18:07:14.884 UTC, question `96e14f0d-…`, gap_kind `grund`, topic `hardware`, score 0.37446, energy 0.504, `impulse: null`.

---

## 5. Case 1 Forward Trace

```
TRIGGER          browser interval, 5 s tick
                 use-orb-presence.ts:99  window.setInterval(PRESENCE_TICK_MS)
STATE DETECTION  shouldAskProactively(presence.ts:102)   idle ≈ 41 s ≥ PROACTIVE_MIN_IDLE_MS (40 s),
                 tabVisible, !typing/!speaking/!listening/!pending, band(curiosity 1) = very_high,
                 hasCandidate = true (client stub, presence.ts:109)
                 verdict.ask === true → lastProactiveRef = now → onAsk()
DISPATCH (client) channels.orb.tsx:250 onAsk → askProactively → useServerFn(requestOrbCuriosity):105
SERVER ENTRY     orb.functions.ts requestOrbCuriosity (auth middleware)
                 → orb-sdk/orb-core.server.ts:65 evaluateCuriosity()
                 → engine.server.ts:2187 askProactively(db, userId)
CONTEXT LOAD     loadCuriosityContext (engine.server.ts:1900-2059): orb_state, 12 orb_nodes,
                 8 orb_interests, 8 orb_messages, orb_questions, 60 orb_connections
EVALUATION A     decideCuriosity(engine.server.ts:2197) → energy 0 < CURIOSITY_MIN_ENERGY 0.15
                 → action WAIT, gap null   (curiosity branch blocked)
EVALUATION B     detectGaps(gaps.ts, called at engine.server.ts:2020)
                 → missing_information on node 5d140b55 (important, unconnected)
                 decideImpulse(engine.server.ts:2209) → GAP_PRIORITY P2, impulseScore 0.36288
                 ≥ IMPULSE_MIN_SCORE 0.2, no cooldown, no duplicate → action SPEAK
PATH MERGE       engine.server.ts:2239  gap = gapFromImpulse(impulse, ctx)
ACTION           formulateQuestion(engine.server.ts:2245, impulseCandidate ≠ null)
                 → isDuplicateQuestion check :2252
PERSISTENCE      orb_questions insert :2261  (id a95656dc)
DISPATCH         orb_messages insert :2280  decision "ask", proactive true, impulse {...}
STATE CHANGE     orb_state update :2308  curiosity −0.06, energy −0.03
OBSERVABLE       orb_metrics insert :2328 kind "proactive"  (07:26:13.759 UTC)
```

## 6. Case 2 Forward Trace

Identical to §5 up to and including CONTEXT LOAD and then:

```
EVALUATION A     decideCuriosity(:2197)  curiosity 0.7475 → band high, energy 0.618 ≥ 0.15,
                 no open question, cooldown passed, best gap score 0.40446 ≥
                 CURIOSITY_ASK_THRESHOLD 0.2 → action ASK, gap = {node dac061cb, kind detail}
EVALUATION B     detectGaps: connections_loaded = 0 (orb_metrics 18:05:15.454) and only 3 nodes
                 → decideImpulse(:2209) produced no SPEAK candidate → impulse = null
PATH MERGE       engine.server.ts:2239  gap = decision.gap!      ← same variable, other source
ACTION           formulateQuestion(:2245, impulseCandidate = null)   ← same function
PERSISTENCE      orb_questions insert :2261  (id 145b70ef)           ← same statement
DISPATCH         orb_messages insert :2280  proactive true, impulse null ← same statement
STATE CHANGE     orb_state update :2308  curiosity −0.06, energy −0.03 ← same statement
OBSERVABLE       orb_metrics insert :2328 kind "proactive" (18:05:15.454 UTC) ← same statement
```

## 7. Case 1 Backward Trace

```
orb_messages 409fc08f (decision ask, proactive true)
 ← engine.server.ts:2280 insert            [only writer of decision "ask" + proactive true]
 ← engine.server.ts:2261 orb_questions insert (a95656dc)
 ← engine.server.ts:2245 formulateQuestion
 ← engine.server.ts:2239 gap = gapFromImpulse(impulse, ctx)          [merge point]
 ← engine.server.ts:2220 impulse = impulseDecision.action === "SPEAK" ? …
 ← engine.server.ts:2209 decideImpulse  ← impulse.ts:163
 ← engine.server.ts:2020 detectGaps     ← gaps.ts
 ← engine.server.ts:2195 loadCuriosityContext
 ← engine.server.ts:2187 askProactively
 ← orb-sdk/orb-core.server.ts:65 evaluateCuriosity
 ← orb.functions.ts requestOrbCuriosity
 ← channels.orb.tsx:250 onAsk
 ← use-orb-presence.ts:125 if (verdict.ask) onAsk()
 ← presence.ts:102 shouldAskProactively   ← use-orb-presence.ts:99 setInterval
```

## 8. Case 2 Backward Trace

Identical chain, diverging only in two links:

```
 … ← engine.server.ts:2239 gap = decision.gap!            [same merge point, other branch]
   ← engine.server.ts:2197 decideCuriosity ← curiosity.ts:267
   ← engine.server.ts:1977 deriveKnowledgeGaps ← curiosity.ts:178
   ← engine.server.ts:2195 loadCuriosityContext          [from here upward: identical]
```

Backward and forward traces agree in both cases. The **smallest common execution layer is `askProactively()` lines 2239–2346**, entered through the shared prefix lines 2187–2195.

---

## 9. IMPULSE Architecture

- `src/orb-core/gaps.ts` — `detectGaps()`: derives structural gaps (contradiction, pending_decision, missing_information, …) from nodes **and connections**.
- `src/orb-core/impulse.ts:163` — `decideImpulse()`: `GAP_PRIORITY` → `PRIORITY_BENEFIT` → `impulseScore = gapImportance × confidence × futureRelevance × conversationalFit × userBenefit`; gate `IMPULSE_MIN_SCORE = 0.2`; duplicate gate `IMPULSE_DUPLICATE_SIMILARITY = 0.6`; user-control gates (`readUserControl`); cooldown via `PROACTIVE_COOLDOWN_MS[curiosityBand(curiosity)]`.
- **Contains no energy check.** Pure function, no DB, no network, no AI.

## 10. CURIOSITY Architecture

- `src/orb-core/curiosity.ts:178` — `deriveKnowledgeGaps()`: derives content gaps (`grund`, `stand`, `erfahrung`, `praeferenz`, `detail`, `kontext`) from nodes **and interests**, no connections.
- `src/orb-core/curiosity.ts:135` — `curiosityScore = curiosity × relevance × soft(importance) × soft(confidence) × soft(conversationalFit) × soft(novelty)`.
- `src/orb-core/curiosity.ts:267` — `decideCuriosity()`: gates `mayAskAtCuriosity` (band ≠ low), **`CURIOSITY_MIN_ENERGY = 0.15`**, open question, cooldown `PROACTIVE_COOLDOWN_MS[band]`, `CURIOSITY_ASK_THRESHOLD = 0.2`. Pure function.

## 11. Common Architecture Investigation

Shared, proven from code:

| Shared element | Location | Used by Case 1 | Used by Case 2 |
|---|---|---|---|
| Trigger loop | `use-orb-presence.ts:99` | yes | yes |
| Gate `shouldAskProactively` | `presence.ts:102` | yes | yes |
| Server entry `askProactively` | `engine.server.ts:2187` | yes | yes |
| Context loader | `engine.server.ts:1900` | yes | yes |
| Cooldown table `PROACTIVE_COOLDOWN_MS` | `presence.ts:55` | yes (`impulse.ts:221`) | yes (`curiosity.ts:293`) |
| Band function `curiosityBand` | `presence.ts:41` | yes | yes |
| State variable `curiosity` (`orb_state`) | DB | yes | yes |
| Merge variable `gap` | `engine.server.ts:2239` | yes | yes |
| Formulation `formulateQuestion` | `engine.server.ts:2141` | yes | yes |
| Duplicate gate `isDuplicateQuestion` | `curiosity.ts:156` | yes | yes |
| Persistence `orb_questions` | `engine.server.ts:2261` | yes | yes |
| Dispatch `orb_messages` | `engine.server.ts:2280` | yes | yes |
| State change `orb_state` | `engine.server.ts:2308` | yes | yes |
| Metrics `kind = "proactive"` | `engine.server.ts:2328` | yes | yes |
| Shared type `KnowledgeGap` | `curiosity.ts:93` (IMPULSE adapted via `gapFromImpulse:2118`) | yes | yes |

Case-specific: `detectGaps`/`decideImpulse`/`GAP_PRIORITY`/`gapFromImpulse` (Case 1 only); `deriveKnowledgeGaps`/`curiosityScore`/`CURIOSITY_MIN_ENERGY` (Case 2 only).

Excluded as **false commonalities** (present but not architecturally meaningful): same database, same app, same ORB instance, same LLM provider, same `clamp01` utility, same auth middleware, same conversation, same user.

## 12. First Common Node

**`askProactively()` — `src/orb-core/engine.server.ts:2187`.**

1. Module/file: `src/orb-core/engine.server.ts`
2. Function: `askProactively(db, userId, { explicit? })`
3. Caller: `orb-sdk/orb-core.server.ts:65 evaluateCuriosity()` ← `requestOrbCuriosity` ← `channels.orb.tsx:250 onAsk` ← `use-orb-presence.ts:125`
4. Inputs: authenticated `db`, `userId`; internally `loadCuriosityContext` (state, 12 nodes, 8 interests, 8 messages, questions, 60 connections)
5. Outputs: `OrbProactiveResult`; side effects = 1 `orb_questions` row, 1 `orb_messages` row, 1 `orb_state` update, 1 `orb_metrics` row
6. Decision logic: `decideCuriosity` **and** `decideImpulse` are both evaluated; IMPULSE takes precedence (`:2239-2241`); silence if neither yields a gap (`:2238`) or if the user suppressed impulses (`:2235`)
7. Case 1 path: impulse branch, `gapFromImpulse`
8. Case 2 path: curiosity branch, `decision.gap`
9. Evidence both use it: it is the **only** code location in the repository that writes `orb_messages` with `decision "ask"` and `state_snapshot.proactive = true` together with a `question_id` and an `orb_metrics` row of `kind "proactive"` — and both Production events carry exactly that fingerprint (§14).

Note: the strictly earliest common node is the trigger `shouldAskProactively` (`presence.ts:102`), which runs before either evaluator. The first common node **inside the decision/action architecture** is `askProactively`.

## 13. Autonomous Action Boundary

The boundary between "internal evaluation" and "autonomous action" is **`engine.server.ts:2238-2245`**:

- `:2238` last possible silence (`return silent(...)`)
- `:2239` the two evaluator results collapse into one `gap`
- `:2245` `formulateQuestion()` — first outward-facing effect (LLM call)
- `:2261/:2280` the action becomes user-visible and persistent

Both cases cross **the same boundary, in the same function, at the same lines**. Proof: identical dispatcher fingerprint in both Production rows (§14); no second code path with these side effects exists (verified by repository search for `decideImpulse`, `decideCuriosity`, `orb_questions` inserts — only `engine.server.ts:1237` in `processInput` for explicit "frag mich" requests, which is not involved in either case; both cases have `explicit: false`).

## 14. Production Runtime Evidence

`orb_messages` (read-only query, personal content redacted where not causally needed):

| id | created_at (UTC) | decision | proactive | explicit | energy | curiosity | score | gap_kind | impulse | question_id |
|---|---|---|---|---|---|---|---|---|---|---|
| 1c088006 (Case 2) | 2026-09-19 18:05:12.998 | ask | true | false | 0.618 | 0.7475 | 0.40446 | detail | **null** | 145b70ef |
| da514bb1 (replication) | 2026-09-19 18:07:14.884 | ask | true | false | 0.504 | 0.7575 | 0.37446 | grund | **null** | 96e14f0d |
| 409fc08f (Case 1) | 2026-09-20 07:26:11.726 | ask | true | false | **0** | 1 | 0.36288 | kontext | **{missing_information, P2, question}** | a95656dc |

`orb_metrics` `kind = "proactive"` — exactly three rows exist, one per event, each ~2 s after its message:

| created_at | nodes_loaded | connections_loaded | ai_ms | total_ms | db_queries |
|---|---|---|---|---|---|
| 2026-09-19 18:05:15.454 | 3 | **0** | 1929 | 2396 | 9 |
| 2026-09-19 18:07:17.047 | 4 | **0** | 1718 | 2114 | 9 |
| 2026-09-20 07:26:13.759 | 12 | **15** | 1734 | 2004 | 10 |

`orb_questions`: all three rows present with `asked_at` equal to the message timestamp, `answered = true`, and `source_memory_ids` pointing to one node each — written by `engine.server.ts:2261`. Parent/child correlation is via `state_snapshot.question_id` → `orb_questions.id`; there is no separate correlation-ID infrastructure.

Runtime significance of `connections_loaded`: Case 2 ran with **zero** connections loaded, so `detectGaps` (which needs connections to find unconnected/contradictory structure) could not produce a SPEAK candidate — which is precisely why the shared function fell through to the curiosity branch. Case 1 ran with 15 connections and 12 nodes, enabling the impulse branch. The branch difference is therefore explained by **data state, not by a different architecture**.

## 15. Causal Graphs

Case 1:
```text
idle 41s ──▶ shouldAskProactively ──▶ askProactively ──▶ detectGaps ──▶ decideImpulse(SPEAK,0.363)
   [PROVEN]        [SUPPORTED]            [PROVEN]        [PROVEN]          [PROVEN]
 ──▶ gapFromImpulse ──▶ formulateQuestion ──▶ orb_questions+orb_messages ──▶ orb_state −energy/−curiosity
        [PROVEN]            [PROVEN]                  [PROVEN]                       [PROVEN]
```
Case 2:
```text
idle ≥40s ──▶ shouldAskProactively ──▶ askProactively ──▶ deriveKnowledgeGaps ──▶ decideCuriosity(ASK,0.404)
 [SUPPORTED]       [SUPPORTED]             [PROVEN]            [PROVEN]                 [PROVEN]
 ──▶ decision.gap ──▶ formulateQuestion ──▶ orb_questions+orb_messages ──▶ orb_state −energy/−curiosity
        [PROVEN]           [PROVEN]                 [PROVEN]                        [PROVEN]
```
Proven common nodes only:
```text
                ┌──────────────────────────┐
                │ OBSERVE (client idle tick)│  presence.ts:102 / use-orb-presence.ts:99
                └────────────┬─────────────┘
                             ▼
                ┌──────────────────────────┐
                │ LOAD CONTEXT             │  engine.server.ts:1900
                └────────────┬─────────────┘
                 ┌───────────┴───────────┐
                 ▼                       ▼
        IMPULSE (detectGaps/        CURIOSITY (deriveKnowledgeGaps/
        decideImpulse)              decideCuriosity)
                 └───────────┬───────────┘
                             ▼
                ┌──────────────────────────┐
                │ MERGE + DECIDE  :2238-39 │
                └────────────┬─────────────┘
                             ▼
                ┌──────────────────────────┐
                │ ACT (formulate, persist, │  :2245 / :2261 / :2280
                │      dispatch)           │
                └────────────┬─────────────┘
                             ▼
                ┌──────────────────────────┐
                │ STATE CHANGE + METRICS   │  :2308 / :2328
                └──────────────────────────┘
```
The `WAIT`/`DO_NOTHING`/`STAY_SILENT` returns feed back only through persisted state (`orb_state`, `orb_questions`) read on the next invocation. There is **no explicit loop construct and no state-machine implementation**; the observe→evaluate→decide→act→observe pattern is realised by repeated invocation of one function, not by a state machine object. It is therefore described as a repeated pipeline, not a state machine.

## 16. Minimum Common Architecture

| Component | Classification |
|---|---|
| `use-orb-presence.ts` 5 s tick + `shouldAskProactively` (trigger/observer) | COMMON — PROVEN (code); runtime for each individual tick: SUPPORTED |
| `requestOrbCuriosity` → `evaluateCuriosity` → `askProactively` (single entry) | COMMON — PROVEN |
| `loadCuriosityContext` (state observation) | COMMON — PROVEN |
| Merge point `gap` (`:2239`) | COMMON — PROVEN |
| `formulateQuestion` (action generation) | COMMON — PROVEN |
| `isDuplicateQuestion` guard | COMMON — PROVEN |
| `orb_questions` / `orb_messages` write (action dispatch + persistence) | COMMON — PROVEN |
| `orb_state` update, `orb_metrics` "proactive" | COMMON — PROVEN |
| `PROACTIVE_COOLDOWN_MS` + `curiosityBand` + `curiosity` state | COMMON — PROVEN |
| `detectGaps` / `decideImpulse` / `gapFromImpulse` | CASE-SPECIFIC (Case 1) |
| `deriveKnowledgeGaps` / `curiosityScore` / `CURIOSITY_MIN_ENERGY` | CASE-SPECIFIC (Case 2) |
| Energy value | CASE-SPECIFIC input; gate exists only in the curiosity branch |
| Scheduler, event bus, autonomy controller, guardrail engine | NOT PRESENT (no implementation found) |
| `processInput` self-question path (`:1122-1250`) | NOT RELEVANT (both cases `explicit: false`) |
| Number of silent ticks before each event | UNKNOWN (not recorded) |

Answer to §6 of the request: **C + D combined** — different signals **and** different scoring mechanisms entering one common decision-and-action layer. Not A, not B (they are separate modules, not branches of one evaluator), not E.

## 17. Alternative Explanations (checked, rejected or retained)

- *Two independent systems producing similar output* — rejected: only one code location writes this side-effect set; both rows carry its exact fingerprint.
- *Case 2 was a normal LLM answer merely labelled as a question* — rejected: `decision "ask"`, `proactive: true`, `question_id` and matching `orb_questions` row can only be produced by `:2261/:2280`.
- *Case 1 used the explicit "frag mich" path (`processInput:1237`)* — rejected: that path never writes `orb_metrics kind "proactive"` and never sets `state_snapshot.proactive`; both rows have `explicit: false` and a proactive metrics row.
- *Different architecture because energy differed* — rejected: the energy gate exists only in `decideCuriosity`; its absence in `decideImpulse` is a branch property inside the shared function, not a second architecture.
- *User input triggered Case 2* — not re-opened here; Case 2 report already classified the trigger as impulse-free. The idle precondition (`≥40 s`) is SUPPORTED, not PROVEN, because client ticks are not logged.
- *Staging contamination / another conversation* — no evidence; all rows belong to one user and one Production database.

## 18. Evidence Gaps

1. Client-side tick outcomes are not persisted; the exact `idleMs` at trigger time and the number of preceding silent rejections are NOT PROVEN for either case.
2. `shouldAskProactively`'s per-tick inputs (typing/speaking/tab visibility) exist only in browser memory.
3. `detectGaps` and `decideCuriosity` intermediate candidate lists are not persisted; only the winning gap is stored.
4. No request/correlation ID links the server invocation to the client tick; correlation rests on timestamps (±2.5 s) and the `question_id`.
5. Node connection state at Case 1 detection time is reconstructed from the Case 1 report, not re-derivable today.

## 19. Final Architectural Verdict

**A. COMMON ARCHITECTURE CONFIRMED.**

Basis: one trigger (`shouldAskProactively`), one server entry (`askProactively`), one context loader, one merge point, one action/persistence/state-change/metrics block — all proven in code and corroborated by three Production events carrying the same dispatcher fingerprint and differing only in the discriminator field the shared dispatcher itself writes. IMPULSE and CURIOSITY are two evaluators, not two architectures.

Qualification (does not change the classification): the common layer is one function with two inline evaluators. There is no scheduler, no event bus, no autonomy controller, no state-machine implementation, and no continuous server-side loop; autonomy is realised by a client 5 s tick that may invoke the function, which then either acts once or returns silently. The observe→evaluate→decide→act→observe model of §13 of the request is therefore supported for steps 1, 2, 4, 5 (PROVEN), supported for step 3 (path selection is precedence, not selection logic weighing both), and for step 6 supported only indirectly: re-observation happens through persisted state read on the next invocation, not through an explicit feedback mechanism. No claim of consciousness, self-awareness or equivalent is made or supported.

## 20. FINDINGS — NO CHANGE MADE

1. **FINDING — NO CHANGE MADE:** The energy gate is asymmetric. `decideCuriosity` enforces `CURIOSITY_MIN_ENERGY = 0.15`; `decideImpulse` has no energy check. With energy 0, autonomous questions remain possible only through the impulse branch (Case 1 demonstrates this in Production).
2. **FINDING — NO CHANGE MADE:** Energy is only ever decremented in the paths reviewed (`:2313` and equivalents); no replenishment was found. Production energy is 0 since 2026-09-19 (also recorded in the earlier trace report).
3. **FINDING — NO CHANGE MADE:** IMPULSE takes unconditional precedence over CURIOSITY at `:2239-2241` even when the curiosity score is higher; no comparative selection between the two evaluators exists.
4. **FINDING — NO CHANGE MADE:** `hasCandidate: true` is hard-coded in the client gate (`use-orb-presence.ts:109`), so the client cannot pre-filter for memory relevance; the server performs the real check. This costs one server call per accepted tick.
5. **FINDING — NO CHANGE MADE:** Silent outcomes (`WAIT`, `DO_NOTHING`, `STAY_SILENT`) and rejected candidates are not persisted, which is the root cause of evidence gaps 1–3 and limits future forensics.
6. **FINDING — NO CHANGE MADE:** `gapFromImpulse` (`:2118`) forces every impulse into `kind: "kontext"` and `novelty: 1`, so impulse-derived questions are indistinguishable by `gap_kind` from genuine `kontext` curiosity gaps; only `state_snapshot.impulse` distinguishes them.
7. **FINDING — NO CHANGE MADE:** Case 2's topic was `erzähle` — a verb form captured as a topic. Topic extraction can produce non-substantive topics that still pass the gap gates.

READ-ONLY. Nothing was changed, deployed, migrated or fixed.
