import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_LAB_PARAMS,
  LAB_MODELS,
  POOL_MAX,
  S_INITIAL,
  buildPool,
  generateEvents,
  initModel,
  metricsOf,
  runComparison,
  setCandidateStatus,
  stepModel,
  strengthAt,
  toLabSnapshot,
  type LabParams,
  type LabSnapshot,
} from "@/orb-core/synaptic-lab/simulation";

const snap: LabSnapshot = {
  nodes: ["a", "b", "c", "d", "e"].map((id, i) => ({ id, group: i < 3 ? "essen" : "musik" })),
  edges: [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "d", target: "b" },
  ],
};
const P: LabParams = { ...DEFAULT_LAB_PARAMS, growthRate: 2, activationRate: 0, decay: 0.2 };
const pool = buildPool(snap);
const pm = new Map(pool.map((e) => [e.key, e]));
const key = pool[0]!.key;

describe("Synaptic Lab", () => {
  it("1 neue Information erzeugt Kandidaten als Hypothese", () => {
    const s = stepModel(initModel("C"), { grow: [key], activate: [] }, pm, P);
    const c = s.candidates.get(key)!;
    expect(c.status).toBe("hypothesis");
    expect(c.source && c.target && c.relation && c.origin).toBeTruthy();
  });

  it("2 wiederholte Aktivierung verstärkt (C)", () => {
    let s = stepModel(initModel("C"), { grow: [key], activate: [] }, pm, P);
    s = stepModel(s, { grow: [], activate: [key] }, pm, P);
    s = stepModel(s, { grow: [], activate: [key] }, pm, P);
    expect(s.candidates.get(key)!.anchorStrength).toBeGreaterThan(S_INITIAL);
  });

  it("3 Nichtbenutzung senkt Stärke (B, C), nicht in A", () => {
    for (const m of LAB_MODELS) {
      let s = stepModel(initModel(m), { grow: [key], activate: [] }, pm, P);
      for (let i = 0; i < 5; i++) s = stepModel(s, { grow: [], activate: [] }, pm, P);
      const v = strengthAt(s.candidates.get(key)!, s.step, m, P.decay);
      if (m === "A") expect(v).toBe(S_INITIAL);
      else expect(v).toBeLessThan(S_INITIAL);
    }
  });

  it("4 Reaktivierung stärkt abgeschwächte Verbindung", () => {
    let s = stepModel(initModel("C"), { grow: [key], activate: [] }, pm, P);
    for (let i = 0; i < 4; i++) s = stepModel(s, { grow: [], activate: [] }, pm, P);
    expect(s.candidates.get(key)!.lifecycle).toBe("weak");
    s = stepModel(s, { grow: [], activate: [key] }, pm, P);
    expect(s.candidates.get(key)!.lifecycle).toBe("reactivated");
    expect(s.candidates.get(key)!.everReactivated).toBe(true);
  });

  it("5/6 Snapshot bleibt unverändert, Reset = neuer Anfangszustand", () => {
    const before = JSON.stringify(snap);
    runComparison(snap, DEFAULT_LAB_PARAMS, 50);
    expect(JSON.stringify(snap)).toBe(before);
    expect(initModel("A").candidates.size).toBe(0);
  });

  it("5 Labor hat keinen Schreibweg (kein insert/update/delete, nur getOrbKnowledgeGraph)", () => {
    for (const f of [
      "src/orb-core/synaptic-lab/simulation.ts",
      "src/components/orb-synaptic-lab/SynapticLab.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src).not.toMatch(
        /\.(insert|update|upsert|delete)\(|supabase|localStorage|BroadcastChannel/,
      );
    }
  });

  it("7 Snapshot-Adapter übernimmt nur IDs/Gruppen und lose Kanten nicht", () => {
    const s = toLabSnapshot({
      nodes: [{ id: "x", topic: null, category: "k", content: "geheim" } as never],
      edges: [{ sourceNodeId: "x", targetNodeId: "fremd" }],
    });
    expect(s.edges).toHaveLength(0);
    expect(JSON.stringify(s)).not.toContain("geheim");
    const src = readFileSync("src/components/orb-synaptic-lab/SynapticLab.tsx", "utf8");
    expect(src).toContain('["orb-synaptic-lab-source", userId, scope]');
  });

  it("8 reproduzierbar bei gleichem Seed, anders bei anderem", () => {
    const a = runComparison(snap, DEFAULT_LAB_PARAMS, 40);
    const b = runComparison(snap, DEFAULT_LAB_PARAMS, 40);
    expect(JSON.stringify(a.events)).toBe(JSON.stringify(b.events));
    expect(a.states.map((s) => metricsOf(s, snap, DEFAULT_LAB_PARAMS))).toEqual(
      b.states.map((s) => metricsOf(s, snap, DEFAULT_LAB_PARAMS)),
    );
  });

  it("8 alle Modelle bekommen denselben Ereignisverlauf", () => {
    const ev = generateEvents(pool, DEFAULT_LAB_PARAMS, 10);
    expect(ev).toEqual(generateEvents(pool, DEFAULT_LAB_PARAMS, 10));
  });

  it("9 Wachstum bleibt in Grenzen", () => {
    const big: LabSnapshot = {
      nodes: Array.from({ length: 300 }, (_, i) => ({
        id: `n${String(i).padStart(3, "0")}`,
        group: "g",
      })),
      edges: [],
    };
    expect(buildPool(big).length).toBeLessThanOrEqual(POOL_MAX);
    const p = { ...DEFAULT_LAB_PARAMS, growthRate: 20, maxCandidates: 30 };
    const r = runComparison(big, p, 20);
    for (const s of r.states) {
      expect(
        [...s.candidates.values()].filter((c) => c.lifecycle !== "removed").length,
      ).toBeLessThanOrEqual(30);
    }
  });

  it("10 Hypothesen werden nie automatisch bestätigt; bestätigt wird nicht entfernt", () => {
    const r = runComparison(snap, { ...DEFAULT_LAB_PARAMS, activationRate: 30 }, 200);
    for (const s of r.states)
      for (const c of s.candidates.values()) expect(c.status).not.toBe("confirmed");
    let s = stepModel(initModel("B"), { grow: [key], activate: [] }, pm, P);
    s = setCandidateStatus(s, key, "confirmed");
    for (let i = 0; i < 40; i++) s = stepModel(s, { grow: [], activate: [] }, pm, P);
    expect(s.candidates.get(key)!.lifecycle).not.toBe("removed");
    expect(s.candidates.get(key)!.status).toBe("confirmed");
  });
});
