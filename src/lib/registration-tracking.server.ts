import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  REGISTRATION_CAUSES,
  REGISTRATION_EVENTS,
  type FunnelStage,
  type RegistrationCause,
  type RegistrationEvent,
  type RegistrationMetrics,
  type RegistrationRange,
} from "./registration-tracking.shared";

/** Obergrenze pro Versuch: verhindert missbraeuchliches Vollschreiben. */
const MAX_EVENTS_PER_ATTEMPT = 40;

/**
 * Schreibt genau ein technisches Ereignis. Es werden keine
 * personenbezogenen Inhalte, Tokens oder Secrets gespeichert.
 */
export async function recordRegistrationEvent(input: {
  attemptId: string;
  event: RegistrationEvent;
  cause?: RegistrationCause | null;
  detail?: string | null;
}): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("registration_events")
    .select("id", { count: "exact", head: true })
    .eq("attempt_id", input.attemptId);
  if ((count ?? 0) >= MAX_EVENTS_PER_ATTEMPT) return false;

  const { error } = await supabaseAdmin.from("registration_events").insert({
    attempt_id: input.attemptId,
    event: input.event,
    cause: input.cause ?? null,
    detail: input.detail ?? null,
  });
  if (error) {
    console.error("[registration-tracking] insert", error.message);
    return false;
  }
  return true;
}

function rangeStart(range: RegistrationRange): Date | null {
  const now = new Date();
  if (range === "all") return null;
  if (range === "today") {
    const d = new Date(now);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

const FAILURE_EVENTS: RegistrationEvent[] = [
  "turnstile_failed",
  "validation_failed",
  "auth_failed",
  "profile_creation_failed",
];

const ATTEMPT_LEVEL_EVENTS: RegistrationEvent[] = [
  "registration_submitted",
  "registration_completed",
  "email_confirmation_pending",
  ...FAILURE_EVENTS,
];

async function countEvent(event: RegistrationEvent, from: Date | null): Promise<number> {
  let q = supabaseAdmin
    .from("registration_events")
    .select("id", { count: "exact", head: true })
    .eq("event", event);
  if (from) q = q.gte("created_at", from.toISOString());
  const { count } = await q;
  return count ?? 0;
}

async function countCause(cause: RegistrationCause, from: Date | null): Promise<number> {
  let q = supabaseAdmin
    .from("registration_events")
    .select("id", { count: "exact", head: true })
    .eq("cause", cause);
  if (from) q = q.gte("created_at", from.toISOString());
  const { count } = await q;
  return count ?? 0;
}

/** Liest die Ereignisse auf Versuchsebene (gedeckelt, seitenweise). */
async function loadAttemptRows(from: Date | null) {
  const rows: { attempt_id: string; event: string }[] = [];
  const PAGE = 1000;
  for (let page = 0; page < 25; page++) {
    let q = supabaseAdmin
      .from("registration_events")
      .select("attempt_id, event")
      .in("event", ATTEMPT_LEVEL_EVENTS)
      .order("created_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (from) q = q.gte("created_at", from.toISOString());
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Kontodaten aus dem Auth-Bestand (faktisch, nicht versuchsbezogen). */
async function loadAccountStats(from: Date | null): Promise<{
  created: number;
  confirmed: number;
  signedIn: number;
  truncated: boolean;
}> {
  let created = 0;
  let confirmed = 0;
  let signedIn = 0;
  let truncated = false;
  const fromMs = from ? from.getTime() : 0;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) {
      truncated = true;
      break;
    }
    for (const u of data.users) {
      const ms = u.created_at ? new Date(u.created_at).getTime() : 0;
      if (ms < fromMs) continue;
      created++;
      if (u.email_confirmed_at || u.confirmed_at) confirmed++;
      if (u.last_sign_in_at) signedIn++;
    }
    if (data.users.length < 200) return { created, confirmed, signedIn, truncated };
    if (page === 20) truncated = true;
  }
  return { created, confirmed, signedIn, truncated };
}

export async function loadRegistrationMetrics(
  range: RegistrationRange,
): Promise<RegistrationMetrics> {
  const from = rangeStart(range);

  const firstEvent = await supabaseAdmin
    .from("registration_events")
    .select("created_at")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const measurementStart = firstEvent.data?.created_at ?? null;

  const eventEntries = await Promise.all(
    REGISTRATION_EVENTS.map(async (e) => [e, await countEvent(e, from)] as const),
  );
  const eventCounts = Object.fromEntries(eventEntries) as Record<RegistrationEvent, number>;

  const causeEntries = await Promise.all(
    REGISTRATION_CAUSES.map(async (c) => [c, await countCause(c, from)] as const),
  );
  const causeCounts = Object.fromEntries(causeEntries) as Record<RegistrationCause, number>;

  const rows = await loadAttemptRows(from);
  const byAttempt = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byAttempt.get(r.attempt_id) ?? new Set<string>();
    set.add(r.event);
    byAttempt.set(r.attempt_id, set);
  }

  const attempts = Math.max(eventCounts.registration_started, byAttempt.size);
  let completed = 0;
  let failed = 0;
  let filled = 0;
  for (const set of byAttempt.values()) {
    const done = set.has("registration_completed") || set.has("email_confirmation_pending");
    if (done) completed++;
    else if (FAILURE_EVENTS.some((e) => set.has(e))) failed++;
    if (set.has("registration_submitted") || set.has("validation_failed")) filled++;
  }
  const abandoned = Math.max(0, attempts - completed - failed);
  const pct = (n: number) => (attempts > 0 ? Math.round((n / attempts) * 1000) / 10 : null);

  const accounts = await loadAccountStats(from);

  const funnel: FunnelStage[] = [
    {
      key: "opened",
      label: "Registrierung geöffnet",
      count: eventCounts.registration_started,
      source: "events",
    },
    { key: "filled", label: "Formular ausgefüllt", count: filled, source: "events" },
    {
      key: "submitted",
      label: "Registrierung abgesendet",
      count: eventCounts.registration_submitted,
      source: "events",
    },
    {
      key: "turnstile",
      label: "Turnstile bestanden",
      count: eventCounts.turnstile_completed,
      source: "events",
    },
    {
      key: "account",
      label: "Account erstellt",
      count: accounts.truncated ? null : accounts.created,
      source: "accounts",
    },
    {
      key: "confirmed",
      label: "E-Mail bestätigt",
      count: accounts.truncated ? null : accounts.confirmed,
      source: "accounts",
    },
    {
      key: "profile",
      label: "Profil erstellt",
      count: await countProfiles(from),
      source: "accounts",
    },
    {
      key: "first_login",
      label: "Erste Anmeldung",
      count: accounts.truncated ? null : accounts.signedIn,
      source: "accounts",
    },
  ];

  // Nur dann "unvollstaendig", wenn der gewaehlte Zeitraum vor dem Beginn
  // der Messung liegt. Fehlende Zeitraeume werden nie geschaetzt.
  const historyIncomplete =
    !!measurementStart && !!from && new Date(measurementStart).getTime() > from.getTime();

  return {
    range,
    from: from ? from.toISOString() : null,
    measurementStart,
    historyIncomplete,
    attempts,
    completed,
    failed,
    abandoned,
    failureRate: pct(failed),
    abandonRate: pct(abandoned),
    conversionRate: pct(completed),
    eventCounts,
    causeCounts,
    funnel,
  };
}

async function countProfiles(from: Date | null): Promise<number> {
  let q = supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
  if (from) q = q.gte("created_at", from.toISOString());
  const { count } = await q;
  return count ?? 0;
}
