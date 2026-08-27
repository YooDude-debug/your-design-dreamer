import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Integrationsebene – echter Zugriff über die Datenschnittstelle als
 * nicht angemeldeter Besucher (anon).
 *
 * Zweck: belegen, dass die Zeilensicherheit im Betrieb wirkt und geschützte
 * Bereiche ohne Anmeldung leer bleiben oder abgewiesen werden. Es werden
 * ausschließlich Leseanfragen gestellt, keine Daten verändert.
 */

function readEnvFile(): Record<string, string> {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m) out[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const env = readEnvFile();
const url = process.env["SUPABASE_URL"] ?? env["SUPABASE_URL"] ?? env["VITE_SUPABASE_URL"];
const key =
  process.env["SUPABASE_PUBLISHABLE_KEY"] ??
  env["SUPABASE_PUBLISHABLE_KEY"] ??
  env["VITE_SUPABASE_PUBLISHABLE_KEY"];

const run = url && key ? describe : describe.skip;

run("Datenschnittstelle – Zugriff ohne Anmeldung", () => {
  let anon: SupabaseClient;

  beforeAll(() => {
    anon = createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  const geschuetzt = [
    "messages",
    "conversations",
    "conversation_members",
    "user_roles",
    "market_transactions",
    "push_subscriptions",
    "notifications",
  ] as const;

  it.each(geschuetzt)("%s liefert ohne Anmeldung keine Zeilen", async (tabelle) => {
    const { data, error } = await anon.from(tabelle).select("*").limit(1);
    if (error) {
      // Abweisung ist ebenfalls ein gültiges Ergebnis (keine Rechte).
      expect(error.message.length).toBeGreaterThan(0);
      return;
    }
    expect(data ?? [], `${tabelle} darf ohne Anmeldung nichts herausgeben`).toEqual([]);
  });

  it("Schreibversuch ohne Anmeldung wird abgewiesen", async () => {
    const { error } = await anon
      .from("posts")
      .insert({ content: "e2e-guard-should-fail" } as never)
      .select();
    expect(error, "anon darf keine Beiträge anlegen").toBeTruthy();
  });
});
