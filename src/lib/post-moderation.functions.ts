/**
 * Serverseitige Beitragsprüfung und -erstellung.
 *
 * Beiträge werden ausschließlich hier angelegt bzw. geändert. Die Datenbank
 * verweigert dem Browser das direkte Einfügen/Ändern von Beiträgen – die
 * Prüfung kann daher nicht über manipuliertes JavaScript umgangen werden.
 *
 * Ablauf: Text prüfen → Bild prüfen (zwei Modelle) → SlangTags prüfen
 * → Entscheidung. Bei einem Treffer wird der Beitrag nicht gespeichert und das
 * Bild samt Varianten aus dem Speicher gelöscht.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MODERATION_MESSAGES } from "@/lib/moderation-policy";

const placementSchema = z
  .object({
    id: z.string(),
    tagId: z.string(),
    x: z.number(),
    y: z.number(),
    scale: z.number(),
    rotation: z.number(),
  })
  .passthrough();

const createSchema = z.object({
  title: z.string().max(300).default(""),
  description: z.string().max(5000).default(""),
  region: z.string().max(120).default(""),
  hashtags: z.array(z.string().max(80)).max(30).default([]),
  imagePath: z.string().max(500).nullable().default(null),
  audioPath: z.string().max(500).nullable().default(null),
  duration: z.string().max(20).default("0:00"),
  placements: z.array(placementSchema).max(20).default([]),
  slangTagIds: z.array(z.string().uuid()).max(5).default([]),
  visibility: z.enum(["public", "connections", "private", "following"]).default("public"),
});

const updateSchema = z.object({
  postId: z.string().uuid(),
  title: z.string().max(300).optional(),
  description: z.string().max(5000).optional(),
  region: z.string().max(120).optional(),
  hashtags: z.array(z.string().max(80)).max(30).optional(),
  /** undefined = unverändert, null = Bild entfernen, string = neuer Pfad */
  imagePath: z.string().max(500).nullable().optional(),
  placements: z.array(placementSchema).max(20).optional(),
  slangTagIds: z.array(z.string().uuid()).max(5).optional(),
  visibility: z.enum(["public", "connections", "private", "following"]).optional(),
});

/** JSON-serialisierbarer Wert (Rückgabe über die Server-Function-Grenze). */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type ModeratedPostResult = {
  ok: boolean;
  /** Entscheidung der Prüfung. */
  decision: "allow" | "review" | "block";
  /** Neutrale Meldung für die Oberfläche (ohne Details). */
  message: string;
  /** Der gespeicherte Beitrag (nur bei ok = true). */
  post: Record<string, Json> | null;
};

export const createModeratedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => createSchema.parse(data))
  .handler(async ({ data, context }): Promise<ModeratedPostResult> => {
    const { runPostModeration, purgeImage, logModeration } = await import(
      "@/lib/post-moderation.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Eigene Uploads: der Pfad muss im Ordner des Nutzers liegen.
    for (const path of [data.imagePath, data.audioPath]) {
      if (path && !path.startsWith(`${context.userId}/`)) {
        return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
      }
    }

    const verdict = await runPostModeration({
      userId: context.userId,
      title: data.title,
      description: data.description,
      hashtags: data.hashtags,
      region: data.region,
      imagePath: data.imagePath,
      slangTagIds: data.slangTagIds,
    });

    if (verdict.decision === "block") {
      await purgeImage(data.imagePath);
      await logModeration({
        userId: context.userId,
        contentType: "post_create",
        contentId: null,
        verdict,
      });
      return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
    }

    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description,
        region: data.region,
        hashtags: data.hashtags,
        image_url: data.imagePath,
        audio_url: data.audioPath,
        duration: data.duration,
        placements: data.placements as never,
        slang_tag_ids: data.slangTagIds,
        visibility: data.visibility,
        // Unklare Fälle bleiben bis zur Admin-Entscheidung unveröffentlicht.
        hidden_at: verdict.decision === "review" ? new Date().toISOString() : null,
      } as never)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      await purgeImage(data.imagePath);
      throw new Error(error?.message ?? "post insert failed");
    }

    await logModeration({
      userId: context.userId,
      contentType: "post_create",
      contentId: (row as { id: string }).id,
      verdict,
    });

    return {
      ok: verdict.decision === "allow",
      decision: verdict.decision,
      message: verdict.decision === "review" ? MODERATION_MESSAGES.review : "",
      post: verdict.decision === "allow" ? (row as Record<string, Json>) : null,
    };
  });

export const updateModeratedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateSchema.parse(data))
  .handler(async ({ data, context }): Promise<ModeratedPostResult> => {
    const { runPostModeration, purgeImage, logModeration } = await import(
      "@/lib/post-moderation.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("posts")
      .select("id,user_id,title,description,hashtags,region,image_url,slang_tag_ids")
      .eq("id", data.postId)
      .maybeSingle();
    if (!existing) throw new Error("Post not found");
    const current = existing as Record<string, unknown>;
    // Bearbeiten darf ausschliesslich der Eigentuemer oder ein Administrator.
    if (current.user_id !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "admin",
      });
      if (isAdmin !== true) throw new Error("Forbidden");
    }

    if (data.imagePath && !data.imagePath.startsWith(`${context.userId}/`)) {
      return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
    }

    // Geprüft wird immer der Inhalt, wie er nach der Änderung aussieht.
    const nextImage =
      data.imagePath === undefined ? ((current.image_url as string | null) ?? null) : data.imagePath;
    const imageChanged = data.imagePath !== undefined && data.imagePath !== current.image_url;

    const verdict = await runPostModeration({
      userId: context.userId,
      title: data.title ?? String(current.title ?? ""),
      description: data.description ?? String(current.description ?? ""),
      hashtags: data.hashtags ?? ((current.hashtags as string[] | null) ?? []),
      region: data.region ?? String(current.region ?? ""),
      imagePath: nextImage,
      slangTagIds: data.slangTagIds ?? ((current.slang_tag_ids as string[] | null) ?? []),
      // Unverändertes Bild wurde beim Erstellen bereits geprüft.
      skipImage: !imageChanged,
    });

    if (verdict.decision === "block") {
      if (imageChanged) await purgeImage(data.imagePath);
      await logModeration({
        userId: context.userId,
        contentType: "post_update",
        contentId: data.postId,
        verdict,
      });
      return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
    }

    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.region !== undefined) update.region = data.region;
    if (data.hashtags !== undefined) update.hashtags = data.hashtags;
    if (data.placements !== undefined) update.placements = data.placements;
    if (data.slangTagIds !== undefined) update.slang_tag_ids = data.slangTagIds;
    if (data.visibility !== undefined) update.visibility = data.visibility;
    if (data.imagePath !== undefined) update.image_url = data.imagePath;
    if (verdict.decision === "review") update.hidden_at = new Date().toISOString();

    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .update(update as never)
      .eq("id", data.postId)
      .eq("user_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error || !row) throw new Error(error?.message ?? "post update failed");

    await logModeration({
      userId: context.userId,
      contentType: "post_update",
      contentId: data.postId,
      verdict,
    });

    return {
      ok: verdict.decision === "allow",
      decision: verdict.decision,
      message: verdict.decision === "review" ? MODERATION_MESSAGES.review : "",
      post: row as Record<string, Json>,
    };
  });
