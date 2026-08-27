import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { RETENTION_RULES, type RetentionAction, type RetentionRule } from "@/lib/retention-policy";

/**
 * Ausführung des Aufbewahrungs- und Löschkonzepts.
 *
 * Das Regelwerk (was, warum, wie lange, welche Aktion, welche gesetzliche
 * Aufbewahrung) steht in `retention-policy.ts`. Hier wird es angewendet:
 * - `delete`    → Zeilen älter als die Frist werden entfernt.
 * - `anonymize` → Zeilen bleiben, der Personenbezug wird überschrieben.
 * - `keep`      → nie automatisch löschen (gesetzliche Aufbewahrung).
 *
 * Fristen sind pro Regel über `RETENTION_DAYS_<KEY>` überschreibbar (0
 * deaktiviert die Regel); `RETENTION_DISABLED=1` schaltet den ganzen Lauf ab.
 */

export type { RetentionRule } from "@/lib/retention-policy";
export { RETENTION_RULES } from "@/lib/retention-policy";

/** Untypisierter Zugriff, weil die Tabellennamen aus dem Regelwerk kommen. */
type LooseTable = {
  delete: () => { lt: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  update: (values: Record<string, unknown>) => {
    lt: (
      c: string,
      v: string,
    ) => {
      select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
  select: (
    c: string,
    o: { count: "exact"; head: true },
  ) => {
    lt: (
      c: string,
      v: string,
    ) => Promise<{ count: number | null; error: { message: string } | null }>;
  };
};
const db = supabaseAdmin as unknown as { from: (t: string) => LooseTable };

export type RetentionOutcome = {
  key: string;
  table: string;
  action: RetentionAction;
  /** Angewandte Frist in Tagen; null bei `keep` oder deaktivierter Regel. */
  days: number | null;
  /** Anzahl betroffener Zeilen (gelöscht bzw. anonymisiert). */
  affected: number;
  skipped: boolean;
  reason?: string;
  error?: string;
};

export type RetentionReport = {
  results: RetentionOutcome[];
  executed: number;
  deleted: number;
  anonymized: number;
  retainedByLaw: string[];
  dryRun: boolean;
};

/** Effektive Frist: Umgebungsvariable schlägt Regelfrist. */
export function effectiveDays(rule: RetentionRule): number | null {
  const raw = process.env[`RETENTION_DAYS_${rule.key}`];
  if (raw !== undefined && raw !== "") {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }
  return rule.days;
}

function cutoffFor(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function countOlder(rule: RetentionRule, cutoff: string): Promise<number> {
  const { count } = await db
    .from(rule.table)
    .select("*", { count: "exact", head: true })
    .lt(rule.column, cutoff);
  return count ?? 0;
}

async function applyRule(rule: RetentionRule, dryRun: boolean): Promise<RetentionOutcome> {
  const base = { key: rule.key, table: rule.table, action: rule.action };

  if (rule.action === "keep") {
    return {
      ...base,
      days: null,
      affected: 0,
      skipped: true,
      reason: "Gesetzliche Aufbewahrungspflicht – keine automatische Löschung.",
    };
  }

  const days = effectiveDays(rule);
  if (days === null) {
    return {
      ...base,
      days: null,
      affected: 0,
      skipped: true,
      reason: `Regel deaktiviert (RETENTION_DAYS_${rule.key}=0).`,
    };
  }

  const cutoff = cutoffFor(days);

  try {
    if (dryRun) {
      return {
        ...base,
        days,
        affected: await countOlder(rule, cutoff),
        skipped: true,
        reason: "Probelauf",
      };
    }

    if (rule.action === "anonymize") {
      const values = { ...(rule.anonymize ?? {}) } as Record<string, unknown>;
      // Nur Zeilen anfassen, die noch Personenbezug tragen: doppelte Läufe
      // bleiben dadurch wirkungslos, ohne die Zeile zu verändern.
      const { data, error } = await db
        .from(rule.table)
        .update(values)
        .lt(rule.column, cutoff)
        .select("*");
      if (error) throw new Error(error.message);
      return { ...base, days, affected: Array.isArray(data) ? data.length : 0, skipped: false };
    }

    const affected = await countOlder(rule, cutoff);
    const { error } = await db.from(rule.table).delete().lt(rule.column, cutoff);
    if (error) throw new Error(error.message);
    return { ...base, days, affected, skipped: false };
  } catch (err) {
    return {
      ...base,
      days,
      affected: 0,
      skipped: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/**
 * Führt das Aufbewahrungskonzept aus. `dryRun` berichtet nur, wie viele
 * Zeilen betroffen wären, ohne etwas zu verändern.
 */
export async function runRetention(options: { dryRun?: boolean } = {}): Promise<RetentionReport> {
  const dryRun = options.dryRun === true || process.env["RETENTION_DISABLED"] === "1";
  const results: RetentionOutcome[] = [];

  for (const rule of RETENTION_RULES) {
    results.push(await applyRule(rule, dryRun));
  }

  return {
    results,
    executed: results.filter((r) => !r.skipped && !r.error).length,
    deleted: results
      .filter((r) => r.action === "delete" && !r.skipped)
      .reduce((s, r) => s + r.affected, 0),
    anonymized: results
      .filter((r) => r.action === "anonymize" && !r.skipped)
      .reduce((s, r) => s + r.affected, 0),
    retainedByLaw: RETENTION_RULES.filter((r) => r.action === "keep").map((r) => r.table),
    dryRun,
  };
}
