/**
 * Open-Beta-Start: serverseitige Aktivierung und einmaliger Versand der
 * Startmail an die bestehenden „Notify me“-Adressen.
 *
 * Datenschutz: E-Mail-Adressen verlassen den Server nicht. Nach aussen werden
 * ausschliesslich Zahlen und Statuswerte gemeldet, niemals Adressen. Es werden
 * keine Adressen, Tokens oder Passwoerter geloggt.
 *
 * Einmaligkeit: `beta_launch_notifications` haelt pro Abonnent genau einen
 * Datensatz (UNIQUE). Der Datensatz wird VOR dem Versand angelegt; ein
 * Konflikt bedeutet „bereits benachrichtigt“ und ueberspringt den Versand.
 * Zusaetzlich sichert ein stabiler Idempotenzschluessel den Mailversand ab.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import type { Lang } from "@/lib/email-templates/beta-launch-copy";

const TEMPLATE = "beta-launch";
const REGISTER_URL = "https://y-dude.com/auth?mode=register";
const SEND_HOUR_BERLIN = 10;
const TIME_ZONE = "Europe/Berlin";

export interface BetaLaunchStatus {
  openBeta: boolean;
  activatedAt: string | null;
  scheduledSendAt: string | null;
  sendStartedAt: string | null;
  sendCompletedAt: string | null;
  dispatchId: string | null;
  /** Bestaetigte Notify-me-Adressen insgesamt (nur Anzahl, keine Adressen). */
  recipients: number;
  alreadyNotified: number;
  pending: number;
}

/** Versatz der Zone Europe/Berlin zum UTC-Zeitpunkt (MEZ/MESZ automatisch). */
function zoneOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUtc - at.getTime();
}

/**
 * Naechster Versandzeitpunkt: 10:00 Uhr Ortszeit Berlin. Der Sommer-/
 * Winterzeitwechsel wird ueber die Zonendatenbank aufgeloest, es wird kein
 * fester UTC-Versatz angenommen.
 */
export function nextBerlinSendAt(from: Date = new Date()): Date {
  const offset = zoneOffsetMs(from);
  const local = new Date(from.getTime() + offset);
  for (let dayShift = 0; dayShift < 3; dayShift += 1) {
    const wallClock = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + dayShift,
      SEND_HOUR_BERLIN,
      0,
      0,
    );
    // Zweifache Aufloesung, damit der Versatz am Umstellungstag korrekt ist.
    let candidate = new Date(wallClock - offset);
    candidate = new Date(wallClock - zoneOffsetMs(candidate));
    if (candidate.getTime() > from.getTime()) return candidate;
  }
  return new Date(from.getTime() + 86_400_000);
}

async function readState() {
  const { data } = await supabaseAdmin.from("beta_launch_state").select("*").eq("id", true).single();
  return data;
}

/** Bestaetigte Notify-me-Abonnenten ohne Testaccounts (serverseitig, ohne Ausgabe). */
async function loadRecipients() {
  const [subs, testAccounts] = await Promise.all([
    supabaseAdmin
      .from("newsletter_subscribers")
      .select("id, email, language")
      .eq("status", "verified")
      .order("created_at", { ascending: true }),
    supabaseAdmin.from("test_accounts").select("email"),
  ]);
  const blocked = new Set(
    (testAccounts.data ?? []).map((t) => (t.email ?? "").trim().toLowerCase()),
  );
  return (subs.data ?? []).filter((s) => !blocked.has((s.email ?? "").trim().toLowerCase()));
}

export async function getBetaLaunchStatus(): Promise<BetaLaunchStatus> {
  const state = await readState();
  const recipients = await loadRecipients();
  const { data: notified } = await supabaseAdmin
    .from("beta_launch_notifications")
    .select("subscriber_id");
  const done = new Set((notified ?? []).map((n) => n.subscriber_id));
  const outstanding = recipients.filter((r) => !done.has(r.id)).length;

  return {
    openBeta: state?.open_beta_enabled ?? false,
    activatedAt: state?.activated_at ?? null,
    scheduledSendAt: state?.scheduled_send_at ?? null,
    sendStartedAt: state?.send_started_at ?? null,
    sendCompletedAt: state?.send_completed_at ?? null,
    dispatchId: state?.dispatch_id ?? null,
    recipients: recipients.length,
    alreadyNotified: recipients.length - outstanding,
    pending: outstanding,
  };
}

/**
 * Aktiviert die offene Beta und plant den Versand auf den naechsten
 * 10-Uhr-Termin (Europe/Berlin). Eine erneute Aktivierung plant keinen
 * zweiten Versand: bereits benachrichtigte Adressen bleiben ausgeschlossen,
 * und ein abgeschlossener Versand wird nicht neu terminiert.
 */
export async function activateOpenBeta(adminId: string): Promise<BetaLaunchStatus> {
  const state = await readState();
  const now = new Date();

  if (state?.open_beta_enabled) {
    // Bereits aktiv: Zeitplan und Versand-ID bleiben unveraendert.
    return getBetaLaunchStatus();
  }

  const scheduled = state?.send_completed_at ? null : nextBerlinSendAt(now);
  const { error } = await supabaseAdmin
    .from("beta_launch_state")
    .update({
      open_beta_enabled: true,
      activated_at: now.toISOString(),
      activated_by: adminId,
      scheduled_send_at: scheduled ? scheduled.toISOString() : state?.scheduled_send_at ?? null,
      dispatch_id: state?.dispatch_id ?? crypto.randomUUID(),
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
  return getBetaLaunchStatus();
}

/** Deaktiviert die offene Beta (Zeitplan wird gestoppt, Versandstatus bleibt erhalten). */
export async function deactivateOpenBeta(): Promise<BetaLaunchStatus> {
  const { error } = await supabaseAdmin
    .from("beta_launch_state")
    .update({ open_beta_enabled: false, scheduled_send_at: null })
    .eq("id", true);
  if (error) throw new Error(error.message);
  return getBetaLaunchStatus();
}

/** Testmail an genau eine Adresse. Aendert keinen Versandstatus. */
export async function sendBetaLaunchTestEmail(
  to: string,
  language: Lang = "de",
): Promise<{ sent: boolean; reason?: string }> {
  const address = to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(address)) {
    throw new Error("Ungültige Testadresse.");
  }
  const result = await sendTemplateEmail(TEMPLATE, address, {
    templateData: { registerUrl: REGISTER_URL, language },
    idempotencyKey: `beta-launch-test-${Date.now()}`,
  });
  return result.sent ? { sent: true } : { sent: false, reason: result.reason };
}

export interface BetaLaunchRunReport {
  ran: boolean;
  skipped?: "not_enabled" | "not_due" | "completed";
  sent: number;
  suppressed: number;
  failed: number;
  alreadyNotified: number;
}

/**
 * Fuehrt den Versand aus, sobald der geplante Zeitpunkt erreicht ist.
 * Idempotent: pro Abonnent wird vor dem Versand ein UNIQUE-Datensatz gesetzt;
 * mehrfache Laeufe, Neustarts oder erneute Trigger fuehren zu keinem zweiten
 * Versand. `force` ueberspringt nur die Zeitpruefung, nie die Einmaligkeit.
 */
export async function runBetaLaunchDispatch(
  options: { force?: boolean } = {},
): Promise<BetaLaunchRunReport> {
  const state = await readState();
  const report: BetaLaunchRunReport = {
    ran: false,
    sent: 0,
    suppressed: 0,
    failed: 0,
    alreadyNotified: 0,
  };

  if (!state?.open_beta_enabled) return { ...report, skipped: "not_enabled" };
  if (state.send_completed_at) return { ...report, skipped: "completed" };
  const due =
    options.force === true ||
    (state.scheduled_send_at ? new Date(state.scheduled_send_at) <= new Date() : false);
  if (!due) return { ...report, skipped: "not_due" };

  const dispatchId = state.dispatch_id ?? crypto.randomUUID();
  await supabaseAdmin
    .from("beta_launch_state")
    .update({
      dispatch_id: dispatchId,
      send_started_at: state.send_started_at ?? new Date().toISOString(),
    })
    .eq("id", true);

  const recipients = await loadRecipients();
  report.ran = true;

  for (const subscriber of recipients) {
    // Versandstatus zuerst reservieren — der UNIQUE-Konflikt ist die Sperre
    // gegen doppelte Startmails.
    const claim = await supabaseAdmin.from("beta_launch_notifications").insert({
      dispatch_id: dispatchId,
      subscriber_id: subscriber.id,
      email: subscriber.email,
      status: "sent",
    });
    if (claim.error) {
      report.alreadyNotified += 1;
      continue;
    }

    const lang = (subscriber.language as Lang | null) ?? "de";
    try {
      const result = await sendTemplateEmail(TEMPLATE, subscriber.email, {
        templateData: { registerUrl: REGISTER_URL, language: lang },
        idempotencyKey: `beta-launch-${dispatchId}-${subscriber.id}`,
      });
      if (result.sent) {
        report.sent += 1;
      } else {
        report.suppressed += 1;
        await supabaseAdmin
          .from("beta_launch_notifications")
          .update({ status: "suppressed", reason: result.reason })
          .eq("subscriber_id", subscriber.id);
      }
    } catch (error) {
      report.failed += 1;
      // Fehlerdetails ohne Adresse protokollieren.
      console.error("[beta-launch] send failed", {
        subscriberId: subscriber.id,
        message: error instanceof Error ? error.message : "unknown",
      });
      await supabaseAdmin
        .from("beta_launch_notifications")
        .update({ status: "failed", reason: "send_error" })
        .eq("subscriber_id", subscriber.id);
    }
  }

  await supabaseAdmin
    .from("beta_launch_state")
    .update({ send_completed_at: new Date().toISOString(), scheduled_send_at: null })
    .eq("id", true);

  return report;
}
