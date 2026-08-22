import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicSlangTagView = {
  id: string;
  name: string;
  kind: "community" | "creator";
  region: string;
  duration: string;
  audio: string | null;
};

/**
 * Öffentlicher Lesezugriff für QR-Deep-Links (`/?slangtag=<id>`).
 *
 * Bewusst nur Lesen: es entstehen keine Besitzverhältnisse, keine Kopie und
 * keine Play-/Use-Statistik. Zurückgegeben werden ausschließlich freigegebene,
 * nicht gelöschte SlangTags mit einem kurzlebigen Signed-Link auf das Audio.
 */
export const getPublicSlangTag = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ tagId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PublicSlangTagView | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tag } = await supabaseAdmin
      .from("slang_tags")
      .select("id,name,kind,region,duration,audio_url,deleted_at,moderation_status")
      .eq("id", data.tagId)
      .is("deleted_at", null)
      .eq("moderation_status", "approved")
      .maybeSingle();

    if (!tag) return null;

    const path = (tag.audio_url as string | null) ?? null;
    const audio = path
      ? ((await supabaseAdmin.storage.from("media").createSignedUrl(path, 60 * 60)).data
          ?.signedUrl ?? null)
      : null;

    return {
      id: tag.id,
      name: tag.name ?? "",
      kind: tag.kind === "creator" ? "creator" : "community",
      region: (tag.region as string | null) ?? "",
      duration: (tag.duration as string | null) ?? "",
      audio,
    };
  });
