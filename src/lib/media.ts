import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";
const SIGN_TTL = 60 * 60 * 24 * 7; // 7 Tage

/** Kurzlebiger Cache für signierte URLs (nur Caching, kein Primärspeicher). */
const signedCache = new Map<string, { url: string; expires: number }>();

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(head)?.[1] ?? "application/octet-stream";
  if (head.includes("base64")) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

function extFor(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

/** Lädt einen Data-URL in den Medienspeicher und liefert den Pfad zurück. */
export async function uploadDataUrl(
  userId: string,
  dataUrl: string | null,
  folder: "images" | "audio" | "avatars" | "covers",
): Promise<string | null> {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith("data:")) return dataUrl; // bereits ein Pfad
  const blob = dataUrlToBlob(dataUrl);
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extFor(blob.type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });
  if (error) {
    console.error("[media] upload failed", error.message);
    return null;
  }
  return path;
}

/** Signiert Speicherpfade (mit Cache) und liefert eine Pfad→URL-Map. */
export async function signPaths(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const now = Date.now();
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p && !p.startsWith("http") && !p.startsWith("data:"))));
  const result: Record<string, string> = {};
  const missing: string[] = [];

  unique.forEach((p) => {
    const hit = signedCache.get(p);
    if (hit && hit.expires > now) result[p] = hit.url;
    else missing.push(p);
  });

  if (missing.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SIGN_TTL);
    if (error) console.error("[media] sign failed", error.message);
    (data ?? []).forEach((entry) => {
      if (entry.signedUrl && entry.path) {
        result[entry.path] = entry.signedUrl;
        signedCache.set(entry.path, { url: entry.signedUrl, expires: now + (SIGN_TTL - 600) * 1000 });
      }
    });
  }

  return result;
}

/** Löst einen einzelnen Pfad auf (durchgereicht, wenn es bereits eine URL ist). */
export async function signPath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  const map = await signPaths([path]);
  return map[path] ?? null;
}
