import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicPostView = {
  id: string;
  title: string;
  description: string;
  region: string;
  hashtags: string[];
  image: string | null;
  authorName: string;
  authorUsername: string;
  authorVerified: boolean;
  likes: number;
  comments: number;
  createdAt: string;
};

/**
 * Lädt einen ausschließlich öffentlichen Beitrag für die geteilte Link-Seite.
 * Private oder eingeschränkte Beiträge (connections/following/private) und
 * verborgene Beiträge werden nie zurückgegeben.
 */
export const getPublicPost = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PublicPostView | null> => {
    const { cachedRead, publicCacheHeader } = await import("@/lib/server-cache.server");
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("cache-control", publicCacheHeader());
    return cachedRead(`public-post:${data.postId}`, async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: post } = await supabaseAdmin
        .from("posts")
        .select(
          "id,title,description,region,hashtags,image_url,placements,likes_count,comments_count,created_at,user_id,visibility,hidden_at",
        )
        .eq("id", data.postId)
        .eq("visibility", "public")
        .is("hidden_at", null)
        .maybeSingle();

      if (!post) return null;

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("username,display_name,verified")
        .eq("id", post.user_id)
        .maybeSingle();

      /**
       * Vorschaubild für Link-Vorschauen (og:image, Share Sheet des Systems).
       *
       * Beiträge mit SlangTags dürfen NIE mit dem unverpixelten Beitragsbild
       * vorangezeigt werden. Für sie existiert eine eigene, mit derselben
       * Verpixelungslogik erzeugte Vorschaudatei (`…__s.webp`). Fehlt diese,
       * wird bewusst KEIN Vorschaubild ausgeliefert.
       */
      let image: string | null = null;
      const hasPlacements = Array.isArray(post.placements) && post.placements.length > 0;
      const previewPath = (() => {
        if (!post.image_url) return null;
        if (!hasPlacements) return post.image_url;
        const dot = post.image_url.lastIndexOf(".");
        return dot > 0 ? `${post.image_url.slice(0, dot)}__s.webp` : null;
      })();
      if (previewPath) {
        const { data: signed } = await supabaseAdmin.storage
          .from("media")
          .createSignedUrl(previewPath, 60 * 60 * 24 * 7);
        image = signed?.signedUrl ?? null;
      }

      return {
        id: post.id,
        title: post.title ?? "",
        description: post.description ?? "",
        region: post.region ?? "",
        hashtags: Array.isArray(post.hashtags) ? (post.hashtags as string[]) : [],
        image,
        authorName: profile?.display_name || profile?.username || "Y-Dude Nutzer",
        authorUsername: profile?.username ?? "unbekannt",
        authorVerified: Boolean(profile?.verified),
        likes: post.likes_count ?? 0,
        comments: post.comments_count ?? 0,
        createdAt: post.created_at,
      };
    });
  });
