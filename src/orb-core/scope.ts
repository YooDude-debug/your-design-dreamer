/**
 * ORB Scope – strikte Bereichstrennung.
 *
 * Vertrag: jede ORB-Anfrage arbeitet mit user_id = Sitzung UND scope = Route.
 * Der Bereich wird serverseitig gegen die feste Liste geprüft; es gibt keinen
 * Standardwert, keine Erkennung aus Text und keine automatische Zuordnung.
 *
 * `scopedDb` setzt den Bereich zentral in JEDE Abfrage auf bereichsgebundene
 * Tabellen (Filter in der Datenbankabfrage selbst, damit vor order/limit) und
 * in jede neue Zeile. `orb_state` und `orb_style` bleiben bewusst userweit.
 */

import type { DB } from "./engine.server";

export {
  ORB_CHAT_SCOPES,
  ORB_DEV_SCOPE,
  ORB_FEED_SCOPE,
  isOrbChatScope,
  orbChatScopeSchema,
  type OrbChatScope,
  type OrbDataScope,
} from "./scope-values";
import { ORB_CHAT_SCOPES, type OrbDataScope } from "./scope-values";

/** Tabellen mit Spalte `scope`. */
export const ORB_SCOPED_TABLES: ReadonlySet<string> = new Set([
  "orb_messages",
  "orb_nodes",
  "orb_connections",
  "orb_threads",
  "orb_questions",
  "orb_interests",
  "orb_candidates",
]);

const DATA_SCOPES: readonly string[] = [...ORB_CHAT_SCOPES, "unassigned"];

export class OrbScopeViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrbScopeViolation";
  }
}

function withScope(values: unknown, scope: OrbDataScope): unknown {
  const apply = (row: unknown) => {
    if (!row || typeof row !== "object") return row;
    const r = row as Record<string, unknown>;
    if ("scope" in r && r["scope"] !== scope) {
      throw new OrbScopeViolation("Zeile mit fremdem Bereich abgelehnt");
    }
    return { ...r, scope };
  };
  return Array.isArray(values) ? values.map(apply) : apply(values);
}

function rejectScopeChange(values: unknown): unknown {
  if (values && typeof values === "object" && "scope" in (values as object)) {
    throw new OrbScopeViolation("Bereichswechsel über den Chat ist nicht erlaubt");
  }
  return values;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Datenzugang, der für bereichsgebundene Tabellen immer `scope = S` filtert
 * bzw. setzt. Andere Tabellen und alle übrigen Methoden bleiben unverändert.
 */
export function scopedDb(db: DB, scope: OrbDataScope): DB {
  if (!DATA_SCOPES.includes(scope)) {
    throw new OrbScopeViolation("Ungültiger Bereich");
  }
  const from = (table: string) => {
    const qb = (db as any).from(table);
    if (!ORB_SCOPED_TABLES.has(table)) return qb;
    return {
      select: (...args: any[]) => qb.select(...args).eq("scope", scope),
      insert: (values: unknown, opts?: unknown) => qb.insert(withScope(values, scope), opts),
      upsert: (values: unknown, opts?: unknown) => qb.upsert(withScope(values, scope), opts),
      update: (values: unknown, opts?: unknown) =>
        qb.update(rejectScopeChange(values), opts).eq("scope", scope),
      delete: (opts?: unknown) => qb.delete(opts).eq("scope", scope),
    };
  };
  return new Proxy(db as object, {
    get(target, prop, receiver) {
      if (prop === "from") return from;
      if (prop === "__orbScope") return scope;
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as DB;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Bereich eines bereichsgebundenen Datenzugangs (für Diagnose). */
export function scopeOf(db: DB): OrbDataScope | null {
  const s = (db as unknown as { __orbScope?: unknown }).__orbScope;
  return typeof s === "string" && DATA_SCOPES.includes(s) ? (s as OrbDataScope) : null;
}
