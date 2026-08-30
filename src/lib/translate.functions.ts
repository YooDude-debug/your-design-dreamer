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

/**
 * Gebuendelte Uebersetzung mehrerer Beitraege eines Feed-Ladevorgangs.
 *
 * Sicherheit: identisch zu `translatePost`. Jede Post-ID wird einzeln ueber
 * denselben angemeldeten Supabase-Client (RLS/`can_view_post`) aufgeloest –
 * kein service_role, kein Admin-Bypass, keine gelockerte Policy. Nicht
 * sichtbare oder erfundene IDs liefern nur `unavailable`.
 *
 * Kosten: pro ID wird zuerst der Cache `post_translations` genutzt; ein
 * KI-Aufruf entsteht ausschliesslich fuer tatsaechlich fehlende Uebersetzungen.
 */
export const translatePostsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        postIds: z.array(z.string().uuid()).min(1).max(20),
        targetLang: z.enum(TRANSLATION_LANGS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { translatePostForViewer } = await import("@/lib/translate-post.server");
    const ids = Array.from(new Set(data.postIds));
    const results = await Promise.all(
      ids.map((id) => translatePostForViewer(context.supabase, id, data.targetLang)),
    );
    return Object.fromEntries(ids.map((id, i) => [id, results[i]!]));
  });

/**
 * Uebersetzung eines Kommentars in die Sprache des angemeldeten Nutzers.
 * Das Original bleibt unveraendert; Ergebnisse liegen im Cache
 * `comment_translations` und werden wiederverwendet.
 */
export const translateComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        commentId: z.string().uuid(),
        targetLang: z.enum(TRANSLATION_LANGS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { translateCommentForViewer } = await import("@/lib/translate-comment.server");
    return translateCommentForViewer(context.supabase, data.commentId, data.targetLang);
  });
