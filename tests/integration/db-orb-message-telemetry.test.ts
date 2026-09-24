import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { dbAvailable } from "./db-client";

/**
 * ORB Chat-Telemetrie (orb_message_telemetry, Trigger auf orb_messages).
 *
 * Schreibt drei Testnachrichten ausschließlich innerhalb einer Transaktion,
 * die am Ende per ROLLBACK verworfen wird – es bleibt nichts gespeichert.
 */

const SQL = `
BEGIN;
CREATE TEMP TABLE t_user ON COMMIT DROP AS SELECT user_id AS id FROM public.orb_state ORDER BY user_id LIMIT 1;
CREATE TEMP TABLE t_base ON COMMIT DROP AS
  SELECT count(*)::int AS n FROM public.orb_messages WHERE user_id = (SELECT id FROM t_user);
INSERT INTO public.orb_messages (user_id, role, body, created_at) VALUES
  ((SELECT id FROM t_user), 'user', 'Hi', '2999-01-01T00:00:00.000Z'),
  ((SELECT id FROM t_user), 'orb', 'Grüße 👋 aus dem ORB', '2999-01-01T00:00:00.001Z'),
  ((SELECT id FROM t_user), 'user', repeat('x', 500), '2999-01-01T00:00:01.000Z');
SELECT json_agg(r ORDER BY r.position) FROM (
  SELECT t.message_id, m.body, t.direction, to_char(t.server_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS server_ts,
         t.char_count, t.byte_count, t.chat_length, t.position, (SELECT n FROM t_base) AS base
    FROM public.orb_message_telemetry t JOIN public.orb_messages m ON m.id = t.message_id
   WHERE t.server_ts >= '2999-01-01' AND t.user_id = (SELECT id FROM t_user)
) r;
ROLLBACK;
`;

type Row = {
  message_id: string;
  body: string;
  direction: string;
  server_ts: string;
  char_count: number;
  byte_count: number;
  chat_length: number;
  position: number;
  base: number;
};

describe.skipIf(!dbAvailable())("ORB Chat-Telemetrie", () => {
  it("erfasst ID, Zeitstempel, Größe, Richtung und Chatlänge je Nachricht", () => {
    const out = execFileSync("psql", ["-tA", "-q", "-v", "ON_ERROR_STOP=1", "-c", SQL], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const rows = JSON.parse(out.slice(out.indexOf("["), out.lastIndexOf("]") + 1)) as Row[];

    expect(rows).toHaveLength(3);
    const base = rows[0]!.base;
    expect(rows.map((r) => r.direction)).toEqual(["USER", "ORB", "USER"]);
    expect(rows.map((r) => r.server_ts)).toEqual([
      "2999-01-01T00:00:00.000Z",
      "2999-01-01T00:00:00.001Z",
      "2999-01-01T00:00:01.000Z",
    ]);
    expect(rows.map((r) => r.char_count)).toEqual([2, 19, 500]);
    // "ü", "ß" = je 2 Bytes, "👋" = 4 Bytes
    expect(rows.map((r) => r.byte_count)).toEqual([2, 24, 500]);
    expect(rows.map((r) => r.position)).toEqual([base + 1, base + 2, base + 3]);
    expect(rows.map((r) => r.chat_length)).toEqual([base + 1, base + 2, base + 3]);
    expect(new Set(rows.map((r) => r.message_id)).size).toBe(3);

    // ROLLBACK: nichts darf bestehen bleiben.
    const left = execFileSync(
      "psql",
      ["-tA", "-c", "select count(*) from public.orb_messages where created_at >= '2999-01-01'"],
      { encoding: "utf8" },
    ).trim();
    expect(left).toBe("0");
  });
});
