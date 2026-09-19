/**
 * ORB Core – Sicherheitsvertrag der neuen Tabellen (nur lesend geprüft).
 *
 * Belegt: Zeilenschutz aktiv, Regeln ausschliesslich auf die eigene
 * Benutzerkennung, kein Zugriff für nicht angemeldete Besucher, und eine
 * strukturelle Garantie dafür, dass Verfall keine Erinnerung entfernt
 * (es existiert kein Löschvorgang in der Datenbank selbst).
 */
import { describe, expect, it } from "vitest";

import { column, dbAvailable, scalar } from "./db-client";

const run = dbAvailable() ? describe : describe.skip;
const TABLES = [
  "orb_nodes",
  "orb_connections",
  "orb_state",
  "orb_messages",
  "orb_interests",
  "orb_suggestions",
  "orb_metrics",
  "orb_questions",
];

run("ORB Core – Datenbanksicherheit", () => {
  it("alle ORB-Tabellen existieren", () => {
    const found = column(
      `select tablename from pg_tables where schemaname='public' and tablename like 'orb\\_%' order by 1`,
    );
    for (const t of TABLES) expect(found).toContain(t);
  });

  it("Zeilenschutz ist auf jeder ORB-Tabelle aktiv", () => {
    for (const t of TABLES) {
      const on = scalar(`select relrowsecurity from pg_class where oid = 'public.${t}'::regclass`);
      expect(on, t).toBe("t");
    }
  });

  it("jede ORB-Tabelle hat mindestens eine Regel, und jede bindet auth.uid()", () => {
    for (const t of TABLES) {
      const rows = column(
        `select coalesce(qual,'') || ' ' || coalesce(with_check,'') from pg_policies where schemaname='public' and tablename='${t}'`,
      );
      expect(rows.length, t).toBeGreaterThan(0);
      for (const clause of rows) expect(clause, t).toContain("auth.uid()");
    }
  });

  it("Regeln gelten nur für angemeldete Benutzer", () => {
    for (const t of TABLES) {
      const roles = column(
        `select array_to_string(roles, ',') from pg_policies where schemaname='public' and tablename='${t}'`,
      );
      for (const r of roles) {
        expect(r, t).toContain("authenticated");
        expect(r, t).not.toContain("anon");
      }
    }
  });

  // Rechte werden direkt aus dem Rechtekatalog der Tabelle gelesen, nicht über
  // information_schema: dort sind nur Rechte sichtbar, die die aktuelle Rolle betreffen.
  const privsOf = (table: string, role: string) =>
    column(
      `select a.privilege_type from pg_class c join pg_namespace n on n.oid=c.relnamespace,
         aclexplode(c.relacl) a join pg_roles r on r.oid=a.grantee
       where n.nspname='public' and c.relname='${table}' and r.rolname='${role}'`,
    );

  it("nicht angemeldete Besucher haben keine Tabellenrechte", () => {
    for (const t of TABLES) expect(privsOf(t, "anon"), t).toHaveLength(0);
  });

  it("angemeldete Benutzer haben nur die benötigten Tabellenrechte", () => {
    for (const t of TABLES) {
      const privs = privsOf(t, "authenticated").sort();
      const expected =
        t === "orb_metrics"
          ? ["DELETE", "INSERT", "SELECT"]
          : t === "orb_questions"
            ? ["INSERT", "SELECT", "UPDATE"]
            : ["DELETE", "INSERT", "SELECT", "UPDATE"];
      expect(privs, t).toEqual(expected);
    }
  });

  it("Verbindungen sind gerichtet, eindeutig und ohne Selbstbezug", () => {
    const checks = column(
      `select conname from pg_constraint where conrelid='public.orb_connections'::regclass`,
    );
    expect(checks).toContain("orb_connections_no_self");
    expect(checks).toContain("orb_connections_unique");
  });

  it("Gewichte, Wichtigkeit und Zustandswerte sind auf 0..1 begrenzt", () => {
    const def = column(
      `select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.orb_connections'::regclass and contype='c'`,
    ).join(" ");
    expect(def).toContain("weight");
    const state = column(
      `select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.orb_state'::regclass and contype='c'`,
    ).join(" ");
    for (const field of ["curiosity", "joy", "fear", "trust", "uncertainty", "energy"]) {
      expect(state).toContain(field);
    }
  });

  it("VERGESSEN ≠ LÖSCHEN: keine Datenbankroutine entfernt ORB-Erinnerungen", () => {
    const routines = column(
      `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prokind='f' and pg_get_functiondef(p.oid) ilike '%orb\\_nodes%'
         and pg_get_functiondef(p.oid) ilike '%delete%'`,
    );
    expect(routines).toHaveLength(0);
  });
});
