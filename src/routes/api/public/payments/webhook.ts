/**
 * Zahlungs-Webhook (öffentlich erreichbar, signaturgeprüft).
 *
 * Sicherheit: Jede Anfrage wird per HMAC-Signatur des Anbieters geprüft.
 * Doppelt zugestellte Ereignisse werden über die Ereignis-ID abgewiesen
 * (Idempotenz), damit eine Zahlung niemals doppelt verbucht wird.
 *
 * Zuständigkeit:
 * - Kauf eines Market-Artikels  → Transaktionslogik
 * - Hervorhebung („Sponsored“)  → Freischaltung der Laufzeit
 * - Business-Abo                → Abostatus, Verlängerung, Kündigung, Wechsel
 */

import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

type SessionLike = {
  id?: string;
  payment_intent?: string | { id?: string } | null;
  payment_status?: string;
  amount_total?: number | null;
  mode?: string;
  metadata?: Record<string, string> | null;
};

const SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Ereignis-ID einmalig festschreiben; ein zweiter Aufruf wird verworfen. */
async function claimEvent(eventId: string, eventType: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("market_payment_webhook_events").insert({
    provider: "stripe",
    event_id: eventId,
    event_type: eventType,
    transaction_id: null,
  });
  return !error;
}

async function handle(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);

  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    if (!(await claimEvent(event.id, event.type))) return;
    const subscriptionObject = event.data.object as { metadata?: Record<string, string> | null };
    if (subscriptionObject.metadata?.["kind"] === "creator_subscription") {
      const { syncCreatorSubscriptionFromWebhook } =
        await import("@/lib/creator-subscription.server");
      await syncCreatorSubscriptionFromWebhook(
        event.data.object as Parameters<typeof syncCreatorSubscriptionFromWebhook>[0],
        env,
        event.type === "customer.subscription.deleted",
      );
      return;
    }
    const { syncSubscriptionFromWebhook } = await import("@/lib/billing.server");
    await syncSubscriptionFromWebhook(
      event.data.object as Parameters<typeof syncSubscriptionFromWebhook>[0],
      env,
      event.type === "customer.subscription.deleted",
    );
    return;
  }

  if (!SESSION_EVENTS.has(event.type)) return;

  const session = event.data.object as SessionLike;
  const failed = event.type === "checkout.session.async_payment_failed";
  if (event.type === "checkout.session.completed" && session.payment_status === "unpaid") return;

  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const kind = session.metadata?.["kind"] ?? null;

  if (kind === "market_promotion") {
    if (!(await claimEvent(event.id, event.type))) return;
    const { activatePromotionFromWebhook } = await import("@/lib/billing.server");
    await activatePromotionFromWebhook({
      promotionId: session.metadata?.["promotionId"] ?? null,
      sessionId: session.id ?? null,
      paymentIntentId: intent,
      amountCents: session.amount_total ?? null,
      environment: env,
      failed,
    });
    return;
  }

  if (kind === "business_subscription" || session.mode === "subscription") {
    // Der Abostatus kommt aus den customer.subscription.* Meldungen.
    return;
  }

  const { confirmPaymentFromWebhook } = await import("@/lib/market-tx.server");
  await confirmPaymentFromWebhook({
    eventId: event.id,
    eventType: event.type,
    sessionId: session.id ?? null,
    paymentIntentId: intent,
    transactionId: session.metadata?.["transactionId"] ?? null,
    environment: env,
    amountCents: session.amount_total ?? null,
  });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logEvent, logFailure, logIfSlow } = await import("@/lib/observability.server");
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          logEvent({
            area: "payments",
            event: "webhook_invalid_env",
            severity: "warn",
            context: { env: rawEnv ?? "none" },
          });
          return Response.json({ received: true, ignored: "invalid env" });
        }
        // Umgebungs-Schutz (Phase 2): Eine Testzahlungsmeldung darf niemals
        // den produktiven Datenbestand verändern – und eine Live-Meldung
        // niemals eine Staging-Instanz.
        const { appEnvironment, paymentsModeAllowed } = await import("@/lib/environment.server");
        const environment = appEnvironment(request);
        const { recordOpsEvent, recordOpsFailure, recordOpsLatency } =
          await import("@/lib/ops-monitor.server");
        if (!paymentsModeAllowed(rawEnv, environment)) {
          logEvent({
            area: "payments",
            event: "webhook_env_mismatch",
            severity: "warn",
            context: { env: rawEnv, environment },
          });
          // Umgebungsverstoß ist sicherheitsrelevant: sofort melden.
          await recordOpsEvent({
            area: "security",
            event: "payment_env_mismatch",
            severity: "critical",
            service: "stripe_webhook",
            environment,
            request,
            context: { env: rawEnv },
          });
          return Response.json({ received: true, ignored: "environment mismatch" });
        }

        const started = Date.now();
        try {
          await handle(request, rawEnv);
          const duration = Date.now() - started;
          logIfSlow("payments", "webhook", duration, { env: rawEnv, environment });
          await recordOpsLatency("webhook", "stripe_webhook", duration, {
            environment,
            service: "stripe_webhook",
            request,
          });
          return Response.json({ received: true });
        } catch (e) {
          // Kritisch: eine abgewiesene oder fehlgeschlagene Zahlungsmeldung muss
          // im Protokoll auffindbar sein (ohne Signatur, ohne Nutzdaten).
          logFailure("payments", "webhook_failed", e, { env: rawEnv, environment });
          await recordOpsFailure("webhook", "stripe_webhook_failed", e, {
            environment,
            service: "stripe_webhook",
            request,
            context: { env: rawEnv },
          });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
