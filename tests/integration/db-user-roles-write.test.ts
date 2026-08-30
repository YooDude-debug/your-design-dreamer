import { describe, expect, it } from "vitest";

import { column, dbAvailable } from "./db-client";

/**
 * T9 – Rollenvergabe ist nicht durch Endnutzer manipulierbar.
 *
 * Die Rollenquelle `public.user_roles` darf für `anon` und `authenticated`
 * keine Schreibrechte besitzen; der Creator-Wechsel läuft ausschliesslich über
 * die geprüfte Serverfunktion. Nur lesende Prüfung.
 */
const run = dbAvailable() ? describe : describe.skip;

function grants(rolle: string): string[] {
  return column(
    `select a.privilege_type from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       cross join aclexplode(c.relacl) a
       join pg_roles r on r.oid=a.grantee
     where n.nspname='public' and c.relname='user_roles' and r.rolname='${rolle}'
       and a.privilege_type in ('INSERT','UPDATE','DELETE')`,
  );
}

run("Datenbank – Rollenvergabe", () => {
  it("anon darf user_roles nicht schreiben", () => {
    expect(grants("anon")).toEqual([]);
  });

  it("authenticated darf user_roles nicht schreiben", () => {
    expect(grants("authenticated")).toEqual([]);
  });
});
