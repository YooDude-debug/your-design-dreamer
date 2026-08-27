/**
 * Observability – Datenaufbereitung für die technische Übersicht (Phase 3).
 *
 * Liefert ausschließlich aggregierte technische Kennzahlen und Vorfälle für die
 * Adminansicht. Keine Nutzerinhalte, keine Geheimnisse.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { alertChannelConfigured, OPS_AREA_THRESHOLD_TEXT } from "@/lib/ops-monitor.server";
import { runtimeMetrics } from "@/lib/runtime-metrics.server";
import {
  OPS_AREAS,
  OPS_AREA_LABEL,
  isSelftestEvent,
  systemStatus,
  type OpsArea,
  type OpsEventDTO,
  type OpsHealth,
  type OpsIncidentDTO,
  type OpsSeverity,
} from "@/lib/ops-monitor.shared";
import type { AppEnvironment } from "@/lib/environment.shared";


type EventRow = {
  id: string;
  created_at: string;
  environment: string;
  severity: string;
  area: string;
  event: string;
  service: string | null;
  fn: string | null;
  message: string | null;
  duration_ms: number | null;
};

function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return Math.round(sorted[index] ?? 0);
}

/** Vollständige Momentaufnahme für eine Umgebung. */
export async function loadOpsHealth(environment: AppEnvironment): Promise<OpsHealth> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 3_600_000).toISOString();
  const since1h = new Date(now - 3_600_000).toISOString();

  const [{ data: events }, { data: incidents }] = await Promise.all([
    supabaseAdmin
      .from("ops_events")
      .select(
        "id, created_at, environment, severity, area, event, service, fn, message, duration_ms",
      )
      .eq("environment", environment)
      .gte("created_at", since24h)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabaseAdmin
      .from("ops_incidents")
      .select(
        "id, environment, severity, area, title, summary, event_count, first_seen_at, last_seen_at, status, alerted_at, alert_count, note, fingerprint",
      )
      .eq("environment", environment)
      .order("last_seen_at", { ascending: false })
      .limit(50),
  ]);

  const allRows = (events ?? []) as EventRow[];
  // Selbsttest-Ereignisse bleiben sichtbar, zählen aber nicht in Kennzahlen,
  // Bereichsstatistik oder Ampel – sonst sähe ein Test wie ein Ausfall aus.
  const rows = allRows.filter((r) => !isSelftestEvent(r.event));
  const isError = (s: string) => s === "warning" || s === "critical";
  const isTestIncident = (i: { fingerprint?: string | null; title?: string }) =>
    (i.fingerprint ?? "").startsWith("selftest:");

  const openIncidents = (incidents ?? []).filter(
    (i) => i.status !== "resolved" && !isTestIncident(i),
  );
  const areaStats = OPS_AREAS.map((area) => {
    const areaRows = rows.filter((r) => r.area === area);
    const durations = areaRows
      .map((r) => r.duration_ms)
      .filter((v): v is number => typeof v === "number");
    return {
      area,
      label: OPS_AREA_LABEL[area],
      errors1h: areaRows.filter((r) => r.created_at >= since1h && isError(r.severity)).length,
      errors24h: areaRows.filter((r) => isError(r.severity)).length,
      critical24h: areaRows.filter((r) => r.severity === "critical").length,
      openIncidents: openIncidents.filter((i) => i.area === area).length,
      p95DurationMs: p95(durations),
      threshold: OPS_AREA_THRESHOLD_TEXT[area],
    };
  });

  const errors1h = rows.filter((r) => r.created_at >= since1h && isError(r.severity)).length;
  const status = systemStatus({
    criticalOpen: openIncidents.filter((i) => i.severity === "critical").length,
    warningOpen: openIncidents.filter((i) => i.severity === "warning").length,
    errorsLastHour: errors1h,
  });

  const incidentDTOs: OpsIncidentDTO[] = (incidents ?? []).map((i) => ({
    id: i.id,
    environment: i.environment as AppEnvironment,
    severity: i.severity as OpsSeverity,
    area: i.area as OpsArea,
    title: i.title,
    summary: i.summary,
    eventCount: i.event_count,
    firstSeenAt: i.first_seen_at,
    lastSeenAt: i.last_seen_at,
    status: i.status as OpsIncidentDTO["status"],
    alertedAt: i.alerted_at,
    alertCount: i.alert_count,
    note: i.note,
    isTest: isTestIncident(i),
  }));

  const recentEvents: OpsEventDTO[] = allRows.slice(0, 40).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    environment: r.environment as AppEnvironment,
    severity: r.severity as OpsSeverity,
    area: r.area as OpsArea,
    event: r.event,
    service: r.service,
    fn: r.fn,
    message: r.message,
    durationMs: r.duration_ms,
    isTest: isSelftestEvent(r.event),
  }));

  return {
    environment,
    generatedAt: new Date().toISOString(),
    status,
    totals: {
      events1h: rows.filter((r) => r.created_at >= since1h).length,
      errors1h,
      errors24h: rows.filter((r) => isError(r.severity)).length,
      critical24h: rows.filter((r) => r.severity === "critical").length,
    },

    areas: areaStats,
    incidents: incidentDTOs,
    recentEvents,
    alertChannel: {
      configured: alertChannelConfigured(),
      kind: alertChannelConfigured() ? "webhook" : "log",
    },
    runtime: runtimeMetrics(),
  };
}
