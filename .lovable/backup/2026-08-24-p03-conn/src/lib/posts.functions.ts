import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Beitrag löschen. Serverseitige Rechteprüfung:
 * - Eigentümer des Beitrags → erlaubt
 * - Administrator → erlaubt
 * - sonst → verweigert
 */
export const deleteOwnPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ deleted: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: post } = await supabaseAdmin
      .from("posts")
      .select("id,user_id")
      .eq("id", data.postId)
      .maybeSingle();

    if (!post) return { deleted: true };

    let allowed = post.user_id === context.userId;
    if (!allowed) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      allowed = Boolean(isAdmin);
    }
    if (!allowed) throw new Error("Forbidden");

    // Privates Original mitentfernen (Zeile in post_originals faellt per Cascade).
    const { data: original } = await supabaseAdmin
      .from("post_originals")
      .select("storage_path")
      .eq("post_id", data.postId)
      .maybeSingle();
    const originalPath = (original as { storage_path?: string } | null)?.storage_path;
    if (originalPath) {
      const { purgeImage } = await import("@/lib/post-moderation.server");
      await purgeImage(originalPath);
    }

    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    // Serverseitigen Cache gezielt verwerfen: keine veralteten Daten nach
    // Änderungen (öffentlicher Beitrag + Hashtag-Trends).
    const { invalidateServerCache } = await import("@/lib/server-cache.server");
    invalidateServerCache(`public-post:${data.postId}`);
    invalidateServerCache("hashtag-trends:");
    return { deleted: true };
  });
