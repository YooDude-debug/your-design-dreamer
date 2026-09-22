/**
 * ORB Developer / Repair Environment – Phase 2: Sicherheitsvertrag der
 * Persistenztabellen (nur lesend geprüft).
 *
 * Belegt: die drei Tabellen existieren, Zeilenschutz ist aktiv, jede Regel
 * bindet die Administratorrolle, nicht angemeldete Besucher und normale
 * Benutzer haben keinen Zugriff, Fix-Inhalte und Freigaben sind per Trigger
 * unveränderlich, manipulierte Fix-IDs und Freigabequellen scheitern an
 * Prüfbedingungen, und je Fix existiert höchstens eine gültige Freigabe.
 */
import { describe, expect, it } from "vitest";

import { column, dbAvailable, scalar } from "./db-client";

const run = dbAvailable() ? describe : describe.skip;

const TABLES = ["orb_dev_fix_proposals", "orb_dev_fix_approvals", "orb_dev_audit_log"];

run("ORB Developer / Repair – Persistenzsicherheit", () => {
  it("alle drei Tabellen existieren", () => {
    const found = column(
      `select tablename from pg_tables where schemaname='public' and tablename like 'orb\\_dev\\_%' order by 1`,
    );
    for (const t of TABLES) expect(found).toContain(t);
  });

  it("Zeilenschutz ist auf jeder Tabelle aktiv", () => {
    for (const t of TABLES) {
      const on = scalar(`select relrowsecurity from pg_class where oid = 'public.${t}'::regclass`);
      expect(on, t).toBe("t");
    }
  });

  it("jede Regel verlangt die Administratorrolle", () => {
    for (const t of TABLES) {
      const defs = column(
        `select coalesce(qual,'') || ' ' || coalesce(with_check,'') from pg_policies where schemaname='public' and tablename='${t}'`,
      );
      expect(defs.length, t).toBeGreaterThan(0);
      for (const def of defs) expect(def, `${t}: ${def}`).toContain("has_role");
    }
  });

  it("nicht angemeldete Besucher haben keine Rechte", () => {
    for (const t of TABLES) {
      const grants = column(
        `select privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='${t}' and grantee='anon'`,
      );
      expect(grants, t).toEqual([]);
    }
  });

  it("es gibt keine Regel für normale Benutzer ausserhalb der Administratorrolle", () => {
    const open = column(
      `select tablename || ':' || policyname from pg_policies
       where schemaname='public' and tablename like 'orb\\_dev\\_%'
         and coalesce(qual,'') || coalesce(with_check,'') not like '%has_role%'`,
    );
    expect(open).toEqual([]);
  });

  it("das Protokoll kann nicht geändert oder gelöscht werden", () => {
    const writeGrants = column(
      `select distinct privilege_type from information_schema.role_table_grants
       where table_schema='public' and table_name='orb_dev_audit_log'
         and privilege_type in ('UPDATE','DELETE','TRUNCATE')`,
    );
    expect(writeGrants).toEqual([]);
    const cmds = column(
      `select cmd from pg_policies where schemaname='public' and tablename='orb_dev_audit_log'`,
    );
    expect(cmds).not.toContain("UPDATE");
    expect(cmds).not.toContain("DELETE");
  });

  it("Fix-Vorschläge und Freigaben sind per Trigger unveränderlich", () => {
    const triggers = column(
      `select tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'orb_dev_%'`,
    );
    expect(triggers).toContain("orb_dev_fix_proposals_immutable");
    expect(triggers).toContain("orb_dev_fix_approvals_immutable");
  });

  it("manipulierte Fix-IDs scheitern an einer Prüfbedingung", () => {
    const checks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.orb_dev_fix_proposals'::regclass and contype='c'`,
    ).join(" ");
    expect(checks).toContain("ORB-FIX-");
    expect(checks).toContain("fingerprint");
  });

  it("nur die Administratoroberfläche darf Freigabequelle sein", () => {
    const checks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.orb_dev_fix_approvals'::regclass and contype='c'`,
    ).join(" ");
    expect(checks).toContain("admin_ui");
  });

  it("eine Freigabe verweist zwingend auf einen gespeicherten Fix", () => {
    const fks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.orb_dev_fix_approvals'::regclass and contype='f'`,
    ).join(" ");
    expect(fks).toContain("orb_dev_fix_proposals");
  });

  it("je Fix existiert höchstens eine gültige Freigabe", () => {
    const idx = column(
      `select indexdef from pg_indexes where schemaname='public' and tablename='orb_dev_fix_approvals'`,
    ).join(" ");
    expect(idx).toContain("orb_dev_one_active_approval_per_fix");
    expect(idx).toContain("APPROVED");
  });

  it("der Statusraum ist in der Datenbank eingegrenzt", () => {
    const checks = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.orb_dev_fix_proposals'::regclass and contype='c'`,
    ).join(" ");
    for (const state of ["DRAFT", "WAITING_FOR_ADMIN_APPROVAL", "APPROVED", "INVALIDATED"]) {
      expect(checks).toContain(state);
    }
  });

  it("die Versionierung ist gespeichert und Fix-IDs sind eindeutig", () => {
    const cols = column(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='orb_dev_fix_proposals'`,
    );
    for (const c of ["version", "supersedes_fix_id", "fingerprint", "created_at", "updated_at"]) {
      expect(cols).toContain(c);
    }
    const uniques = column(
      `select pg_get_constraintdef(oid) from pg_constraint
       where conrelid='public.orb_dev_fix_proposals'::regclass and contype='u'`,
    ).join(" ");
    expect(uniques).toContain("fix_id");
  });
});
