/**
 * Serverseitige Beitragserstellung mit asynchroner KI-Moderation.
 *
 * Beiträge werden ausschließlich hier angelegt bzw. geändert. Die Datenbank
 * verweigert dem Browser das direkte Einfügen/Ändern von Beiträgen.
 *
 * Ablauf: Beitrag sofort speichern (Status "pending") → Moderationsauftrag in
 * die Warteschlange legen → Antwort an die Oberfläche. Die vollständige Prüfung
 * (Text, Bild, SlangTags) läuft danach im Hintergrund
 * (`src/lib/moderation-queue.server.ts`) mit unveränderten Regeln.
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

/**
 * `title` ist ein kurzes Label (SlangTag-Name oder Kurzform der Caption), die
 * vollständige Caption steht in `description`. Ein zu langer Titel darf den
 * Beitrag deshalb nie ablehnen (Beitrags- und Medienverlust), sondern wird auf
 * die Feldlänge gekürzt. Die Semantik von `title` bleibt unverändert.
 */
const titleField = z
  .string()
  .transform((v) => v.slice(0, 300))
  .pipe(z.string().max(300));

const createSchema = z.object({
  title: titleField.default(""),
  description: z.string().max(5000).default(""),

  region: z.string().max(120).default(""),
  hashtags: z.array(z.string().max(80)).max(30).default([]),
  /** Zusätzlicher Channel; serverseitig gegen Sichtbarkeit und Sperren geprüft. */
  channelId: z.string().uuid().nullable().default(null),
  imagePath: z.string().max(500).nullable().default(null),
  /** Privates Original (nur bei eingebrannter Verpixelung vorhanden) */
  originalImagePath: z.string().max(500).nullable().default(null),
  audioPath: z.string().max(500).nullable().default(null),
  duration: z.string().max(20).default("0:00"),
  placements: z.array(placementSchema).max(5).default([]),
  slangTagIds: z.array(z.string().uuid()).max(5).default([]),
  /** Schloss der Abspielreihenfolge (Standard: geschlossen). */
  slangtagOrderLocked: z.boolean().default(true),
  visibility: z.enum(["public", "connections", "private", "following"]).default("public"),
  /** Videopfad: SlangShot (`shot`) oder Video-Beitrag V1 (`post`). */
  videoPath: z.string().max(500).nullable().default(null),
  /**
   * `shot` = stumme SlangShot-Bildspur (max. 5 s, SlangTag verpflichtend).
   * `post` = Video-Beitrag V1 (max. 60 s, Angaben kommen aus
   * `media_video_assets` – Clientwerte werden nicht übernommen).
   */
  videoKind: z.enum(["shot", "post"]).default("shot"),
  /** Länge des Shorts – serverseitig hart begrenzt (Shot 5 s, Video 60 s). */
  videoDurationMs: z.number().int().positive().max(60000).nullable().default(null),
});

const updateSchema = z.object({
  postId: z.string().uuid(),
  title: titleField.optional(),
  description: z.string().max(5000).optional(),
  region: z.string().max(120).optional(),
  hashtags: z.array(z.string().max(80)).max(30).optional(),
  /** undefined = unverändert, null = Bild entfernen, string = neuer Pfad */
  imagePath: z.string().max(500).nullable().optional(),
  /** Privates Original zum neuen Bild */
  originalImagePath: z.string().max(500).nullable().optional(),
  placements: z.array(placementSchema).max(5).optional(),
  slangTagIds: z.array(z.string().uuid()).max(5).optional(),
  slangtagOrderLocked: z.boolean().optional(),
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
    const { purgeImage, checkSlangTagUsability } = await import("@/lib/post-moderation.server");
    const { enqueuePostModeration } = await import("@/lib/moderation-queue.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Missbrauchsbremse (P-06): begrenzt Serien-Uploads und damit auch die
    // Kosten der KI-Moderation. Normale Nutzung bleibt unberührt.
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await checkRateLimit({
      table: "posts",
      userId: context.userId,
      max: 15,
      windowMinutes: 10,
    });
    if (!limit.ok) {
      return {
        ok: false,
        decision: "review",
        message:
          "Du hast in kurzer Zeit sehr viele Beiträge erstellt. Bitte versuche es in einigen Minuten erneut.",
        post: null,
      };
    }

    // Eigene Uploads: der Pfad muss im Ordner des Nutzers liegen.
    for (const path of [data.imagePath, data.audioPath, data.originalImagePath, data.videoPath]) {
      if (path && !path.startsWith(`${context.userId}/`)) {
        return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
      }
    }

    // Das private Original darf niemals als veroeffentlichte Version dienen.
    if (data.imagePath?.includes("/originals/")) {
      return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
    }

    // SlangShots brauchen immer einen SlangTag – der Ton kommt ausschliesslich
    // vom SlangTag, das Video selbst ist stumm.
    if (data.videoPath && data.videoKind === "shot" && data.slangTagIds.length === 0) {
      return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
    }

    /**
     * Video-Beitrag V1: die Länge stammt ausschliesslich aus der bereits
     * serverseitig geprüften Abnahme (`media_video_assets`, Status `ready`).
     * Ohne gültigen Datensatz wird der Beitrag nicht angelegt.
     */
    let videoDurationMs: number | null = null;
    if (data.videoPath && data.videoKind === "post") {
      const { data: asset } = await supabaseAdmin
        .from("media_video_assets")
        .select("duration_ms, status, owner_id")
        .eq("path", data.videoPath)
        .maybeSingle();
      const ready =
        asset && asset.status === "ready" && asset.owner_id === context.userId && asset.duration_ms;
      if (!ready) {
        return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
      }
      videoDurationMs = Math.min(Number(asset.duration_ms), 60000);
    } else if (data.videoPath) {
      videoDurationMs = Math.min(data.videoDurationMs ?? 5000, 5000);
    }

    // SlangTag-Prüfung getrennt von der Inhaltsmoderation: ungültige SlangTags
    // werden hier mit konkretem Namen gemeldet, nicht als Richtlinienverstoß.
    if (data.slangTagIds.length > 0) {
      const tags = await checkSlangTagUsability(data.slangTagIds);
      if (!tags.ok) {
        return { ok: false, decision: "block", message: tags.message, post: null };
      }
    }

    // Channel-Zuordnung: nur Channels, die der Nutzer selbst sehen darf und in
    // denen er nicht gesperrt ist. Die Prüfung läuft mit den Rechten des
    // Nutzers (RLS), die Kategorie wird vom Channel übernommen.
    let channelId: string | null = null;
    let channelCategoryId: string | null = null;
    if (data.channelId) {
      const { data: channel } = await context.supabase
        .from("channels")
        .select("id, category_id, is_active")
        .eq("id", data.channelId)
        .maybeSingle();
      if (!channel || channel.is_active === false) {
        return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
      }
      const { data: banned } = await context.supabase.rpc("is_channel_banned", {
        _channel_id: channel.id,
        _user_id: context.userId,
      });
      if (banned) {
        return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
      }
      channelId = channel.id;
      channelCategoryId = channel.category_id ?? null;
    }

    // Ohne Profilzeile schlaegt der Fremdschluessel posts.user_id fehl. Konten,
    // deren Profilanlage nach der Registrierung nicht durchlief, werden hier
    // reparariert, statt den Beitrag zu verlieren.
    const { ensureProfileRow } = await import("@/lib/profile-ensure.server");
    const profileUsername = await ensureProfileRow(context.userId);
    if (!profileUsername) {
      console.error("[posts] post_insert_error profile_missing");
      throw new Error("profile missing");
    }

    console.info("[posts] post_insert_started");
    // Sofort speichern – der Beitrag ist unmittelbar im Feed und im Profil.
    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .insert({
        user_id: context.userId,
        title: data.title,
        description: data.description,
        region: data.region,
        hashtags: data.hashtags,
        channel_id: channelId,
        channel_category_id: channelCategoryId,
        image_url: data.imagePath,
        audio_url: data.audioPath,
        video_url: data.videoPath,
        video_kind: data.videoPath ? data.videoKind : "shot",
        video_duration_ms: videoDurationMs,
        duration: data.duration,
        placements: data.placements as never,
        slang_tag_ids: data.slangTagIds,
        slangtag_order_locked: data.slangtagOrderLocked,
        visibility: data.visibility,
        moderation_status: "pending",
        hidden_at: null,
      } as never)
      .select("*")
      .maybeSingle();

    if (error || !row) {
      // Fehlercode mitloggen (keine Inhalte), damit RLS-/Constraint-Fehler
      // unterscheidbar sind.
      console.error(
        "[posts] post_insert_error",
        error?.code ?? "",
        error?.message ?? "post insert failed",
      );
      await purgeImage(data.imagePath);
      throw new Error(error?.message ?? "post insert failed");
    }
    console.info("[posts] post_insert_success");

    // Original privat verknuepfen (nur Eigentuemer/Administrator lesbar).
    if (data.originalImagePath) {
      const { error: origError } = await supabaseAdmin.from("post_originals").insert({
        post_id: (row as { id: string }).id,
        owner_id: context.userId,
        storage_path: data.originalImagePath,
      } as never);
      if (origError) console.error("[posts] original link failed", origError.message);
    }

    // Nutzung je SlangTag (Region + Jahr) wird zentral per DB-Trigger
    // "posts_sync_slang_tag_uses" gepflegt – Grundlage der Slang-Globe-Statistiken.

    // KI-Prüfung läuft entkoppelt im Hintergrund.
    await enqueuePostModeration({
      postId: (row as { id: string }).id,
      userId: context.userId,
      kind: "post_create",
    });

    return {
      ok: true,
      decision: "allow",
      message: "",
      post: row as Record<string, Json>,
    };
  });

export const updateModeratedPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => updateSchema.parse(data))
  .handler(async ({ data, context }): Promise<ModeratedPostResult> => {
    const { enqueuePostModeration } = await import("@/lib/moderation-queue.server");
    const { checkSlangTagUsability } = await import("@/lib/post-moderation.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.slangTagIds && data.slangTagIds.length > 0) {
      const tags = await checkSlangTagUsability(data.slangTagIds);
      if (!tags.ok) {
        return { ok: false, decision: "block", message: tags.message, post: null };
      }
    }

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

    for (const path of [data.imagePath, data.originalImagePath]) {
      if (path && !path.startsWith(`${context.userId}/`)) {
        return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
      }
    }
    if (data.imagePath?.includes("/originals/")) {
      return { ok: false, decision: "block", message: MODERATION_MESSAGES.blocked, post: null };
    }

    const imageChanged = data.imagePath !== undefined && data.imagePath !== current.image_url;

    const update: Record<string, unknown> = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.region !== undefined) update.region = data.region;
    if (data.hashtags !== undefined) update.hashtags = data.hashtags;
    if (data.placements !== undefined) update.placements = data.placements;
    if (data.slangTagIds !== undefined) update.slang_tag_ids = data.slangTagIds;
    if (data.slangtagOrderLocked !== undefined)
      update.slangtag_order_locked = data.slangtagOrderLocked;
    if (data.visibility !== undefined) update.visibility = data.visibility;
    if (data.imagePath !== undefined) update.image_url = data.imagePath;
    // Änderung wird sofort übernommen, die Prüfung folgt im Hintergrund.
    update.moderation_status = "pending";

    const { data: row, error } = await supabaseAdmin
      .from("posts")
      .update(update as never)
      .eq("id", data.postId)
      .eq("user_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error || !row) throw new Error(error?.message ?? "post update failed");

    if (imageChanged) {
      if (data.originalImagePath) {
        await supabaseAdmin.from("post_originals").upsert({
          post_id: data.postId,
          owner_id: current.user_id as string,
          storage_path: data.originalImagePath,
        } as never);
      } else {
        await supabaseAdmin.from("post_originals").delete().eq("post_id", data.postId);
      }
    }

    await enqueuePostModeration({
      postId: data.postId,
      userId: context.userId,
      kind: "post_update",
      // Unverändertes Bild wurde beim Erstellen bereits geprüft.
      skipImage: !imageChanged,
    });

    return {
      ok: true,
      decision: "allow",
      message: "",
      post: row as Record<string, Json>,
    };
  });

/**
 * Signierte URL des privaten Originalbildes – ausschliesslich fuer den
 * Eigentuemer oder einen Administrator. Der Speicherpfad selbst verlaesst den
 * Server nie; ausgeliefert wird nur eine kurzlebige signierte URL.
 */
export const getPostOriginalImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ postId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { data: link } = await context.supabase
      .from("post_originals")
      .select("storage_path")
      .eq("post_id", data.postId)
      .maybeSingle();
    const path = (link as { storage_path?: string } | null)?.storage_path;
    if (!path) return { url: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from("media").createSignedUrl(path, 300);
    return { url: signed?.signedUrl ?? null };
  });
