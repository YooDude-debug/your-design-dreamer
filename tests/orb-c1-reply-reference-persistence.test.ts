/**
 * C1: persistente Reply-Referenz in `state_snapshot` der USER-Zeile.
 * Nur Referenzierung – keine Confirmation-, Activation-, Importance-,
 * Safety- oder Memory-Wirkung.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPLY_REF_KEY, isUuid, userReplySnapshot } from "@/orb-core/reply-reference-snapshot";
import { resolveReplyReference } from "@/orb-core/memory-usage";
import { loadReplyReference } from "@/orb-core/turn-memory.server";

const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const replyRefClient = readFileSync("src/integrations/y-dude-orb/reply-ref.ts", "utf8");

const ORB_ID = "11111111-2222-4333-8444-555555555555";
const USER_MSG_ID = "99999999-2222-4333-8444-555555555555";

type Row = { id: string; role: string; created_at: string; state_snapshot?: unknown };

/** Minimaler DB-Doppelgänger: spiegelt die Filter id + user_id + role. */
function fakeDb(rows: Row[], owner: Record<string, string>) {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      calls.push(table);
      const filters: Record<string, string> = {};
      const q = {
        select: () => q,
        eq: (col: string, val: string) => {
          filters[col] = val;
          return q;
        },
        maybeSingle: async () => {
          const row = rows.find(
            (r) =>
              r.id === filters.id &&
              (filters.role === undefined || r.role === filters.role) &&
              (filters.user_id === undefined || owner[r.id] === filters.user_id),
          );
          return { data: row ?? null, error: null };
        },
      };
      return q;
    },
  };
}

const load = (db: unknown, id: string | undefined, userId = "u1") =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- schmaler DB-Doppelgänger
  loadReplyReference(db as any, userId, id);

describe("C1 – Speicherort und Format", () => {
  it("A) gültige, serverseitig bestätigte Reply-ID wird gespeichert", async () => {
    const db = fakeDb([{ id: ORB_ID, role: "orb", created_at: "t1" }], { [ORB_ID]: "u1" });
    const ref = await load(db, ORB_ID);
    expect(ref.referencedOrbTurnId).toBe(ORB_ID);
    expect(userReplySnapshot(ref)).toEqual({ reply_to_orb_message_id: ORB_ID });
  });

  it("B) keine Reply-ID → state_snapshot bleibt leer", async () => {
    const db = fakeDb([], {});
    const ref = await load(db, undefined);
    expect(db.calls).toEqual([]);
    expect(userReplySnapshot(ref)).toEqual({});
    expect(userReplySnapshot(null)).toEqual({});
    expect(userReplySnapshot(undefined)).toEqual({});
  });

  it("C) ungültige UUID wird nicht gespeichert", async () => {
    const db = fakeDb([{ id: "nicht-uuid", role: "orb", created_at: "t1" }], {
      "nicht-uuid": "u1",
    });
    const ref = await load(db, "nicht-uuid");
    expect(userReplySnapshot(ref)).toEqual({});
    expect(isUuid("nicht-uuid")).toBe(false);
    expect(isUuid(ORB_ID)).toBe(true);
  });

  it("D) ID einer User-Nachricht wird nicht gespeichert", async () => {
    const db = fakeDb([{ id: USER_MSG_ID, role: "user", created_at: "t1" }], {
      [USER_MSG_ID]: "u1",
    });
    const ref = await load(db, USER_MSG_ID);
    expect(ref.referencedOrbTurnId).toBeNull();
    expect(userReplySnapshot(ref)).toEqual({});
  });

  it("E) ORB-Turn eines anderen Users wird nicht gespeichert", async () => {
    const db = fakeDb([{ id: ORB_ID, role: "orb", created_at: "t1" }], { [ORB_ID]: "u2" });
    const ref = await load(db, ORB_ID);
    expect(ref.referencedOrbTurnId).toBeNull();
    expect(userReplySnapshot(ref)).toEqual({});
  });

  it("F) nicht existierende ID wird nicht gespeichert", async () => {
    const db = fakeDb([], {});
    const ref = await load(db, ORB_ID);
    expect(ref.referencedOrbTurnId).toBeNull();
    expect(userReplySnapshot(ref)).toEqual({});
  });

  it("nur bestätigte IDs: eine gemeldete, aber unbestätigte ID wird verworfen", () => {
    expect(userReplySnapshot(resolveReplyReference(ORB_ID, null))).toEqual({});
  });

  it("J) Snapshot enthält ausschliesslich das technische Referenzfeld", async () => {
    const db = fakeDb([{ id: ORB_ID, role: "orb", created_at: "t1" }], { [ORB_ID]: "u1" });
    const snap = userReplySnapshot(await load(db, ORB_ID));
    expect(Object.keys(snap)).toEqual([REPLY_REF_KEY]);
    expect(Object.values(snap).every(isUuid)).toBe(true);
  });
});

describe("C1 – Einbau im Engine-Quelltext", () => {
  it("die USER-Zeile erhält den Snapshot beim bestehenden Insert", () => {
    expect(engine).toContain("state_snapshot: userReplySnapshot(replyReference)");
  });

  it("H) es gibt weiterhin genau einen orb_messages-Insert", () => {
    expect(engine.match(/from\("orb_messages"\)\s*\.insert/g)?.length ?? 0).toBe(1);
  });

  it("die ORB-Zeile bleibt unverändert (kein Reply-Feld dort)", () => {
    expect(engine).not.toContain(`[${REPLY_REF_KEY}]`);
    expect(engine).not.toContain("reply_to_orb_message_id:");
  });

  it("I) keine Memory-, Activation-, Importance- oder Safety-Wirkung im C1-Modul", () => {
    const mod = readFileSync("src/orb-core/reply-reference-snapshot.ts", "utf8");
    for (const forbidden of [
      "activation",
      "importance",
      "safety",
      "orb_nodes",
      "update(",
      "insert(",
      "confirm",
    ]) {
      expect(mod.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("G) der Runtime-ReplyReference-Mechanismus bleibt unverändert", () => {
    expect(replyRefClient).toContain("export function lastOrbMessageId");
    expect(replyRefClient).toContain("export function createSendGate");
    expect(engine).toContain("loadReplyReference(db, userId, options.replyToOrbMessageId)");
  });
});
