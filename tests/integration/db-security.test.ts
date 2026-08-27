import { describe, expect, it } from "vitest";

import { column, dbAvailable, query, scalar } from "./db-client";

/**
 * Integrationsebene – echte Datenbank, ausschließlich lesend.
 *
 * Geprüft wird der tatsächliche Zustand der Datenbank (nicht nur die
 * Migrationsdateien): Rechtevergabe, aktivierte Zeilensicherheit, Rollenmodell
 * und Absicherung sensibler Tabellen. Es werden keine Daten geschrieben.
 */

const run = dbAvailable() ? describe : describe.skip;

/**
 * Tatsächlich vergebene Datenrechte der Rolle anon auf eine Tabelle.
 * Verwaltungsrechte (TRUNCATE/REFERENCES/TRIGGER/MAINTAIN) stammen aus den
 * Vorgaben der Plattform und erlauben keinen Datenzugriff.
 */
function anonGrants(tabelle: string): string[] {
  return column(
    `select a.privilege_type from pg_class c
       join pg_namespace n on n.oid=c.relnamespace
       cross join aclexplode(c.relacl) a
       join pg_roles r on r.oid=a.grantee
     where n.nspname='public' and c.relname='${tabelle}' and r.rolname='anon'
       and a.privilege_type in ('SELECT','INSERT','UPDATE','DELETE')`,
  );
}

run("Datenbank – Zeilensicherheit und Rechte", () => {
  it("jede öffentliche Tabelle hat aktive Zeilensicherheit", () => {
    const offen = column(
      `select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r' and c.relrowsecurity is false`,
    );
    expect(offen, `Tabellen ohne Zeilensicherheit: ${offen.join(", ")}`).toEqual([]);
  });

  it("Tabellen ohne Regeln bleiben durch Zeilensicherheit gesperrt", () => {
    const offen = column(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r'
         and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
         and c.relrowsecurity is false`,
    );
    expect(
      offen,
      `Tabellen ohne Regeln und ohne Zeilensicherheit: ${offen.join(", ")}`,
    ).toEqual([]);
  });


  it("jede öffentliche Tabelle hat Rechte für authenticated oder service_role", () => {
    const ohne = column(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
       where n.nspname='public' and c.relkind='r'
         and not exists (
           select 1 from aclexplode(c.relacl) a join pg_roles r on r.oid=a.grantee
           where r.rolname in ('authenticated','service_role'))`,
    );
    expect(ohne, `Tabellen ohne Rechtevergabe: ${ohne.join(", ")}`).toEqual([]);
  });


  it("SECURITY-DEFINER-Funktionen legen ihren Suchpfad fest", () => {
    const ohne = column(
      `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef
         and coalesce(array_to_string(p.proconfig,','),'') not like '%search_path%'`,
    );
    expect(ohne, `Funktionen ohne festen Suchpfad: ${ohne.join(", ")}`).toEqual([]);
  });
});

run("Datenbank – Rollenmodell", () => {
  it("Rollen liegen in einer eigenen Tabelle, nicht am Profil", () => {
    expect(scalar(`select 1 from information_schema.tables
      where table_schema='public' and table_name='user_roles'`)).toBe("1");

    const profilSpalten = column(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='profiles' and column_name in ('role','roles','is_admin')`,
    );
    expect(profilSpalten, "Rollen dürfen nicht am Profil hängen").toEqual([]);
  });

  it("has_role ist SECURITY DEFINER mit festem Suchpfad", () => {
    const row = query(
      `select p.prosecdef, coalesce(array_to_string(p.proconfig,','),'')
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname='has_role'`,
    )[0];
    expect(row?.[0]).toBe("t");
    expect(row?.[1]).toContain("search_path");
  });

  it("anon darf user_roles nicht lesen", () => {
    expect(anonGrants("user_roles")).toEqual([]);
  });
});

run("Datenbank – sensible Bereiche", () => {
  const tabellen = [
    "market_transaction_secrets",
    "market_payment_webhook_events",
    "market_payment_records",
    "messages",
    "conversation_members",
    "push_subscriptions",
    "admin_audit_log",
  ];

  /**
   * Wirksamer Schutz statt reiner Rechteliste: die Plattform vergibt auf dem
   * öffentlichen Schema pauschale Grundrechte an anon. Entscheidend ist daher,
   * dass Zeilensicherheit aktiv ist und keine Regel offen für nicht
   * angemeldete Besucher gilt. Der tatsächliche Zugriff wird zusätzlich in
   * db-anon-access.test.ts gegen die laufende Schnittstelle geprüft.
   */
  it.each(tabellen)("%s ist gegen nicht angemeldete Zugriffe geschützt", (tabelle) => {
    expect(
      scalar(`select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
              where n.nspname='public' and c.relname='${tabelle}'`),
      `${tabelle} braucht aktive Zeilensicherheit`,
    ).toBe("t");

    const offeneRegeln = column(
      `select policyname from pg_policies
       where schemaname='public' and tablename='${tabelle}'
         and (roles::text like '%anon%' or roles = '{public}')
         and coalesce(qual,'true') = 'true'`,
    );
    expect(offeneRegeln, `${tabelle} hat offene Regeln: ${offeneRegeln.join(", ")}`).toEqual([]);
  });

  it("streng vertrauliche Tabellen haben für anon keine Datenrechte", () => {
    for (const tabelle of ["user_roles", "market_transaction_secrets"]) {
      expect(anonGrants(tabelle), `${tabelle} muss für anon gesperrt sein`).toEqual([]);
    }
  });


  it("Nachrichten- und Mitgliederregeln nutzen die Mitgliedsprüfung", () => {
    const regeln = query(
      `select tablename, coalesce(qual,'') || ' ' || coalesce(with_check,'')
       from pg_policies where schemaname='public' and tablename in ('messages','conversation_members')`,
    );
    expect(regeln.length).toBeGreaterThan(0);
    const text = regeln.map((r) => r[1]).join(" ");
    expect(text).toMatch(/is_conversation_member|auth\.uid\(\)/);
  });

  it("Markttransaktionen sind an Käufer/Verkäufer gebunden", () => {
    const text = query(
      `select coalesce(qual,'') || ' ' || coalesce(with_check,'')
       from pg_policies where schemaname='public' and tablename='market_transactions'`,
    )
      .map((r) => r[0])
      .join(" ");
    expect(text).toMatch(/buyer_id|seller_id|has_role/);
  });

  it("Medien-Regeln auf storage.objects sind vorhanden", () => {
    const anzahl = Number(
      scalar(`select count(*) from pg_policies where schemaname='storage' and tablename='objects'`) ??
        "0",
    );
    expect(anzahl).toBeGreaterThan(0);
  });
});
