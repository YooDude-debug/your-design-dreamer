/**
 * Market-Scope: kein Abholcode.
 *
 * Der vereinfachte Market kennt Listing, Kaufanfrage/Reservierung, Kommunikation
 * und "Als verkauft markieren". Ein Abholcode wird weder eingegeben noch erzeugt.
 * Historische Datensaetze bleiben in der Datenbank erhalten, werden aber nicht
 * mehr neu geschrieben oder verwendet.
 */

import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const APP_FILES = [
  "src/lib/market-tx.server.ts",
  "src/lib/market-tx.functions.ts",
  "src/routes/_authenticated/market.tx.$txId.tsx",
  "src/routes/_authenticated/market.$itemId.tsx",
];

describe("Market ohne Abholcode", () => {
  it.each(APP_FILES)("%s enthaelt keine Abholcode-Logik", async (file) => {
    const src = await readFile(file, "utf8");
    expect(src).not.toMatch(/pickup_code|pickupCode|confirmPickup|market_transaction_secrets/i);
  });

  it("die Serverlogik bietet keine Abholcode-/Zahlungs-/Versandfunktionen an", async () => {
    const mod = (await import("@/lib/market-tx.server")) as Record<string, unknown>;
    for (const name of [
      "confirmPickup",
      "createCheckoutSession",
      "confirmPaymentFromWebhook",
      "markShipped",
      "requestRefund",
    ]) {
      expect(mod[name]).toBeUndefined();
    }
    expect(typeof mod["markSold"]).toBe("function");
  });

  it("die juengste Market-Migration erzeugt keinen Abholcode mehr", async () => {
    // Migrationen liegen je nach Stand in supabase/migrations und/oder
    // drizzle/migrations. Beide Verzeichnisse werden in Anwendungsreihenfolge
    // gelesen; geprueft wird die zuletzt versionierte Definition.
    const dirs = ["supabase/migrations", "drizzle/migrations"];
    let latest: string | null = null;
    for (const dir of dirs) {
      let files: string[] = [];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
      } catch {
        continue;
      }
      for (const f of files) {
        const sql = await readFile(`${dir}/${f}`, "utf8");
        if (sql.includes("CREATE OR REPLACE FUNCTION public.market_start_transaction"))
          latest = sql;
      }
    }
    expect(latest, "market_start_transaction muss versioniert sein").toBeTruthy();
    expect(latest!).not.toMatch(/INSERT INTO public\.market_transaction_secrets/i);
  });
});
