/**
 * Observability – serverseitige Erfassung, Bewertung und Alarmierung (Phase 3).
 *
 * Ablauf je Ereignis:
 *   Erkennen → Protokollieren → Gruppieren → Bewerten → Schwellwert prüfen → Alarm
 *
 * Eigenschaften:
 * - Verändert niemals den Programmablauf: alle Funktionen fangen ihre eigenen
 *   Fehler ab und geben nichts weiter.
 * - Speichert ausschließlich technische Kennungen, Zähler und gekürzte
 *   Fehlermeldungen – keine Geheimnisse, keine Inhalte, keine E-Mail-Adressen.
 * - Unterscheidet Development, Staging und Production; Development löst nie
 *   einen Alarm aus, Staging nie einen Production-Alarm.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { appEnvironment } from "@/lib/environment.server";
import { logEvent, sanitizeContext, type Area as LogArea } from "@/lib/observability.server";
import {
  OPS_ALERT_RULES,
  OPS_AREA_LABEL,
  OPS_LATENCY_BUDGET_MS,
  formatAlert,
  opsFingerprint,
  opsIncidentTitle,
  shouldAlert,
  type OpsArea,
  type OpsSeverity,
} from "@/lib/ops-monitor.shared";
import type { AppEnvironment } from "@/lib/environment.shared";

const MAX_MESSAGE = 300;

/** Bereichszuordnung für das bestehende Textprotokoll. */
const LOG_AREA: Record<OpsArea, LogArea> = {
  api: "server",
  database: "database",
  rpc: "database",
  auth: "auth",
  payments: "payments",
  webhook: "payments",
  push: "push",
  performance: "server",
  security: "auth",
};

export type OpsEventInput = {
  area: OpsArea;
  event: string;
  severity?: OpsSeverity;
  /** Betroffener Dienst, z. B. "stripe_webhook", "postgrest". */
  service?: string | null;
  /** Betroffene Funktion / Endpunkt, z. B. "market_start_transaction". */
  fn?: string | null;
  /** Fehlerobjekt oder Kurzbeschreibung. */
  error?: unknown;
  context?: Record<string, unknown>;
  durationMs?: number;
  environment?: AppEnvironment;
  request?: Request;
};

function messageOf(error: unknown): string | null {
  if (error == null) return null;
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, MAX_MESSAGE);
  if (typeof error === "string") return error.slice(0, MAX_MESSAGE);
  return "unknown_error";
}

/**
 * Zentrale Erfassung. Schreibt in das Textprotokoll und in die
 * Ereignistabelle, bildet daraus einen Vorfall und alarmiert bei Bedarf.
 */
export async function recordOpsEvent(input: OpsEventInput): Promise<{ eventId: string | null }> {
  const severity: OpsSeverity = input.severity ?? "warning";
  const environment = input.environment ?? appEnvironment(input.request);
  const fingerprint = opsFingerprint({
    area: input.area,
    event: input.event,
    service: input.service ?? null,
  });
  const message = messageOf(input.error);
  const context = sanitizeContext({
    ...input.context,
    environment,
    service: input.service ?? undefined,
    fn: input.fn ?? undefined,
  });

  // 1) Immer sichtbar im Serverprotokoll (auch wenn die Datenbank ausfällt).
  logEvent({
    area: LOG_AREA[input.area],
    event: input.event,
    severity: severity === "critical" ? "critical" : severity === "warning" ? "warn" : "info",
    context: { ...context, fingerprint, message: message ?? undefined },
    ...(typeof input.durationMs === "number" ? { durationMs: input.durationMs } : {}),
  });

  try {
    const { data, error } = await supabaseAdmin
      .from("ops_events")
      .insert({
        environment,
        severity,
        area: input.area,
        event: input.event.slice(0, 80),
        service: input.service ?? null,
        fn: input.fn ?? null,
        fingerprint,
        message,
        duration_ms:
          typeof input.durationMs === "number" && Number.isFinite(input.durationMs)
            ? Math.round(input.durationMs)
            : null,
        context: context as never,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[ops] event insert failed", error.message);
      return { eventId: null };
    }

    if (severity !== "info") {
      await evaluateIncident({
        area: input.area,
        event: input.event,
        severity,
        environment,
        fingerprint,
        summary: message,
      });
    }
    return { eventId: data?.id ?? null };
  } catch (error) {
    console.error("[ops] event pipeline failed", (error as Error).message);
    return { eventId: null };
  }
}

/** Bequemer Kurzaufruf für kritische Fehler. */
export function recordOpsFailure(
  area: OpsArea,
  event: string,
  error: unknown,
  extra?: Omit<OpsEventInput, "area" | "event" | "error" | "severity">,
): Promise<{ eventId: string | null }> {
  return recordOpsEvent({ ...extra, area, event, error, severity: "critical" });
}

/** Latenzmessung: protokolliert nur, wenn das Budget des Bereichs überschritten wird. */
export async function recordOpsLatency(
  area: keyof typeof OPS_LATENCY_BUDGET_MS,
  fn: string,
  durationMs: number,
  extra?: Omit<OpsEventInput, "area" | "event" | "durationMs">,
): Promise<void> {
  if (durationMs < OPS_LATENCY_BUDGET_MS[area]) return;
  await recordOpsEvent({
    ...extra,
    area: "performance",
    event: `slow_${area}`,
    severity: "warning",
    fn,
    durationMs,
    context: { ...extra?.context, budgetMs: OPS_LATENCY_BUDGET_MS[area] },
  });
}

/**
 * Aggregation und Bewertung: gleiche Fingerabdrücke werden zu einem offenen
 * Vorfall zusammengefasst; erst beim Erreichen des Schwellenwerts (und nach
 * Ablauf der Wiederholungssperre) wird eine Benachrichtigung erzeugt.
 */
async function evaluateIncident(input: {
  area: OpsArea;
  event: string;
  severity: OpsSeverity;
  environment: AppEnvironment;
  fingerprint: string;
  summary: string | null;
}): Promise<void> {
  const rule = OPS_ALERT_RULES[input.area];
  const since = new Date(Date.now() - rule.windowMinutes * 60_000).toISOString();

  const { count } = await supabaseAdmin
    .from("ops_events")
    .select("id", { count: "exact", head: true })
    .eq("environment", input.environment)
    .eq("fingerprint", input.fingerprint)
    .in("severity", ["warning", "critical"])
    .gte("created_at", since);
  const countInWindow = count ?? 1;

  const { data: existing } = await supabaseAdmin
    .from("ops_incidents")
    .select("id, event_count, alerted_at, alert_count, severity, status")
    .eq("environment", input.environment)
    .eq("fingerprint", input.fingerprint)
    .neq("status", "resolved")
    .maybeSingle();

  const nowIso = new Date().toISOString();
  let incidentId = existing?.id ?? null;

  if (existing) {
    const worseSeverity =
      existing.severity === "critical" || input.severity === "critical"
        ? "critical"
        : input.severity;
    await supabaseAdmin
      .from("ops_incidents")
      .update({
        event_count: (existing.event_count ?? 0) + 1,
        last_seen_at: nowIso,
        severity: worseSeverity,
        summary: input.summary,
      })
      .eq("id", existing.id);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from("ops_incidents")
      .insert({
        environment: input.environment,
        severity: input.severity,
        area: input.area,
        fingerprint: input.fingerprint,
        title: opsIncidentTitle(input.area, input.event),
        summary: input.summary,
        event_count: 1,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        status: "open",
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[ops] incident upsert failed", error.message);
      return;
    }
    incidentId = created?.id ?? null;
  }
  if (!incidentId) return;

  const decision = shouldAlert({
    area: input.area,
    severity: input.severity,
    environment: input.environment,
    countInWindow,
    lastAlertedAt: existing?.alerted_at ?? null,
  });
  if (!decision.alert) return;

  const sent = await dispatchAlert({
    environment: input.environment,
    severity: input.severity,
    area: input.area,
    event: input.event,
    summary: input.summary,
    incidentId,
    count: countInWindow,
  });

  await supabaseAdmin
    .from("ops_incidents")
    .update({
      alerted_at: nowIso,
      alert_count: (existing?.alert_count ?? 0) + 1,
    })
    .eq("id", incidentId);

  logEvent({
    area: LOG_AREA[input.area],
    event: "ops_alert_dispatched",
    severity: input.severity === "critical" ? "critical" : "warn",
    context: {
      incidentId,
      environment: input.environment,
      area: input.area,
      alertEvent: input.event,
      count: countInWindow,
      channel: sent ? "webhook" : "log_only",
    },
  });
}

/**
 * Hinterlegte externe Alarmkanäle (Reihenfolge = Zustellversuch).
 * Ein zweiter Kanal ist optional und dient als Ausweichweg, falls der erste
 * Anbieter selbst gestört ist.
 */
export function alertChannels(): string[] {
  return [process.env["OPS_ALERT_WEBHOOK_URL"], process.env["OPS_ALERT_WEBHOOK_URL_2"]].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

/** Ist mindestens ein externer Benachrichtigungskanal hinterlegt? */
export function alertChannelConfigured(): boolean {
  return alertChannels().length > 0;
}

const ALERT_TIMEOUT_MS = 5_000;

/** Einzelner Zustellversuch mit Zeitbegrenzung. */
async function postAlert(
  url: string,
  payload: { title: string; text: string },
): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // "text" passt zu Slack/Discord; "content" ist Discords Feldname.
      body: JSON.stringify({ text: payload.text, content: payload.text, title: payload.title }),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    return res.ok ? { ok: true, detail: "ok" } : { ok: false, detail: `http_${res.status}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).name || "network_error" };
  }
}

/**
 * Versand der Benachrichtigung.
 *
 * Eigenschaften:
 * - Jeder Kanal wird einmal wiederholt, bevor der nächste Kanal versucht wird.
 * - Jeder Versuch ist zeitbegrenzt; ein hängender Anbieter blockiert nichts.
 * - Ohne hinterlegten Kanal bleibt der Alarm im Serverprotokoll und in der
 *   Vorfallübersicht sichtbar (kein stiller Verlust).
 * - Eine fehlgeschlagene Zustellung wird selbst als Ereignis erfasst – mit
 *   Schweregrad "info", damit daraus kein Alarmkreislauf entsteht.
 */
async function dispatchAlert(input: {
  environment: AppEnvironment;
  severity: OpsSeverity;
  area: OpsArea;
  event: string;
  summary: string | null;
  incidentId: string;
  count: number;
}): Promise<boolean> {
  const { title, text } = formatAlert(input);
  const urls = alertChannels();
  if (urls.length === 0) {
    console.error(`[ops-alert] ${text}`);
    return false;
  }

  const failures: string[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const result = await postAlert(urls[i]!, { title, text });
      if (result.ok) return true;
      failures.push(`channel${i + 1}#${attempt}:${result.detail}`);
      console.error(`[ops-alert] delivery failed (${result.detail})`);
    }
  }

  console.error(`[ops-alert] undelivered: ${text}`);
  await recordOpsEvent({
    area: "api",
    event: "alert_dispatch_failed",
    severity: "info",
    environment: input.environment,
    service: "ops_alert_channel",
    context: {
      incidentId: input.incidentId,
      alertArea: input.area,
      alertEvent: input.event,
      attempts: failures.join(","),
    },
  });
  return false;
}

/**
 * Kontrollierter Alarmtest: sendet eine als Test gekennzeichnete Meldung über
 * den hinterlegten Kanal, ohne Vorfälle oder Fehlerereignisse zu erzeugen.
 * Damit lässt sich der Alarmweg auch in der Produktion gefahrlos prüfen.
 */
export async function testAlertChannel(request?: Request): Promise<{
  configured: boolean;
  delivered: boolean;
  channels: number;
}> {
  const environment = appEnvironment(request);
  const urls = alertChannels();
  if (urls.length === 0) return { configured: false, delivered: false, channels: 0 };

  const payload = {
    title: "Y-Dude Alarmtest",
    text: `[TEST] Y-Dude Alarmweg geprüft (${environment}) – kein echter Vorfall.`,
  };
  let delivered = false;
  for (const url of urls) {
    const result = await postAlert(url, payload);
    if (result.ok) {
      delivered = true;
      break;
    }
  }
  logEvent({
    area: "server",
    event: "ops_alert_channel_test",
    severity: delivered ? "info" : "warn",
    context: { environment, channels: urls.length, delivered },
  });
  return { configured: true, delivered, channels: urls.length };
}

/**
 * Lebenszeichen an einen externen Überwachungsdienst ("Totmannschalter").
 *
 * Zweck: Wenn Y-Dude selbst nicht erreichbar ist oder der Zeitplan nicht mehr
 * läuft, bleibt das Lebenszeichen aus und der externe Dienst alarmiert –
 * unabhängig von Y-Dude, der Datenbank und dem Admin-Cockpit.
 * Ohne hinterlegte URL passiert nichts (bewusst optional).
 */
export async function pingHeartbeat(): Promise<{ configured: boolean; ok: boolean }> {
  const url = process.env["OPS_HEARTBEAT_URL"];
  if (!url) return { configured: false, ok: false };
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(ALERT_TIMEOUT_MS) });
    if (!res.ok) console.error(`[ops-heartbeat] rejected (${res.status})`);
    return { configured: true, ok: res.ok };
  } catch (error) {
    console.error("[ops-heartbeat] unreachable", (error as Error).message);
    return { configured: true, ok: false };
  }
}

// --------------------------------------------------------------- Aufräumen

/** Alte Ereignisse entfernen und ausgelaufene Vorfälle schließen. */
export async function opsHousekeeping(retentionDays = 14): Promise<{
  deletedEvents: number;
  autoResolved: number;
}> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  let deletedEvents = 0;
  let autoResolved = 0;
  try {
    const { data } = await supabaseAdmin
      .from("ops_events")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    deletedEvents = data?.length ?? 0;

    // Vorfälle, die seit 24 h kein Ereignis mehr erzeugt haben, gelten als
    // abgeklungen und werden nachvollziehbar geschlossen.
    const quiet = new Date(Date.now() - 86_400_000).toISOString();
    const { data: resolved } = await supabaseAdmin
      .from("ops_incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        note: "Automatisch geschlossen: 24 h ohne weiteres Ereignis.",
      })
      .neq("status", "resolved")
      .lt("last_seen_at", quiet)
      .select("id");
    autoResolved = resolved?.length ?? 0;
  } catch (error) {
    console.error("[ops] housekeeping failed", (error as Error).message);
  }
  return { deletedEvents, autoResolved };
}

// ------------------------------------------------------------ Systemprüfung

/**
 * Aktive Prüfung der wichtigsten Abhängigkeiten. Wird vom Zeitplan aufgerufen
 * und meldet Ausfälle selbstständig, ohne dass ein Nutzer betroffen sein muss.
 */
export async function opsHealthChecks(request?: Request): Promise<{
  environment: AppEnvironment;
  dbLatencyMs: number | null;
  rpcLatencyMs: number | null;
  pushFailures: number;
  webhookFailures: number;
  stuckPayments: number;
}> {
  const environment = appEnvironment(request);

  // 1) Datenbank erreichbar und schnell genug?
  let dbLatencyMs: number | null = null;
  const dbStart = Date.now();
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    dbLatencyMs = Date.now() - dbStart;
    if (error) throw new Error(error.message);
    await recordOpsLatency("database", "profiles_probe", dbLatencyMs, { environment });
  } catch (error) {
    await recordOpsFailure("database", "db_probe_failed", error, {
      environment,
      service: "postgrest",
    });
  }

  // 2) RPC-Infrastruktur erreichbar?
  //
  // Bewusst `ops_rpc_probe` (nur service_role, ohne Auth-Zwang) statt einer
  // Nutzerfunktion wie `globe_vote_current_round`: Der Probe läuft als
  // Service-Role-Request ohne Session, deshalb schlug die Nutzerfunktion
  // korrekt mit "Not authenticated" fehl. Die Auth-Prüfung der Nutzer-RPCs
  // bleibt unverändert erhalten – geprüft wird hier die RPC-Infrastruktur.
  let rpcLatencyMs: number | null = null;
  const rpcStart = Date.now();
  try {
    const { error } = await supabaseAdmin.rpc("ops_rpc_probe");
    rpcLatencyMs = Date.now() - rpcStart;
    if (error) throw new Error(error.message);
    await recordOpsLatency("rpc", "ops_rpc_probe", rpcLatencyMs, { environment });
  } catch (error) {
    await recordOpsFailure("rpc", "rpc_probe_failed", error, {
      environment,
      fn: "ops_rpc_probe",
    });
  }


  // 3) Push-Warteschlange: systematische Ausfälle statt Einzelfehler.
  let pushFailures = 0;
  try {
    const since = new Date(Date.now() - 30 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("notification_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since);
    pushFailures = count ?? 0;
    if (pushFailures >= 25) {
      await recordOpsEvent({
        area: "push",
        event: "push_queue_failure_rate",
        severity: "critical",
        environment,
        service: "web_push",
        context: { failedLast30Min: pushFailures },
      });
    }
  } catch (error) {
    await recordOpsFailure("push", "push_queue_check_failed", error, { environment });
  }

  // 4) Zahlungs-Webhooks: nicht verarbeitete Meldungen.
  let webhookFailures = 0;
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("market_payment_records")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since);
    webhookFailures = count ?? 0;
    if (webhookFailures >= 3) {
      await recordOpsEvent({
        area: "payments",
        event: "payment_failure_rate",
        severity: "critical",
        environment,
        service: "stripe",
        context: { failedLastHour: webhookFailures },
      });
    }
  } catch (error) {
    await recordOpsFailure("payments", "payment_check_failed", error, { environment });
  }

  // 5) Inkonsistente Zahlungszustände: bezahlt, aber Vorgang hängt.
  let stuckPayments = 0;
  try {
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("market_transactions")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .eq("status", "payment_pending")
      .lt("created_at", since);
    stuckPayments = count ?? 0;
    if (stuckPayments > 0) {
      await recordOpsEvent({
        area: "payments",
        event: "payment_state_inconsistent",
        severity: "critical",
        environment,
        service: "market_transactions",
        context: { stuck: stuckPayments },
      });
    }
  } catch (error) {
    await recordOpsFailure("payments", "payment_state_check_failed", error, { environment });
  }

  return { environment, dbLatencyMs, rpcLatencyMs, pushFailures, webhookFailures, stuckPayments };
}

// ------------------------------------------------------------ Übersichtsdaten

export const OPS_AREA_THRESHOLD_TEXT: Record<OpsArea, string> = Object.fromEntries(
  (Object.keys(OPS_ALERT_RULES) as OpsArea[]).map((area) => {
    const r = OPS_ALERT_RULES[area];
    return [
      area,
      `${r.threshold}× in ${r.windowMinutes} min (${OPS_AREA_LABEL[area]}), erneut frühestens nach ${r.renotifyMinutes} min`,
    ];
  }),
) as Record<OpsArea, string>;
