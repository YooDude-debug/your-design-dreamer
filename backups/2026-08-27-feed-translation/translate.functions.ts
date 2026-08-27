import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TRANSLATION_LANGS } from "@/lib/lang-detect";

/**
 * Uebersetzung einer Chat-Nachricht in die Sprache des Empfaengers.
 *
 * Sicherheit: laeuft nur fuer angemeldete Nutzer, liest die Nachricht mit den
 * bestehenden RLS-Regeln (nur eigene Chats) und schreibt Cache-Zeilen
 * ausschliesslich serverseitig. API-Schluessel bleiben auf dem Server.
 *
 * Kosten: vorhandene Uebersetzung wird wiederverwendet, gleiche Sprache wird
 * nicht uebersetzt, Audio wird nur bei Bedarf transkribiert.
 */
export const translateChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        messageId: z.string().uuid(),
        targetLang: z.enum(TRANSLATION_LANGS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { translateMessageForViewer } = await import("@/lib/translate-message.server");
    return translateMessageForViewer(context.supabase, data.messageId, data.targetLang);
  });

/**
 * Speech-to-Text für private Chat-SlangTags: transkribiert die frische
 * Aufnahme (Data-URL) ohne sie zu speichern. Das Transkript bleibt im
 * Original – daraus wird clientseitig der SlangTag-Name vorgeschlagen.
 */
export const transcribeChatRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ audioDataUrl: z.string().min(64).max(8_000_000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ text: string }> => {
    const { transcribeTestAudio } = await import("@/lib/public-transcribe.server");
    try {
      return { text: await transcribeTestAudio(data.audioDataUrl) };
    } catch {
      // Speech-to-Text ist optional: die Aufnahme bleibt sendbar.
      return { text: "" };
    }
  });

/**
 * Uebersetzung eines Beitrags (Titel + Beschreibung) in die Sprache des
 * angemeldeten Nutzers. Das Original bleibt unveraendert; Ergebnisse liegen
 * im Cache `post_translations` und werden wiederverwendet.
 */
export const translatePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        postId: z.string().uuid(),
        targetLang: z.enum(TRANSLATION_LANGS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { translatePostForViewer } = await import("@/lib/translate-post.server");
    return translatePostForViewer(context.supabase, data.postId, data.targetLang);
  });
