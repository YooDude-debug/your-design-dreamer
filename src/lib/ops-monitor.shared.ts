/**
 * Observability – gemeinsame, reine Logik (Phase 3).
 *
 * Diese Datei enthält ausschließlich Entscheidungen ohne Nebenwirkungen:
 * Schweregrade, Bereiche, Gruppierung gleichartiger Fehler, Schwellenwerte,
 * Alarm-Entscheidung und Alarm-Text. Dadurch ist das Alarmverhalten
 * automatisiert testbar, ohne Datenbank oder Netzwerk.
 *
 * Grundsatz: Es werden niemals Geheimnisse oder personenbezogene Daten
 * verarbeitet – nur technische Kennungen und Zähler.
 */

import type { AppEnvironment } from "@/lib/environment.shared";

export type OpsSeverity = "info" | "warning" | "critical";

/** Überwachte technische Bereiche. */
export type OpsArea =
  | "api"
  | "database"
  | "rpc"
  | "auth"
  | "payments"
  | "webhook"
  | "push"
  | "performance"
  | "security";

export const OPS_AREAS: readonly OpsArea[] = [
  "api",
  "database",
  "rpc",
  "auth",
  "payments",
  "webhook",
  "push",
  "performance",
  "security",
] as const;

export const OPS_AREA_LABEL: Record<OpsArea, string> = {
  api: "API / Backend",
  database: "Datenbank",
  rpc: "Datenbankfunktionen (RPC)",
  auth: "Anmeldung",
  payments: "Zahlungen",
  webhook: "Webhooks",
  push: "Push-Benachrichtigungen",
  performance: "Performance",
  security: "Sicherheit",
};

export type OpsIncidentStatus = "open" | "acknowledged" | "investigating" | "resolved";

/**
 * Alarmregel je Bereich.
 *
 * - `threshold`: wie viele gleichartige Ereignisse innerhalb des Fensters
 *   auftreten müssen, bevor überhaupt alarmiert wird (Aggregation statt Spam).
 * - `windowMinutes`: Beobachtungsfenster.
 * - `renotifyMinutes`: frühestens nach dieser Zeit wird für denselben Vorfall
 *   erneut benachrichtigt.
 * - `alertSeverity`: ab diesem Schweregrad ist eine Benachrichtigung möglich.
 */
export type OpsAlertRule = {
  threshold: number;
  windowMinutes: number;
  renotifyMinutes: number;
  alertSeverity: OpsSeverity;
};

/**
 * Schwellenwerte. Zahlungen und Sicherheit alarmieren beim ersten kritischen
 * Ereignis, weil dort echtes Geld bzw. Schutzverletzungen betroffen sind.
 * Bereiche mit natürlicher Fehlerquote (Push, Auth, Performance) brauchen eine
 * Häufung, damit Einzelfälle keinen Alarm erzeugen.
 */
export const OPS_ALERT_RULES: Record<OpsArea, OpsAlertRule> = {
  api: { threshold: 10, windowMinutes: 10, renotifyMinutes: 30, alertSeverity: "critical" },
  database: { threshold: 3, windowMinutes: 10, renotifyMinutes: 30, alertSeverity: "critical" },
  rpc: { threshold: 5, windowMinutes: 10, renotifyMinutes: 30, alertSeverity: "critical" },
  auth: { threshold: 20, windowMinutes: 10, renotifyMinutes: 60, alertSeverity: "critical" },
  payments: { threshold: 1, windowMinutes: 60, renotifyMinutes: 15, alertSeverity: "critical" },
  webhook: { threshold: 3, windowMinutes: 15, renotifyMinutes: 30, alertSeverity: "critical" },
  push: { threshold: 25, windowMinutes: 30, renotifyMinutes: 120, alertSeverity: "critical" },
  performance: { threshold: 10, windowMinutes: 15, renotifyMinutes: 120, alertSeverity: "warning" },
  security: { threshold: 1, windowMinutes: 60, renotifyMinutes: 15, alertSeverity: "critical" },
};

/** Latenzgrenzen in Millisekunden, ab denen eine Messung auffällig ist. */
export const OPS_LATENCY_BUDGET_MS: Record<"api" | "database" | "rpc" | "webhook" | "push", number> =
  {
    api: 2000,
    database: 800,
    rpc: 1200,
    webhook: 3000,
    push: 5000,
  };

/** Gruppierungskennung: gleichartige Fehler landen im selben Vorfall. */
export function opsFingerprint(input: { area: OpsArea; event: string; service?: string | null }): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60);
  const parts = [slug(input.area), slug(input.event)];
  if (input.service) parts.push(slug(input.service));
  return parts.filter(Boolean).join(":");
}

/** Lesbarer Titel eines Vorfalls (ohne Nutzdaten). */
export function opsIncidentTitle(area: OpsArea, event: string): string {
  return `${OPS_AREA_LABEL[area]} – ${event.replace(/_/g, " ")}`;
}

/**
 * Ist eine Benachrichtigung fällig?
 *
 * Ablauf: Ereignisse werden gezählt → Schwellenwert im Fenster geprüft →
 * Wiederholungssperre geprüft. Ereignisse unterhalb des geforderten
 * Schweregrades und alles außerhalb von Production/Staging lösen nichts aus.
 */
export function shouldAlert(input: {
  area: OpsArea;
  severity: OpsSeverity;
  environment: AppEnvironment;
  /** Anzahl gleichartiger Ereignisse im Beobachtungsfenster (inkl. aktuellem). */
  countInWindow: number;
  /** Zeitpunkt der letzten Benachrichtigung für denselben Vorfall. */
  lastAlertedAt?: string | Date | null;
  now?: Date;
  rules?: Record<OpsArea, OpsAlertRule>;
}): { alert: boolean; reason: string } {
  const rule = (input.rules ?? OPS_ALERT_RULES)[input.area];
  if (input.environment === "development") return { alert: false, reason: "development" };

  const order: Record<OpsSeverity, number> = { info: 0, warning: 1, critical: 2 };
  if (order[input.severity] < order[rule.alertSeverity]) {
    return { alert: false, reason: "severity_below_rule" };
  }
  if (input.countInWindow < rule.threshold) {
    return { alert: false, reason: "below_threshold" };
  }
  if (input.lastAlertedAt) {
    const last = new Date(input.lastAlertedAt).getTime();
    const now = (input.now ?? new Date()).getTime();
    if (Number.isFinite(last) && now - last < rule.renotifyMinutes * 60_000) {
      return { alert: false, reason: "throttled" };
    }
  }
  return { alert: true, reason: "threshold_reached" };
}

/**
 * Alarmtext. Enthält nur Umgebung, Schweregrad, Bereich, Kurzbeschreibung,
 * Zeitpunkt, Vorfalls-ID und einen Verweis auf die technische Übersicht.
 */
export function formatAlert(input: {
  environment: AppEnvironment;
  severity: OpsSeverity;
  area: OpsArea;
  event: string;
  summary?: string | null;
  incidentId: string;
  count: number;
  at?: Date;
  dashboardUrl?: string;
}): { title: string; text: string } {
  const env = input.environment.toUpperCase();
  const sev = input.severity.toUpperCase();
  const at = (input.at ?? new Date()).toISOString();
  const title = `${sev} – ${env}: ${opsIncidentTitle(input.area, input.event)}`;
  const lines = [
    title,
    "",
    `Environment: ${env}`,
    `Service: ${OPS_AREA_LABEL[input.area]}`,
    `Severity: ${sev}`,
    `Event: ${input.event}`,
    `Incident ID: ${input.incidentId}`,
    `Occurrences: ${input.count}`,
    `Time: ${at}`,
  ];
  if (input.summary) lines.push(`Detail: ${input.summary}`);
  lines.push(
    input.dashboardUrl
      ? `Technische Logs: ${input.dashboardUrl}`
      : "Technische Logs: /admin/health",
  );
  return { title, text: lines.join("\n") };
}

/** Ampel für die Übersicht: aus offenen Vorfällen und Fehlerzahl abgeleitet. */
export function systemStatus(input: {
  criticalOpen: number;
  warningOpen: number;
  errorsLastHour: number;
}): { level: "ok" | "degraded" | "down"; label: string } {
  if (input.criticalOpen > 0) return { level: "down", label: "Kritischer Vorfall offen" };
  if (input.warningOpen > 0 || input.errorsLastHour > 20)
    return { level: "degraded", label: "Auffälligkeiten" };
  return { level: "ok", label: "Betrieb normal" };
}
