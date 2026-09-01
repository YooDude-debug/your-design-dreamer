import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile.server";

const VALID = "x".repeat(40);

describe("verifyTurnstileToken (fail-closed)", () => {
  beforeEach(() => {
    process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"] = "test-secret";
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"];
  });

  const mockFetch = (impl: () => unknown) => {
    vi.stubGlobal("fetch", vi.fn(impl as never));
  };

  it("lehnt fehlendes Token ab", async () => {
    mockFetch(() => {
      throw new Error("should not be called");
    });
    expect(await verifyTurnstileToken(undefined)).toBe(false);
    expect(await verifyTurnstileToken(null)).toBe(false);
  });

  it("lehnt leeres und zu kurzes Token ab", async () => {
    expect(await verifyTurnstileToken("")).toBe(false);
    expect(await verifyTurnstileToken("   ")).toBe(false);
    expect(await verifyTurnstileToken("abc")).toBe(false);
    expect(await verifyTurnstileToken("y".repeat(5000))).toBe(false);
  });

  it("lehnt manipuliertes/abgelaufenes Token ab", async () => {
    mockFetch(() => ({
      ok: true,
      json: async () => ({ success: false, "error-codes": ["timeout-or-duplicate"] }),
    }));
    expect(await verifyTurnstileToken(VALID)).toBe(false);
  });

  it("lehnt unerwartete API-Antwort ab", async () => {
    mockFetch(() => ({ ok: true, json: async () => ({}) }));
    expect(await verifyTurnstileToken(VALID)).toBe(false);
  });

  it("lehnt HTTP-Fehler ab", async () => {
    mockFetch(() => ({ ok: false, status: 500, json: async () => ({}) }));
    expect(await verifyTurnstileToken(VALID)).toBe(false);
  });

  it("lehnt bei nicht erreichbarem Verifikationsserver ab", async () => {
    mockFetch(() => {
      throw new Error("network down");
    });
    expect(await verifyTurnstileToken(VALID)).toBe(false);
  });

  it("lehnt bei fehlender Konfiguration ab", async () => {
    delete process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"];
    mockFetch(() => ({ ok: true, json: async () => ({ success: true }) }));
    expect(await verifyTurnstileToken(VALID)).toBe(false);
  });

  it("akzeptiert ausschließlich ein serverseitig bestätigtes Token", async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ success: true }) }));
    expect(await verifyTurnstileToken(VALID, "203.0.113.1")).toBe(true);
  });
});
