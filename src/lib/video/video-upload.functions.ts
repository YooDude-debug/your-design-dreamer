import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnedVideoPath, videoThumbPath } from "./video-upload.shared";
import {
  checkVideoFile,
  videoDurationMs,
  type RangeReader,
  type VideoErrorCode,
} from "./video-file";

/**
 * Video Upload V1 – serverseitige Abnahme eines hochgeladenen Videos.
 *
 * Ablauf: der Client legt die Originaldatei über die bestehende Speicherlogik
 * in `<userId>/videos/…` ab und meldet den Pfad hier an. Der Server prüft
 * anschließend selbst – Angaben des Clients werden nie übernommen:
 * Dateigröße und MIME kommen aus dem Speicher, Dauer/Maße/Rotation aus den
 * Containerdaten der Datei (Byte-Bereiche, keine Dekodierung).
 *
 * Ergebnis ist ein Datensatz in `public.media_video_assets` mit Status
 * `ready` oder `failed`. Nur `ready` darf später ausgeliefert werden.
 */

type RegisterInput = { path: string; thumbnailPath?: string | null };

type RegisterResult =
  | {
      ok: true;
      path: string;
      status: "ready";
      durationMs: number;
      width: number;
      height: number;
      aspectRatio: number;
      rotation: number;
      thumbnailPath: string | null;
    }
  | { ok: false; code: VideoErrorCode; status: "failed" };

export const registerVideoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RegisterInput) => {
    if (!input?.path || typeof input.path !== "string" || input.path.length > 400) {
      throw new Error("Invalid path");
    }
    return {
      path: input.path,
      thumbnailPath:
        typeof input.thumbnailPath === "string" && input.thumbnailPath.length <= 400
          ? input.thumbnailPath
          : null,
    };
  })
  .handler(async ({ data, context }): Promise<RegisterResult> => {
    const { userId } = context;
    if (!isOwnedVideoPath(data.path, userId)) {
      return { ok: false, code: "storage_error", status: "failed" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const storage = supabaseAdmin.storage.from("media");

    const slash = data.path.lastIndexOf("/");
    const prefix = data.path.slice(0, slash);
    const name = data.path.slice(slash + 1);
    const { data: listed, error: listError } = await storage.list(prefix, {
      limit: 100,
      search: name,
    });
    if (listError) return { ok: false, code: "storage_error", status: "failed" };
    const object = (listed ?? []).find((entry) => entry.name === name) as
      | { name: string; metadata?: { size?: number; mimetype?: string } | null }
      | undefined;
    if (!object) return { ok: false, code: "storage_error", status: "failed" };

    const size = object.metadata?.size ?? 0;
    const mimeType = object.metadata?.mimetype ?? "";

    const { data: signed, error: signError } = await storage.createSignedUrl(data.path, 120);
    if (signError || !signed?.signedUrl) {
      return { ok: false, code: "storage_error", status: "failed" };
    }
    const url = signed.signedUrl;

    // Byte-Bereiche statt Volldownload: Header/`moov` genügen für alle Angaben.
    const read: RangeReader = async (offset, len) => {
      const res = await fetch(url, {
        headers: { range: `bytes=${offset}-${offset + len - 1}` },
      });
      if (!res.ok && res.status !== 206) throw new Error(`range ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    };

    const check = await checkVideoFile({ read, size, mimeType });

    const thumbnailPath = data.thumbnailPath ?? videoThumbPath(data.path);

    if (!check.ok) {
      await supabaseAdmin.from("media_video_assets").upsert(
        {
          path: data.path,
          owner_id: userId,
          status: "failed",
          mime_type: mimeType || null,
          file_size: size || null,
          last_error: check.code,
        },
        { onConflict: "path" },
      );
      // Fehlgeschlagene Uploads hinterlassen keine unbrauchbaren Dateien.
      await storage.remove([data.path, ...(thumbnailPath ? [thumbnailPath] : [])]);
      return { ok: false, code: check.code, status: "failed" };
    }

    const m = check.metadata;
    const hasThumb = thumbnailPath
      ? await storage
          .list(thumbnailPath.slice(0, thumbnailPath.lastIndexOf("/")), {
            limit: 100,
            search: thumbnailPath.slice(thumbnailPath.lastIndexOf("/") + 1),
          })
          .then(({ data: rows }) =>
            (rows ?? []).some(
              (r) =>
                `${thumbnailPath.slice(0, thumbnailPath.lastIndexOf("/"))}/${r.name}` ===
                thumbnailPath,
            ),
          )
          .catch(() => false)
      : false;

    const { error: upsertError } = await supabaseAdmin.from("media_video_assets").upsert(
      {
        path: data.path,
        owner_id: userId,
        status: "ready",
        mime_type: mimeType,
        file_size: size,
        duration_ms: videoDurationMs(m.durationSeconds),
        width: m.displayWidth,
        height: m.displayHeight,
        aspect_ratio: m.aspectRatio,
        rotation: m.rotation,
        container: m.container,
        thumbnail_path: hasThumb ? thumbnailPath : null,
        last_error: null,
      },
      { onConflict: "path" },
    );
    if (upsertError) {
      console.error("[video] register failed", upsertError.message);
      return { ok: false, code: "processing_failed", status: "failed" };
    }

    return {
      ok: true,
      path: data.path,
      status: "ready",
      durationMs: videoDurationMs(m.durationSeconds),
      width: m.displayWidth,
      height: m.displayHeight,
      aspectRatio: m.aspectRatio,
      rotation: m.rotation,
      thumbnailPath: hasThumb ? thumbnailPath : null,
    };
  });
