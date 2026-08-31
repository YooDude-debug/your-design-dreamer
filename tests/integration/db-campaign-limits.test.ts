import { describe, expect, it } from "vitest";

import { dbAvailable, query, scalar } from "./db-client";

/**
 * Business Campaigns V1 – F3 (DB-Vertragstests).
 *
 * Geprüft wird die Datenintegrität unabhängig vom Frontend: der Limit-Trigger
 * auf `ad_campaigns`, die Tarifzuordnung, die Rollenpflicht und die
 * Zeilensicherheit der Kampagnentabelle. Es werden keine Daten erzeugt,
 * geändert oder gelöscht.
 */
const run = dbAvailable() ? describe : describe.skip;

function def(name: string): string {
  return (
    scalar(
      `select regexp_replace(replace(pg_get_functiondef(oid), chr(10), ' '), '\\s+', ' ', 'g')
         from pg_proc where proname='${name}' and pronamespace='public'::regnamespace`,
    ) ?? ""
  );
}

run("Business-Kampagnen – Datenbankverträge", () => {
  const limitFn = def("business_campaign_limit");
  const tierFn = def("business_plan_tier");
  const trigger = def("enforce_business_campaign_limit");

  it("T1 – Business erlaubt 2, Business Pro 5 aktive Kampagnen", () => {
    expect(limitFn).toContain("'business_pro' THEN 5");
    expect(limitFn).toContain("'business' THEN 2");
    expect(limitFn).toContain("IMMUTABLE");
  });

  it("T2 – ohne Business-Tarif sind 0 aktive Kampagnen erlaubt", () => {
    expect(limitFn).toContain("ELSE 0 END");
    expect(trigger).toContain("business_subscription_required");
  });

  it("T3 – Überschreitung des Limits wird in der Datenbank abgelehnt", () => {
    expect(trigger).toContain("campaign_limit_reached");
    expect(trigger).toContain("AND status = 'active'");
    expect(trigger).toContain("_active >= _limit");
  });

  it("T4 – nur aktive Kampagnen derselben Umgebung zählen", () => {
    expect(trigger).toContain("NEW.status <> 'active'");
    expect(trigger).toContain("coalesce(environment, 'development') = _env");
  });

  it("T5 – ohne Business-Rolle wird eine aktive Kampagne abgelehnt", () => {
    expect(trigger).toContain("has_role(NEW.owner_id, 'business')");
    expect(trigger).toContain("business_role_required");
  });

  it("T6 – Tarif kommt ausschliesslich aus gültigen Abonnements", () => {
    expect(tierFn).toContain("business_pro_monthly");
    expect(tierFn).toContain("business_monthly");
    expect(tierFn).toContain("FROM public.subscriptions");
    expect(tierFn).toContain("current_period_end");
  });

  it("T7 – Limit-Prüfung läuft als Trigger vor jedem Schreibvorgang", () => {
    const rows = query(
      `select tgname, tgtype::int
         from pg_trigger
        where tgrelid = 'public.ad_campaigns'::regclass
          and not tgisinternal
          and tgfoid = 'public.enforce_business_campaign_limit'::regproc`,
    );
    expect(rows.length).toBe(1);
    // BEFORE (bit 1 gesetzt) und INSERT+UPDATE (bit 4 + 16).
    const type = Number(rows[0]?.[1]);
    expect(type & 1).toBe(1);
    expect(type & 4).toBe(4);
    expect(type & 16).toBe(16);
  });

  it("T8 – Kampagnen sind zeilengesichert und nur für Eigentümer schreibbar", () => {
    expect(
      scalar(`select relrowsecurity from pg_class where oid='public.ad_campaigns'::regclass`),
    ).toBe("t");
    const writes = query(
      `select policyname, coalesce(with_check, qual)
         from pg_policies
        where tablename='ad_campaigns' and cmd in ('INSERT','UPDATE','DELETE')
          and policyname like '%own'`,
    );
    expect(writes.length).toBe(3);
    for (const [, expr] of writes) {
      expect(expr).toContain("owner_id");
      expect(expr).toContain("'business'::app_role");
    }
  });

  it("T9 – anonyme Nutzer haben keine Rechte an Kampagnen", () => {
    const grants = scalar(
      `select coalesce(string_agg(distinct privilege_type, ','), 'none')
         from information_schema.role_table_grants
        where table_schema='public' and table_name='ad_campaigns' and grantee='anon'`,
    );
    expect(grants).toBe("none");
  });
});
