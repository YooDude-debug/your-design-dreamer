import { describe, it, expect, vi, beforeEach } from "vitest";
const probe = vi.fn();
const chain = () => ({ select: () => ({ limit: () => ({ abortSignal: () => probe() }) }) });
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: chain, rpc: async () => ({ error: new Error("x") }) },
}));
const events: any[] = [];
vi.mock("@/lib/ops-log.server", () => ({ logEvent: () => {} }), { virtual: true } as any);
describe("db probe", () => {
  beforeEach(() => { probe.mockReset(); events.length = 0; });
  it("scenarios", async () => {
    const mod: any = await import("@/lib/ops-monitor.server");
    expect(typeof mod.opsHealthChecks).toBe("function");
  });
});
