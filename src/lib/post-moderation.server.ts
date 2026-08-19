/**
 * Moderationskette für Beiträge (Server-only).
 *
 * Trennung der Kanäle:
 * - Text (Titel, Beschreibung, Hashtags, Region)
 * - Bild (zwei unabhängige Bildmodelle)
 * - verwendete SlangTags (müssen freigegeben sein)
 *
 * Ergebnisse werden zusammengeführt: der strengste Teilbefund gewinnt.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  mergeAnalyses,
  moderateImageBytes,
  moderateText,
  type ModerationAnalysis,
} from "@/lib/content-moderation.server";
import { MODERATION_MESSAGES } from "@/lib/moderation-policy";

/** Bildvarianten-Suffixe (wie im Medien-Modul des Clients). */
const VARIANTS = ["__t", "__m"] as const;

/** Kleinere Vorschau bevorzugen (identischer Bildinhalt, weniger Datenmenge). */
function mediumVariant(path: string): string | null {
  const dot = path.lastIndexOf(".");
  if (dot <= 0) return null;
  const base = path.slice(0, dot);
  if (base.endsWith("__t") || base.endsWith("__m")) return null;
  return `${base}__m.webp`;
}

/** Entfernt ein Bild samt Varianten unwiderruflich aus dem Speicher. */
export async function purgeImage(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const dot = path.lastIndexOf(".");
  const targets = [path];
  if (dot > 0) {
    const base = path.slice(0, dot);
    for (const suffix of VARIANTS) targets.push(`${base}${suffix}.webp`);
  }
  const { error } = await supabaseAdmin.storage.from("media").remove(targets);
  if (error) console.warn("[moderation] image purge failed", error.message);
}

async function downloadImage(path: string): Promise<{ bytes: Uint8Array; path: string } | null> {
  const candidates = [mediumVariant(path), path].filter((p): p is string => Boolean(p));
  for (const candidate of candidates) {
    const dl = await supabaseAdmin.storage.from("media").download(candidate);
    if (!dl.error && dl.data) {
      return { bytes: new Uint8Array(await dl.data.arrayBuffer()), path: candidate };
    }
  }
  return null;
}

export type SlangTagUsability = {
  ok: boolean;
  /** Namen gesperrter/gelöschter SlangTags (mit Präfix, z. B. "$xyz"). */
  blocked: string[];
  /** IDs, zu denen kein SlangTag existiert. */
  missing: string[];
  /** Noch in Prüfung befindliche SlangTags. */
  pending: string[];
  /** Konkrete Meldung für die Oberfläche (leer wenn ok). */
  message: string;
};

/** Präfix nach Typ: Community `$`, Creator/Unternehmen `$$`. */
function tagLabel(row: { name: string | null; kind: string | null }): string {
  return `${row.kind === "creator" ? "$$" : "$"}${row.name ?? ""}`;
}

/**
 * Prüft ausschließlich die Verwendbarkeit der SlangTags (getrennt von der
 * Inhaltsmoderation) und nennt den konkreten SlangTag im Klartext.
 */
export async function checkSlangTagUsability(ids: string[]): Promise<SlangTagUsability> {
  if (ids.length === 0) return { ok: true, blocked: [], missing: [], pending: [], message: "" };

  const { data } = await supabaseAdmin
    .from("slang_tags")
    .select("id,name,kind,moderation_status,deleted_at")
    .in("id", ids);
  const rows = (data ?? []) as {
    id: string;
    name: string | null;
    kind: string | null;
    moderation_status: string;
    deleted_at: string | null;
  }[];

  const blocked = rows
    .filter((r) => r.moderation_status === "blocked" || r.deleted_at !== null)
    .map(tagLabel);
  const missing = ids.filter((id) => !rows.some((r) => r.id === id));
  const pending = rows
    .filter((r) => r.moderation_status !== "approved" && r.deleted_at === null)
    .map(tagLabel);

  const names = [...blocked, ...missing];
  const message =
    names.length === 0
      ? ""
      : names.length === 1
        ? `SlangTag ${names[0]} ist gesperrt oder nicht vorhanden.`
        : `Diese SlangTags sind gesperrt oder nicht vorhanden: ${names.join(", ")}.`;

  return { ok: names.length === 0, blocked, missing, pending, message };
}

export type PostModerationInput = {
  userId: string;
  title: string;
  description: string;
  hashtags: string[];
  region: string;
  imagePath: string | null;
  slangTagIds: string[];
  /** Bildprüfung überspringen (unverändertes, bereits geprüftes Bild). */
  skipImage?: boolean;
  /** Beitrag ist ein SlangShot (Video) – tolerantere Video-Regeln anwenden. */
  isVideo?: boolean;
};

/** Führt die vollständige Prüfung eines Beitrags aus. */
export async function runPostModeration(input: PostModerationInput): Promise<ModerationAnalysis> {
  const parts: Record<string, ModerationAnalysis> = {};

  // 1) Text
  parts.text = await moderateText({
    Titel: input.title,
    Beschreibung: input.description,
    Hashtags: input.hashtags.join(" "),
    Region: input.region,
  });

  // 2) Bild – Pflichtprüfung. Kann das Bild nicht geladen werden, wird der
  //    Beitrag nicht veröffentlicht (kein "im Zweifel durchlassen").
  if (input.imagePath && !input.skipImage) {
    const file = await downloadImage(input.imagePath);
    if (!file) {
      parts.image = {
        decision: "review",
        labels: ["analysis_failed"],
        flags: [],
        confidence: 0,
        reason: "Bild konnte für die Prüfung nicht geladen werden.",
        crisis: false,
        message: MODERATION_MESSAGES.review,
        raw: {},
      };
    } else {
      parts.image = await moderateImageBytes(
        file.bytes,
        file.path,
        [input.title, input.description, input.hashtags.join(" ")].filter(Boolean).join(" — "),
        input.isVideo ? "video" : "image",
      );
    }
  }

  // 3) Verwendete SlangTags müssen freigegeben sein (eigener, getrennter Befund).
  if (input.slangTagIds.length > 0) {
    const tags = await checkSlangTagUsability(input.slangTagIds);

    if (!tags.ok) {
      parts.slangtags = {
        decision: "block",
        labels: ["slangtag_not_allowed"],
        flags: [],
        confidence: 1,
        reason: tags.message,
        crisis: false,
        message: tags.message,
        raw: { blocked: tags.blocked, missing: tags.missing },
      };
    } else if (tags.pending.length > 0) {
      parts.slangtags = {
        decision: "review",
        labels: ["slangtag_pending"],
        flags: [],
        confidence: 0.5,
        reason: `Verwendete SlangTags sind noch in Prüfung: ${tags.pending.join(", ")}.`,
        crisis: false,
        message: MODERATION_MESSAGES.review,
        raw: { pending: tags.pending },
      };
    }
  }

  return mergeAnalyses(parts);
}

/** Schreibt das Ergebnis in das Moderationsprotokoll (Admin-Einsicht). */
export async function logModeration(opts: {
  userId: string;
  contentType: string;
  contentId: string | null;
  verdict: ModerationAnalysis;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("content_moderation_log").insert({
    user_id: opts.userId,
    content_type: opts.contentType,
    content_id: opts.contentId,
    decision: opts.verdict.decision,
    labels: opts.verdict.labels,
    flags: opts.verdict.flags,
    confidence: opts.verdict.confidence,
    reason: opts.verdict.reason,
    crisis: opts.verdict.crisis,
    ai: opts.verdict.raw as never,
  } as never);
  if (error) console.error("[moderation] log failed", error.message);
}
