/* eslint-disable @typescript-eslint/no-explicit-any -- Fake-DB-Builder im Test */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { confirmationTurnDiagnostic } from "@/orb-core/confirmation-signal";
import {
  confirmationEffectTarget,
  applyConfirmationEffect,
  type ConfirmationEffect,
} from "@/orb-core/confirmation-effect";
import { suppressLearningForConfirmation } from "@/orb-core/confirmation-learning-gate";
import { isStorableStatement, isCorrection } from "@/orb-core/eligibility";

const U = "u1";
const NOW = Date.parse("2026-09-25T08:00:00.000Z");
type Row = Record<string, any>;
const mkRows = (): Row[] =>
  ["A", "B"].map((id) => ({
    id,
    user_id: U,
    activation_count: 3,
    last_accessed_at: "2026-01-01T00:00:00.000Z",
    importance: 0.5,
    safety: 0.7,
    confidence: 0.6,
    content: `text ${id}`,
    norm_key: `k${id}`,
  }));

function fakeDb(rows: Row[], o: { failUpdate?: boolean; concurrent?: boolean } = {}) {
  const from = () => {
    const f: Record<string, unknown> = {};
    let patch: Row | null = null;
    let ins: Row | null = null;
    const match = () => rows.filter((r) => Object.entries(f).every(([k, v]) => r[k] === v));
    const b: any = {
      select: () => b,
      update: (p: Row) => {
        patch = p;
        if (o.concurrent) rows[0].activation_count = 99;
        return b;
      },
      insert: (r: Row) => {
        ins = r;
        return b;
      },
      eq: (k: string, v: unknown) => {
        f[k] = v;
        return b;
      },
      maybeSingle: () =>
        Promise.resolve({ data: match()[0] ? { ...match()[0] } : null, error: null }),
      then: (res: (v: unknown) => void) => {
        if (ins) {
          rows.push({ id: `new${rows.length}`, ...ins });
          return res({ data: { id: "n" }, error: null });
        }
        if (patch) {
          if (o.failUpdate) return res({ data: null, error: { message: "x" } });
          const m = match();
          m.forEach((r) => Object.assign(r, patch));
          return res({ data: m.map((r) => ({ id: r.id })), error: null });
        }
        return res({ data: match(), error: null });
      },
    };
    return b;
  };
  return { from };
}

/** Nachbildung der Engine-Reihenfolge: B4 → Block 2 (Speicher-Gate aus der Engine). */
async function turn(text: string, ref: any, o = {}, persistCriteria = true) {
  const rows = mkRows();
  const before = JSON.parse(JSON.stringify(rows));
  const db = fakeDb(rows, o);
  const diag = confirmationTurnDiagnostic(text, ref);
  const target = confirmationEffectTarget(diag, new Set());
  let effect: ConfirmationEffect = "NONE";
  if (target) effect = await applyConfirmationEffect(db, U, target, NOW);
  const stored =
    !suppressLearningForConfirmation(effect) && isStorableStatement(text) && persistCriteria;
  if (stored) await db.from().insert({ user_id: U, content: text });
  return { rows, before, effect, stored };
}
const C1 = (ids: string[] | null, id: string | null = "orb-1") => ({
  referencedOrbTurnId: id,
  referencedModelVisibleMemoryIds: ids,
});

function onlyAPlusOne(rows: Row[], before: Row[]) {
  expect(rows.length).toBe(before.length); // keine neue Memory
  expect(rows[0].activation_count).toBe(before[0].activation_count + 1);
  expect(rows[0].last_accessed_at).toBe(new Date(NOW).toISOString());
  const strip = ({ activation_count: _a, last_accessed_at: _l, ...r }: Row) => r;
  expect(strip(rows[0])).toEqual(strip(before[0]));
  expect(rows[1]).toEqual(before[1]);
}

describe("P5-B5 – bestätigte reine Zustimmung nicht als neue Memory", () => {
  it.each(["Stimmt.", "Richtig.", "Das stimmt."])(
    "A/B/C: %s + B4 → +1, keine neue Memory",
    async (t) => {
      expect(isStorableStatement(t)).toBe(true); // Learning hätte gespeichert
      const r = await turn(t, C1(["A"]));
      expect(r.effect).toBe("ACTIVATED_SINGLE");
      expect(r.stored).toBe(false);
      onlyAPlusOne(r.rows, r.before);
    },
  );
  it.each(["Ja.", "Ja, genau."])("D/E: %s + B4 → keine neue Memory", async (t) => {
    const r = await turn(t, C1(["A"]));
    expect(r.effect).toBe("ACTIVATED_SINGLE");
    expect(r.stored).toBe(false);
    onlyAPlusOne(r.rows, r.before);
  });
  it.each([
    "Stimmt, ich bin Koch.",
    "Richtig, ich arbeite als Koch.",
    "Das stimmt, ich arbeite dort.",
    "Genau die RTX.",
  ])("F–I: %s → Learning unverändert, keine B4-Wirkung", async (t) => {
    const r = await turn(t, C1(["A"]));
    expect(r.effect).toBe("NONE");
    expect(suppressLearningForConfirmation(r.effect)).toBe(false);
    expect(r.stored).toBe(isStorableStatement(t));
    expect(r.rows.slice(0, 2)).toEqual(r.before);
  });
  it("J: Das stimmt nicht → Correction unverändert, keine Unterdrückung", async () => {
    expect(isCorrection("Das stimmt nicht.")).toBe(true);
    const r = await turn("Das stimmt nicht.", C1(["A"]));
    expect(r.effect).toBe("NONE");
    expect(r.rows.slice(0, 2)).toEqual(r.before);
  });
  it("K: Stimmt. ohne C1 → keine Unterdrückung (bisheriger Pfad)", async () => {
    for (const ref of [null, C1(["A"], null)]) {
      const r = await turn("Stimmt.", ref);
      expect(r.effect).toBe("NONE");
      expect(r.stored).toBe(true);
    }
  });
  it("L: Stimmt. + AMBIGUOUS → keine Wirkung, keine Unterdrückung", async () => {
    const r = await turn("Stimmt.", C1(["A", "B"]));
    expect(r.effect).toBe("NONE");
    expect(r.stored).toBe(true);
    expect(r.rows.slice(0, 2)).toEqual(r.before);
  });
  it("M: B4-Update schlägt fehl → keine Unterdrückung", async () => {
    const r = await turn("Stimmt.", C1(["A"]), { failUpdate: true });
    expect(r.effect).toBe("NONE");
    expect(r.stored).toBe(true);
    expect(r.rows.slice(0, 2)).toEqual(r.before);
  });
  it("N: Concurrent-Update → B4 erfolglos → keine Unterdrückung", async () => {
    const r = await turn("Stimmt.", C1(["A"]), { concurrent: true });
    expect(r.effect).toBe("NONE");
    expect(r.stored).toBe(true);
  });
  it("D2: ungültige ID → keine Unterdrückung", async () => {
    const r = await turn("Stimmt.", C1(["ZZZ"]));
    expect(r.effect).toBe("NONE");
    expect(r.stored).toBe(true);
  });
  it("O: Gate = ausschliesslich ACTIVATED_SINGLE", () => {
    expect(suppressLearningForConfirmation("ACTIVATED_SINGLE")).toBe(true);
    expect(suppressLearningForConfirmation("NONE")).toBe(false);
  });
  it("Engine: Gate sitzt nur im Neu-Speicher-Zweig von Block 2", () => {
    const eng = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(eng.match(/suppressLearningForConfirmation\(/g)?.length).toBe(2); // Gate + Log
    const gate = eng.indexOf("!suppressLearningForConfirmation(confirmationEffect) &&");
    const elseIf = eng.lastIndexOf("} else if (", gate);
    expect(gate - elseIf).toBeLessThan(150);
    expect(eng.indexOf("isStorableStatement(memoryText) &&", gate) - gate).toBeLessThan(80);
    // Wirkung (B4) liegt vor dem Gate
    expect(eng.indexOf("applyConfirmationEffect(db")).toBeLessThan(gate);
    expect(eng.indexOf("let confirmationEffect")).toBeLessThan(
      eng.indexOf("if (confirmationDiag) {"),
    );
  });
});
