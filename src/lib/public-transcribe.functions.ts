import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Öffentliche Transkription für den SlangTag Tester der Landingpage.
 * Reine Ansicht: keine Datenbank, kein Storage, keine Statistik.
 *
 * Bewusst OHNE Turnstile: der Tester ist eine öffentliche Demo. Turnstile
 * schützt ausschließlich die Registrierung.
 *
 * Abuse-/Kostenschutz (ausschließlich serverseitig):
 * 1. Rate Limit pro Client-IP (In-Memory-Sliding-Window).
 * 2. Harte Größen-/Format-Limits vor dem Aufruf der kostenpflichtigen API.
 * Pro Request wird höchstens EIN externer Transkriptionsaufruf ausgelöst,
 * ohne Retry-Schleife und mit Timeout.
 */
export const transcribeTestRecording = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        audioDataUrl: z.string().min(64).max(4_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { currentRequestIp } = await import("@/lib/turnstile.server");
    const ip = await currentRequestIp();

    const { checkIpRateLimit } = await import("@/lib/ip-rate-limit.server");
    const limited = checkIpRateLimit({
      scope: "public-transcribe",
      ip,
      max: 8,
      windowSeconds: 600,
    });
    if (!limited.ok) throw new Error("rate_limited");

    const { transcribeTestAudio } = await import("@/lib/public-transcribe.server");
    return { text: await transcribeTestAudio(data.audioDataUrl) };
  });
