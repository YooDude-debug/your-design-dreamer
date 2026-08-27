import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Zustellung von Alarmen: Kanalerkennung, Zeitbegrenzung, Wiederholung und
 * Ausweichkanal. Die Datenbank wird nicht benötigt, es zählt der Zustellweg.
 */

const ORIGINAL_ENV = { ...process.env };

async function loadModule() {
  vi.resetModules();
  return import("@/lib/ops-monitor.server");
}

beforeEach(() => {
  delete process.env["OPS_ALERT_WEBHOOK_URL"];
  delete process.env["OPS_ALERT_WEBHOOK_URL_2"];
  delete process.env["OPS_HEARTBEAT_URL"];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("Alarmkanäle", () => {
  it("meldet ohne hinterlegte URL keinen Kanal", async () => {
    const mod = await loadModule();
    expect(mod.alertChannels()).toEqual([]);
    expect(mod.alertChannelConfigured()).toBe(false);
  });

  it("erkennt Haupt- und Ausweichkanal", async () => {
    process.env["OPS_ALERT_WEBHOOK_URL"] = "https://example.test/primary";
    process.env["OPS_ALERT_WEBHOOK_URL_2"] = "https://example.test/backup";
    const mod = await loadModule();
    expect(mod.alertChannels()).toEqual([
      "https://example.test/primary",
      "https://example.test/backup",
    ]);
    expect(mod.alertChannelConfigured()).toBe(true);
  });

  it("ignoriert leere Werte", async () => {
    process.env["OPS_ALERT_WEBHOOK_URL"] = "   ";
    const mod = await loadModule();
    expect(mod.alertChannelConfigured()).toBe(false);
  });
});

describe("Alarmtest", () => {
  it("bleibt ohne Kanal ohne Netzzugriff", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const mod = await loadModule();
    const result = await mod.testAlertChannel();
    expect(result).toEqual({ configured: false, delivered: false, channels: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("kennzeichnet die Meldung als Test und meldet Zustellung", async () => {
    process.env["OPS_ALERT_WEBHOOK_URL"] = "https://example.test/primary";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const mod = await loadModule();
    const result = await mod.testAlertChannel();
    expect(result).toEqual({ configured: true, delivered: true, channels: 1 });
    const body = String((fetchSpy.mock.calls[0]![1] as RequestInit).body);
    expect(body).toContain("[TEST]");
  });

  it("nutzt den Ausweichkanal, wenn der erste Kanal ausfällt", async () => {
    process.env["OPS_ALERT_WEBHOOK_URL"] = "https://example.test/primary";
    process.env["OPS_ALERT_WEBHOOK_URL_2"] = "https://example.test/backup";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("no", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const mod = await loadModule();
    const result = await mod.testAlertChannel();
    expect(result.delivered).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("meldet Fehlschlag, wenn kein Kanal antwortet", async () => {
    process.env["OPS_ALERT_WEBHOOK_URL"] = "https://example.test/primary";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const mod = await loadModule();
    const result = await mod.testAlertChannel();
    expect(result).toEqual({ configured: true, delivered: false, channels: 1 });
  });

  it("begrenzt jeden Zustellversuch zeitlich", async () => {
    process.env["OPS_ALERT_WEBHOOK_URL"] = "https://example.test/primary";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const mod = await loadModule();
    await mod.testAlertChannel();
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("Lebenszeichen (Totmannschalter)", () => {
  it("ist optional und ohne URL wirkungslos", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const mod = await loadModule();
    expect(await mod.pingHeartbeat()).toEqual({ configured: false, ok: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sendet ein Lebenszeichen, wenn eine URL hinterlegt ist", async () => {
    process.env["OPS_HEARTBEAT_URL"] = "https://example.test/heartbeat";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const mod = await loadModule();
    expect(await mod.pingHeartbeat()).toEqual({ configured: true, ok: true });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.test/heartbeat",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("meldet einen gestörten Überwachungsdienst, ohne zu werfen", async () => {
    process.env["OPS_HEARTBEAT_URL"] = "https://example.test/heartbeat";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    const mod = await loadModule();
    expect(await mod.pingHeartbeat()).toEqual({ configured: true, ok: false });
  });
});
