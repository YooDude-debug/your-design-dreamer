/**
 * Globale Gesprächsautonomie: eigene ORB-Fragen in allen Chat-Bereichen,
 * strikt gebunden an Benutzer + Bereich. Keine echte DB, kein Modellaufruf.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { scopedDb } from "@/orb-core/scope";
import { askProactively, type DB } from "@/orb-core/engine.server";
import { finalAutonomyGate, AUTONOMY_MIN_ENERGY } from "@/orb-core/autonomy";
import { recentlyAskedMemoryIds, QUESTION_MEMORY_LOCK_MS } from "@/orb-core/curiosity";

type Call = { table: string; filters: [string, unknown][]; op: string };

/** Kettenfähiger Schein-Client: zeichnet Filter auf, liefert leere Daten. */
function fakeDb() {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, filters: [], op: "select" };
      calls.push(call);
      const result = () => {
        if (table === "orb_state") {
          return {
            data: {
              user_id: call.filters.find((f) => f[0] === "user_id")?.[1],
              energy: 0.9,
              curiosity: 1,
              joy: 0.5,
              trust: 0.5,
              frustration: 0,
              updated_at: new Date().toISOString(),
              goals: ["help_user"],
            },
            error: null,
          };
        }
        return { data: [], error: null };
      };
      const qb: Record<string, unknown> = {};
      const chain = () => qb;
      for (const m of ["select", "order", "limit", "gte", "gt", "or", "not", "in", "is", "neq"]) {
        qb[m] = chain;
      }
      qb["eq"] = (col: string, val: unknown) => {
        call.filters.push([col, val]);
        return qb;
      };
      qb["insert"] = () => {
        call.op = "insert";
        return qb;
      };
      qb["update"] = () => {
        call.op = "update";
        return qb;
      };
      qb["maybeSingle"] = () => Promise.resolve(result());
      qb["single"] = () => Promise.resolve(result());
      qb["then"] = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(result()).then(res, rej);
      return qb;
    },
    rpc() {
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as DB;
  return { db, calls };
}

const SCOPED = new Set(["orb_messages", "orb_nodes", "orb_connections", "orb_threads", "orb_questions", "orb_interests"]);

describe("Globale Gesprächsautonomie", () => {
  for (const scope of ["normal", "orb_core", "y_dude"] as const) {
    it(`${scope}: Prüfpfad läuft serverseitig, ohne Kontext bleibt ORB still`, async () => {
      const { db, calls } = fakeDb();
      const r = await askProactively(scopedDb(db, scope), "user-a");
      expect(r.asked).toBe(false);
      expect(r.attempt?.gate).toBe("no_candidate");
      expect(calls.some((c) => c.table === "orb_nodes")).toBe(true);
      // Keine Fragen, keine Nachrichten ohne Anknüpfungspunkt.
      expect(calls.filter((c) => c.op === "insert")).toEqual([]);
    });
  }

  it("unassigned und fehlende Bereichsbindung bleiben ohne Datenzugriff", async () => {
    for (const db0 of [scopedDb(fakeDb().db, "unassigned"), fakeDb().db]) {
      const r = await askProactively(db0, "user-a");
      expect(r.asked).toBe(false);
    }
  });

  it("zwei Benutzer: jede Abfrage ist an den eigenen Benutzer und Bereich gebunden", async () => {
    for (const [user, scope] of [
      ["user-a", "normal"],
      ["user-b", "y_dude"],
    ] as const) {
      const { db, calls } = fakeDb();
      await askProactively(scopedDb(db, scope), user);
      const relevant = calls.filter((c) => c.table.startsWith("orb_"));
      expect(relevant.length).toBeGreaterThan(0);
      for (const c of relevant) {
        expect(c.filters).toContainEqual(["user_id", user]);
        for (const [col, val] of c.filters) {
          if (col === "user_id") expect(val).toBe(user);
        }
        if (SCOPED.has(c.table)) expect(c.filters).toContainEqual(["scope", scope]);
      }
    }
  });

  it("7-Tage-Sperre bleibt pro Memory-ID", () => {
    const now = Date.now();
    const locked = recentlyAskedMemoryIds(
      [
        { memoryIds: ["m1"], askedAt: now - 60_000 },
        { memoryIds: ["m2"], askedAt: now - QUESTION_MEMORY_LOCK_MS - 1 },
      ],
      now,
    );
    expect(locked.has("m1")).toBe(true);
    expect(locked.has("m2")).toBe(false);
  });

  it("Energie-Gate bleibt wirksam", () => {
    const gate = finalAutonomyGate({
      energy: AUTONOMY_MIN_ENERGY - 0.01,
      curiosity: { action: "ASK", gap: { nodeId: "m1" }, reason: "r", score: 1 } as never,
      impulse: { action: "WAIT", impulse: null, suppressed: false, reason: "", candidates: [] } as never,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.gate).toBe("energy");
  });

  it("Idle-Trigger ist nicht mehr an orb_core gebunden", () => {
    const src = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");
    expect(src).toContain("enabled: Boolean(snapshot),");
    expect(src).not.toContain('scope === "orb_core"');
  });
});
