import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Auth-Vorgänge mit vorgeschalteter, serverseitiger Turnstile-Prüfung.
 * Ohne gültiges Token wird kein Supabase-Auth-Aufruf ausgeführt.
 */

export type SignInResult =
  | { status: "ok"; accessToken: string; refreshToken: string; userId: string }
  | { status: "captcha" }
  | { status: "unconfirmed" }
  | { status: "invalid" };

export const signInWithCaptcha = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        password: z.string().min(1).max(200),
        captchaToken: z.string().trim().min(10).max(4096).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SignInResult> => {
    const { verifyTurnstileToken, currentRequestIp } = await import("./turnstile.server");
    const ok = await verifyTurnstileToken(data.captchaToken, await currentRequestIp());
    if (!ok) return { status: "captcha" };

    const { createPublicServerClient } = await import("./auth-public.server");
    const supabase = createPublicServerClient();
    const { data: res, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    // Ohne bestätigte E-Mail verweigert Supabase die Anmeldung; das wird
    // hier eindeutig gemeldet, damit die UI die Bestätigung anbieten kann.
    if (error?.code === "email_not_confirmed") return { status: "unconfirmed" };
    if (error || !res.session || !res.user) return { status: "invalid" };
    return {
      status: "ok",
      accessToken: res.session.access_token,
      refreshToken: res.session.refresh_token,
      userId: res.user.id,
    };
  });

/**
 * Bestätigungs-E-Mail erneut senden. Die Antwort ist neutral, damit keine
 * Konto-Existenz preisgegeben wird. Supabase erzwingt zusätzlich ein
 * eigenes Zeitfenster zwischen zwei Sendungen.
 */
export const resendConfirmationEmail = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        redirectTo: z.string().url().max(500),
        captchaToken: z.string().trim().min(10).max(4096).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ status: "ok" | "captcha" | "cooldown" | "failed" }> => {
    const { verifyTurnstileToken, currentRequestIp } = await import("./turnstile.server");
    const ok = await verifyTurnstileToken(data.captchaToken, await currentRequestIp());
    if (!ok) return { status: "captcha" };

    const { createPublicServerClient } = await import("./auth-public.server");
    const supabase = createPublicServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: data.email,
      options: { emailRedirectTo: data.redirectTo },
    });
    if (error) {
      if (error.status === 429) return { status: "cooldown" };
      console.error("[auth] resend confirmation", error.message);
      return { status: "failed" };
    }
    return { status: "ok" };
  });

export type SignUpResult =
  | { status: "confirm" }
  | { status: "underage" }
  | { status: "session"; accessToken: string; refreshToken: string; userId: string }
  | { status: "captcha" }
  | { status: "username_blocked" }
  | { status: "username_taken" }
  | { status: "weak_password" }
  | { status: "email_taken" }
  | { status: "rate_limited" }
  | { status: "failed"; code?: string; message?: string };

export const signUpWithCaptcha = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        password: z.string().min(8).max(200),
        username: z
          .string()
          .trim()
          .regex(/^[a-zA-Z0-9_.-]{3,24}$/),
        // Jugendschutz: Geburtsdatum (Selbstauskunft) ist Pflichtangabe.
        birthdate: z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/),
        // Personenbezogene Registrierungsdaten: getrennt von der oeffentlichen Anzeige.
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        // Sicherer Standard: nur der Username ist oeffentlich sichtbar.
        displayNameMode: z.enum(["username", "real_name", "both"]).default("username"),
        redirectTo: z.string().url().max(500),
        captchaToken: z.string().trim().min(10).max(4096).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<SignUpResult> => {
    // Mindestalter wird serverseitig erzwungen, nicht nur im Formular.
    const { meetsMinAge } = await import("./age-policy");
    if (!meetsMinAge(data.birthdate)) return { status: "underage" };

    const { verifyTurnstileToken, currentRequestIp } = await import("./turnstile.server");
    const ok = await verifyTurnstileToken(data.captchaToken, await currentRequestIp());
    if (!ok) return { status: "captcha" };

    // Zentrale Sperrliste und Vergabe werden serverseitig geprüft; die
    // Datenbank erzwingt die Sperre zusätzlich per Trigger und UNIQUE-Regel.
    const { usernameStatus } = await import("./username.server");
    const uStatus = await usernameStatus(data.username);
    if (uStatus === "reserved" || uStatus === "invalid") return { status: "username_blocked" };
    if (uStatus === "taken") return { status: "username_taken" };

    const { createPublicServerClient } = await import("./auth-public.server");
    const supabase = createPublicServerClient();
    const { data: res, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: data.redirectTo,
        data: {
          username: data.username,
          birthdate: data.birthdate,
          first_name: data.firstName,
          last_name: data.lastName,
          display_name_mode: data.displayNameMode,
        },
      },
    });
    if (error) {
      // Der konkrete Fehler des Auth-Service bleibt erhalten, damit das
      // Formular eine verstaendliche Meldung anzeigen kann.
      console.error("[auth] signup", error.status, error.code, error.message);
      const code = error.code ?? "";
      const msg = (error.message ?? "").toLowerCase();
      if (code === "weak_password" || msg.includes("password")) {
        return { status: "weak_password" };
      }
      if (code === "user_already_exists" || code === "email_exists") {
        return { status: "email_taken" };
      }
      if (
        error.status === 429 ||
        code === "over_request_rate_limit" ||
        code === "over_email_send_rate_limit"
      ) {
        return { status: "rate_limited" };
      }
      return { status: "failed", code: code || undefined, message: error.message };
    }
    if (res.session && res.user) {
      return {
        status: "session",
        accessToken: res.session.access_token,
        refreshToken: res.session.refresh_token,
        userId: res.user.id,
      };
    }
    return { status: "confirm" };
  });

/**
 * Passwort-Reset. Die Antwort ist bewusst neutral, damit keine
 * Konto-Existenz preisgegeben wird – außer bei fehlgeschlagenem Captcha.
 */
export const requestPasswordResetWithCaptcha = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        redirectTo: z.string().url().max(500),
        captchaToken: z.string().trim().min(10).max(4096).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ status: "ok" | "captcha" }> => {
    const { verifyTurnstileToken, currentRequestIp } = await import("./turnstile.server");
    const ok = await verifyTurnstileToken(data.captchaToken, await currentRequestIp());
    if (!ok) return { status: "captcha" };

    const { createPublicServerClient } = await import("./auth-public.server");
    const supabase = createPublicServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) console.error("[auth] reset password", error.message);
    return { status: "ok" };
  });
