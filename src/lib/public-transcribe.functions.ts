import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Öffentliche Transkription für den SlangTag Tester der Landingpage.
 * Reine Ansicht: keine Datenbank, kein Storage, keine Statistik.
 *
 * Abuse-/Kostenschutz (fail-closed, ausschließlich serverseitig):
 * 1. Turnstile-Token ist Pflicht und wird gegen Cloudflare geprüft.
 * 2. Rate Limit pro Client-IP (In-Memory-Sliding-Window).
 * 3. Harte Größen-/Format-Limits vor dem Aufruf der kostenpflichtigen API.
 * Pro Request wird höchstens EIN externer Transkriptionsaufruf ausgelöst,
 * ohne Retry-Schleife und mit Timeout.
 */
export const transcribeTestRecording = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        audioDataUrl: z.string().min(64).max(4_000_000),
        captchaToken: z.string().min(10).max(4096),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { verifyTurnstileToken, currentRequestIp } = await import("@/lib/turnstile.server");
    const ip = await currentRequestIp();

    const { checkIpRateLimit } = await import("@/lib/ip-rate-limit.server");
    const limited = checkIpRateLimit({
      scope: "public-transcribe",
      ip,
      max: 8,
      windowSeconds: 600,
    });
    if (!limited.ok) throw new Error("rate_limited");

    const ok = await verifyTurnstileToken(data.captchaToken, ip);
    if (!ok) throw new Error("captcha");

    const { transcribeTestAudio } = await import("@/lib/public-transcribe.server");
    return { text: await transcribeTestAudio(data.audioDataUrl) };
  });
