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
      );
    }
  }

  // 3) Verwendete SlangTags müssen freigegeben sein.
  if (input.slangTagIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("slang_tags")
      .select("id,moderation_status,deleted_at")
      .in("id", input.slangTagIds);
    const rows = (data ?? []) as {
      id: string;
      moderation_status: string;
      deleted_at: string | null;
    }[];
    const blocked = rows.filter((r) => r.moderation_status === "blocked" || r.deleted_at !== null);
    const missing = input.slangTagIds.filter((id) => !rows.some((r) => r.id === id));
    const pending = rows.filter((r) => r.moderation_status !== "approved" && r.deleted_at === null);

    if (blocked.length > 0 || missing.length > 0) {
      parts.slangtags = {
        decision: "block",
        labels: ["slangtag_not_allowed"],
        flags: [],
        confidence: 1,
        reason: "Beitrag verweist auf gesperrte oder unbekannte SlangTags.",
        crisis: false,
        message: MODERATION_MESSAGES.blocked,
        raw: { blocked: blocked.map((b) => b.id), missing },
      };
    } else if (pending.length > 0) {
      parts.slangtags = {
        decision: "review",
        labels: ["slangtag_pending"],
        flags: [],
        confidence: 0.5,
        reason: "Verwendete SlangTags sind noch in Prüfung.",
        crisis: false,
        message: MODERATION_MESSAGES.review,
        raw: { pending: pending.map((p) => p.id) },
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
