/**
 * touchConnection – paralleles Anlegen (23505). Isolierter Mock, keine echte DB.
 * Live-Parallelität gegen die Datenbank ist bewusst NICHT getestet.
 */
import { describe, expect, it } from "vitest";

import { QueryCounter, touchConnection, type DB } from "@/orb-core/engine.server";
import { scopedDb } from "@/orb-core/scope";

type Row = Record<string, unknown>;
type Opts = { insertError?: { code: string; message: string }; onInsert?: (rows: Row[]) => void };

function mockDb(rows: Row[], opts: Opts = {}) {
  const calls = { inserts: 0, updates: 0, selects: 0 };
  const from = (_table: string) => {
    const filters: [string, unknown][] = [];
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const chain: Record<string, unknown> = {
      eq(k: string, v: unknown) {
        filters.push([k, v]);
        return chain;
      },
      maybeSingle() {
        calls.selects += 1;
        const m = match();
        return Promise.resolve({ data: m[0] ?? null, error: null });
      },
      then(res: (v: unknown) => unknown) {
        return Promise.resolve({ data: null, error: null }).then(res);
      },
    };
    return {
      select: () => chain,
      update: () => {
        calls.updates += 1;
        return chain;
      },
      delete: () => chain,
      upsert: () => Promise.resolve({ data: null, error: null }),
      insert: (row: Row) => {
        calls.inserts += 1;
        if (opts.insertError) {
          opts.onInsert?.(rows);
          return Promise.resolve({ data: null, error: opts.insertError });
        }
        rows.push({ id: `c${rows.length + 1}`, ...row });
        return Promise.resolve({ data: null, error: null });
      },
    };
  };
  return { db: { from } as unknown as DB, calls };
}

const U = "user-a";
const INPUT = { delta: 0.1, importance: 0.5, decayRate: 0.02, origin: "test" };
const conn = (o: Row = {}): Row => ({
  id: "c1",
  user_id: U,
  scope: "normal",
  source_node_id: "s",
  target_node_id: "t",
  weight: 0.5,
  importance: 0.5,
  decay_rate: 0.02,
  activation_count: 1,
  last_activated_at: new Date(0).toISOString(),
  metadata: {},
  ...o,
});
const DUP = { code: "23505", message: "duplicate key" };
const run = (db: DB) =>
  touchConnection(scopedDb(db, "normal"), U, "s", "t", INPUT, new QueryCounter(), Date.now());

describe("touchConnection – 23505-Rennen", () => {
  it("T1 normales Anlegen: genau eine Connection", async () => {
    const rows: Row[] = [];
    const { db } = mockDb(rows);
    expect(await run(db)).toBe("created");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: U, scope: "normal", activation_count: 1 });
  });

  it("T2 vorhandene Connection: Update, kein Insert", async () => {
    const rows = [conn()];
    const { db, calls } = mockDb(rows);
    expect(await run(db)).toBe("reactivated");
    expect(calls.inserts).toBe(0);
    expect(calls.updates).toBe(1);
  });

  it("T3 paralleler Insert: erneut lesen, kein Duplikat, kein zweites Update", async () => {
    const rows: Row[] = [];
    const { db, calls } = mockDb(rows, {
      insertError: DUP,
      onInsert: (r) => r.push(conn()), // Vorgang A hat inzwischen angelegt
    });
    expect(await run(db)).toBe("reactivated");
    expect(rows).toHaveLength(1);
    expect(calls.updates).toBe(0);
    expect(rows[0]!["activation_count"]).toBe(1);
  });

  it("T4 23505 ohne passende Connection: Fehler, kein Erfolg", async () => {
    const { db } = mockDb([], { insertError: DUP });
    await expect(run(db)).rejects.toThrow();
  });

  it("T5 fremder Benutzer wird beim erneuten Lesen nicht verwendet", async () => {
    const { db } = mockDb([], {
      insertError: DUP,
      onInsert: (r) => r.push(conn({ user_id: "b" })),
    });
    await expect(run(db)).rejects.toThrow();
  });

  it("T6 fremder Scope wird beim erneuten Lesen nicht verwendet", async () => {
    const { db } = mockDb([], {
      insertError: DUP,
      onInsert: (r) => r.push(conn({ scope: "orb_core" })),
    });
    await expect(run(db)).rejects.toThrow();
  });

  it("T7 andere DB-Fehler bleiben Fehler (kein Nachlesen)", async () => {
    const { db, calls } = mockDb([], {
      insertError: { code: "42501", message: "permission denied" },
      onInsert: (r) => r.push(conn()),
    });
    await expect(run(db)).rejects.toThrow();
    expect(calls.selects).toBe(1); // nur die erste Existenzprüfung
  });
});
