import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runPublicTranscription, type PublicTranscribeResult } from "./public-transcribe-guard";

/**
 * Öffentliche Transkription für den SlangTag Tester der Landingpage.
 * Reine Ansicht: keine Datenbank, kein Storage, keine Statistik.
 *
 * Schutz (ausschließlich serverseitig, siehe public-transcribe-guard.ts):
 * 1. Rate Limit pro Client-IP (In-Memory-Sliding-Window).
 * 2. Cloudflare-Turnstile-Token, gegen Cloudflare verifiziert (einmalig gültig).
 * 3. Harte Größen-/Format-Limits vor dem Aufruf der kostenpflichtigen API.
 * Pro Request höchstens EIN externer Transkriptionsaufruf, ohne Retry.
 */
export const transcribeTestRecording = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        audioDataUrl: z.string().min(64).max(4_000_000),
        turnstileToken: z.string().max(4096).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PublicTranscribeResult> => {
    const { currentRequestIp, verifyTurnstileToken } = await import("@/lib/turnstile.server");
    const ip = await currentRequestIp();
    const { checkIpRateLimit } = await import("@/lib/ip-rate-limit.server");

    return runPublicTranscription(data.turnstileToken, {
      rateLimit: () =>
        checkIpRateLimit({ scope: "public-transcribe", ip, max: 8, windowSeconds: 600 }),
      verify: (token) => verifyTurnstileToken(token, ip),
      transcribe: async () => {
        const { transcribeTestAudio } = await import("@/lib/public-transcribe.server");
        return transcribeTestAudio(data.audioDataUrl);
      },
    });
  });
