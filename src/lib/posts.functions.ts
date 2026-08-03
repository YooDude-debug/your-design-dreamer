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

    const { error } = await supabaseAdmin.from("posts").delete().eq("id", data.postId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });
