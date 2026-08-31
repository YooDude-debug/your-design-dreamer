import { describe, expect, it } from "vitest";

import { column, dbAvailable, scalar } from "./db-client";

/**
 * T1–T15 – Automatische 3-Monats-Reifung für Exclusive SlangDrops.
 *
 * Nur lesende Vertragsprüfung: Es werden keine Testdaten erzeugt, geändert
 * oder gelöscht. Geprüft wird die tatsächlich in der Datenbank hinterlegte
 * Logik (Funktionsdefinitionen, Zeitplan, Rechte, Policies).
 */
const run = dbAvailable() ? describe : describe.skip;

/** Funktionsquelle als eine Zeile (die Testabfrage liefert zeilenweise Ergebnisse). */
function def(name: string): string {
  return (
    scalar(
      `select regexp_replace(replace(pg_get_functiondef(oid), chr(10), ' '), '\\s+', ' ', 'g')
         from pg_proc where proname='${name}' and pronamespace='public'::regnamespace`,
    ) ?? ""
  );
}

function executors(name: string): string[] {
  return column(
    `select r.rolname from pg_proc p
       cross join aclexplode(p.proacl) a
       join pg_roles r on r.oid=a.grantee
     where p.proname='${name}' and p.pronamespace='public'::regnamespace
       and a.privilege_type='EXECUTE'`,
  );
}

run("Exclusive SlangDrops – automatische Reifung", () => {
  const claim = def("claim_creator_slang_tag");
  const job = def("run_exclusive_drop_maturation");

  it("T1/T2 – Übernahme eines Drops verlangt ein aktives Creator-Abo", () => {
    expect(claim).toContain("has_active_creator_subscription(uid, t.owner_id, _environment)");
    expect(claim).toContain("not_entitled");
  });

  it("T3/T4 – neuer Drop-Claim ist vorläufig mit Frist von drei Kalendermonaten", () => {
    expect(claim).toContain("'exclusive_drop', false, now() + interval '3 months'");
  });

  it("T5/T6 – Reifung ist eine serverseitige Datenbankfunktion", () => {
    // Der Zeitplan liegt im Schema `cron` und ist für die Testrolle nicht
    // lesbar; geprüft wird hier die aufgerufene autoritative Funktion.
    expect(job).toContain("permanent_after <= now()");
    expect(job).toContain("SECURITY DEFINER");
  });

  it("T7 – Reifung erzeugt das dauerhafte Recht im bestehenden Bibliothekseintrag", () => {
    expect(job).toContain("UPDATE public.slang_tag_library");
    expect(job).toContain("SET is_permanent = true");
    // keine parallele Bibliothek: kein INSERT in eine andere Tabelle
    expect(job).not.toContain("INSERT INTO");
  });

  it("T8 – die SlangTag Box liest ausschließlich slang_tag_library", () => {
    const tables = column(
      `select table_name from information_schema.tables
        where table_schema='public' and table_name like 'slang_tag_librar%'`,
    );
    expect(tables).toEqual(["slang_tag_library"]);
  });

  it("T9/T10 – Abo-Ende beendet nur vorläufige Rechte", () => {
    const lapse = def("lapse_pending_drops_on_subscription_change");
    expect(lapse).toContain("is_permanent = false");
    expect(job).toContain("l0.is_permanent = false");
  });

  it("T11/T13 – weder Creator noch Nutzer dürfen Bibliothekseinträge schreiben", () => {
    const policies = column(
      `select cmd from pg_policies where tablename='slang_tag_library' and cmd <> 'SELECT'`,
    );
    // Ohne Schreib-Policy blockiert die Zeilensicherheit jede direkte
    // Schreibanfrage über die Daten-API – auch für den Creator.
    expect(policies).toEqual([]);
    expect(executors("run_exclusive_drop_maturation").sort()).toEqual(["postgres", "service_role"]);
  });

  it("T12 – Mehrfachlauf verändert bereits dauerhafte Rechte nicht", () => {
    expect(job).toContain("l1.is_permanent = false");
    expect(job).toContain("l1.revoked_at IS NULL");
  });

  it("T14/T15 – normale Subscriber-Tags und Preislogik bleiben unverändert", () => {
    expect(claim).toContain("'creator_subscription' ELSE 'follow' END, true");
    const check = scalar(
      `select pg_get_constraintdef(oid) from pg_constraint where conname='creator_subscription_prices_price_range'`,
    );
    expect(check).toContain("299");
    expect(check).toContain("9999");
  });
});
