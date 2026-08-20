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
