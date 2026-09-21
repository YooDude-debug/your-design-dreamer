# ORB Autonomy Observability Forensic

DATE: 2026-09-21 · MODE: STRICT READ-ONLY · ENVIRONMENT: PRODUCTION
NO CODE CHANGE · NO DB WRITE · NO CONFIG CHANGE · NO DEPLOYMENT · NOTHING IMPLEMENTED

---

## 1. Current Autonomous Execution Path

Client (browser only, no server polling):

1. `src/integrations/y-dude-orb/use-orb-presence.ts:107` — `setInterval`, 5 s tick
   (`PRESENCE_TICK_MS`), pure computation.
2. `shouldAskProactively()` — `src/orb-core/presence.ts:104–131`.
   `hasCandidate` is hard-coded `true` on the client (line ~118 of the hook);
   the real candidate check is server-side.
3. On `verdict.ask === true`: `lastProactiveRef.current = now` (immediate
   client lock), then `onAsk()` → `askProactively` in
   `src/routes/_authenticated/channels.orb.tsx:234` → `curiosityMutation.mutate()`
   → server function → `askProactively(db, userId)`.

Server — `src/orb-core/engine.server.ts:2190–2345`:

4. `loadCuriosityContext()` — memories, gaps, detectedGaps, interests,
   questions, openQuestion, lastQuestionAt, state (energy read through
   `recoverEnergy`, engine.server.ts:265).
5. `decideCuriosity()` — `src/orb-core/curiosity.ts:267–304`.
6. `decideImpulse()` — `src/orb-core/impulse.ts:163–241`.
7. Merge: `impulse ?? decision.gap` → single `gap`.
8. `formulateQuestion()` — engine.server.ts:2144, language layer.
9. `isDuplicateQuestion()` against own previous questions.
10. Persist `orb_questions` row → `orb_messages` row (`decision: "ask"`,
    `state_snapshot.proactive: true`, `question_id`) → `orb_state` update
    (curiosity −0.06, energy −0.03) → `orb_metrics` row `kind: "proactive"`.
11. Return `{ asked: true, question, snapshot, perf }`; the UI renders it
    (`channels.orb.tsx:220–228`) and calls `presence.noteProactive()`.

**Corrected order vs. the requested map:** energy and value are not sequential
stages. Both evaluators run in full, and the order inside each differs:

```
TRIGGER (client: tab visible, not typing/listening/speaking/pending,
         idle 40 s–15 min, curiosity band ≠ low, client cooldown)
  ↓
CONTEXT LOAD (server)
  ↓
CURIOSITY BRANCH                    IMPULSE BRANCH (runs in parallel)
  gaps empty? → DO_NOTHING            user suppression → silent
  curiosity low → DO_NOTHING          open question → silent
  energy < 0.15 → WAIT                cooldown → silent
  open question → WAIT                duplicate/known → candidate dropped
  cooldown → WAIT                     no candidate → silent
  score < 0.20 → WAIT                 best.score < 0.20 → silent
  ↓                                   ↓  (IMPULSE has NO energy gate)
        MERGE into one `gap`  (impulse takes precedence)
  ↓
QUESTION GENERATION (LLM) — failure → silent
  ↓
DUPLICATE CHECK on the generated text — hit → silent
  ↓
PERSISTENCE: orb_questions → orb_messages → orb_state → orb_metrics
  ↓
DISPATCH: return value → UI render + TTS
```

Timing window and client-side cooldown sit **before** the server call, not after.

## 2. Decision Gates

| # | File | Function | Condition | Required | Rejection reason | Logged | DB | Browser | Silent |
|---|---|---|---|---|---|---|---|---|---|
| G1 | presence.ts:108 | shouldAskProactively | `!tabVisible` | tab visible | tab inactive | no | no | only in-memory `status.reason` | yes |
| G2 | presence.ts:109 | same | `typing` | false | user typing | no | no | same | yes |
| G3 | presence.ts:110 | same | `listening` | false | microphone active | no | no | same | yes |
| G4 | presence.ts:111 | same | `speaking` | false | TTS running | no | no | same | yes |
| G5 | presence.ts:112 | same | `pending` | false | request in flight | no | no | same | yes |
| G6 | presence.ts:113 | same | `idleMs < 40 000` | ≥ 40 s | too early | no | no | same | yes |
| G7 | presence.ts:116 | same | `idleMs > 900 000` | ≤ 15 min | absent too long | no | no | same | yes |
| G8 | presence.ts:119 | same | `band === "low"` | curiosity ≥ 0.35 | curiosity too low | no | no | same | yes |
| G9 | presence.ts:121 | same | client `cooldown` | ≥ 120/180/300 s | cooldown | no | no | `OrbDevPanel` shows cooldown s | yes |
| G10 | curiosity.ts:279 | decideCuriosity | `gaps.length === 0` | ≥ 1 gap | no knowledge gap | no | no | only via "Neugier prüfen" button | yes |
| G11 | curiosity.ts:282 | same | `!mayAskAtCuriosity` | ≥ 0.35 | curiosity too low | no | no | same | yes |
| G12 | curiosity.ts:285 | same | `energy < CURIOSITY_MIN_ENERGY` | ≥ 0.15 | too little energy | no | no | same | yes |
| G13 | curiosity.ts:288 | same | `openQuestion` | none open | own question unanswered | no | no | same | yes |
| G14 | curiosity.ts:291–294 | same | server cooldown | band cooldown | cooldown | no | no | same | yes |
| G15 | curiosity.ts:297 | same | `score < CURIOSITY_ASK_THRESHOLD` | ≥ 0.20 | value too low | no | no | same | yes |
| G16 | impulse.ts:216 | decideImpulse | `suppressed` | not suppressed | user declined | no | no | no | yes |
| G17 | impulse.ts:217 | same | `openQuestion` | none open | question open | no | no | no | yes |
| G18 | impulse.ts:219–222 | same | cooldown | band cooldown | cooldown | no | no | no | yes |
| G19 | impulse.ts:171–180 | same | expired / duplicate / known | — | candidate dropped | no | no | no | yes |
| G20 | impulse.ts:173 | same | `!isProactivePriority` | P1/P2 | priority too low | no | no | no | yes |
| G21 | impulse.ts:227 | same | no candidate | ≥ 1 | no added value | no | no | no | yes |
| G22 | impulse.ts:228 | same | `best.score < IMPULSE_MIN_SCORE` | ≥ 0.20 | value too low | no | no | no | yes |
| G23 | engine.server.ts:2238 | askProactively | `!impulse && (action !== ASK \|\| !gap)` | one branch passes | combined rejection | no | no | no | yes |
| G24 | engine.server.ts:2248 | askProactively | `spoken.status !== "ok"` | ok | language layer down / quota | no | no | no | yes |
| G25 | engine.server.ts:2253–2260 | askProactively | `isDuplicateQuestion` | no match | already asked | no | no | no | yes |
| P1 | engine.server.ts:2262+ | askProactively | insert errors `throw` | — | DB failure | thrown → `console.error` in UI (`channels.orb.tsx:229`) | partial row possible | browser console only | no |

There is **no energy gate on the impulse branch** — confirmed again here.

## 3. All Silent Exit Points

Every gate G1–G25 is silent server-side and database-side. Concretely:

- Client-side (G1–G9): never leaves the browser. The reason string exists only
  in React state (`PresenceStatus.reason`) and is not rendered anywhere in
  `channels.orb.tsx`; only the cooldown seconds appear in `OrbDevPanel`.
- Server-side (G10–G25): `silent(reason)` returns a plain object. No
  `console.log`, no `orb_metrics` row, no `orb_questions` row, no
  `orb_messages` row, no `orb_state` write. The reason is returned to the
  client, where `curiosityMutation.onSuccess` discards it
  (`if (!result.asked || !result.question) return;`).
- The only non-silent failure is a thrown DB error (P1), visible solely in the
  user's browser console.

## 4. Current Evidence Available

For case A–J (per the request):

| Case | Log | DB row | Metric | Question row | Browser state | Reconstructable? |
|---|---|---|---|---|---|---|
| A energy < 0.15 (curiosity branch) | no | no | no | no | reason in memory only | NO |
| B value < 0.20 | no | no | no | no | only via manual "Neugier prüfen" | NO |
| C duplicate | no | no | no | no | no | NO |
| D open question | no | no | no | no | no | NO |
| E cooldown | no | no | no | no | cooldown seconds in dev panel | NO |
| F outside 40 s–15 min | no | no | no | no | no | NO (call never made) |
| G candidate accepted | no | (follows) | (follows) | (follows) | "ORB denkt nach" | partially |
| H generation failed | no | no | no | no | no | NO |
| I dispatch/DB failed | browser console only | possibly partial | no | possibly orphaned | console | partially |
| J question sent | no | orb_messages + orb_state | `kind: proactive` | orb_questions | message + TTS | YES |

Only case J leaves a durable fingerprint: `orb_questions` row +
`orb_messages` row with `state_snapshot.proactive = true` and `question_id` +
`orb_metrics kind = proactive` + energy −0.03. Production shows the last such
set at 2026-09-20 07:26:13.636; none on 2026-09-21.

One manual, on-demand observability path exists and was not used during the
live test: the "Neugier prüfen" button (`inspectCuriosity`) renders action,
reason, curiosity, energy, score, threshold, cooldown and the gap list in
`OrbDevPanel` (lines 208–245). It covers the curiosity branch only — not the
impulse branch — and it is read-only.

## 5. What "ORB denkt …" Actually Proves

`channels.orb.tsx:257` and `:517` derive the thinking state from
`sendMutation.isPending || curiosityMutation.isPending`.

- It proves a **server function call was in flight** — either the reply call or
  the autonomous call.
- It does **not** identify which one. With any user message in flight the same
  label appears.
- If no message was sent in that moment, thinking implies `curiosityMutation`
  ran, i.e. `askProactively()` did reach the server, and it returned
  `asked: false` — but **which** gate rejected it is unrecoverable, because
  `onSuccess` drops the reason.
- If the observed thinking state coincided with a reply, it proves nothing
  about the autonomous path at all.

So the symptom narrows the cause to G10–G25 only when a user message can be
ruled out for that exact moment; it never identifies the gate.

## 6. What Cannot Currently Be Proven

- Whether the idle observer fired at all (NOT_TRIGGERED vs. rejected).
- Which of the 16 server-side gates rejected the attempt.
- The energy value at the moment of the autonomous decision (the recovered
  value is computed in memory and only written when a question is actually
  sent).
- The candidate score of a rejected attempt.
- How many attempts occurred in a session.
- Whether the language layer failed (quota/unavailable) versus a gate rejecting.

## 7. Minimum Required Observability

To distinguish the ten outcomes, exactly one record per attempt would be
needed, containing: timestamp, trigger source (idle/explicit), outcome code
(NOT_TRIGGERED, ENERGY_REJECTED, VALUE_REJECTED, DUPLICATE_REJECTED,
OPEN_QUESTION_REJECTED, COOLDOWN_REJECTED, TIMING_REJECTED, GENERATION_FAILED,
DISPATCH_FAILED, QUESTION_SENT), branch (impulse/curiosity), effective energy,
best candidate score, and the existing reason string.

Mapping: TIMING_REJECTED and NOT_TRIGGERED are only observable client-side
(G1–G9 never reach the server). All other codes are derivable server-side from
the existing `reason` strings — the reason text already uniquely identifies
each gate; nothing new would have to be computed.

## 8. Production Impact of Instrumentation

- A write per rejected attempt would touch `orb_state`'s sibling tables. Any
  write to `orb_state` resets `updated_at` via `set_updated_at()` and would
  therefore **destroy the energy recovery clock** — a behavior change. Writing
  to `orb_state` for observability is disqualified.
- A write to a separate table does not touch `orb_state` and would not alter
  any decision, but it adds one insert per 5 s tick in the worst case
  (rejections are the common case), i.e. up to 12 rows/minute/session.
- Pure `console.log` on the server changes no behavior and no data, but is not
  durable and not queryable after the fact.
- Returning the existing `reason` to the UI and displaying it changes no
  decision at all — the value is already computed and already transmitted.

## 9. Recommended Minimal Instrumentation Design (ANALYSIS ONLY — NOT IMPLEMENTED)

Smallest surface that yields full discrimination, in ascending cost:

1. **Zero-write option:** surface the already-returned `reason`, `action`,
   `score` from `curiosityMutation` in the existing `OrbDevPanel` (it is
   currently discarded in `onSuccess`). Covers G10–G25 live, no DB, no
   behavior change. Does not cover G1–G9 and is not durable.
2. **Client reason display:** additionally render the existing
   `presence.status.reason` (already computed every tick) in the dev panel.
   Covers G1–G9 including NOT_TRIGGERED and TIMING_REJECTED. No DB, no
   behavior change.
3. **Durable option (only if forensic history is required):** one append-only
   row per attempt in a dedicated table — never in `orb_state` — with the six
   fields from §7, written at the single existing `silent()` helper plus the
   success path. One insertion point, no threshold, no gate, no decision
   touched.

Options 1 and 2 alone would have answered every open question from today's
live test.

## 10. Findings

- **FINDING — NO CHANGE MADE** F-1: 25 decision gates exist; 24 of them leave
  no server-side or database trace whatsoever.
- **FINDING — NO CHANGE MADE** F-2: the server already computes a precise,
  gate-unique `reason` for every rejection and returns it to the client, where
  `channels.orb.tsx:222` discards it. Full diagnostic information is produced
  and then thrown away.
- **FINDING — NO CHANGE MADE** F-3: "ORB denkt nach" is shared between the
  reply and the autonomous call, so it cannot attribute an attempt to the
  autonomous path on its own.
- **FINDING — NO CHANGE MADE** F-4: the recovered energy value used in the
  autonomous decision is never persisted unless a question is actually sent,
  so the energy at decision time is unrecoverable after the fact.
- **FINDING — NO CHANGE MADE** F-5: the impulse branch has no energy gate;
  any energy-based explanation of silence can only apply to the curiosity
  branch.
- **FINDING — NO CHANGE MADE** F-6: client-side gates G1–G9 prevent the server
  call entirely, so NOT_TRIGGERED and TIMING_REJECTED are structurally
  invisible to any server-side instrumentation.
- **FINDING — NO CHANGE MADE** F-7: instrumentation written into `orb_state`
  would reset `updated_at` and thereby change energy recovery behavior —
  observability must not use that table.
- **FINDING — NO CHANGE MADE** F-8: a DB error inside `askProactively()` is
  thrown after the `orb_questions` insert, so a failure between question
  insert and message insert can leave an orphaned question row that is
  indistinguishable from an unanswered question and would then block further
  attempts via G13/G17.
- **FINDING — NO CHANGE MADE** F-9: an unused observability path already
  exists ("Neugier prüfen" / `inspectCuriosity`), covering the curiosity
  branch read-only; it was not used during the live test.

Nothing in §7–§9 was implemented. Report ends here.
