/**
 * Geldpfad – Market-Kaufabwicklung: Berechtigungen und Statuswechsel.
 *
 * Getestet wird die bestehende Serverlogik (`src/lib/market-tx.server.ts`)
 * gegen einen Datenbank-Ersatz. Es werden ausdrücklich auch unberechtigte
 * Zugriffe und falsche Reihenfolgen geprüft, nicht nur der Erfolgsfall.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, txRow, type FakeCall, type FakeResponse } from "./helpers/fake-supabase";

let db = createFakeDb();

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return db;
  },
}));

type Setup = { tx?: Record<string, unknown>; secret?: unknown; openRefund?: unknown };

function setup(opts: Setup = {}) {
  const tx = txRow(opts.tx ?? {});
  db = createFakeDb((call: FakeCall): FakeResponse => {
    if (call.table === "market_transactions" && call.action === "select") return { data: tx };
    if (call.table === "market_transaction_secrets" && call.action === "select")
      return { data: opts.secret ?? null };
    if (call.table === "market_refunds" && call.action === "select")
      return { data: opts.openRefund ?? null };
    if (call.action === "insert" && call.single) return { data: { id: "new-1" } };
    return {};
  });
  return tx;
}

async function api() {
  return import("@/lib/market-tx.server");
}

beforeEach(() => {
  setup();
});

describe("Versand melden", () => {
  it("nur der Verkäufer darf versenden", async () => {
    setup();
    const { markShipped } = await api();
    await expect(markShipped("buyer-1", { transactionId: "tx-1" })).rejects.toThrow("not_seller");
    await expect(markShipped("fremd", { transactionId: "tx-1" })).rejects.toThrow("not_seller");
  });

  it("Versand ohne Zahlung ist ausgeschlossen", async () => {
    setup({ tx: { payment_status: "pending" } });
    const { markShipped } = await api();
    await expect(markShipped("seller-1", { transactionId: "tx-1" })).rejects.toThrow("not_paid");
  });

  it("Abholung kann nicht versendet werden", async () => {
    setup({ tx: { fulfillment_type: "pickup" } });
    const { markShipped } = await api();
    await expect(markShipped("seller-1", { transactionId: "tx-1" })).rejects.toThrow(
      "not_shipping",
    );
  });

  it("Erfolgsfall setzt Status und schreibt genau ein Ereignis", async () => {
    setup();
    const { markShipped } = await api();
    await expect(
      markShipped("seller-1", { transactionId: "tx-1", carrier: "DHL" }),
    ).resolves.toEqual({
      ok: true,
    });

    const update = db.callsOn("market_transactions", "update")[0];
    expect(update?.payload).toMatchObject({ status: "shipped", shipping_status: "shipped" });
    // Statuswechsel nur, solange die Zahlung bestätigt ist (Schutz vor Rennen).
    expect(update?.filters).toEqual(
      expect.arrayContaining([{ op: "eq", column: "payment_status", value: "paid" }]),
    );
    expect(db.callsOn("market_transaction_events", "insert")).toHaveLength(1);
  });
});

describe("Erhalt bestätigen", () => {
  it("nur der Käufer darf bestätigen", async () => {
    setup();
    const { confirmDelivery } = await api();
    await expect(confirmDelivery("seller-1", "tx-1")).rejects.toThrow("not_buyer");
  });

  it("Abschluss erfolgt nur einmal (Schutz vor Doppelverbuchung)", async () => {
    setup();
    const { confirmDelivery } = await api();
    await confirmDelivery("buyer-1", "tx-1");
    const update = db.callsOn("market_transactions", "update")[0];
    expect(update?.payload).toMatchObject({ status: "completed" });
    expect(update?.filters).toEqual(
      expect.arrayContaining([{ op: "neq", column: "status", value: "completed" }]),
    );
  });
});

describe("Abholcode", () => {
  const pickup = { fulfillment_type: "pickup", status: "ready_for_pickup" };

  it("falscher Code wird abgewiesen", async () => {
    setup({ tx: pickup, secret: { pickup_code: "482913", used_at: null } });
    const { confirmPickup } = await api();
    await expect(confirmPickup("seller-1", "tx-1", "111111")).rejects.toThrow("code_invalid");
    expect(db.callsOn("market_transactions", "update")).toHaveLength(0);
  });

  it("bereits benutzter Code wird abgewiesen", async () => {
    setup({ tx: pickup, secret: { pickup_code: "482913", used_at: new Date().toISOString() } });
    const { confirmPickup } = await api();
    await expect(confirmPickup("seller-1", "tx-1", "482913")).rejects.toThrow("code_invalid");
  });

  it("richtiger Code schliesst ab und verbraucht den Code genau einmal", async () => {
    setup({ tx: pickup, secret: { pickup_code: "482913", used_at: null } });
    const { confirmPickup } = await api();
    await expect(confirmPickup("seller-1", "tx-1", "48 29 13")).resolves.toEqual({ ok: true });
    const secretUpdate = db.callsOn("market_transaction_secrets", "update")[0];
    expect(secretUpdate?.filters).toEqual(
      expect.arrayContaining([{ op: "is", column: "used_at", value: null }]),
    );
  });

  it("nur der Verkäufer darf die Übergabe bestätigen", async () => {
    setup({ tx: pickup, secret: { pickup_code: "482913", used_at: null } });
    const { confirmPickup } = await api();
    await expect(confirmPickup("buyer-1", "tx-1", "482913")).rejects.toThrow("not_seller");
  });
});

describe("Storno und Rückerstattung", () => {
  it("bezahlte Käufe können nicht storniert werden", async () => {
    setup();
    const { cancelTransaction } = await api();
    await expect(cancelTransaction("buyer-1", "tx-1", null)).rejects.toThrow(
      "already_paid_use_refund",
    );
  });

  it("unbeteiligte Konten dürfen nicht stornieren", async () => {
    setup({ tx: { payment_status: "pending", status: "pending_payment" } });
    const { cancelTransaction } = await api();
    await expect(cancelTransaction("fremd", "tx-1", null)).rejects.toThrow("forbidden");
  });

  it("Storno gibt den Artikel wieder frei", async () => {
    setup({ tx: { payment_status: "pending", status: "pending_payment" } });
    const { cancelTransaction } = await api();
    await cancelTransaction("buyer-1", "tx-1", "kein Bedarf");
    const item = db.callsOn("market_items", "update")[0];
    expect(item?.payload).toMatchObject({ status: "active" });
    expect(item?.filters).toEqual(
      expect.arrayContaining([{ op: "eq", column: "status", value: "reserved" }]),
    );
  });

  it("Rückerstattung nur nach Zahlung", async () => {
    setup({ tx: { payment_status: "pending" } });
    const { requestRefund } = await api();
    await expect(requestRefund("buyer-1", "tx-1", null)).rejects.toThrow("not_paid");
  });

  it("offene Rückerstattung wird nicht doppelt angelegt", async () => {
    setup({ openRefund: { id: "refund-open" } });
    const { requestRefund } = await api();
    await expect(requestRefund("buyer-1", "tx-1", null)).resolves.toEqual({
      ok: true,
      refundId: "refund-open",
    });
    expect(db.callsOn("market_refunds", "insert")).toHaveLength(0);
  });

  it("unbeteiligte Konten können keinen Konflikt eröffnen", async () => {
    setup();
    const { openDispute } = await api();
    await expect(openDispute("fremd", "tx-1", "damaged", null)).rejects.toThrow("forbidden");
    expect(db.callsOn("market_disputes", "insert")).toHaveLength(0);
  });

  it("Konflikt setzt den Status auf 'disputed'", async () => {
    setup();
    const { openDispute } = await api();
    await expect(openDispute("buyer-1", "tx-1", "not_received", "nie angekommen")).resolves.toEqual(
      {
        ok: true,
        disputeId: "new-1",
      },
    );
    expect(db.callsOn("market_transactions", "update")[0]?.payload).toMatchObject({
      status: "disputed",
    });
  });
});

describe("Zahlung aus dem Webhook", () => {
  it("doppelt zugestelltes Ereignis wird verworfen", async () => {
    const tx = txRow();
    db = createFakeDb((call) => {
      if (call.table === "market_payment_webhook_events")
        return { error: { message: "duplicate key value violates unique constraint" } };
      if (call.table === "market_transactions" && call.action === "select") return { data: tx };
      return {};
    });
    const { confirmPaymentFromWebhook } = await api();
    const res = await confirmPaymentFromWebhook({
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      transactionId: "tx-1",
      environment: "sandbox",
      amountCents: 2500,
    });
    expect(res).toEqual({ handled: false });
    expect(db.callsOn("market_transactions", "update")).toHaveLength(0);
  });

  it("bereits bezahlte Transaktion wird nicht erneut verbucht", async () => {
    setup({ tx: { payment_status: "paid" } });
    const { confirmPaymentFromWebhook } = await api();
    const res = await confirmPaymentFromWebhook({
      eventId: "evt_2",
      eventType: "checkout.session.completed",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      transactionId: "tx-1",
      environment: "sandbox",
      amountCents: 2500,
    });
    expect(res).toEqual({ handled: true });
    expect(db.callsOn("market_transactions", "update")).toHaveLength(0);
    expect(db.callsOn("market_items", "update")).toHaveLength(0);
  });

  it("fehlgeschlagene Zahlung setzt nur den Zahlungsstatus", async () => {
    setup({ tx: { payment_status: "pending", status: "pending_payment" } });
    const { confirmPaymentFromWebhook } = await api();
    const res = await confirmPaymentFromWebhook({
      eventId: "evt_3",
      eventType: "payment_intent.payment_failed",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      transactionId: "tx-1",
      environment: "sandbox",
      amountCents: 2500,
    });
    expect(res).toEqual({ handled: true });
    expect(db.callsOn("market_transactions", "update")[0]?.payload).toEqual({
      payment_status: "failed",
    });
    expect(db.callsOn("market_items", "update")).toHaveLength(0);
  });

  it("erfolgreiche Zahlung markiert Artikel als verkauft und benachrichtigt den Verkäufer", async () => {
    setup({ tx: { payment_status: "pending", status: "pending_payment" } });
    const { confirmPaymentFromWebhook } = await api();
    const res = await confirmPaymentFromWebhook({
      eventId: "evt_4",
      eventType: "checkout.session.completed",
      sessionId: "cs_1",
      paymentIntentId: "pi_1",
      transactionId: "tx-1",
      environment: "sandbox",
      amountCents: 2500,
    });
    expect(res).toEqual({ handled: true });
    const update = db.callsOn("market_transactions", "update").at(-1);
    expect(update?.payload).toMatchObject({ payment_status: "paid", status: "processing" });
    expect(update?.filters).toEqual(
      expect.arrayContaining([{ op: "neq", column: "payment_status", value: "paid" }]),
    );
    expect(db.callsOn("market_items", "update")[0]?.payload).toMatchObject({ status: "sold" });
    expect(db.rpcs.map((r) => r.fn)).toContain("push_notify");
  });

  it("unbekanntes Ereignis ohne Transaktionsbezug wird ignoriert", async () => {
    db = createFakeDb((call) => {
      if (call.table === "market_payment_records" && call.action === "select")
        return { data: null };
      return {};
    });
    const { confirmPaymentFromWebhook } = await api();
    const res = await confirmPaymentFromWebhook({
      eventId: "evt_5",
      eventType: "checkout.session.completed",
      sessionId: "cs_unknown",
      paymentIntentId: null,
      transactionId: null,
      environment: "sandbox",
      amountCents: null,
    });
    expect(res).toEqual({ handled: false });
  });
});
