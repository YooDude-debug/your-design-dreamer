/**
 * ORB Visual Memory – Speicherung, Verknüpfung, Abruf und Löschen.
 *
 * Alle Zugriffe laufen über den bereichsgebundenen, angemeldeten Datenzugang
 * (scopedDb): RLS (nur eigene Zeilen) + Scope-Filter in jeder Abfrage +
 * DB-Trigger (Pfad, Besitzer, Scope, Status). Speicher: privater Bereich
 * `media`, eigener Ordner; Abruf nur über kurzlebige signierte URLs.
 * Protokolliert werden ausschliesslich IDs und Statuswerte – nie Bilddaten.
 */

import type { DB } from "@/orb-core/engine.server";
import { sniffImageMime, type OrbImageMime } from "@/lib/orb-attachments";
import {
  VISUAL_SIGNED_URL_TTL,
  imageLabel,
  imagesRetrievableFor,
  sha256Hex,
  storagePathFor,
  type TranscriptImage,
  type VisualSourceType,
} from "@/orb-core/visual/assets";

const BUCKET = "media";

/* eslint-disable @typescript-eslint/no-explicit-any */
const t = (db: DB, table: "orb_visual_assets" | "orb_memory_images") => (db as any).from(table);

function log(event: string, fields: Record<string, unknown>) {
  console.info("[orb.visual_memory]", JSON.stringify({ event, ...fields }));
}

export type StoreResult =
  | { ok: true; assetId: string; duplicate: boolean }
  | { ok: false; reason: "invalid_image" | "storage_failed" | "db_failed" };

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Ein geprüftes Bild dauerhaft speichern. Reihenfolge: Zeile `pending` →
 * Upload → `stored`. Scheitert der Upload, wird die Zeile wieder entfernt
 * (kein unvollständiger Eintrag, kein verwaistes Objekt). Scheitert der
 * Statuswechsel, wird das Objekt entfernt. Duplikate (gleicher Hash bei
 * gleichem Besitzer UND Bereich) werden wiederverwendet.
 */
export async function storeImageAsset(
  db: DB,
  input: {
    userId: string;
    scope: string;
    mimeType: OrbImageMime;
    dataBase64: string;
    sourceType: VisualSourceType;
    sourceMessageId: string | null;
  },
): Promise<StoreResult> {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(input.dataBase64);
  } catch {
    return { ok: false, reason: "invalid_image" };
  }
  const sniffed = sniffImageMime(bytes.slice(0, 16));
  if (!sniffed || sniffed !== input.mimeType || bytes.length === 0) {
    return { ok: false, reason: "invalid_image" };
  }
  const sha256 = await sha256Hex(bytes);
  const path = storagePathFor({
    userId: input.userId,
    scope: input.scope,
    sha256,
    mimeType: sniffed,
  });

  const existing = await t(db, "orb_visual_assets")
    .select("id, origin_status")
    .eq("user_id", input.userId)
    .eq("sha256", sha256)
    .maybeSingle();
  if (existing.error) return { ok: false, reason: "db_failed" };
  if (existing.data?.origin_status === "stored") {
    log("duplicate", { assetId: existing.data.id, scope: input.scope });
    return { ok: true, assetId: existing.data.id, duplicate: true };
  }

  let assetId: string | null = existing.data?.id ?? null;
  if (!assetId) {
    const ins = await t(db, "orb_visual_assets")
      .insert({
        user_id: input.userId,
        storage_path: path,
        mime_type: sniffed,
        file_size: bytes.length,
        sha256,
        source_type: input.sourceType,
        source_message_id: input.sourceMessageId,
        origin_status: "pending",
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      log("insert_failed", { scope: input.scope, code: ins.error?.code ?? null });
      return { ok: false, reason: "db_failed" };
    }
    assetId = ins.data.id as string;
  }

  const up = await (db as any).storage.from(BUCKET).upload(path, bytes, {
    contentType: sniffed,
    upsert: true,
    cacheControl: "3600",
  });
  if (up.error) {
    const del = await t(db, "orb_visual_assets")
      .delete()
      .eq("id", assetId)
      .eq("user_id", input.userId);
    if (del.error) {
      await t(db, "orb_visual_assets").update({ origin_status: "failed" }).eq("id", assetId);
    }
    log("upload_failed", { assetId, scope: input.scope });
    return { ok: false, reason: "storage_failed" };
  }

  const done = await t(db, "orb_visual_assets")
    .update({ origin_status: "stored" })
    .eq("id", assetId)
    .eq("user_id", input.userId);
  if (done.error) {
    await (db as any).storage.from(BUCKET).remove([path]);
    await t(db, "orb_visual_assets").delete().eq("id", assetId).eq("user_id", input.userId);
    log("finalize_failed", { assetId, scope: input.scope });
    return { ok: false, reason: "db_failed" };
  }
  log("stored", { assetId, scope: input.scope, source: input.sourceType });
  return { ok: true, assetId, duplicate: false };
}

/** Gespeicherte Upload-Bilder zu Nachrichten des Analyse-Transkripts. */
export async function loadTranscriptImages(
  db: DB,
  userId: string,
  messages: { id: string; role: string; body: string }[],
): Promise<TranscriptImage[]> {
  const userMsgs = messages.filter((m) => m.role === "user" && m.id);
  if (userMsgs.length === 0) return [];
  const res = await t(db, "orb_visual_assets")
    .select("id, source_message_id, created_at")
    .eq("user_id", userId)
    .eq("origin_status", "stored")
    .eq("source_type", "user_upload")
    .in(
      "source_message_id",
      userMsgs.map((m) => m.id),
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(30);
  if (res.error) return [];
  const bodyOf = new Map(userMsgs.map((m) => [m.id, m.body]));
  return ((res.data ?? []) as { id: string; source_message_id: string }[]).map((a, i) => ({
    label: imageLabel(i),
    assetId: a.id,
    messageId: a.source_message_id,
    messageBody: bodyOf.get(a.source_message_id) ?? "",
  }));
}

export type LinkResult =
  | { ok: true; created: boolean }
  | { ok: false; reason: "rejected" | "db_failed" };

/** Ausdrückliche Verknüpfung Erinnerung ↔ Bild (Trigger prüft Besitzer, Scope, Status). */
export async function linkMemoryImage(
  db: DB,
  input: {
    userId: string;
    memoryId: string;
    assetId: string;
    basis: "analysis_image_ref" | "manual";
    analysisRunId?: string | null;
  },
): Promise<LinkResult> {
  const res = await t(db, "orb_memory_images").insert({
    memory_id: input.memoryId,
    image_id: input.assetId,
    user_id: input.userId,
    basis: input.basis,
    analysis_run_id: input.analysisRunId ?? null,
  });
  if (!res.error) {
    log("linked", { memoryId: input.memoryId, assetId: input.assetId, basis: input.basis });
    return { ok: true, created: true };
  }
  if (res.error.code === "23505") return { ok: true, created: false };
  if (res.error.code === "23514" || res.error.code === "23503" || res.error.code === "42501") {
    return { ok: false, reason: "rejected" };
  }
  return { ok: false, reason: "db_failed" };
}

/** Verknüpfung aufheben – Bild und Erinnerung bleiben unverändert. */
export async function unlinkMemoryImage(
  db: DB,
  input: { userId: string; memoryId: string; assetId: string },
): Promise<{ ok: boolean }> {
  const res = await t(db, "orb_memory_images")
    .delete()
    .eq("user_id", input.userId)
    .eq("memory_id", input.memoryId)
    .eq("image_id", input.assetId);
  return { ok: !res.error };
}

export type VisualAssetView = {
  id: string;
  sourceType: VisualSourceType;
  status: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  url: string | null;
};

type AssetRow = {
  id: string;
  storage_path: string;
  source_type: VisualSourceType;
  origin_status: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

const ASSET_COLS = "id, storage_path, source_type, origin_status, mime_type, file_size, created_at";

async function sign(db: DB, rows: AssetRow[]): Promise<VisualAssetView[]> {
  const stored = rows.filter((r) => r.origin_status === "stored");
  const urls = new Map<string, string>();
  if (stored.length > 0) {
    const s = await (db as any).storage.from(BUCKET).createSignedUrls(
      stored.map((r) => r.storage_path),
      VISUAL_SIGNED_URL_TTL,
    );
    for (const item of (s.data ?? []) as { path: string | null; signedUrl: string | null }[]) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
  }
  return rows.map((r) => ({
    id: r.id,
    sourceType: r.source_type,
    status: r.origin_status,
    mimeType: r.mime_type,
    fileSize: r.file_size,
    createdAt: r.created_at,
    url: urls.get(r.storage_path) ?? null,
  }));
}

async function assetsByIds(db: DB, userId: string, ids: string[]): Promise<AssetRow[]> {
  if (ids.length === 0) return [];
  const res = await t(db, "orb_visual_assets")
    .select(ASSET_COLS)
    .eq("user_id", userId)
    .in("id", ids)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  return res.error ? [] : ((res.data ?? []) as AssetRow[]);
}

/** Alle tatsächlich verknüpften Bilder einer Erinnerung (Detailansicht). */
export async function listMemoryImages(
  db: DB,
  userId: string,
  memoryId: string,
): Promise<VisualAssetView[]> {
  const links = await t(db, "orb_memory_images")
    .select("image_id")
    .eq("user_id", userId)
    .eq("memory_id", memoryId)
    .order("image_id", { ascending: true })
    .limit(50);
  if (links.error) return [];
  const ids = ((links.data ?? []) as { image_id: string }[]).map((l) => l.image_id);
  return sign(db, await assetsByIds(db, userId, ids));
}

/**
 * Bilder zu abgerufenen Erinnerungen. Nur echte Verknüpfungen, nur abrufbare
 * Lebenszyklus-Stufen, nur gespeicherte Assets. Kein Bild = leeres Ergebnis.
 */
export async function imagesForRecalledMemories(
  db: DB,
  userId: string,
  memoryIds: string[],
): Promise<{ memoryId: string; images: VisualAssetView[] }[]> {
  const ids = [...new Set(memoryIds)].slice(0, 12);
  if (ids.length === 0) return [];
  const nodes = await (db as any)
    .from("orb_nodes")
    .select("id, lifecycle")
    .eq("user_id", userId)
    .in("id", ids);
  if (nodes.error) return [];
  const allowed = new Set(
    ((nodes.data ?? []) as { id: string; lifecycle: string }[])
      .filter((n) => imagesRetrievableFor(n.lifecycle))
      .map((n) => n.id),
  );
  if (allowed.size === 0) return [];
  const links = await t(db, "orb_memory_images")
    .select("memory_id, image_id")
    .eq("user_id", userId)
    .in("memory_id", [...allowed])
    .order("memory_id", { ascending: true })
    .order("image_id", { ascending: true })
    .limit(36);
  if (links.error) return [];
  const pairs = (links.data ?? []) as { memory_id: string; image_id: string }[];
  if (pairs.length === 0) return [];
  const views = await sign(
    db,
    (await assetsByIds(db, userId, [...new Set(pairs.map((p) => p.image_id))])).filter(
      (a) => a.origin_status === "stored",
    ),
  );
  const byId = new Map(views.map((v) => [v.id, v]));
  const out = new Map<string, VisualAssetView[]>();
  for (const p of pairs) {
    const v = byId.get(p.image_id);
    if (!v || !v.url) continue;
    out.set(p.memory_id, [...(out.get(p.memory_id) ?? []), v]);
  }
  return ids.filter((id) => out.has(id)).map((id) => ({ memoryId: id, images: out.get(id)! }));
}

/** Bilder ohne jede Verknüpfung (inkl. hängender `pending`/`failed`) – auffindbar und löschbar. */
export async function listUnassignedImages(db: DB, userId: string): Promise<VisualAssetView[]> {
  const assets = await t(db, "orb_visual_assets")
    .select(ASSET_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(200);
  if (assets.error) return [];
  const rows = (assets.data ?? []) as AssetRow[];
  if (rows.length === 0) return [];
  const links = await t(db, "orb_memory_images")
    .select("image_id")
    .eq("user_id", userId)
    .in(
      "image_id",
      rows.map((r) => r.id),
    );
  if (links.error) return [];
  const linked = new Set(((links.data ?? []) as { image_id: string }[]).map((l) => l.image_id));
  return sign(
    db,
    rows.filter((r) => !linked.has(r.id)),
  );
}

/**
 * Bild löschen: zuerst das Speicherobjekt, dann die Zeile (Verknüpfungen
 * kaskadieren). Scheitert das Entfernen im Speicher, bleibt die Zeile, damit
 * nie ein unauffindbares Objekt zurückbleibt.
 */
export async function deleteVisualAsset(
  db: DB,
  userId: string,
  assetId: string,
): Promise<{ ok: boolean; reason?: "not_found" | "storage_failed" | "db_failed" }> {
  const row = await t(db, "orb_visual_assets")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  if (row.error) return { ok: false, reason: "db_failed" };
  if (!row.data) return { ok: false, reason: "not_found" };
  const rm = await (db as any).storage.from(BUCKET).remove([row.data.storage_path]);
  if (rm.error) return { ok: false, reason: "storage_failed" };
  const del = await t(db, "orb_visual_assets").delete().eq("id", assetId).eq("user_id", userId);
  if (del.error) return { ok: false, reason: "db_failed" };
  log("deleted", { assetId });
  return { ok: true };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
