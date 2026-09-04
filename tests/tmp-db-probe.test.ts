import { describe, it, expect, vi, beforeEach } from "vitest";
const attempts: (() => any)[] = [];
const inserted: any[] = [];
function fromMock(table: string) {
  if (table === "profiles") {
    return { select: () => ({ limit: () => ({ abortSignal: () => (attempts.shift() ?? (() => ({ error: null })))() }) }) };
  }
  if (table === "ops_events") {
    return { insert: (row: any) => { inserted.push(row); return { select: () => ({ maybeSingle: async () => ({ data: { id: "e1" }, error: null }) }) }; } };
  }
  const q: any = { select: () => ({ count: 0, data: [], error: null }) };
  return { insert: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }), select: () => q, update: () => q, delete: () => q, upsert: () => q };
}
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fromMock, rpc: async () => ({ error: null }) },
}));
async function run() {
  inserted.length = 0;
  const mod: any = await import("@/lib/ops-monitor.server");
  const r = await mod.opsHealthChecks(new Request("http://localhost/"));
  return r;
}
const ev = (name: string) => inserted.filter((r) => r.event === name);
describe("db probe scenarios", () => {
  beforeEach(() => { attempts.length = 0; });
  it("A success", async () => {
    const r = await run();
    expect(typeof r.dbLatencyMs).toBe("number");
    expect(ev("db_probe_failed")).toHaveLength(0);
  });
  it("B retry ok", async () => {
    attempts.push(() => { throw new Error("boom"); });
    const r = await run();
    expect(typeof r.dbLatencyMs).toBe("number");
    expect(ev("db_probe_failed")).toHaveLength(0);
    expect(ev("db_probe_transient_retry_ok")[0].severity).toBe("info");
  });
  it("C both fail", async () => {
    attempts.push(() => { throw new Error("boom"); }, () => { throw new Error("boom2"); });
    const r = await run();
    expect(r.dbLatencyMs).toBeNull();
    expect(ev("db_probe_failed")[0].severity).toBe("critical");
    expect(ev("db_probe_failed")[0].message).toContain("boom2");
  });
  it("D timeout", async () => {
    const to = () => { const e = new Error(""); e.name = "TimeoutError"; throw e; };
    attempts.push(to, to);
    await run();
    expect(ev("db_probe_failed")[0].message).toContain("timeout_or_abort");
  });
  it("E error without message", async () => {
    const bad = () => { const e = new Error(""); (e as any).cause = new Error("socket closed"); throw e; };
    attempts.push(bad, bad);
    await run();
    const m = ev("db_probe_failed")[0].message as string;
    expect(m).not.toBe("Error: ");
    expect(m).toContain("no_error_message");
    expect(m).toContain("cause=Error: socket closed");
  });
});
