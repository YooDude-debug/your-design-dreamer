import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Öffentliche Transkription für den SlangTag Tester der Landingpage.
 * Reine Ansicht: keine Datenbank, kein Storage, keine Statistik.
 */
export const transcribeTestRecording = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ audioDataUrl: z.string().min(64).max(8_000_000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { transcribeTestAudio } = await import("@/lib/public-transcribe.server");
    return { text: await transcribeTestAudio(data.audioDataUrl) };
  });
