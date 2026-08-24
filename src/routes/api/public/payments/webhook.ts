/**
 * Zahlungs-Webhook (öffentlich erreichbar, signaturgeprüft).
 *
 * Sicherheit: Jede Anfrage wird per HMAC-Signatur des Anbieters geprüft.
 * Doppelt zugestellte Ereignisse werden über die Ereignis-ID abgewiesen
 * (Idempotenz), damit eine Zahlung niemals doppelt verbucht wird.
 */

import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhook, type StripeEnv } from "@/lib/stripe.server";

type SessionLike = {
  id?: string;
  payment_intent?: string | { id?: string } | null;
  payment_status?: string;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
};

async function handle(request: Request, env: StripeEnv) {
  const event = await verifyWebhook(request, env);
  const relevant = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]);
  if (!relevant.has(event.type)) return;

  const session = event.data.object as SessionLike;
  if (event.type === "checkout.session.completed" && session.payment_status === "unpaid") return;

  const intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const { confirmPaymentFromWebhook } = await import("@/lib/market-tx.server");
  await confirmPaymentFromWebhook({
    eventId: event.id,
    eventType: event.type,
    sessionId: session.id ?? null,
    paymentIntentId: intent,
    transactionId: session.metadata?.transactionId ?? null,
    environment: env,
    amountCents: session.amount_total ?? null,
  });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handle(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("payments webhook error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
