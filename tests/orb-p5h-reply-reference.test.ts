/* eslint-disable @typescript-eslint/no-explicit-any -- Test-Mocks */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { resolveReplyReference, TURN_VISIBLE_IDS_KEY } from "@/orb-core/memory-usage";
import { loadReplyReference } from "@/orb-core/turn-memory.server";
import { createSendGate, lastOrbMessageId } from "@/integrations/y-dude-orb/reply-ref";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const ORB1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USERMSG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const FOREIGN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const UNKNOWN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

type Row = { id: string; user_id: string; role: string; created_at: string; state_snapshot: any };
const rows: Row[] = [
  {
    id: ORB1,
    user_id: ME,
    role: "orb",
    created_at: "t1",
    state_snapshot: { [TURN_VISIBLE_IDS_KEY]: ["A", "C"] },
  },
  { id: USERMSG, user_id: ME, role: "user", created_at: "t0", state_snapshot: {} },
  {
    id: FOREIGN,
    user_id: OTHER,
    role: "orb",
    created_at: "t2",
    state_snapshot: { [TURN_VISIBLE_IDS_KEY]: ["X"] },
  },
];
/** Mock, der die Filter wirklich anwendet und die Aufrufe protokolliert. */
function mockDb(data: Row[] = rows) {
  const calls: [string, unknown][] = [];
  const db = {
    from: (t: string) => {
      expect(t).toBe("orb_messages");
      const f: Record<string, unknown> = {};
      const b: any = {
        select: () => b,
        eq: (k: string, v: unknown) => (calls.push([k, v]), (f[k] = v), b),
        maybeSingle: async () => ({
          data: data.find((r) => Object.entries(f).every(([k, v]) => (r as any)[k] === v)) ?? null,
          error: null,
        }),
      };
      return b;
    },
  };
  return { db, calls };
}
const schema = z.object({ text: z.string(), replyToOrbMessageId: z.string().uuid().optional() });

describe("P5-H Reply-Referenz (Server)", () => {
  it("A gültige eigene ORB-ID → [A,C]", async () => {
    const { db } = mockDb();
    expect(await loadReplyReference(db, ME, ORB1)).toEqual({
      replyToOrbMessageId: ORB1,
      referencedOrbTurnId: ORB1,
      referencedModelVisibleMemoryIds: ["A", "C"],
    });
  });
  it("B fehlende ID → keine Abfrage, keine Referenz", async () => {
    const { db, calls } = mockDb();
    const r = await loadReplyReference(db, ME, undefined);
    expect(calls).toHaveLength(0);
    expect(r.referencedOrbTurnId).toBeNull();
  });
  it("C unbekannte UUID → ungültig", async () =>
    expect((await loadReplyReference(mockDb().db, ME, UNKNOWN)).referencedOrbTurnId).toBeNull());
  it("D ungültiger String → Schema lehnt ab", () => {
    expect(() => schema.parse({ text: "x", replyToOrbMessageId: "kein-uuid" })).toThrow();
    expect(schema.parse({ text: "x" })).toEqual({ text: "x" });
  });
  it("E User-Message-ID → ungültig", async () =>
    expect((await loadReplyReference(mockDb().db, ME, USERMSG)).referencedOrbTurnId).toBeNull());
  it("F fremde ORB-ID → ungültig, keine fremden Memory-IDs", async () => {
    const r = await loadReplyReference(mockDb().db, ME, FOREIGN);
    expect(r.referencedOrbTurnId).toBeNull();
    expect(r.referencedModelVisibleMemoryIds).toBeNull();
  });
  it("Filter enthalten id + user_id (Server) + role=orb", async () => {
    const { db, calls } = mockDb();
    await loadReplyReference(db, ME, ORB1);
    expect(calls).toEqual([
      ["id", ORB1],
      ["user_id", ME],
      ["role", "orb"],
    ]);
  });
  const orb = (snap: any) => ({ id: ORB1, role: "orb", created_at: "t", state_snapshot: snap });
  it("G null → gültig, keine erfasste Referenz", () =>
    expect(resolveReplyReference(ORB1, orb({ [TURN_VISIBLE_IDS_KEY]: null }))).toMatchObject({
      referencedOrbTurnId: ORB1,
      referencedModelVisibleMemoryIds: null,
    }));
  it("H [] → gültig, 0 sichtbar (nicht null)", () =>
    expect(
      resolveReplyReference(ORB1, orb({ [TURN_VISIBLE_IDS_KEY]: [] }))
        .referencedModelVisibleMemoryIds,
    ).toEqual([]));
  it("I [A]", () =>
    expect(
      resolveReplyReference(ORB1, orb({ [TURN_VISIBLE_IDS_KEY]: ["A"] }))
        .referencedModelVisibleMemoryIds,
    ).toEqual(["A"]));
  it("J [A,B]", () =>
    expect(
      resolveReplyReference(ORB1, orb({ [TURN_VISIBLE_IDS_KEY]: ["A", "B"] }))
        .referencedModelVisibleMemoryIds,
    ).toEqual(["A", "B"]));
  it("K proaktive ORB-Frage (ohne Feld) → gültig, null", () =>
    expect(resolveReplyReference(ORB1, orb({ proactive: true }))).toMatchObject({
      referencedOrbTurnId: ORB1,
      referencedModelVisibleMemoryIds: null,
    }));
  it("Q alte Zeile ohne P5-C-Daten → gültig, null", () =>
    expect(
      resolveReplyReference(ORB1, orb({ recalled: 2 })).referencedModelVisibleMemoryIds,
    ).toBeNull());
  it("DB-Fehler → ungültig, Anfrage wird nicht abgelehnt", async () => {
    const db = {
      from: () => {
        throw new Error("x");
      },
    };
    await expect(loadReplyReference(db, ME, ORB1)).resolves.toMatchObject({
      referencedOrbTurnId: null,
    });
  });
});

describe("P5-H Client: Referenz + Sendesperre", () => {
  const msgs = [
    { id: "u1", role: "user" },
    { id: "o1", role: "orb" },
    { id: "u2", role: "user" },
  ];
  it("L/M/N Text, Voice, Bild nutzen dieselbe letzte ORB-ID", () => {
    expect(lastOrbMessageId(msgs)).toBe("o1");
    expect(lastOrbMessageId([...msgs, { id: "o2", role: "orb" }])).toBe("o2");
  });
  it("keine ORB-Nachricht → undefined", () => {
    expect(lastOrbMessageId([{ id: "u", role: "user" }])).toBeUndefined();
    expect(lastOrbMessageId(undefined)).toBeUndefined();
  });
  it("O Voice während pending → kein zweiter Request", () => {
    const g = createSendGate();
    const send = vi.fn();
    const trigger = () => g.tryAcquire() && (send(), true);
    expect(trigger()).toBe(true);
    expect(trigger()).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    g.release();
    expect(trigger()).toBe(true);
  });
  it("O2 laufende Neugier-Anfrage blockiert ebenfalls", () =>
    expect(createSendGate().tryAcquire(true)).toBe(false));
  it("P zwei parallele Voice-Trigger → genau ein Request", async () => {
    const g = createSendGate();
    const send = vi.fn();
    await Promise.all(
      [0, 1].map(async () => {
        if (g.tryAcquire()) send();
      }),
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
