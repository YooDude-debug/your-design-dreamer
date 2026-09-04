/**
 * Geldpfad – Idempotenz des Zahlungs-Webhooks.
 *
 * Ein doppelt zugestelltes Ereignis darf niemals zweimal verbucht werden.
 * Die Sperre ist der eindeutige Eintrag in `market_payment_webhook_events`:
 * schlägt das Einfügen fehl (Duplikat), wird das Ereignis verworfen.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyWebhook = vi.fn();
const activatePromotionFromWebhook = vi.fn();
const syncSubscriptionFromWebhook = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/stripe.server", () => ({
  verifyWebhook: (...args: unknown[]) => verifyWebhook(...args),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => ({ insert: (row: unknown) => insert(row) }) },
}));

vi.mock("@/lib/billing.server", () => ({
  activatePromotionFromWebhook: (...args: unknown[]) => activatePromotionFromWebhook(...args),
  syncSubscriptionFromWebhook: (...args: unknown[]) => syncSubscriptionFromWebhook(...args),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
}));

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function post(handler: Handler, env: string, body = "{}") {
  return handler({
    request: new Request(`https://example.test/api/public/payments/webhook?env=${env}`, {
      method: "POST",
      body,
    }),
  });
}

async function loadHandler(): Promise<Handler> {
  const mod = (await import("@/routes/api/public/payments/webhook")) as unknown as {
    Route: { server: { handlers: { POST: Handler } } };
  };
  return mod.Route.server.handlers.POST;
}

const marketEvent = {
  id: "evt_market_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_1",
      payment_status: "paid",
      payment_intent: "pi_1",
      amount_total: 4200,
      metadata: { transactionId: "11111111-1111-1111-1111-111111111111" },
    },
  },
};

const promotionEvent = {
  id: "evt_promo_1",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_2",
      payment_status: "paid",
      payment_intent: "pi_2",
      amount_total: 990,
      metadata: { kind: "market_promotion", promotionId: "22222222-2222-2222-2222-222222222222" },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockResolvedValue({ error: null });
});

describe("Zahlungs-Webhook", () => {
  it("ignoriert Anfragen ohne gültiges Environment", async () => {
    const handler = await loadHandler();
    const res = await post(handler, "production");
    expect(await res.json()).toEqual({ received: true, ignored: "invalid env" });
    expect(verifyWebhook).not.toHaveBeenCalled();
  });

  it("antwortet mit 400, wenn die Signatur ungültig ist", async () => {
    verifyWebhook.mockRejectedValue(new Error("Invalid webhook signature"));
    const handler = await loadHandler();
    const res = await post(handler, "sandbox");
    expect(res.status).toBe(400);
  });

  it("ignoriert Market-Kaufsitzungen (keine Marketplace-Zahlung mehr)", async () => {
    verifyWebhook.mockResolvedValue(marketEvent);
    const handler = await loadHandler();
    const res = await post(handler, "sandbox");
    expect(res.status).toBe(200);
    expect(activatePromotionFromWebhook).not.toHaveBeenCalled();
    expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
  });

  it("verwirft eine bereits verarbeitete Hervorhebung (Duplikat-Sperre greift)", async () => {
    verifyWebhook.mockResolvedValue(promotionEvent);
    insert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({
      error: { code: "23505", message: "duplicate key value" },
    });
    const handler = await loadHandler();
    await post(handler, "sandbox");
    await post(handler, "sandbox");
    expect(activatePromotionFromWebhook).toHaveBeenCalledTimes(1);
  });

  it("verwirft doppelte Abo-Ereignisse", async () => {
    verifyWebhook.mockResolvedValue({
      id: "evt_sub_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1" } },
    });
    insert.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({
      error: { code: "23505", message: "duplicate key value" },
    });
    const handler = await loadHandler();
    await post(handler, "sandbox");
    await post(handler, "sandbox");
    expect(syncSubscriptionFromWebhook).toHaveBeenCalledTimes(1);
  });

  it("ignoriert unbezahlte Sitzungen", async () => {
    verifyWebhook.mockResolvedValue({
      ...marketEvent,
      id: "evt_unpaid",
      data: { object: { ...marketEvent.data.object, payment_status: "unpaid" } },
    });
    const handler = await loadHandler();
    await post(handler, "sandbox");
  });

  it("ignoriert nicht zuständige Ereignisarten", async () => {
    verifyWebhook.mockResolvedValue({
      id: "evt_other",
      type: "payment_intent.created",
      data: { object: {} },
    });
    const handler = await loadHandler();
    await post(handler, "sandbox");
    expect(activatePromotionFromWebhook).not.toHaveBeenCalled();
    expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
  });

  it("verwirft Live-Meldungen in einer Testumgebung (Umgebungs-Trennung)", async () => {
    verifyWebhook.mockResolvedValue({
      id: "evt_live_in_staging",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_x" } },
    });
    const handler = await loadHandler();
    // Host example.test gilt als Staging: eine Live-Meldung darf hier nichts bewirken.
    const res = await post(handler, "live");
    expect(await res.json()).toMatchObject({ ignored: "environment mismatch" });
    expect(verifyWebhook).not.toHaveBeenCalled();
    expect(syncSubscriptionFromWebhook).not.toHaveBeenCalled();
  });
});
