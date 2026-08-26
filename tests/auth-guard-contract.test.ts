/**
 * Authentifizierung und Zugriffsschutz – Vertrag im Code.
 *
 * Geprüft wird, dass geschützte Server-Funktionen ohne angemeldete Sitzung
 * nicht ausführbar sind, geschützte Seiten im abgesicherten Routenbereich
 * liegen und öffentliche HTTP-Endpunkte ihre Aufrufer selbst prüfen.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const srcFiles = walk(join(ROOT, "src"));
const read = (p: string) => readFileSync(p, "utf8");

describe("Sitzung und Token", () => {
  it("Server-Funktionen erhalten den Sitzungs-Token über eine Middleware", () => {
    const start = read(join(ROOT, "src", "start.ts"));
    expect(start).toMatch(/functionMiddleware/);
    expect(start).toMatch(/attachSupabaseAuth|Authorization/);
  });

  it("die Token-Prüfung verlangt einen Bearer-Token mit drei Teilen", () => {
    const mw = read(join(ROOT, "src", "integrations", "supabase", "auth-middleware.ts"));
    expect(mw).toMatch(/Unauthorized: No authorization header provided/);
    expect(mw).toMatch(/Only Bearer tokens are supported/);
    expect(mw).toMatch(/split\("\."\)\.length !== 3/);
    expect(mw).toMatch(/getClaims/);
  });

  it("geschützte Seiten liegen hinter dem Routen-Gate", () => {
    const gate = read(join(ROOT, "src", "routes", "_authenticated", "route.tsx"));
    expect(gate).toMatch(/ssr:\s*false/);
    expect(gate).toMatch(/auth\.get(User|Session)\(\)/);
    expect(gate).toMatch(/redirect\(\{\s*to:\s*"\/auth"/);
  });
});

describe("Geschützte Server-Funktionen", () => {
  const functionFiles = srcFiles.filter((f) => f.endsWith(".functions.ts"));

  it("es gibt Server-Funktions-Module", () => {
    expect(functionFiles.length).toBeGreaterThan(10);
  });

  /**
   * Module mit personen- oder geldbezogenen Vorgängen dürfen keine anonymen
   * Aufrufe zulassen: jede Server-Funktion darin braucht `requireSupabaseAuth`.
   */
  const mustBeProtected = [
    "market-tx.functions.ts",
    "billing.functions.ts",
    "admin.functions.ts",
    "moderation.functions.ts",
    "push.functions.ts",
  ];

  it.each(mustBeProtected)("%s: jede Server-Funktion verlangt eine Anmeldung", (name) => {
    const file = functionFiles.find((f) => f.endsWith(name));
    expect(file, `${name} nicht gefunden`).toBeTruthy();
    const sql = read(file!);
    const declarations = sql.match(/createServerFn\(/g) ?? [];
    const guards = sql.match(/requireSupabaseAuth/g) ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    // Ein Guard-Eintrag pro Server-Funktion (zusätzlich der Import).
    expect(guards.length).toBeGreaterThanOrEqual(declarations.length);
  });

  /**
   * `account.functions.ts` enthält bewusst zwei öffentliche Prüfungen der
   * Namensverfügbarkeit (vor der Registrierung). Alle Vorgänge mit
   * Personenbezug müssen dagegen angemeldet sein.
   */
  it.each(["ensureProfile", "exportMyData", "deleteMyAccount"])(
    "account.functions.ts: %s verlangt eine Anmeldung",
    (name) => {
      const code = read(join(ROOT, "src", "lib", "account.functions.ts"));
      const block = code.slice(code.indexOf(`export const ${name} =`));
      expect(block.slice(0, 200)).toMatch(/requireSupabaseAuth/);
    },
  );

  it("Adminvorgänge prüfen zusätzlich die Rolle", () => {
    const server = read(join(ROOT, "src", "lib", "admin.server.ts"));
    expect(server).toMatch(/has_role/);
  });

  it("der Dienst-Schlüssel wird nie im Browser-Code verwendet", () => {
    const leaks = srcFiles.filter(
      (f) =>
        (f.endsWith(".ts") || f.endsWith(".tsx")) &&
        !f.includes(".server.") &&
        !f.endsWith("client.server.ts") &&
        read(f).includes("SUPABASE_SERVICE_ROLE_KEY"),
    );
    expect(leaks).toEqual([]);
  });
});

describe("Öffentliche HTTP-Endpunkte prüfen ihre Aufrufer", () => {
  const publicDir = join(ROOT, "src", "routes", "api", "public");
  const endpoints = walk(publicDir).filter((f) => f.endsWith(".ts"));

  it("es gibt öffentliche Endpunkte", () => {
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it.each(endpoints.map((f) => [f.replace(ROOT + "/", ""), f] as const))(
    "%s prüft Signatur oder Berechtigung",
    (_name, file) => {
      const code = read(file);
      const guarded =
        /isAuthorizedWorkerRequest|verifyWebhook|authenticateCronRequest|stripe-signature|timingSafeEqual|CRON_SECRET|authorization/i.test(
          code,
        );
      expect(guarded).toBe(true);
    },
  );
});

describe("Konto und DSGVO", () => {
  const account = read(join(ROOT, "src", "lib", "account.server.ts"));

  it("Datenexport und Löschung verlangen eine erneute Passwortprüfung", () => {
    expect(account).toMatch(/export async function verifyPassword/);
    expect(account).toMatch(/signInWithPassword/);
  });

  it("beide Vorgänge sind ratenbegrenzt und werden protokolliert", () => {
    expect(account).toMatch(/export async function checkRateLimit/);
    expect(account).toMatch(/account_security_events/);
  });

  it("Passwörter landen nicht im Protokoll", () => {
    expect(/logAccountEvent\([^)]*password/i.test(account)).toBe(false);
  });

  it("die Kontolöschung entfernt das Konto vollständig", () => {
    expect(account).toMatch(/auth\.admin\.deleteUser/);
  });
});
