/**
 * Serverseitige Uebersetzung eines Kommentars.
 *
 * Grundsaetze (identisch zu Beitraegen und Chat-Nachrichten):
 *  - Das Original in `comments.body` wird NIEMALS veraendert.
 *  - Uebersetzungen liegen im Cache `comment_translations`
 *    (Schluessel: Kommentar + Zielsprache) – je Sprache genau ein KI-Aufruf.
 *  - SlangTags ($name, $$name), Hashtags (#tag) und @Mentions bleiben stehen
 *    (Prompt-Vorgabe der gemeinsamen Uebersetzungsschicht).
 *  - Gelesen wird mit den RLS-Regeln des Nutzers; geschrieben ausschliesslich
 *    serverseitig.
 */
import type { TranslationLang } from "@/lib/lang-detect";
import { detectAndTranslate, isQuotaError, normalizeLang } from "@/lib/translate.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase-Client bewusst locker typisiert
type AnyClient = { from: (table: string) => any };

export type CommentTranslationResult = {
  status: "ready" | "same_language" | "unavailable" | "empty" | "quota";
  sourceLanguage: string | null;
  body: string;
};

function result(
  status: CommentTranslationResult["status"],
  sourceLanguage: string | null,
  body = "",
): CommentTranslationResult {
  return { status, sourceLanguage, body };
}

export async function translateCommentForViewer(
  client: unknown,
  commentId: string,
  targetLang: TranslationLang,
): Promise<CommentTranslationResult> {
  const supabase = client as AnyClient;

  const { data } = await supabase
    .from("comments")
    .select("id, body")
    .eq("id", commentId)
    .maybeSingle();
  const comment = data as { id: string; body: string | null } | null;
  if (!comment) return result("unavailable", null);

  const body = (comment.body ?? "").trim();
  if (!body) return result("empty", null);

  // 1) Cache – kostet keinen KI-Aufruf.
  const { data: cachedRow } = await supabase
    .from("comment_translations")
    .select("source_language, translated_body, status")
    .eq("comment_id", commentId)
    .eq("target_language", targetLang)
    .maybeSingle();
  const cached = cachedRow as {
    source_language: string | null;
    translated_body: string;
    status: string;
  } | null;
  if (cached && cached.status === "ready") {
    const text = cached.translated_body ?? "";
    return result(
      text ? "ready" : "same_language",
      normalizeLang(cached.source_language),
      text,
    );
  }

  // 2) Erkennen + uebersetzen.
  let translated: { source_language: string; translated_text: string } | null = null;
  try {
    translated = await detectAndTranslate(body, targetLang);
  } catch (err) {
    console.error("[translate-comment] gateway failed", (err as Error).message);
    return result(isQuotaError(err) ? "quota" : "unavailable", null);
  }
  if (!translated) return result("unavailable", null);

  const source = normalizeLang(translated.source_language) ?? "unknown";
  const sameLanguage = source === targetLang;
  const out = sameLanguage ? "" : translated.translated_text.trim();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as AnyClient;
  await admin.from("comment_translations").upsert(
    {
      comment_id: commentId,
      target_language: targetLang,
      source_language: source,
      translated_body: out,
      status: "ready",
    },
    { onConflict: "comment_id,target_language" },
  );

  return result(sameLanguage ? "same_language" : "ready", source, out);
}
