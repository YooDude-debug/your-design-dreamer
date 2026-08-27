import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { maskName } from "./post-likes.shared";

export type PostLiker = {
  id: string;
  /** Bereits serverseitig anonymisierter Name, falls Privatsphäre aktiv. */
  username: string;
  avatar: string | null;
  verified: boolean;
  /** true = Nutzer hat seine Like-Privatsphäre aktiviert. */
  masked: boolean;
};

/**
 * Liste der Nutzer, die einen Beitrag geliked haben.
 * Privatsphäre: Wer seine Likes verborgen hat, wird anonymisiert – der
 * vollständige Name wird nur an den Nutzer selbst ausgeliefert.
 * Shares und Aufrufe werden bewusst NICHT personenbezogen ausgeliefert.
 */
export const getPostLikers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PostLiker[]> => {
    // Sichtbarkeit des Beitrags MUSS vor jeder Datenausgabe geprueft werden:
    // die bestehende Serverlogik can_view_post entscheidet als einzige Quelle.
    const { data: visible, error: visErr } = await context.supabase.rpc("can_view_post", {
      _post_id: data.postId,
    });
    if (visErr || visible !== true) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: likes } = await supabaseAdmin
      .from("post_likes")
      .select("user_id,created_at")
      .eq("post_id", data.postId)
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = (likes ?? []).map((l) => l.user_id as string);
    if (ids.length === 0) return [];

    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,username,display_name,avatar_url,verified,likes_private")
      .in("id", ids);

    const byId = new Map((profs ?? []).map((p) => [p.id as string, p]));

    const out: PostLiker[] = [];
    for (const id of ids) {
      const p = byId.get(id);
      if (!p) continue;
      const isSelf = id === context.userId;
      const priv = Boolean(p.likes_private) && !isSelf;
      const name = (p.display_name as string) || (p.username as string) || "unbekannt";

      let avatar: string | null = null;
      if (!priv && p.avatar_url) {
        const { data: signed } = await supabaseAdmin.storage
          .from("media")
          .createSignedUrl(p.avatar_url as string, 60 * 60);
        avatar = signed?.signedUrl ?? null;
      }

      out.push({
        id,
        username: priv ? maskName(name) : name,
        avatar,
        verified: priv ? false : Boolean(p.verified),
        masked: priv,
      });
    }
    return out;
  });
