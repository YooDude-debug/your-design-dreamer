// P5-C: rein diagnostisch – keine Produktivänderung.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { utteranceKind, isStorableStatement, isCorrection } from "@/orb-core/eligibility";
import { detectConfirmationSignal } from "@/orb-core/confirmation-signal";
import { traceMemoryUsage, turnVisibleMemoryIds, resolveReplyReference } from "@/orb-core/memory-usage";
import { suppressLearningForConfirmation } from "@/orb-core/confirmation-learning-gate";
import { isAskMeRequest } from "@/orb-core/engine.server";

const eng = readFileSync("src/orb-core/engine.server.ts", "utf8");
const pos = (s: string) => { const i = eng.indexOf(s); expect(i, s).toBeGreaterThan(0); return i; };

describe("P5-C Forensik: Confirmation vs. offene Frage", () => {
  it("Klassifikation der Fälle A–E", () => {
    const rows = ["Stimmt.", "Ja.", "Das stimmt.", "Stimmt, ich habe eine RTX 5070.", "Ich habe eine RTX 5070."].map((t) => ({
      t, kind: utteranceKind(t), storable: isStorableStatement(t), signal: detectConfirmationSignal(t),
      askMe: isAskMeRequest(t), correction: isCorrection(t),
    }));
    console.log(JSON.stringify(rows));
    expect(rows.map((r) => r.signal)).toEqual(["POSITIVE_CONFIRMATION", "POSITIVE_CONFIRMATION", "POSITIVE_CONFIRMATION", "NONE", "NONE"]);
    expect(rows.every((r) => !r.askMe && !r.correction)).toBe(true);
  });
  it("Reihenfolge im Turn", () => {
    const order = [
      "confirmationDiag = confirmationTurnDiagnostic(",
      "const resolvedContextFact = learnRequest",
      "if (selfQuestion) {\n    const row",
      "confirmationEffect = await applyConfirmationEffect(",
      "const openQuestionRow = isAskMeRequest(text) ? null : await findOpenQuestion(",
      "!suppressLearningForConfirmation(confirmationEffect) &&",
      "answeringQuestion ||",
      'db.from("orb_nodes").insert(row)',
      "answeredQuestion = await closeOpenQuestion(",
      "const turnMemoryIds = turnVisibleMemoryIds(",
    ].map(pos);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("B5 wirkt nur im Neu-Speicher-Zweig; closeOpenQuestion hängt nur an openQuestionRow", () => {
    expect(eng.match(/suppressLearningForConfirmation\(/g)?.length).toBe(2);
    const i = pos("if (openQuestionRow) {\n    answeredQuestion");
    expect(eng.slice(i, i + 300)).toContain("answerNodeId: focusNodeId");
    expect(eng.slice(i, i + 300)).not.toContain("confirmation");
  });
  it("Frage-Turns liefern keine sichtbaren IDs → B4 kann dort nicht wirken", () => {
    // selfQuestion: kein Modellaufruf → promptMetrics fehlt → modelCalled=false → []
    const trace = traceMemoryUsage(["A"], [{ id: "A" }], false);
    expect(turnVisibleMemoryIds(trace, { status: "ok", fallbackUsed: false })).toEqual([]);
    // proaktive Frage: state_snapshot ohne model_visible_memory_ids → null
    const ref = resolveReplyReference("11111111-1111-4111-8111-111111111111", {
      id: "11111111-1111-4111-8111-111111111111", role: "orb", created_at: "2026-01-01", state_snapshot: { proactive: true },
    } as never);
    expect(ref.referencedModelVisibleMemoryIds).toBeNull();
    expect(suppressLearningForConfirmation("NONE")).toBe(false);
  });
});
