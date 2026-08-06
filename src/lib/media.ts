import { supabase } from "@/integrations/supabase/client";

const BUCKET = "media";
const SIGN_TTL = 60 * 60 * 24 * 7; // 7 Tage

/**
 * Kurzlebiger Cache für signierte URLs (nur Caching, kein Primärspeicher).
 * Wird zusätzlich in `sessionStorage` gespiegelt, damit ein Seitenwechsel oder
 * Neuladen dieselben Bild-/Audio-URLs weiterverwendet (Browser-Cache greift)
 * und keine erneuten Signier-Aufrufe nötig sind.
 */
const signedCache = new Map<string, { url: string; expires: number }>();

const PERSIST_KEY = "yd.signed.v1";
let persistTimer: number | undefined;

function loadPersistedCache() {
  if (typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const now = Date.now();
    const parsed = JSON.parse(raw) as Record<string, { url: string; expires: number }>;
    Object.entries(parsed).forEach(([path, entry]) => {
      if (entry?.url && entry.expires > now) signedCache.set(path, entry);
    });
  } catch {
    /* defekter Cache wird einfach ignoriert */
  }
}

function persistCacheSoon() {
  if (typeof sessionStorage === "undefined") return;
  if (persistTimer) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(Object.fromEntries(signedCache)));
    } catch {
      /* Speicher voll oder gesperrt – Cache bleibt rein im Arbeitsspeicher */
    }
  }, 500);
}

if (typeof window !== "undefined") loadPersistedCache();


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

/* ------------------------------- Bildvarianten ------------------------------- */

/** Suffixe der abgeleiteten Bildvarianten (Konvention, kein zusätzliches DB-Feld). */
const VARIANT_SUFFIX = { thumb: "__t", medium: "__m" } as const;
export type ImageVariant = keyof typeof VARIANT_SUFFIX;

/** Thumbnail: 300 × 300 px, Medium: max. 1080 px Kante. */
const VARIANT_SPEC: Record<ImageVariant, { size: number; cover: boolean; quality: number }> = {
  thumb: { size: 300, cover: true, quality: 0.72 },
  medium: { size: 1080, cover: false, quality: 0.82 },
};

/** Leitet den Pfad einer Variante aus dem Originalpfad ab. */
export function variantPath(path: string | null | undefined, variant: ImageVariant): string | null {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return null;
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = path.slice(0, dot);
  if (base.endsWith(VARIANT_SUFFIX.thumb) || base.endsWith(VARIANT_SUFFIX.medium)) return null;
  // Varianten werden immer als WebP gespeichert (breite Browserunterstützung, kleine Dateien).
  return `${base}${VARIANT_SUFFIX[variant]}.webp`;
}

/** Prüft einmalig, ob der Browser WebP kodieren kann. */
let webpSupport: boolean | null = null;
function canEncodeWebp() {
  if (webpSupport !== null) return webpSupport;
  if (typeof document === "undefined") return (webpSupport = false);
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupport;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = src;
  });
}

/** Rendert eine verkleinerte WebP-Variante; `null`, wenn nicht möglich/nicht nötig. */
async function renderVariant(img: HTMLImageElement, variant: ImageVariant): Promise<Blob | null> {
  const spec = VARIANT_SPEC[variant];
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (spec.cover) {
    canvas.width = canvas.height = spec.size;
    const scale = Math.max(spec.size / img.width, spec.size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (spec.size - w) / 2, (spec.size - h) / 2, w, h);
  } else {
    const scale = Math.min(1, spec.size / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", spec.quality),
  );
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

  // Bilder erhalten zusätzlich Thumbnail und Medium als WebP (GIFs bleiben animiert).
  if (
    (folder === "images" || folder === "avatars" || folder === "covers") &&
    !blob.type.includes("gif")
  ) {
    await createVariants(path, dataUrl);
  }
  return path;
}

/**
 * Entfernt hochgeladene Objekte samt Bildvarianten wieder aus dem Speicher.
 * Wird als Rollback verwendet, wenn ein Datenbankeintrag nach dem Upload scheitert.
 */
export async function removeUploads(paths: (string | null | undefined)[]): Promise<void> {
  const targets = new Set<string>();
  for (const p of paths) {
    if (!p || p.startsWith("data:")) continue;
    targets.add(p);
    for (const variant of ["thumb", "medium"] as ImageVariant[]) {
      const v = variantPath(p, variant);
      if (v) targets.add(v);
    }
  }
  if (targets.size === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove([...targets]);
  if (error) console.warn("[media] rollback cleanup failed", error.message);
}

/** Erzeugt Thumbnail + Medium neben dem Original (fehlertolerant, blockiert nichts). */
async function createVariants(path: string, dataUrl: string) {
  if (!canEncodeWebp()) return;
  try {
    const img = await loadImage(dataUrl);
    for (const variant of ["thumb", "medium"] as ImageVariant[]) {
      const target = variantPath(path, variant);
      if (!target) continue;
      const out = await renderVariant(img, variant);
      if (!out) continue;
      const { error } = await supabase.storage.from(BUCKET).upload(target, out, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) console.warn("[media] variant upload failed", variant, error.message);
    }
  } catch (e) {
    console.warn("[media] variant creation skipped", e);
  }
}

/** Signiert Speicherpfade (mit Cache) und liefert eine Pfad→URL-Map. */
export async function signPaths(
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const now = Date.now();
  const unique = Array.from(
    new Set(
      paths.filter((p): p is string => !!p && !p.startsWith("http") && !p.startsWith("data:")),
    ),
  );
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
        signedCache.set(entry.path, {
          url: entry.signedUrl,
          expires: now + (SIGN_TTL - 600) * 1000,
        });
      } else if (entry.path) {
        // Einzelne Pfade koennen fehlschlagen (Datei fehlt oder kein Zugriff).
        // Ohne Hinweis wirkt das spaeter wie "Audio spielt nicht" – daher loggen.
        console.warn("[media] sign skipped", entry.path, entry.error ?? "unknown");
      }
    });
    persistCacheSoon();
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
