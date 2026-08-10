import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Auth-Vorgänge mit vorgeschalteter, serverseitiger Turnstile-Prüfung.
 * Ohne gültiges Token wird kein Supabase-Auth-Aufruf ausgeführt.
 */

const captcha = z.string().trim().min(10).max(4096);

export type SignInResult =
  | { status: "ok"; accessToken: string; refreshToken: string; userId: string }
  | { status: "captcha" }
  | { status: "invalid" };

export const signInWithCaptcha = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email().max(255),
        password: z.string().min(1).max(200),
        captchaToken: captcha,
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
    if (error || !res.session || !res.user) return { status: "invalid" };
    return {
      status: "ok",
      accessToken: res.session.access_token,
      refreshToken: res.session.refresh_token,
      userId: res.user.id,
    };
  });

export type SignUpResult =
  | { status: "confirm" }
  | { status: "underage" }
  | { status: "session"; accessToken: string; refreshToken: string; userId: string }
  | { status: "captcha" }
  | { status: "failed" };

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
        birthdate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
        redirectTo: z.string().url().max(500),
        captchaToken: captcha,
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

    const { createPublicServerClient } = await import("./auth-public.server");
    const supabase = createPublicServerClient();
    const { data: res, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: data.redirectTo,
        data: { username: data.username, birthdate: data.birthdate },
      },
    });
    if (error) {
      console.error("[auth] signup", error.message);
      return { status: "failed" };
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
        captchaToken: captcha,
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
