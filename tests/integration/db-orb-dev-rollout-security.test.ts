/**
 * ORB Developer / Repair Environment – Phase 4: Sicherheitsvertrag der
 * Deployment-Freigaben in der Datenbank (nur lesend geprüft).
 *
 * Belegt: die Tabelle existiert, Zeilenschutz ist aktiv, jede Regel bindet die
 * Administratorrolle, nicht angemeldete Besucher und normale Benutzer haben
 * keinen Zugriff, erteilte Freigaben sind per Trigger unveränderlich, Ziel und
 * Sandbox-Ergebnis sind per Prüfbedingung eingegrenzt, und je Fix und Ziel
 * existiert höchstens eine gültige Deployment-Freigabe.
 */
import { describe, expect, it } from "vitest";

import { column, dbAvailable, scalar } from "./db-client";

const run = dbAvailable() ? describe : describe.skip;
const T = "orb_dev_deployment_approvals";

run("ORB Controlled Rollout – Sicherheit der Deployment-Freigaben", () => {
  it("die Tabelle existiert", () => {
    const found = column(
      `select tablename from pg_tables where schemaname='public' and tablename='${T}'`,
    );
    expect(found).toEqual([T]);
  });

  it("Zeilenschutz ist aktiv", () => {
    expect(scalar(`select relrowsecurity from pg_class where oid='public.${T}'::regclass`)).toBe(
      "t",
    );
  });

  it("jede Regel verlangt die Administratorrolle", () => {
    const defs = column(
      `select coalesce(qual,'') || ' ' || coalesce(with_check,'') from pg_policies where schemaname='public' and tablename='${T}'`,
    );
    expect(defs.length).toBeGreaterThan(0);
    for (const def of defs) expect(def).toContain("has_role");
  });

  it("nicht angemeldete Besucher haben keine Rechte", () => {
    const grants = column(
      `select privilege_type from information_schema.role_table_grants
       where table_schema='public' and table_name='${T}' and grantee='anon'`,
    );
    expect(grants).toEqual([]);
  });

  it("erteilte Freigaben sind per Trigger unveränderlich", () => {
    const triggers = column(
      `select tgname from pg_trigger where not tgisinternal and tgrelid='public.${T}'::regclass`,
    );
    expect(triggers.join(" ")).toContain("immutable");
  });

  it("nur ausdrückliche Ziele sind erlaubt, kein AUTO", () => {
    const checks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.${T}'::regclass and contype='c'`,
    ).join(" ");
    expect(checks).toContain("STAGING");
    expect(checks).toContain("PRODUCTION");
    expect(checks).not.toContain("AUTO");
  });

  it("nur ein bestandener Sandbox-Test darf hinterlegt sein", () => {
    const checks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.${T}'::regclass and contype='c'`,
    ).join(" ");
    expect(checks).toContain("PASSED");
  });

  it("nur die Administratoroberfläche darf Freigabequelle sein", () => {
    const checks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.${T}'::regclass and contype='c'`,
    ).join(" ");
    expect(checks).toContain("admin_ui");
  });

  it("eine Deployment-Freigabe verweist zwingend auf einen gespeicherten Fix", () => {
    const fks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.${T}'::regclass and contype='f'`,
    ).join(" ");
    expect(fks).toContain("orb_dev_fix_proposals");
  });

  it("je Fix und Ziel existiert höchstens eine gültige Deployment-Freigabe", () => {
    const idx = column(
      `select indexdef from pg_indexes where schemaname='public' and tablename='${T}'`,
    ).join(" ");
    expect(idx).toContain("DEPLOYMENT_APPROVED");
    expect(idx).toContain("target");
  });

  it("der Fingerabdruck der Freigabe ist gespeichert und formatgeprüft", () => {
    const cols = column(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='${T}'`,
    );
    for (const c of [
      "fix_id",
      "fix_version",
      "proposal_fingerprint",
      "final_diff_fingerprint",
      "deployment_fingerprint",
      "sandbox_execution_id",
      "sandbox_result",
      "base_commit",
      "rollback_target",
      "target",
      "status",
      "approved_by",
      "approved_at",
      "source",
    ]) {
      expect(cols, c).toContain(c);
    }
  });

  it("bestehende Phase-2-Tabellen sind unverändert geschützt", () => {
    for (const t of ["orb_dev_fix_proposals", "orb_dev_fix_approvals", "orb_dev_audit_log"]) {
      expect(
        scalar(`select relrowsecurity from pg_class where oid='public.${t}'::regclass`),
        t,
      ).toBe("t");
    }
  });
});
