import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { confirmationTurnDiagnostic } from "@/orb-core/confirmation-signal";
import { isCorrection, isStorableStatement } from "@/orb-core/eligibility";

const ref = (ids: string[] | null, id: string | null = "orb-1") => ({
  referencedOrbTurnId: id,
  referencedModelVisibleMemoryIds: ids,
});

describe("P5-B3 confirmation wiring (diagnostic only)", () => {
  it("A: Ja. + one visible → CONFIRMED_SINGLE_CANDIDATE", () => {
    const d = confirmationTurnDiagnostic("Ja.", ref(["A"]));
    expect(d).toEqual({
      confirmation_signal: "POSITIVE_CONFIRMATION",
      confirmation_diagnosis: "CONFIRMED_SINGLE_CANDIDATE",
      visible_memory_count: 1,
      referenced_orb_message_id: "orb-1",
      candidate_memory_id: "A",
    });
  });
  it("B: Ja. + two → AMBIGUOUS, no candidate id", () => {
    const d = confirmationTurnDiagnostic("Ja.", ref(["A", "B"]));
    expect(d.confirmation_diagnosis).toBe("AMBIGUOUS_CANDIDATE");
    expect(d.candidate_memory_id).toBeNull();
    expect(d.visible_memory_count).toBe(2);
  });
  it("C: Ja. + none → NONE", () => {
    expect(confirmationTurnDiagnostic("Ja.", ref([])).confirmation_diagnosis).toBe("NONE");
    expect(confirmationTurnDiagnostic("Ja.", ref(null)).confirmation_diagnosis).toBe("NONE");
  });
  it("D: invalid/missing C1 reference → NONE (ids ignored)", () => {
    expect(confirmationTurnDiagnostic("Ja.", ref(["A"], null)).confirmation_diagnosis).toBe("NONE");
    expect(confirmationTurnDiagnostic("Ja.", ref(["A"], null)).visible_memory_count).toBe(0);
    expect(confirmationTurnDiagnostic("Ja.", null).confirmation_diagnosis).toBe("NONE");
  });
  it("E/F: Stimmt / Das stimmt → diagnosed", () => {
    for (const t of ["Stimmt", "Das stimmt"]) {
      expect(confirmationTurnDiagnostic(t, ref(["A"])).confirmation_diagnosis).toBe(
        "CONFIRMED_SINGLE_CANDIDATE",
      );
    }
    // Learning path unchanged
    expect(isStorableStatement("Stimmt")).toBe(true);
    expect(isStorableStatement("Das stimmt")).toBe(true);
  });
  it("G/H: content sentences → no diagnosis", () => {
    for (const t of ["Ja, ich bin Koch.", "Stimmt, ich bin Koch."]) {
      const d = confirmationTurnDiagnostic(t, ref(["A"]));
      expect(d.confirmation_signal).toBe("NONE");
      expect(d.confirmation_diagnosis).toBe("NONE");
      expect(d.candidate_memory_id).toBeNull();
    }
  });
  it("I: Das stimmt nicht → not positive; correction unchanged", () => {
    const d = confirmationTurnDiagnostic("Das stimmt nicht.", ref(["A"]));
    expect(d.confirmation_signal).toBe("NONE");
    expect(isCorrection("Das stimmt nicht.")).toBe(true);
  });
  it("J: inputs (memory state proxy) not mutated", () => {
    const mem = {
      id: "A",
      activation_count: 3,
      importance: 0.5,
      safety: 1,
      last_accessed_at: "x",
      text: "t",
    };
    const snap = JSON.stringify(mem);
    const r = ref([mem.id]);
    const rs = JSON.stringify(r);
    confirmationTurnDiagnostic("Ja.", r);
    expect(JSON.stringify(mem)).toBe(snap);
    expect(JSON.stringify(r)).toBe(rs);
  });
  it("K/L: no DB/fetch; engine wiring is log-only", () => {
    const f = vi.spyOn(globalThis, "fetch");
    confirmationTurnDiagnostic("Ja.", ref(["A"]));
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
    const src = readFileSync("src/orb-core/confirmation-signal.ts", "utf8");
    expect(src).not.toMatch(/\.from\(|\.insert\(|\.update\(|fetch\(/);
    const eng = readFileSync("src/orb-core/engine.server.ts", "utf8");
    const i = eng.indexOf("P5-B3");
    expect(i).toBeGreaterThan(0);
    const block = eng.slice(i, eng.indexOf("const state = toState", i));
    expect(block).not.toMatch(/db\.|insert|update|fetch|speak|applyFeedback/);
    expect(block).not.toMatch(/\btext:/);
    expect(eng).toContain("confirmationDiag");
  });
});
