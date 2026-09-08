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

type Setup = {
  tx?: Record<string, unknown>;
  secret?: unknown;
  openRefund?: unknown;
  /** Antwort der atomaren Abschlussfunktion `market_complete_transaction`. */
  complete?: FakeResponse;
};

function setup(opts: Setup = {}) {
  const tx = txRow(opts.tx ?? {});
  db = createFakeDb((call: FakeCall): FakeResponse => {
    if (call.table === "market_transactions" && call.action === "select") return { data: tx };
    if (call.table === "market_transaction_secrets" && call.action === "select")
      return { data: opts.secret ?? null };
    if (call.table === "market_refunds" && call.action === "select")
      return { data: opts.openRefund ?? null };
    if (call.table === "rpc:market_complete_transaction")
      return (
        opts.complete ?? { data: { changed: true, item_id: "item-1", item_status: "sold" } }
      );
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

describe("Verkauf bestätigen (reserved → sold)", () => {
  const reserved = { fulfillment_type: "pickup", status: "ready_for_pickup" };

  it("Verkäufer schliesst ab und setzt den Artikel atomar auf 'sold'", async () => {
    setup({ tx: reserved });
    const { markSold } = await api();
    await expect(markSold("seller-1", "tx-1")).resolves.toEqual({ ok: true });
    // Vorgang und Artikel werden in einer Datenbanktransaktion gesetzt.
    expect(db.rpcs.filter((r) => r.fn === "market_complete_transaction")).toHaveLength(1);
  });

  it("Versandvorgänge funktionieren genauso ohne Plattformabwicklung", async () => {
    setup({ tx: { fulfillment_type: "shipping", status: "processing" } });
    const { markSold } = await api();
    await expect(markSold("seller-1", "tx-1")).resolves.toEqual({ ok: true });
    expect(db.rpcs.filter((r) => r.fn === "market_complete_transaction")).toHaveLength(1);
  });

  it("bleibt der Artikel nicht auf 'sold', schlägt der Abschluss fehl", async () => {
    setup({
      tx: reserved,
      complete: { data: { changed: true, item_id: "item-1", item_status: "reserved" } },
    });
    const { markSold } = await api();
    await expect(markSold("seller-1", "tx-1")).rejects.toThrow("complete_failed");
  });

  it("fremde Konten dürfen nicht als verkauft markieren", async () => {
    setup({ tx: reserved });
    const { markSold } = await api();
    await expect(markSold("fremd", "tx-1")).rejects.toThrow("not_seller");
    expect(db.callsOn("market_items", "update")).toHaveLength(0);
  });

  it("Käufer dürfen nicht als verkauft markieren", async () => {
    setup({ tx: reserved });
    const { markSold } = await api();
    await expect(markSold("buyer-1", "tx-1")).rejects.toThrow("not_seller");
  });

  it("bereits verkaufte Vorgänge können nicht erneut verkauft werden", async () => {
    setup({
      tx: { status: "completed" },
      complete: { error: { message: "already_sold" } } as FakeResponse,
    });
    const { markSold } = await api();
    await expect(markSold("seller-1", "tx-1")).rejects.toThrow("already_sold");
    expect(db.callsOn("market_items", "update")).toHaveLength(0);
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

describe("Keine Marketplace-Zahlung, kein Versand, kein Abholcode", () => {
  it("die Serverlogik bietet keine Zahlungs-/Versandfunktionen mehr an", async () => {
    const mod = (await api()) as Record<string, unknown>;
    for (const name of [
      "createCheckoutSession",
      "confirmPaymentFromWebhook",
      "markShipped",
      "confirmDelivery",
      "requestRefund",
      "confirmPickup",
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
      "confirmMarketPickup",
    ]) {
      expect(src).not.toContain(`export const ${name}`);
    }
    expect(src).toContain("export const startMarketTransaction");
    expect(src).toContain("export const markMarketSold");
  });
});
