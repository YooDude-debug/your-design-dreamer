import { supabase } from "@/integrations/supabase/client";
import { renderRedactedImage } from "@/lib/image-redaction";
import type { SlangTagPlacement } from "@/lib/types";

const BUCKET = "media";
const SIGN_TTL = 60 * 60 * 24 * 7; // 7 Tage

/**
 * Cache-Vorgabe für hochgeladene Medien.
 *
 * Medienpfade sind unveränderlich (UUID je Datei), Varianten und Teilen-
 * Vorschauen werden bei einer echten Änderung neu signiert (neue URL). Ohne
 * diesen Wert liefert der Speicher `no-cache`, wodurch derselbe Beitrag bei
 * jedem Bereichswechsel erneut vollständig geladen wird.
 */
const UPLOAD_CACHE_CONTROL = String(SIGN_TTL); // Sekunden

/**
 * Kurzlebiger Cache für signierte URLs (nur Caching, kein Primärspeicher).
 * Wird zusätzlich in `sessionStorage` gespiegelt, damit ein Seitenwechsel oder
 * Neuladen dieselben Bild-/Audio-URLs weiterverwendet (Browser-Cache greift)
 * und keine erneuten Signier-Aufrufe nötig sind.
 */
const signedCache = new Map<string, { url: string; expires: number }>();

/**
 * Negativ-Cache: Pfade, die der Speicher als "nicht vorhanden / kein Zugriff"
 * gemeldet hat (z. B. Bildvarianten oder Teilen-Vorschauen älterer Beiträge,
 * die nie erzeugt wurden). Ohne diesen Cache fragt jede Hintergrund-
 * Aktualisierung dieselben fehlenden Pfade erneut an – unnötige Netzlast und
 * Log-Rauschen. Die Sperre ist absichtlich kurz, damit neu erzeugte Dateien
 * (z. B. eine frisch erstellte Teilen-Vorschau) zeitnah wieder gefunden werden.
 */
const missingCache = new Map<string, number>();
const MISSING_TTL_MS = 10 * 60 * 1000;

const PERSIST_KEY = "yd.signed.v1";
const MISSING_KEY = "yd.signed.missing.v1";
let persistTimer: number | undefined;

function loadPersistedCache() {
  if (typeof sessionStorage === "undefined") return;
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { url: string; expires: number }>;
      Object.entries(parsed).forEach(([path, entry]) => {
        if (entry?.url && entry.expires > now) signedCache.set(path, entry);
      });
    }
  } catch {
    /* defekter Cache wird einfach ignoriert */
  }
  try {
    const raw = sessionStorage.getItem(MISSING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, number>;
      Object.entries(parsed).forEach(([path, at]) => {
        if (typeof at === "number" && now - at < MISSING_TTL_MS) missingCache.set(path, at);
      });
    }
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
      sessionStorage.setItem(MISSING_KEY, JSON.stringify(Object.fromEntries(missingCache)));
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

/**
 * Lädt ein SlangTag-Video (Short) in den Medienspeicher.
 * Es wird ausschliesslich die bereits stumm aufbereitete Bildspur gespeichert –
 * der Ton eines Shorts ist immer der SlangTag (separates Audio).
 */
export async function uploadShortVideo(userId: string, blob: Blob | null): Promise<string | null> {
  if (!blob) return null;
  const path = `${userId}/videos/${crypto.randomUUID()}.${extFor(blob.type || "video/webm")}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "video/webm",
    cacheControl: UPLOAD_CACHE_CONTROL,
    upsert: false,
  });
  if (error) {
    console.error("[media] video upload failed", error.message);
    return null;
  }
  return path;
}

/** Lädt einen Data-URL in den Medienspeicher und liefert den Pfad zurück. */
export async function uploadDataUrl(
  userId: string,
  dataUrl: string | null,
  folder: "images" | "audio" | "avatars" | "covers" | "originals" | "videos",
): Promise<string | null> {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith("data:")) return dataUrl; // bereits ein Pfad
  const blob = dataUrlToBlob(dataUrl);
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extFor(blob.type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: UPLOAD_CACHE_CONTROL,
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
    const s = sharePreviewPath(p);
    if (s) targets.add(s);
  }
  if (targets.size === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove([...targets]);
  if (error) console.warn("[media] rollback cleanup failed", error.message);
}

/**
 * Bildpipeline für Beiträge – einzige Stelle, an der ein Beitragsbild entsteht.
 *
 * 1. Original: unverändert, ausschließlich im privaten Ordner `originals/`.
 *    Es wird nie öffentlich ausgeliefert (kein Beitrag verweist darauf) und ist
 *    nur für Eigentümer und Administratoren lesbar.
 * 2. Veröffentlichte Version: enthält die Bereiche unter allen SlangTags
 *    dauerhaft verpixelt. Nur aus dieser Version entstehen Thumbnail und Medium.
 */
export async function uploadPostImage(
  userId: string,
  dataUrl: string | null,
  placements: Pick<SlangTagPlacement, "x" | "y" | "scale" | "rotation" | "variant">[],
): Promise<{ imagePath: string | null; originalPath: string | null }> {
  if (!dataUrl) return { imagePath: null, originalPath: null };
  // Bereits gespeicherter Pfad: die veröffentlichte Version existiert schon.
  if (!dataUrl.startsWith("data:")) return { imagePath: dataUrl, originalPath: null };

  const redacted = await renderRedactedImage(dataUrl, placements);
  // Ohne SlangTag-Platzierung gibt es keinen verdeckten Bereich – dann ist die
  // veröffentlichte Version identisch mit dem Original (kein Zweitupload).
  if (!redacted) {
    const imagePath = await uploadDataUrl(userId, dataUrl, "images");
    return { imagePath, originalPath: null };
  }

  const originalPath = await uploadDataUrl(userId, dataUrl, "originals");
  const imagePath = await uploadDataUrl(userId, redacted, "images");
  if (!imagePath) {
    await removeUploads([originalPath]);
    return { imagePath: null, originalPath: null };
  }
  return { imagePath, originalPath };
}

/**
 * Erzeugt Thumbnail + Medium neben dem Original.
 *
 * Fehler werden nicht mehr verschluckt: jede Ursache erhält einen Code und der
 * serverseitige Backstop wird angestoßen, damit der Datensatz nicht dauerhaft
 * ohne Varianten bleibt (Feed müsste sonst MB-große Originale laden).
 */
async function createVariants(path: string, dataUrl: string) {
  let reason: string | null = null;
  if (!canEncodeWebp()) {
    reason = "webp-unsupported";
  } else {
    try {
      const img = await loadImage(dataUrl);
      for (const variant of ["thumb", "medium"] as ImageVariant[]) {
        const target = variantPath(path, variant);
        if (!target) continue;
        const out = await renderVariant(img, variant);
        if (!out) {
          reason = reason ?? "toblob-null";
          continue;
        }
        const { error } = await supabase.storage.from(BUCKET).upload(target, out, {
          contentType: "image/webp",
          cacheControl: UPLOAD_CACHE_CONTROL,
          upsert: true,
        });
        if (error) {
          reason = `upload-failed:${error.message}`;
          console.warn("[media] variant upload failed", variant, error.message);
        } else {
          missingCache.delete(target);
        }
      }
    } catch (e) {
      reason = `decode-failed:${e instanceof Error ? e.message : String(e)}`;
      console.warn("[media] variant creation failed", reason);
    }
  }
  // Immer nachprüfen lassen – auch bei scheinbarem Erfolg (z. B. abgebrochener
  // Upload im Hintergrund). Der Backstop ist idempotent und blockiert nichts.
  void requestVariantBackstop(path, reason);
}

/** Pfade, für die der Backstop in dieser Sitzung schon angefragt wurde. */
const backstopAsked = new Set<string>();

/** Stößt den serverseitigen Backstop an (höchstens einmal je Pfad und Sitzung). */
export function requestVariantBackstop(path: string | null | undefined, reason?: string | null) {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return;
  if (backstopAsked.has(path)) return;
  backstopAsked.add(path);
  void import("@/lib/media-variants.functions")
    .then(({ ensureImageVariants }) =>
      ensureImageVariants({ data: { path, clientError: reason ?? null } }),
    )
    .then((res) => {
      if (!res) return;
      const thumb = variantPath(path, "thumb");
      const medium = variantPath(path, "medium");
      if (thumb) missingCache.delete(thumb);
      if (medium) missingCache.delete(medium);
      if (res.status === "failed") {
        console.warn("[media] variant backstop failed", path, res.thumb, res.medium);
      }
    })
    .catch((e) => console.warn("[media] variant backstop unavailable", e));
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
    if (hit && hit.expires > now) {
      result[p] = hit.url;
      return;
    }
    const failedAt = missingCache.get(p);
    if (failedAt && now - failedAt < MISSING_TTL_MS) return; // bekannt fehlend
    if (failedAt) missingCache.delete(p);
    missing.push(p);
  });

  if (missing.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(missing, SIGN_TTL);
    if (error) console.error("[media] sign failed", error.message);
    (data ?? []).forEach((entry) => {
      if (entry.signedUrl && entry.path) {
        result[entry.path] = entry.signedUrl;
        missingCache.delete(entry.path);
        signedCache.set(entry.path, {
          url: entry.signedUrl,
          expires: now + (SIGN_TTL - 600) * 1000,
        });
      } else if (entry.path) {
        // Einzelne Pfade koennen fehlschlagen (Datei fehlt oder kein Zugriff).
        // Ohne Hinweis wirkt das spaeter wie "Audio spielt nicht" – daher genau
        // einmal je Pfad loggen und den Pfad kurz nicht erneut anfragen.
        if (!missingCache.has(entry.path)) {
          console.warn("[media] sign skipped", entry.path, entry.error ?? "unknown");
        }
        missingCache.set(entry.path, now);
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

/**
 * Einzige Quelle für Vorschaubilder in Feed, Profil und Beitragsliste.
 *
 * SlangTag-Positionen sind Prozentwerte des Originalbildes. Das 300×300-Thumbnail
 * ist ein zentrierter Beschnitt und würde die Tags verschieben – deshalb erhalten
 * Beiträge mit SlangTags immer die seitenverhältnistreue Variante.
 *
 * Reihenfolge: kleine Variante zuerst, Original nur als letzter Ausweg. Wird das
 * Original gebraucht, fehlen die Varianten – dann wird der Backstop angestoßen,
 * damit der nächste Aufruf eine kleine Datei bekommt.
 */
type PreviewSource = {
  image: string | null;
  imageThumb?: string | null;
  imageMedium?: string | null;
  imagePath?: string | null;
  placements?: unknown[];
};

function fallbackToOriginal(post: PreviewSource): string | null {
  if (post.image && post.imagePath) requestVariantBackstop(post.imagePath, "missing-variants");
  return post.image;
}

export function postPreviewImage(post: PreviewSource): string | null {
  if (post.placements?.length)
    return post.imageMedium ?? post.imageThumb ?? fallbackToOriginal(post);
  return post.imageThumb ?? post.imageMedium ?? fallbackToOriginal(post);
}

/**
 * Bildquelle für große Beitragskarten (Feed, Beitragsliste, Profilkarten).
 *
 * Diese Flächen sind mehrere hundert Pixel breit und seitenverhältnistreu. Das
 * 300×300-Thumbnail ist ein zentrierter Beschnitt und dafür zu klein bzw. falsch
 * ausgeschnitten – deshalb gilt strikt: Medium zuerst, Thumbnail nur als Notnagel,
 * Original ausschließlich, wenn keine Variante existiert (löst den Backstop aus).
 */
export function postCardImage(post: PreviewSource): string | null {
  return post.imageMedium ?? post.imageThumb ?? fallbackToOriginal(post);
}

/**
 * Einzige Quelle für Detail-, Vollbild- und Teilen-Ansichten.
 * Immer seitenverhältnistreu – nie ein quadratisches Thumbnail.
 */
export function postFullImage(post: {
  image: string | null;
  imageMedium?: string | null;
  imagePath?: string | null;
}): string | null {
  return post.imageMedium ?? fallbackToOriginal(post);
}

/* ------------------------------- Teilen-Vorschau ------------------------------- */

/**
 * Bild für Teilen-Vorschauen (Share Sheet, og:image, Betriebssystem-Thumbnail).
 *
 * Diese Datei enthält – wie die normale Beitragsdarstellung – die Bereiche unter
 * allen SlangTags dauerhaft verpixelt. Sie entsteht ausschließlich über
 * `renderRedactedImage()`, also über dieselbe Verpixelungslogik wie der Beitrag.
 * Das Original und die veröffentlichte Beitragsdatei bleiben unverändert.
 */
const SHARE_SUFFIX = "__s";

/** Pfad der Teilen-Vorschau (Konvention, kein zusätzliches Datenbankfeld). */
export function sharePreviewPath(path: string | null | undefined): string | null {
  if (!path || path.startsWith("http") || path.startsWith("data:")) return null;
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = path.slice(0, dot);
  if (base.endsWith(SHARE_SUFFIX)) return null;
  return `${base}${SHARE_SUFFIX}.webp`;
}

/** Signierte URL der verpixelten Teilen-Vorschau, mit Rückfall auf das Beitragsbild. */
export function postShareImage(post: {
  image: string | null;
  imageMedium?: string | null;
  imageShare?: string | null;
  placements?: unknown[];
}): string | null {
  if (post.placements?.length && post.imageShare) return post.imageShare;
  return postFullImage(post);
}

/** Lädt eine gespeicherte Datei als Data-URL (Grundlage für die Verpixelung). */
async function pathToDataUrl(path: string): Promise<string | null> {
  const url = await signPath(path);
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Erzeugt bzw. aktualisiert die verpixelte Teilen-Vorschau eines Beitrags.
 * Fehlertolerant: schlägt sie fehl, wird keine Vorschau bereitgestellt (dann
 * liefert der Server lieber kein `og:image` als ein unverpixeltes Bild).
 */
export async function ensureSharePreview(
  imagePath: string | null | undefined,
  placements: Pick<SlangTagPlacement, "x" | "y" | "scale" | "rotation" | "variant">[],
  sourceDataUrl?: string | null,
): Promise<string | null> {
  const target = sharePreviewPath(imagePath);
  if (!target || placements.length === 0 || !canEncodeWebp()) return null;
  try {
    const source =
      sourceDataUrl && sourceDataUrl.startsWith("data:")
        ? sourceDataUrl
        : await pathToDataUrl(imagePath as string);
    if (!source) return null;
    const redacted = await renderRedactedImage(source, placements);
    if (!redacted) return null;
    const img = await loadImage(redacted);
    const out = await renderVariant(img, "medium");
    if (!out) return null;
    const { error } = await supabase.storage.from(BUCKET).upload(target, out, {
      contentType: "image/webp",
      cacheControl: UPLOAD_CACHE_CONTROL,
      upsert: true,
    });
    if (error) {
      console.warn("[media] share preview upload failed", error.message);
      return null;
    }
    signedCache.delete(target);
    missingCache.delete(target);

    return target;
  } catch (e) {
    console.warn("[media] share preview skipped", e);
    return null;
  }
}
