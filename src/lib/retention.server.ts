import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Aufbewahrungsfristen – technische Vorbereitung (DSGVO-Hardening Punkt 6/18).
 *
 * WICHTIG – OFFENE RECHTLICHE KONFIGURATION:
 * Es sind absichtlich KEINE Fristen vorgegeben. Jeder Wert ist eine
 * Serverumgebungsvariable. Ist sie nicht gesetzt (oder <= 0), findet für den
 * jeweiligen Datenbestand KEINE automatische Löschung statt. Erst nach
 * rechtlicher Festlegung werden die Werte (Tage) gesetzt; danach räumt der
 * Lauf `/api/public/retention-run` die betroffenen Tabellen auf.
 *
 * Die Fristen betreffen ausschliesslich technische Protokolle/Warteschlangen.
 * Nutzerinhalte (Beiträge, SlangTags, Chats) werden hier NICHT angefasst –
 * diese löscht der Nutzer selbst bzw. die Kontolöschung.
 */
export type RetentionRule = {
  /** Name der Serverumgebungsvariable mit der Frist in Tagen. */
  env: string;
  table: string;
  /** Zeitstempel-Spalte, nach der gelöscht wird. */
  column: string;
  /** Kurzbeschreibung für Dokumentation und Auditierbarkeit. */
  purpose: string;
};

export const RETENTION_RULES: RetentionRule[] = [
  {
    env: "RETENTION_DAYS_CONTENT_MODERATION_LOG",
    table: "content_moderation_log",
    column: "created_at",
    purpose: "Protokoll automatisierter Moderationsentscheidungen (Nachvollziehbarkeit).",
  },
  {
    env: "RETENTION_DAYS_ADMIN_AUDIT_LOG",
    table: "admin_audit_log",
    column: "created_at",
    purpose: "Protokoll administrativer Eingriffe (Missbrauchs-/Sicherheitsnachweis).",
  },
  {
    env: "RETENTION_DAYS_ACCOUNT_SECURITY_EVENTS",
    table: "account_security_events",
    column: "created_at",
    purpose: "Sicherheitsereignisse zu Export/Löschung (Ratenbegrenzung, Missbrauchserkennung).",
  },
  {
    env: "RETENTION_DAYS_SLANGTAG_MODERATION_EVENTS",
    table: "slang_tag_moderation_events",
    column: "created_at",
    purpose: "Moderationsverlauf einzelner SlangTags.",
  },
  {
    env: "RETENTION_DAYS_POST_MODERATION_JOBS",
    table: "post_moderation_jobs",
    column: "updated_at",
    purpose: "Abgearbeitete Moderations-Warteschlange.",
  },
  {
    env: "RETENTION_DAYS_FEED_SIGNALS",
    table: "feed_signals",
    column: "created_at",
    purpose: "Rohsignale der Feed-Personalisierung.",
  },
  {
    env: "RETENTION_DAYS_INTERACTION_EVENTS",
    table: "interaction_events",
    column: "created_at",
    purpose: "Rohsignale der Interessen-/Empfehlungsberechnung.",
  },
  {
    env: "RETENTION_DAYS_AD_TEST_EVENTS",
    table: "ad_test_events",
    column: "created_at",
    purpose: "Messwerte des internen Werbe-Testmodus.",
  },
];

export type RetentionOutcome = {
  table: string;
  env: string;
  /** null = keine Frist konfiguriert → nichts gelöscht. */
  days: number | null;
  deleted: number;
  skipped: boolean;
  error?: string;
};

function configuredDays(env: string): number | null {
  const raw = process.env[env];
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Führt die konfigurierten Aufbewahrungsfristen aus. Ohne gesetzte
 * Umgebungsvariablen ist der Lauf ein reiner Bericht ohne Löschungen.
 */
export async function runRetention(): Promise<{
  results: RetentionOutcome[];
  configured: number;
  deleted: number;
}> {
  const results: RetentionOutcome[] = [];

  for (const rule of RETENTION_RULES) {
    const days = configuredDays(rule.env);
    if (days === null) {
      results.push({ table: rule.table, env: rule.env, days: null, deleted: 0, skipped: true });
      continue;
    }
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    try {
      const { data, error } = await (
        supabaseAdmin as unknown as {
          from: (t: string) => {
            delete: (o: { count: "exact" }) => {
              lt: (
                c: string,
                v: string,
              ) => Promise<{
                data: unknown[] | null;
                error: { message: string } | null;
                count: number | null;
              }>;
            };
          };
        }
      )
        .from(rule.table)
        .delete({ count: "exact" })
        .lt(rule.column, cutoff);
      if (error) throw new Error(error.message);
      results.push({
        table: rule.table,
        env: rule.env,
        days,
        deleted: Array.isArray(data) ? data.length : 0,
        skipped: false,
      });
    } catch (err) {
      results.push({
        table: rule.table,
        env: rule.env,
        days,
        deleted: 0,
        skipped: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return {
    results,
    configured: results.filter((r) => !r.skipped).length,
    deleted: results.reduce((sum, r) => sum + r.deleted, 0),
  };
}
