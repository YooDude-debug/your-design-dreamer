import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Double-Opt-in für den Notify-Me Newsletter. Zugriff nur serverseitig. */

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);

export type SubscribeResult =
  | { status: "pending"; emailSent: boolean }
  | { status: "resent"; emailSent: boolean }
  | { status: "already_verified" }
  | { status: "cooldown" }
  | { status: "captcha" };

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: emailSchema,
        language: z.enum(["de", "en", "el"]).default("de"),
        consent: z.literal(true),
        captchaToken: z.string().trim().min(10).max(4096),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SubscribeResult> => {
    // Bot-Schutz zuerst: ohne gültiges Turnstile-Token wird nichts gespeichert
    // und keine E-Mail versendet.
    const { verifyTurnstileToken, currentRequestIp } = await import("./turnstile.server");
    const captchaOk = await verifyTurnstileToken(data.captchaToken, await currentRequestIp());
    if (!captchaOk) return { status: "captcha" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();

    const { data: existing } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id,status,last_sent_at")
      .eq("email", data.email)
      .maybeSingle();

    if (existing?.status === "verified") return { status: "already_verified" };

    if (
      existing?.last_sent_at &&
      now.getTime() - new Date(existing.last_sent_at).getTime() < RESEND_COOLDOWN_MS
    ) {
      return { status: "cooldown" };
    }

    const token = newToken();
    const row = {
      email: data.email,
      language: data.language,
      consent_at: now.toISOString(),
      status: "pending",
      confirm_token: token,
      token_expires_at: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(),
      last_sent_at: now.toISOString(),
    };

    if (existing) {
      const { error } = await supabaseAdmin
        .from("newsletter_subscribers")
        .update(row)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("newsletter_subscribers").insert(row);
      if (error) throw new Error(error.message);
    }

    let origin = "https://y-dude.com";
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      if (req?.url) origin = new URL(req.url).origin;
    } catch {
      /* Fallback auf die Produktions-Domain */
    }

    const { sendNewsletterConfirmation } = await import("./newsletter.server");
    const emailSent = await sendNewsletterConfirmation(data.email, token, data.language, origin);
    if (!emailSent) {
      // Ohne Versand darf die Sperre nicht greifen, sonst blockiert der
      // Cooldown den nächsten Versuch trotz fehlender Bestätigungsmail.
      await supabaseAdmin
        .from("newsletter_subscribers")
        .update({ last_sent_at: null })
        .eq("email", data.email);
      console.error("[newsletter] confirmation email not sent for subscriber", {
        origin,
        language: data.language,
      });
    }
    return { status: existing ? "resent" : "pending", emailSent };
  });

export const confirmNewsletter = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().trim().min(16).max(128) }).parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ status: "verified" | "already_verified" | "expired" | "invalid" }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: row } = await supabaseAdmin
        .from("newsletter_subscribers")
        .select("id,status,token_expires_at")
        .eq("confirm_token", data.token)
        .maybeSingle();

      if (!row) return { status: "invalid" };
      if (row.status === "verified") return { status: "already_verified" };
      if (!row.token_expires_at || new Date(row.token_expires_at).getTime() < Date.now()) {
        return { status: "expired" };
      }

      const { error } = await supabaseAdmin
        .from("newsletter_subscribers")
        .update({
          status: "verified",
          confirmed_at: new Date().toISOString(),
          confirm_token: null,
          token_expires_at: null,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);

      return { status: "verified" };
    },
  );

/**
 * Öffentlicher Beta-Interessenten-Zähler.
 *
 * Gibt ausschließlich eine aggregierte Zahl zurück – keine E-Mail-Adressen,
 * IDs oder Zeitstempel. Gezählt werden nur bestätigte Double-Opt-in-Einträge
 * (status = 'verified'); pro E-Mail existiert genau eine Zeile, daher kann
 * dieselbe Adresse nicht doppelt gezählt werden. Bot-/Spam-Anmeldungen ohne
 * Turnstile-Prüfung landen nie in der Tabelle und unbestätigte Adressen
 * erhöhen den Zähler nicht.
 */
export const getBetaTesterCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ betaTesterCount: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "verified");
    if (error) throw new Error(error.message);
    return { betaTesterCount: count ?? 0 };
  },
);
