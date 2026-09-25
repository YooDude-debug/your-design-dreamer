import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { confirmationTurnDiagnostic } from "@/orb-core/confirmation-signal";
import { confirmationEffectTarget, applyConfirmationEffect } from "@/orb-core/confirmation-effect";

type Row = {
  id: string; user_id: string; activation_count: number; last_accessed_at: string;
  importance: number; safety: number; confidence: number; content: string; norm_key: string | null;
};
const U = "u1";
function mkRows(): Row[] {
  return ["A", "B", "C"].map((id) => ({
    id, user_id: U, activation_count: 3, last_accessed_at: "2026-01-01T00:00:00.000Z",
    importance: 0.5, safety: 0.7, confidence: 0.6, content: `text ${id}`, norm_key: `k${id}`,
  }));
}
/** Minimaler Fake-DB: Filter eq, select/maybeSingle, update. Zählt Aufrufe. */
function fakeDb(rows: Row[], opts: { failUpdate?: boolean } = {}) {
  const calls = { select: 0, update: 0, insert: 0, delete: 0 };
  const from = (t: string) => {
    expect(t).toBe("orb_nodes");
    const f: Record<string, unknown> = {};
    let patch: Partial<Row> | null = null;
    const match = () => rows.filter((r) => Object.entries(f).every(([k, v]) => (r as never)[k] === v));
    const b: any = {
      select: () => { if (!patch) calls.select++; return b; },
      update: (p: Partial<Row>) => { calls.update++; patch = p; return b; },
      insert: () => { calls.insert++; return b; },
      delete: () => { calls.delete++; return b; },
      eq: (k: string, v: unknown) => { f[k] = v; return b; },
      maybeSingle: () => Promise.resolve({ data: match()[0] ?? null, error: null }),
      then: (res: (v: unknown) => void) => {
        if (patch) {
          if (opts.failUpdate) return res({ data: null, error: { message: "boom" } });
          const m = match();
          m.forEach((r) => Object.assign(r, patch));
          return res({ data: m.map((r) => ({ id: r.id })), error: null });
        }
        return res({ data: match(), error: null });
      },
    };
    return b;
  };
  return { db: { from }, calls };
}
const ref = (ids: string[] | null, id: string | null = "orb-1") => ({
  referencedOrbTurnId: id, referencedModelVisibleMemoryIds: ids,
});
const NOW = Date.parse("2026-09-25T08:00:00.000Z");

async function run(text: string, r: ReturnType<typeof ref> | null, already = new Set<string>(), o = {}) {
  const rows = mkRows();
  const before = JSON.parse(JSON.stringify(rows));
  const { db, calls } = fakeDb(rows, o);
  const diag = confirmationTurnDiagnostic(text, r);
  const target = confirmationEffectTarget(diag, already);
  const effect = target ? await applyConfirmationEffect(db, U, target, NOW) : "NONE";
  return { rows, before, calls, diag, effect };
}
function unchangedExcept(rows: Row[], before: Row[], id: string | null) {
  rows.forEach((r, i) => {
    const b = before[i];
    if (r.id === id) {
      expect(r.activation_count).toBe(b.activation_count + 1);
      expect(r.last_accessed_at).toBe(new Date(NOW).toISOString());
      const { activation_count: _a, last_accessed_at: _l, ...rest } = r;
      const { activation_count: _a2, last_accessed_at: _l2, ...restB } = b;
      expect(rest).toEqual(restB); // J K L M: safety/importance/content/norm_key/confidence
    } else expect(r).toEqual(b);
  });
  expect(rows.length).toBe(before.length); // P
}

describe("P5-B4 confirmation effect", () => {
  it("A: Ja. + C1 + [A] → +1 only A", async () => {
    const r = await run("Ja.", ref(["A"]));
    expect(r.diag.confirmation_diagnosis).toBe("CONFIRMED_SINGLE_CANDIDATE");
    expect(r.effect).toBe("ACTIVATED_SINGLE");
    unchangedExcept(r.rows, r.before, "A");
    expect(r.calls.update).toBe(1);
  });
  it("B: [A,B] → AMBIGUOUS, nothing changes", async () => {
    const r = await run("Ja.", ref(["A", "B"]));
    expect(r.diag.confirmation_diagnosis).toBe("AMBIGUOUS_CANDIDATE");
    expect(r.effect).toBe("NONE");
    unchangedExcept(r.rows, r.before, null);
    expect(r.calls).toEqual({ select: 0, update: 0, insert: 0, delete: 0 });
  });
  it("C: without C1 → NONE", async () => {
    for (const x of [null, ref(["A"], null)]) {
      const r = await run("Ja.", x);
      expect(r.effect).toBe("NONE");
      unchangedExcept(r.rows, r.before, null);
      expect(r.calls.update).toBe(0);
    }
  });
  it("D: unknown / foreign id → NONE, no update", async () => {
    const r = await run("Ja.", ref(["ZZZ"]));
    expect(r.effect).toBe("NONE");
    expect(r.calls.update).toBe(0);
    unchangedExcept(r.rows, r.before, null);
    // foreign user's memory
    const rows = mkRows(); rows[0].user_id = "other";
    const { db, calls } = fakeDb(rows);
    expect(await applyConfirmationEffect(db, U, "A", NOW)).toBe("NONE");
    expect(calls.update).toBe(0);
  });
  it("E/F: Stimmt. / Das stimmt. → A +1", async () => {
    for (const t of ["Stimmt.", "Das stimmt."]) {
      const r = await run(t, ref(["A"]));
      expect(r.effect).toBe("ACTIVATED_SINGLE");
      unchangedExcept(r.rows, r.before, "A");
    }
  });
  it("G/H/I + content sentences: no effect", async () => {
    for (const t of ["Ja, ich bin Koch.", "Stimmt, ich bin Koch.", "Das stimmt nicht.", "Genau die RTX.",
      "Richtig, ich arbeite als Koch.", "Ja, das stimmt, ich arbeite dort."]) {
      const r = await run(t, ref(["A"]));
      expect(r.effect).toBe("NONE");
      unchangedExcept(r.rows, r.before, null);
      expect(r.calls.update).toBe(0);
    }
  });
  it("O: already activated in recall/exact → no second activation", async () => {
    const r = await run("Ja.", ref(["A"]), new Set(["A"]));
    expect(r.effect).toBe("NONE");
    expect(r.calls.update).toBe(0);
    unchangedExcept(r.rows, r.before, null);
  });
  it("O2: concurrent change of activation_count → guarded, never +2", async () => {
    const rows = mkRows();
    const { db } = fakeDb(rows);
    const wrapped = { from: (t: string) => { const b = db.from(t); const orig = b.update;
      b.update = (p: any) => { rows[0].activation_count = 9; return orig(p); }; return b; } };
    expect(await applyConfirmationEffect(wrapped, U, "A", NOW)).toBe("NONE");
    expect(rows[0].activation_count).toBe(9);
  });
  it("S: update failure → NONE, no partial effect", async () => {
    const r = await run("Ja.", ref(["A"]), new Set(), { failUpdate: true });
    expect(r.effect).toBe("NONE");
    unchangedExcept(r.rows, r.before, null);
  });
  it("Q/R: no fetch, no model, no analysis; update patch only 2 fields", () => {
    const f = vi.spyOn(globalThis, "fetch");
    confirmationEffectTarget(confirmationTurnDiagnostic("Ja.", ref(["A"])), new Set());
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
    const src = readFileSync("src/orb-core/confirmation-effect.ts", "utf8");
    expect(src).not.toMatch(/fetch\(|gateway|analy[sz]e|insert\(|delete\(|safety:|importance:|content:|norm_key:/);
    const eng = readFileSync("src/orb-core/engine.server.ts", "utf8");
    const i = eng.indexOf("P5-B4:");
    const block = eng.slice(i, eng.indexOf("// 1b.", i));
    expect(block).toContain("activationExcluded");
    expect(block).toContain("exact.id");
    expect(block).not.toMatch(/speak|fetch|applyFeedback|runBackground|analy[sz]e\(/);
    // log without text/content
    expect(block).not.toMatch(/\btext\b|content/);
  });
});
