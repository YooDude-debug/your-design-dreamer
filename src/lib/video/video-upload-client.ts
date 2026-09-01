/**
 * Client-Seite des Video-Uploads (Video Upload V1).
 *
 * Verwendet ausschließlich die bestehende Medieninfrastruktur:
 * privater Bucket `media`, Pfadschema `<userId>/videos/<uuid>.<ext>`,
 * Cache-Klassen aus `cacheControlFor`, Auslieferung über Signed URLs.
 *
 * Das Original bleibt im Originalcontainer (MP4/MOV) – es wird nichts
 * transkodiert. Erzeugt wird zusätzlich ein Thumbnail als WebP, analog zur
 * bestehenden Bildvariantenlogik (`__t.webp`).
 */
import { supabase } from "@/integrations/supabase/client";
import { cacheControlFor } from "@/lib/media";
import { registerVideoUpload } from "./video-upload.functions";
import { videoThumbPath } from "./video-upload.shared";
import { pickVideoThumbnail } from "./video-thumbnail";
import { ALLOWED_VIDEO_MIME, MAX_VIDEO_BYTES, type VideoErrorCode } from "./video-file";

const BUCKET = "media";

function extFor(mime: string, fileName: string) {
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/mp4" || mime === "video/x-m4v") return "mp4";
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "mp4";
}

export type VideoUploadResult =
  | {
      ok: true;
      path: string;
      thumbnailPath: string | null;
      durationMs: number;
      width: number;
      height: number;
      aspectRatio: number;
    }
  | { ok: false; code: VideoErrorCode };

/**
 * Lädt ein ausgewähltes Video hoch und lässt es serverseitig abnehmen.
 * Die Prüfung im Browser ist nur eine schnelle Vorfilterung – verbindlich
 * ist immer das Serverergebnis.
 */
export async function uploadPostVideo(userId: string, file: File): Promise<VideoUploadResult> {
  const mime = (file.type || "").split(";")[0]!.toLowerCase();
  if (!ALLOWED_VIDEO_MIME.includes(mime as (typeof ALLOWED_VIDEO_MIME)[number])) {
    return { ok: false, code: "unsupported_format" };
  }
  if (file.size > MAX_VIDEO_BYTES) return { ok: false, code: "too_large" };

  const path = `${userId}/videos/${crypto.randomUUID()}.${extFor(mime, file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mime,
    cacheControl: cacheControlFor("videos"),
    upsert: false,
  });
  if (error) {
    console.error("[video] upload failed", error.message);
    return { ok: false, code: "storage_error" };
  }

  // Thumbnail aus einem sinnvollen Frame – schlägt es fehl, bleibt das Video gültig.
  let thumbnailPath: string | null = null;
  try {
    const thumb = await pickVideoThumbnail(file);
    const target = videoThumbPath(path);
    if (thumb && target) {
      const { error: thumbError } = await supabase.storage.from(BUCKET).upload(target, thumb, {
        contentType: "image/webp",
        cacheControl: cacheControlFor("videos"),
        upsert: false,
      });
      if (!thumbError) thumbnailPath = target;
    }
  } catch {
    /* Thumbnail ist optional */
  }

  const result = await registerVideoUpload({ data: { path, thumbnailPath } });
  if (!result.ok) return { ok: false, code: result.code };
  return {
    ok: true,
    path: result.path,
    thumbnailPath: result.thumbnailPath,
    durationMs: result.durationMs,
    width: result.width,
    height: result.height,
    aspectRatio: result.aspectRatio,
  };
}
