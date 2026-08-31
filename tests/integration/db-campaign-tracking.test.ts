import { describe, expect, it } from "vitest";

import { dbAvailable, scalar } from "./db-client";

/**
 * Business Campaigns V1 – Härtung F1/F5.
 *
 * Lesende Vertragsprüfung der Datenbankseite: die Zählfunktion
 * `increment_campaign_metric`, die Schutztabelle gegen wiederholte
 * Ereignisse und die Zeitfenster-Bedingung auf `ad_campaigns`.
 * Es werden keine Daten erzeugt, geändert oder gelöscht.
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

run("Kampagnen-Ereignisse – serverseitige Absicherung", () => {
  const fn = def("increment_campaign_metric");

  it("T1/T2 – gültige Einblendungen und Klicks erhöhen genau einen Zähler", () => {
    expect(fn).toContain("SET clicks = clicks + 1");
    expect(fn).toContain("SET impressions = impressions + 1");
  });

  it("T3 – ungültige Ereignisart wird abgelehnt", () => {
    expect(fn).toContain("_kind NOT IN ('impression', 'click')");
    expect(fn).toContain("invalid_event_kind");
  });

  it("T4 – unbekannte Kampagnen-ID wird abgelehnt", () => {
    expect(fn).toContain("campaign_not_found");
  });

  it("T5 – Zählerstände sind nicht setzbar und nur der Serverdienst darf zählen", () => {
    // Kein Parameter, mit dem ein Zählerstand gesetzt werden könnte.
    expect(fn).not.toMatch(/SET (clicks|impressions) = \$?\w*_?count/i);
    const callers =
      scalar(
        `select coalesce(array_to_string(proacl, ','), '') from pg_proc
           where proname='increment_campaign_metric' and pronamespace='public'::regnamespace`,
      ) ?? "";
    expect(callers).not.toContain("anon");
    expect(callers).not.toContain("authenticated");
    expect(callers).toContain("service_role");
  });

  it("T6 – Eigenmessung des Kampagnenbetreibers zählt nicht", () => {
    expect(fn).toContain("c.owner_id = _actor");
    expect(fn).toContain("_actor IS NULL");
  });

  it("T7/T8 – nur aktive Kampagnen im gültigen Zeitfenster erhalten Ereignisse", () => {
    expect(fn).toContain("c.status <> 'active'");
    expect(fn).toContain("c.starts_at > now()");
    expect(fn).toContain("c.ends_at <= now()");
    expect(fn).toContain("coalesce(c.environment, 'development') <> _environment");
  });

  it("T9 – wiederholte identische Ereignisse erhöhen den Zähler nicht beliebig", () => {
    expect(fn).toContain("ad_campaign_event_guard");
    expect(fn).toContain("ON CONFLICT DO NOTHING");
    expect(fn).toContain("_fresh IS NOT TRUE");
    const pk =
      scalar(
        `select indexdef from pg_indexes where schemaname='public'
           and tablename='ad_campaign_event_guard' and indexdef ilike '%UNIQUE%' limit 1`,
      ) ?? "";
    expect(pk).toContain("campaign_id");
    expect(pk).toContain("user_id");
    expect(pk).toContain("kind");
    expect(pk).toContain("bucket");
  });

  it("Schutztabelle bleibt für Nutzerrollen unzugänglich", () => {
    const rls = scalar(
      `select relrowsecurity::text from pg_class where oid='public.ad_campaign_event_guard'::regclass`,
    );
    expect(rls).toBe("true");
    const grants =
      scalar(
        `select coalesce(array_to_string(relacl, ','), '') from pg_class
           where oid='public.ad_campaign_event_guard'::regclass`,
      ) ?? "";
    expect(grants).not.toContain("anon");
    expect(grants).not.toContain("authenticated");
    expect(grants).toContain("service_role");
  });

  it("T11/T12 – Datenbank erzwingt Ende nach Start", () => {
    const check =
      scalar(
        `select pg_get_constraintdef(oid) from pg_constraint
           where conname='ad_campaigns_time_window_chk'`,
      ) ?? "";
    expect(check).toContain("ends_at > starts_at");
  });
});
