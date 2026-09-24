import { describe, it, expect } from "vitest";
import {
  traceMemoryUsage,
  turnVisibleMemoryIds,
  readTurnMemoryRef,
  findPreviousOrbTurn,
  TURN_VISIBLE_IDS_KEY,
} from "@/orb-core/memory-usage";

const ok = { status: "ok", fallbackUsed: false };
const ids = (r: string[], v: { id: string | null }[], called = true, a: any = ok) =>
  turnVisibleMemoryIds(traceMemoryUsage(r, v, called), a);
const row = (id: string, role: string, t: string, snap: any = {}) => ({
  id, role, created_at: t, state_snapshot: snap,
});

describe("P5-C Turn → model-visible Memory-IDs", () => {
  it("1 Turn → sichtbare ID", () => expect(ids(["A"], [{ id: "A" }])).toEqual(["A"]));
  it("2 mehrere IDs", () => expect(ids(["A", "B"], [{ id: "A" }, { id: "B" }])).toEqual(["A", "B"]));
  it("3 P2 V2 entfernt B", () =>
    expect(ids(["A", "B", "C"], [{ id: "A" }, { id: "C" }])).toEqual(["A", "C"]));
  it("4 identischer Text, unterschiedliche IDs", () =>
    expect(ids(["X", "Y"], [{ id: "X", content: "t" } as any, { id: "Y", content: "t" } as any])).toEqual(["X", "Y"]));
  it("5 LISTEN / 6 kein Modellaufruf", () => expect(ids(["A"], [], false)).toEqual([]));
  it("6b sichtbare Liste ohne Modellaufruf wird nicht zugeordnet", () =>
    expect(ids(["A"], [{ id: "A" }], false)).toEqual([]));
  it("7 Modellfehler / Fallback", () => {
    expect(ids(["A"], [{ id: "A" }], true, { status: "error" })).toEqual([]);
    expect(ids(["A"], [{ id: "A" }], true, { status: "ok", fallbackUsed: true })).toEqual([]);
  });
  it("7b Messung fehlt", () => {
    expect(turnVisibleMemoryIds(null, ok)).toEqual([]);
    expect(turnVisibleMemoryIds(traceMemoryUsage([], [{ id: "A" }], true), null)).toEqual([]);
  });
  it("keine Memory / Modellaufruf ohne Memory", () => expect(ids([], [])).toEqual([]));
  it("null-IDs werden nie gespeichert", () => expect(ids([], [{ id: null }])).toEqual([]));

  const rows = [
    row("u1", "user", "2026-09-24T10:00:00.000Z"),
    row("o1", "orb", "2026-09-24T10:00:00.001Z", { [TURN_VISIBLE_IDS_KEY]: ["A", "B"] }),
    row("u2", "user", "2026-09-24T10:01:00.000Z"),
    row("o2", "orb", "2026-09-24T10:01:00.001Z", { [TURN_VISIBLE_IDS_KEY]: ["C"] }),
    row("u3", "user", "2026-09-24T10:02:00.000Z"),
  ];
  it("8 vorheriger Turn auffindbar", () =>
    expect(findPreviousOrbTurn(rows, "2026-09-24T10:02:00.000Z")).toMatchObject({ turnId: "o2", modelVisibleMemoryIds: ["C"] }));
  it("9 keine falsche Zuordnung zwischen Turns", () =>
    expect(findPreviousOrbTurn(rows, "2026-09-24T10:01:00.000Z")).toMatchObject({ turnId: "o1", modelVisibleMemoryIds: ["A", "B"] }));
  it("10 mehrere Turns hintereinander", () => {
    expect(findPreviousOrbTurn(rows)?.turnId).toBe("o2");
    expect(findPreviousOrbTurn(rows, "2026-09-24T10:00:00.000Z")).toBeNull();
  });
  it("alter Turn ohne Tracking → null, nicht []", () =>
    expect(readTurnMemoryRef(row("o0", "orb", "t", { recalled: 3 }))?.modelVisibleMemoryIds).toBeNull());
  it("User-Zeile ist kein ORB-Turn", () => expect(readTurnMemoryRef(row("u", "user", "t"))).toBeNull());
});
