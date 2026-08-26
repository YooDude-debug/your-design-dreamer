/**
 * Sicherheit – Vertrag der Datenbank-Absicherung.
 *
 * Ohne getrennte Testdatenbank können RLS-Regeln nicht live gegen die
 * Produktionsdaten geprüft werden. Stattdessen wird der verbindliche Vertrag
 * über die vorhandenen Migrationen geprüft: jede öffentliche Tabelle hat
 * Berechtigungen, RLS ist aktiv, Rollen liegen in einer eigenen Tabelle und
 * Rechteprüfungen laufen über die SECURITY-DEFINER-Funktion `has_role`.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const sqlByFile = new Map(files.map((f) => [f, readFileSync(join(DIR, f), "utf8")]));
const allSql = [...sqlByFile.values()].join("\n");

function createdTables(sql: string): string[] {
  const out: string[] = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) out.push(m[1]!);
  return out;
}

function droppedTables(sql: string): Set<string> {
  const out = new Set<string>();
  const re = /drop\s+table\s+(?:if\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) out.add(m[1]!);
  return out;
}

/**
 * Einige Migrationen sichern mehrere gleichartige Tabellen in einer Schleife
 * ab (`EXECUTE format(... %I ...)` über `ARRAY[...]`). Diese Namen zählen als
 * abgesichert, sobald der Block Rechtevergabe und RLS ausführt.
 */
function dynamicallySecured(): { rls: Set<string>; grants: Set<string> } {
  const rls = new Set<string>();
  const grants = new Set<string>();
  for (const sql of sqlByFile.values()) {
    const blocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$/gi) ?? [];
    for (const block of blocks) {
      const names = (block.match(/'([a-z0-9_]+)'/g) ?? []).map((s) => s.slice(1, -1));
      const hasRls = /enable\s+row\s+level\s+security/i.test(block);
      const hasGrant = /\bgrant\b/i.test(block);
      for (const n of names) {
        if (hasRls) rls.add(n);
        if (hasGrant) grants.add(n);
      }
    }
  }
  return { rls, grants };
}

const dynamic = dynamicallySecured();
const dropped = droppedTables(allSql);

describe("Migrationen sind vorhanden und lesbar", () => {
  it("es existieren Migrationen", () => {
    expect(files.length).toBeGreaterThan(100);
  });
});

describe("Jede erzeugte Tabelle wird abgesichert", () => {
  const tables = Array.from(new Set(createdTables(allSql))).filter((t) => !dropped.has(t));

  it("erkennt die bestehenden Tabellen", () => {
    expect(tables.length).toBeGreaterThan(50);
  });

  it.each(tables)("%s: RLS ist aktiviert", (table) => {
    const enabled = new RegExp(
      `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    );
    expect(enabled.test(allSql) || dynamic.rls.has(table)).toBe(true);
  });

  it.each(tables)("%s: Berechtigungen sind explizit vergeben", (table) => {
    const granted = new RegExp(`grant[\\s\\S]{0,80}\\bon\\s+(?:table\\s+)?public\\.${table}\\b`, "i");
    expect(granted.test(allSql) || dynamic.grants.has(table)).toBe(true);
  });
});


describe("Rollenmodell", () => {
  it("Rollen liegen in einer eigenen Tabelle", () => {
    expect(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.user_roles/i.test(allSql)).toBe(true);
  });

  it("die Rollenprüfung ist eine SECURITY-DEFINER-Funktion", () => {
    const fn = /create\s+or\s+replace\s+function\s+public\.has_role[\s\S]{0,400}?security\s+definer/i;
    expect(fn.test(allSql)).toBe(true);
  });

  it("Rollen werden nicht in der Profiltabelle gespeichert", () => {
    const badColumn = /alter\s+table\s+public\.profiles\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(?:is_admin|role|app_role)\b/i;
    expect(badColumn.test(allSql)).toBe(false);
  });

  it("Adminrechte werden über has_role geprüft, nicht über Clientwerte", () => {
    expect(allSql).toMatch(/has_role\(\s*auth\.uid\(\)\s*,\s*'admin'/i);
  });
});

describe("Keine unbeabsichtigt offenen Schreibrechte", () => {
  const writeToPublicRole =
    /create\s+policy[\s\S]{0,200}?for\s+(insert|update|delete)[\s\S]{0,80}?to\s+public\b/gi;

  it("keine Schreib-Policy für die Rolle public", () => {
    expect(allSql.match(writeToPublicRole)).toBeNull();
  });

  it("Zahlungsereignisse sind für Clients nicht schreibbar", () => {
    // Idempotenzsperre des Geldpfads: nur service_role darf schreiben.
    expect(allSql).toMatch(
      /revoke[\s\S]{0,80}public\.market_payment_webhook_events[\s\S]{0,80}from[\s\S]{0,60}(anon|authenticated)/i,
    );
  });

  it("Abhol-/Transaktionsgeheimnisse sind nicht öffentlich lesbar", () => {
    expect(allSql).toMatch(/public\.market_transaction_secrets/i);
    expect(
      /grant\s+select[\s\S]{0,60}public\.market_transaction_secrets[\s\S]{0,40}to[\s\S]{0,20}anon/i.test(
        allSql,
      ),
    ).toBe(false);
  });
});

describe("Sichtbarkeitsprüfungen bleiben zentral", () => {
  it.each([
    "can_view_post",
    "can_view_profile",
    "is_conversation_member",
    "are_connected",
    "is_following",
  ])("%s existiert als SECURITY-DEFINER-Funktion", (fn) => {
    const re = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${fn}[\\s\\S]{0,600}?security\\s+definer`,
      "i",
    );
    expect(re.test(allSql)).toBe(true);
  });
});
