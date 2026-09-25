import { describe, expect, it, vi } from "vitest";
import { speakViaLovableGateway } from "@/orb-core/llm/provider.server";

describe("LIVE Luna – normaler ORB-Chat-Pfad", () => {
  it("genau ein Aufruf, HTTP 200, Parser liefert Text", async () => {
    const real = globalThis.fetch;
    let calls = 0;
    let status = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const res = await real(input as RequestInfo, init);
      status = res.status;
      return res;
    });
    const t0 = Date.now();
    const out = await speakViaLovableGateway("Du bist ORB. Antworte kurz auf Deutsch.", "Hallo.");
    const ms = Date.now() - t0;
    console.log(JSON.stringify({ calls, status, ms, chars: out.reply.length, s: out.status }));
    expect(calls).toBe(1);
    expect(status).toBe(200);
    expect(out.status).toBe("ok");
    expect(out.reply.length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  }, 60000);
});
