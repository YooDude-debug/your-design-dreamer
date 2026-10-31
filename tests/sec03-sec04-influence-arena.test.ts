import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import {
  ownInfluenceRows,
  writeConnectionInfluence,
  type InfluenceRow,
} from "@/lib/interest-engine/influence-writer.server";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

function fakeWriter() {
  const calls: { table: string; rows: InfluenceRow[] }[] = [];
  return {
    calls,
    writer: {
      from(table: string) {
        return {
          upsert: async (rows: InfluenceRow[]) => {
            calls.push({ table, rows });
            return { error: null };
          },
        };
      },
    } as never,
  };
}

describe("SEC-03 connection_influence writes", () => {
  it("writes the signed-in user's own rows", async () => {
    const f = fakeWriter();
    const n = await writeConnectionInfluence(A, [{ user_id: A, peer_id: B, strength: 0.4 }], f.writer);
    expect(n).toBe(1);
    expect(f.calls[0].table).toBe("connection_influence");
    expect(f.calls[0].rows[0].user_id).toBe(A);
  });

  it("user A cannot write rows for user B", async () => {
    const f = fakeWriter();
    const n = await writeConnectionInfluence(A, [{ user_id: B, peer_id: C, strength: 1 }], f.writer);
    expect(n).toBe(0);
    expect(f.calls).toHaveLength(0);
  });

  it("drops self-connections and empty peers", () => {
    expect(ownInfluenceRows(A, [{ user_id: A, peer_id: A }, { user_id: A, peer_id: "" }])).toEqual([]);
  });

  it("rejects missing user id", () => {
    expect(ownInfluenceRows("", [{ user_id: "", peer_id: B }])).toEqual([]);
  });

  it("does not leak error details", async () => {
    const writer = {
      from: () => ({ upsert: async () => ({ error: { message: "secret db detail" } }) }),
    } as never;
    await expect(writeConnectionInfluence(A, [{ user_id: A, peer_id: B }], writer)).resolves.toBe(0);
  });

  it("engine no longer writes connection_influence with the user's client", () => {
    const src = readFileSync("src/lib/interest-engine/engine.server.ts", "utf8");
    expect(src).not.toMatch(/from\("connection_influence"\)\s*\.(upsert|insert|update|delete)/);
    expect(src.match(/writeConnectionInfluence\(userId/g)?.length).toBe(3);
  });
});

describe("SEC-04 arena counters", () => {
  const dir = "drizzle/migrations";
  const file = readdirSync(dir).find((f) => f.includes("sec04_arena_counters_insert_guard"));
  const sql = file ? readFileSync(`${dir}/${file}`, "utf8") : "";

  it("resets all four counters on insert", () => {
    for (const c of ["votes_count", "likes_count", "plays_count", "comments_count"]) {
      expect(sql).toContain(`NEW.${c} := 0;`);
    }
    expect(sql).toMatch(/BEFORE INSERT ON public\.arena_submissions/);
  });

  it("users may only insert the non-counter columns", () => {
    expect(sql).toMatch(/REVOKE INSERT ON public\.arena_submissions FROM anon, authenticated/);
    const grant = sql.match(/GRANT INSERT \(([^)]+)\)/)?.[1] ?? "";
    expect(grant).not.toMatch(/count/);
    expect(grant).toMatch(/pitch/);
  });

  it("the app's normal submit sends only allowed columns", () => {
    const src = readFileSync("src/lib/arena.ts", "utf8");
    const block = src.slice(src.indexOf('from("arena_submissions").insert'), src.indexOf("as never", src.indexOf('from("arena_submissions").insert')));
    expect(block).not.toMatch(/_count/);
  });
});
