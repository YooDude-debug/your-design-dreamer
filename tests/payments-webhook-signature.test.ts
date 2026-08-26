/**
 * Geldpfad – Webhook-Signaturprüfung (sicherheitskritisch).
 *
 * Geprüft wird, dass nur korrekt signierte und zeitlich frische Ereignisse
 * angenommen werden. Manipulierte Signaturen, fremde Secrets, fehlende
 * Signaturen und veraltete Zeitstempel müssen abgewiesen werden.
 */

import { describe, expect, it, beforeAll } from "vitest";

const SANDBOX_SECRET = "whsec_test_sandbox_secret";
const LIVE_SECRET = "whsec_test_live_secret";

beforeAll(() => {
  process.env["PAYMENTS_SANDBOX_WEBHOOK_SECRET"] = SANDBOX_SECRET;
  process.env["PAYMENTS_LIVE_WEBHOOK_SECRET"] = LIVE_SECRET;
});

async function sign(payload: string, timestamp: number, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  );
  return Buffer.from(new Uint8Array(signed)).toString("hex");
}

function request(body: string, signature: string | null) {
  return new Request("https://example.test/api/public/payments/webhook?env=sandbox", {
    method: "POST",
    headers: signature ? { "stripe-signature": signature } : {},
    body,
  });
}

const eventBody = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", payment_status: "paid" } },
});

describe("verifyWebhook", () => {
  it("nimmt ein korrekt signiertes, frisches Ereignis an", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(eventBody, ts, SANDBOX_SECRET);
    const event = await verifyWebhook(request(eventBody, `t=${ts},v1=${sig}`), "sandbox");
    expect(event.id).toBe("evt_1");
    expect(event.type).toBe("checkout.session.completed");
  });

  it("weist eine manipulierte Signatur ab", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(eventBody, ts, SANDBOX_SECRET);
    const tampered = sig.slice(0, -2) + (sig.endsWith("00") ? "11" : "00");
    await expect(
      verifyWebhook(request(eventBody, `t=${ts},v1=${tampered}`), "sandbox"),
    ).rejects.toThrow(/Invalid webhook signature/);
  });

  it("weist einen veränderten Nachrichtentext bei gültiger alter Signatur ab", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(eventBody, ts, SANDBOX_SECRET);
    const modified = eventBody.replace("cs_1", "cs_evil");
    await expect(verifyWebhook(request(modified, `t=${ts},v1=${sig}`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("weist eine Signatur des anderen Environments ab", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    const ts = Math.floor(Date.now() / 1000);
    const sig = await sign(eventBody, ts, LIVE_SECRET);
    await expect(verifyWebhook(request(eventBody, `t=${ts},v1=${sig}`), "sandbox")).rejects.toThrow(
      /Invalid webhook signature/,
    );
  });

  it("weist veraltete Zeitstempel ab (Replay-Schutz)", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    const ts = Math.floor(Date.now() / 1000) - 3600;
    const sig = await sign(eventBody, ts, SANDBOX_SECRET);
    await expect(verifyWebhook(request(eventBody, `t=${ts},v1=${sig}`), "sandbox")).rejects.toThrow(
      /timestamp too old/,
    );
  });

  it("weist fehlende Signaturen ab", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    await expect(verifyWebhook(request(eventBody, null), "sandbox")).rejects.toThrow(
      /Missing signature or body/,
    );
  });

  it("weist ein unbekanntes Signaturformat ab", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    await expect(verifyWebhook(request(eventBody, "garbage"), "sandbox")).rejects.toThrow(
      /Invalid signature format/,
    );
  });

  it("akzeptiert mehrere v1-Signaturen, wenn eine passt (Secret-Rotation)", async () => {
    const { verifyWebhook } = await import("@/lib/stripe.server");
    const ts = Math.floor(Date.now() / 1000);
    const good = await sign(eventBody, ts, SANDBOX_SECRET);
    const bad = await sign(eventBody, ts, LIVE_SECRET);
    const event = await verifyWebhook(
      request(eventBody, `t=${ts},v1=${bad},v1=${good}`),
      "sandbox",
    );
    expect(event.id).toBe("evt_1");
  });
});
