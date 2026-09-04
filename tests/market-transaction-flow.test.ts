/**
 * Market-Abholvorgänge: Berechtigungen und Statuswechsel.
 *
 * Der Market wickelt weder Zahlung noch Versand ab – geprüft werden Abholcode,
 * Storno und Konfliktmeldung.
 *
 * Getestet wird die bestehende Serverlogik (`src/lib/market-tx.server.ts`)
 * gegen einen Datenbank-Ersatz. Es werden ausdrücklich auch unberechtigte
 * Zugriffe und falsche Reihenfolgen geprüft, nicht nur der Erfolgsfall.
 */

import { readFile } from "node:fs/promises";
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

describe("Storno und Konflikte", () => {
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

describe("Keine Marketplace-Zahlung und kein Versand", () => {
  it("die Serverlogik bietet keine Zahlungs-/Versandfunktionen mehr an", async () => {
    const mod = (await api()) as Record<string, unknown>;
    for (const name of [
      "createCheckoutSession",
      "confirmPaymentFromWebhook",
      "markShipped",
      "confirmDelivery",
      "requestRefund",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
  });

  it("die Oberfläche kann nur Abholung, Storno, Übergabe und Konflikt auslösen", async () => {
    const src = await readFile("src/lib/market-tx.functions.ts", "utf8");
    for (const name of [
      "createMarketCheckout",
      "markMarketShipped",
      "confirmMarketDelivery",
      "requestMarketRefund",
    ]) {
      expect(src).not.toContain(`export const ${name}`);
    }
    expect(src).toContain("export const startMarketTransaction");
    expect(src).toContain("export const confirmMarketPickup");
  });
});
