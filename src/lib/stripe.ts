/**
 * Browserseitiger Zugang zur Zahlungsoberfläche.
 * Die Umgebung wird ausschließlich aus dem Präfix des öffentlichen Tokens
 * abgeleitet – niemals still auf „live“ zurückfallen.
 */

// P-05: Der Import über "/pure" laedt das externe Zahlungsskript (ca. 1,1 MB)
// erst beim tatsaechlichen Aufruf von `getStripe()` – nicht schon beim
// Anzeigen einer Seite, die einen Zahlungsdialog nur bereithaelt.
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Die Zahlungsfunktion ist für diesen Build nicht konfiguriert. Bitte den Zahlungs-Bereich im Projekt abschließen.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export function paymentsConfigured(): boolean {
  return Boolean(clientToken?.startsWith("pk_test_") || clientToken?.startsWith("pk_live_"));
}
