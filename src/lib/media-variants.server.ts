/**
 * Serverseitiger Backstop für Bildvarianten.
 *
 * Hintergrund: Thumbnail (`__t.webp`) und Medium (`__m.webp`) werden im Browser
 * des Uploaders erzeugt (Canvas + WebP). Auf manchen Geräten schlägt das fehl
 * (Canvas-Speicherlimit, fehlender WebP-Encoder, Decode-Fehler bei sehr großen
 * Fotos). Fehlen die Varianten, lädt der Feed das Original – bei Handyfotos
 * mehrere MB, was leere/schwarze Flächen und Ruckeln verursacht.
 *
 * Dieser Backstop erzeugt fehlende Varianten serverseitig aus der bereits
 * gespeicherten Datei. Er nutzt dazu die Bildtransformation des Speichers
 * (`render/image`), nicht `sharp`/`canvas` – beides ist im Worker-Runtime nicht
 * verfügbar. Originale werden dabei niemals verändert oder gelöscht.
 */

const BUCKET = "media";

/** Zielmaße identisch zur Client-Erzeugung, damit Darstellung gleich bleibt. */
const SPEC = {
  thumb: { suffix: "__t", width: 300, height: 300, resize: "cover" as const, quality: 72 },
  medium: { suffix: "__m", width: 1080, height: 1080, resize: "contain" as const, quality: 82 },
};

export type VariantKind = keyof typeof SPEC;
export type VariantOutcome = "ok" | "created" | "failed" | "skipped";

/** Sehr große Originale werden nicht transformiert (Schutz vor Timeouts). */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export function serverVariantPath(path: string, kind: VariantKind): string | null {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = path.slice(0, dot);
  if (base.endsWith("__t") || base.endsWith("__m") || base.endsWith("__s")) return null;
  return `${base}${SPEC[kind].suffix}.webp`;
}

type AdminClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        ttl: number,
        opts?: { transform?: Record<string, unknown> },
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;
      upload: (
        path: string,
        body: Blob | ArrayBuffer,
        opts: { contentType: string; cacheControl?: string; upsert: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      list: (
        prefix: string,
        opts: { limit: number; search?: string },
      ) => Promise<{
        data: { name: string; metadata?: { size?: number } | null }[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type ObjectInfo = { exists: boolean; size: number };

/** Liest Existenz und Größe eines Objekts über die Ordnerliste (kein Download). */
async function statObject(admin: AdminClient, path: string): Promise<ObjectInfo> {
  const slash = path.lastIndexOf("/");
  const prefix = slash > 0 ? path.slice(0, slash) : "";
  const name = path.slice(slash + 1);
  const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 100, search: name });
  const hit = (data ?? []).find((entry) => entry.name === name);
  return { exists: !!hit, size: hit?.metadata?.size ?? 0 };
}

export type EnsureResult = {
  thumb: VariantOutcome;
  medium: VariantOutcome;
  reason?: string;
};

/**
 * Stellt sicher, dass `__t.webp` und `__m.webp` neben `path` existieren.
 * Idempotent: vorhandene Varianten werden nicht überschrieben (`upsert: false`).
 */
export async function ensureVariantsForPath(
  admin: AdminClient,
  path: string,
): Promise<EnsureResult> {
  const result: EnsureResult = { thumb: "skipped", medium: "skipped" };

  const targets = {
    thumb: serverVariantPath(path, "thumb"),
    medium: serverVariantPath(path, "medium"),
  };
  if (!targets.thumb || !targets.medium) {
    return { thumb: "skipped", medium: "skipped", reason: "not-a-variant-source" };
  }

  const source = await statObject(admin, path);
  if (!source.exists) {
    return { thumb: "failed", medium: "failed", reason: "source-missing" };
  }
  if (source.size > MAX_SOURCE_BYTES) {
    return { thumb: "failed", medium: "failed", reason: "too-large" };
  }

  for (const kind of ["thumb", "medium"] as VariantKind[]) {
    const target = targets[kind]!;
    const existing = await statObject(admin, target);
    if (existing.exists) {
      result[kind] = "ok";
      continue;
    }
    try {
      const spec = SPEC[kind];
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 120, {
        transform: {
          width: spec.width,
          height: spec.height,
          resize: spec.resize,
          quality: spec.quality,
        },
      });
      if (error || !data?.signedUrl) {
        result[kind] = "failed";
        result.reason = `sign-failed:${error?.message ?? "unknown"}`;
        continue;
      }
      // `Accept: image/webp` lässt die Transformation WebP ausliefern.
      const res = await fetch(data.signedUrl, { headers: { accept: "image/webp,*/*" } });
      if (!res.ok) {
        result[kind] = "failed";
        result.reason = `transform-failed:${res.status}`;
        continue;
      }
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength === 0) {
        result[kind] = "failed";
        result.reason = "transform-empty";
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "image/webp";
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(target, bytes, { contentType, cacheControl: "604800", upsert: false });
      if (upErr) {
        // Parallel erzeugte Variante (Client war schneller) gilt als Erfolg.
        const again = await statObject(admin, target);
        if (again.exists) {
          result[kind] = "ok";
          continue;
        }
        result[kind] = "failed";
        result.reason = `upload-failed:${upErr.message}`;
        continue;
      }
      result[kind] = "created";
    } catch (e) {
      result[kind] = "failed";
      result.reason = `exception:${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return result;
}

/** Fasst ein Ergebnis zu einem Jobstatus zusammen. */
export function outcomeStatus(r: EnsureResult): "done" | "failed" {
  const good = (v: VariantOutcome) => v === "ok" || v === "created";
  return good(r.thumb) && good(r.medium) ? "done" : "failed";
}
