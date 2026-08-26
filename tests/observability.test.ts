/**
 * Observability – strukturierte Protokolle ohne Geheimnisse und PII.
 */

import { describe, expect, it } from "vitest";
import { buildLogRecord, sanitizeContext, SLOW_MS } from "@/lib/observability.server";

describe("sanitizeContext", () => {
  it("entfernt Geheimnisse und personenbezogene Felder", () => {
    const out = sanitizeContext({
      password: "hunter2",
      access_token: "eyJ...",
      apiKey: "sk_live_1",
      Authorization: "Bearer x",
      email: "a@b.de",
      messageBody: "Hallo Anna",
      stripeSignature: "t=1,v1=abc",
      transactionId: "tx-1",
    });
    expect(out).toMatchObject({
      password: "[redacted]",
      access_token: "[redacted]",
      apiKey: "[redacted]",
      Authorization: "[redacted]",
      email: "[redacted]",
      messageBody: "[redacted]",
      stripeSignature: "[redacted]",
      transactionId: "tx-1",
    });
    expect(JSON.stringify(out)).not.toContain("hunter2");
    expect(JSON.stringify(out)).not.toContain("Hallo Anna");
  });

  it("kürzt lange Werte und lässt Zahlen/Booleans durch", () => {
    const out = sanitizeContext({ note: "x".repeat(1000), count: 3, ok: false, nothing: null });
    expect((out["note"] as string).length).toBe(300);
    expect(out["count"]).toBe(3);
    expect(out["ok"]).toBe(false);
    expect(out).not.toHaveProperty("nothing");
  });

  it("reduziert Fehler auf Name und Meldung", () => {
    const out = sanitizeContext({ error: new Error("Invalid webhook signature") });
    expect(out["error"]).toBe("Error: Invalid webhook signature");
  });
});

describe("buildLogRecord", () => {
  it("enthält Zeitstempel, Severity, Bereich und Ereignis", () => {
    const record = buildLogRecord({ area: "payments", event: "webhook_failed", severity: "critical" });
    expect(record["area"]).toBe("payments");
    expect(record["event"]).toBe("webhook_failed");
    expect(record["sev"]).toBe("critical");
    expect(typeof record["ts"]).toBe("string");
    expect(new Date(record["ts"] as string).getTime()).not.toBeNaN();
  });

  it("nutzt info als Standard und nimmt Dauer auf", () => {
    const record = buildLogRecord({ area: "feed", event: "page", durationMs: 1234.6 });
    expect(record["sev"]).toBe("info");
    expect(record["ms"]).toBe(1235);
  });

  it("hat eine sinnvolle Latenzschwelle", () => {
    expect(SLOW_MS).toBeGreaterThanOrEqual(500);
  });
});
