# ORB LISTEN Autonomy Forensic — 2026-09-21

MODE: STRICT READ-ONLY · ENVIRONMENT: PRODUCTION
NO CODE CHANGE · NO DB WRITE · NO CONFIG CHANGE · NO DEPLOYMENT

Claim under investigation (verbatim, from ORB output):
"LISTEN Vorgaben verbieten mir weiterhin ausdrücklich, eine Frage zu stellen."

---

## 1. Where LISTEN is defined

- `src/orb-core/conversation.ts:20` — `"LISTEN"` as one value of `ConversationMode`.
- `src/orb-core/conversation.ts:201` — fallback branch of `decideConversationMode()`:
  `return plan("LISTEN", "Kein belegbarer eigener Beitrag – ORB hört zu.");`
- `src/orb-core/conversation.ts:205–214` — `MODE_HINT`, entry `LISTEN`:
  "Antworte mit höchstens einem kurzen Satz und **stelle keine Frage** – du hast gerade keinen eigenen Beitrag."

LISTEN is a **reply-mode label plus a sentence of prompt wording**. There is no
LISTEN flag stored in the database (`orb_state` has no such column) and no
LISTEN check anywhere outside these lines (`rg "LISTEN"` → only conversation.ts,
prompt.server.ts, tests).

## 2. Where it enters the pipeline

`decideConversationMode()` has exactly two call sites, both inside
`processInput()` — the reply path for a user message:

- `src/orb-core/engine.server.ts:1069` (pre-pass, `impulseAllowed: false`)
- `src/orb-core/engine.server.ts:1162` (re-decision, `impulseAllowed: true`)

The resulting mode reaches the language layer only as text:
`src/orb-core/llm/prompt.server.ts:53–55`
`Gesprächsmodus (von dir selbst bestimmt): ${input.mode}. ${MODE_HINT[input.mode]} …`

No other module imports `decideConversationMode` or `MODE_HINT`
(`rg` across `src/`, tests excluded).

## 3. Prompt information or executable guard?

**Prompt/context information.** The only effect of `mode === "LISTEN"` in
executable code is inside `plan()` (conversation.ts:155–157): it empties
`relevantStrands` and `focusTopic` for the reply prompt. No branch anywhere
returns early, throws, or skips a dispatch because of LISTEN.

## 4. Can `askProactively()` execute while LISTEN is "active"?

Yes — LISTEN is not a persisted state, so there is nothing to be active.
`askProactively()` (`src/orb-core/engine.server.ts:2189+`) never reads
`ConversationMode`, never calls `decideConversationMode()`, and its
formulation helper `formulateQuestion()` (engine.server.ts:2144–2181) builds
its own prompt and calls `speak({ … })` **without** the `mode` field — so
`MODE_HINT.LISTEN` is not even present in the autonomous prompt.

## 5.–7. Candidate evaluation / generation / LISTEN-specific rejection

- Evaluation: both evaluators (IMPULSE, CURIOSITY) run unconditionally inside
  `askProactively()` and merge into one `gap` (engine.server.ts:~2239).
- Generation: gated by the pre-existing numeric gates only —
  `CURIOSITY_MIN_ENERGY 0.15`, `CURIOSITY_ASK_THRESHOLD 0.20`,
  `IMPULSE_MIN_SCORE 0.20`, duplicate similarity 0.6, idle window 40 s–15 min,
  cooldown 120 s, unanswered-question guard.
- LISTEN-specific rejection: **none exists.** No condition in the autonomous
  path references LISTEN, the conversation mode, or `MODE_HINT`.

The only genuinely listening-related guard in the codebase is
`src/orb-core/presence.ts:108` — `if (ctx.listening) return no("Mikrofon ist aktiv.")`.
It is client-side, evaluated by `useOrbPresence`, and means literally
"microphone is recording". It suppresses the *call* while the mic runs; it is
unrelated to the `LISTEN` conversation mode and there is no runtime evidence it
fired during the live test.

## 8. Exact condition responsible for the observed silence

Not LISTEN. Both Production turns today were produced by the reply path and
recorded `decision = stay_silent` with `state_snapshot.energy = 0`:

| created_at (UTC) | role | decision | energy | body (excerpt) |
|---|---|---|---|---|
| 2026-09-21 07:57:36.078 | orb | stay_silent | 0 | "…die aktuellen LISTEN-Vorgaben verbieten mir weiterhin ausdrücklich…" |
| 2026-09-21 07:44:26.702 | orb | stay_silent | 0 | "…das ausdrückliche Frageverbot im LISTEN…" |
| 2026-09-21 05:17:35.589 | orb | stay_silent | 0 | same pattern |

Responsible expressions, in evaluation order:

1. `src/orb-core/core.ts:179` — `if (state.energy < 0.12) return { decision: "stay_silent", … }`
2. `src/orb-core/conversation.ts:~180` (FOLLOW_UP) and `:~194` (SMALLTALK) —
   both require `input.energy >= 0.12`; with energy 0 both fail, so
   `decideConversationMode()` falls through to the LISTEN default at line 201.

LISTEN is therefore the **consequence** of energy 0, selected at line 201, and
its `MODE_HINT` sentence is then handed to the language model, which
paraphrased it back to the user as an explicit prohibition. ORB quoted its own
prompt line — that is the entire origin of the claim.

## 9. Where the rejection happens

Neither before, during, nor after candidate generation in the autonomous path.
It happens in a **different pipeline**: the reply path, at mode decision time,
before the language call. For the autonomous path today there is no rejection
record at all — see §10.

## 10. Exact file/function/line

- Mode selection: `src/orb-core/conversation.ts:201`, `decideConversationMode()`.
- Prompt injection: `src/orb-core/llm/prompt.server.ts:55`.
- Energy gate producing it: `src/orb-core/core.ts:179` (`decide()`),
  `src/orb-core/conversation.ts:180` and `:194`.
- Autonomous path (unaffected): `src/orb-core/engine.server.ts:2189`
  (`askProactively`), `:2144` (`formulateQuestion`).

Runtime evidence for the autonomous path on 2026-09-21: `orb_metrics` for the
test user contains **no** `proactive` row, and `orb_questions` has no row newer
than 2026-09-20 07:26:13.636 ("Worauf bezieht sich „Nicht faktisch falsch“?",
score 0.363). Stored `orb_state`: energy 0, curiosity 1,
decay_computations 4539, updated_at 2026-09-21 07:57:40.545805+00. Whether
`askProactively()` reached the server during the test and returned silent is
**NOT OBSERVABLE** — silent rejections are not logged (pre-existing finding).

## 11. Did this behavior exist before the Energy Recovery change?

Yes. Diff of the pre-change backup `.lovable/backup/pre_orb_energy_recovery_2026-09-21/engine.server.ts`
against current `src/orb-core/engine.server.ts` contains exactly two hunks:
the `recoverEnergy` import (line 28) and the energy read in `toState()`
(line 265–267). `decideConversationMode` call sites are identical
(backup lines 1066/1159). `conversation.ts` — including the LISTEN branch and
`MODE_HINT.LISTEN` — was not touched by the Energy Recovery change; it dates
from the Natural Conversation release (2026-09-20).

## 12. Comparison with the previous forensic conclusion

The earlier conclusion — Listening Mode does **not** technically block
`askProactively()` — remains true in the current Production code. Confirmed
again by call-site analysis (`decideConversationMode` only in `processInput`)
and by the absence of `mode` in `formulateQuestion()`'s `speak()` call. The
earlier report's "partially correct" nuance also holds: the wording is real,
it just governs replies, not autonomous questions.

## FINDINGS — NO CHANGE MADE

- F-1 `MODE_HINT.LISTEN` instructs the model verbatim not to ask; the model
  surfaces this to the user as a system-level prohibition, which is misleading
  as a diagnostic signal. Wording unchanged.
- F-2 Energy 0 selects LISTEN via the 0.12 gates; the resulting explanation
  hides the real cause (energy) behind mode wording.
- F-3 Stored energy is still 0 despite recovery, because every `orb_state`
  write resets `updated_at` (pre-existing finding F from the energy forensic).
  Recovery therefore never accumulates across writes in practice.
- F-4 Silent rejections in `askProactively()` are not persisted, so the live
  test cannot be reconstructed server-side.
- F-5 `presence.ts:108` (`ctx.listening`) is the only real listening guard and
  is mic-only, client-side; it is easily confused with mode LISTEN by name.

## FINAL CLASSIFICATION

**C — LISTEN is only prompt/context wording; another mechanism blocks the question.**

The blocking mechanism is the energy gate (energy 0 < 0.12 in the reply path;
< 0.15 for the curiosity branch of the autonomous path). No executable
LISTEN-specific condition prevents an autonomous question.
