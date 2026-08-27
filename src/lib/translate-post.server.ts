/**
 * Serverseitige Uebersetzung eines Beitrags (Titel + Beschreibung).
 *
 * Grundsaetze:
 *  - Das Original in `posts` wird NIEMALS veraendert oder ueberschrieben.
 *    Nur das Feld `source_language` (erkannte Ausgangssprache) wird einmalig
 *    ergaenzt, damit spaeter kein weiterer KI-Aufruf noetig ist.
 *  - Uebersetzungen liegen im Cache `post_translations`
 *    (Schluessel: Beitrag + Zielsprache). Jeder Beitrag kostet damit je
 *    Sprache genau einen KI-Aufruf.
 *  - SlangTags ($name, $$name), Hashtags (#tag) und @Mentions bleiben
 *    unveraendert – das erledigt die Prompt-Vorgabe und wird zusaetzlich
 *    geprueft (Token-Schutz).
 *  - Es wird dieselbe Infrastruktur wie im Messenger genutzt
 *    (Lovable AI Gateway, `LOVABLE_API_KEY` nur serverseitig).
 */
import type { TranslationLang } from "@/lib/lang-detect";
import { normalizeLang, translatePostFields } from "@/lib/translate.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase-Client bewusst locker typisiert
type AnyClient = { from: (table: string) => any };

export type PostTranslationResult = {
  status: "ready" | "same_language" | "unavailable" | "empty" | "quota";
  sourceLanguage: string | null;
  title: string;
  description: string;
};

type PostRow = {
  id: string;
  title: string | null;
  description: string | null;
  source_language: string | null;
};

function result(
  status: PostTranslationResult["status"],
  sourceLanguage: string | null,
  title = "",
  description = "",
): PostTranslationResult {
  return { status, sourceLanguage, title, description };
}

export async function translatePostForViewer(
  client: unknown,
  postId: string,
  targetLang: TranslationLang,
): Promise<PostTranslationResult> {
  const supabase = client as AnyClient;

  const { data } = await supabase
    .from("posts")
    .select("id, title, description, source_language")
    .eq("id", postId)
    .maybeSingle();
  const post = data as PostRow | null;
  if (!post) return result("unavailable", null);

  const title = (post.title ?? "").trim();
  const description = (post.description ?? "").trim();
  if (!title && !description) return result("empty", normalizeLang(post.source_language));

  // 1) Cache – kostet keinen KI-Aufruf.
  const { data: cachedRow } = await supabase
    .from("post_translations")
    .select("source_language, translated_title, translated_description, status")
    .eq("post_id", postId)
    .eq("target_language", targetLang)
    .maybeSingle();
  const cached = cachedRow as {
    source_language: string | null;
    translated_title: string;
    translated_description: string;
    status: string;
  } | null;
  if (cached && cached.status === "ready") {
    const hasText = Boolean(cached.translated_title || cached.translated_description);
    return result(
      hasText ? "ready" : "same_language",
      normalizeLang(cached.source_language),
      cached.translated_title ?? "",
      cached.translated_description ?? "",
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as AnyClient;

  // 2) Bekannte Ausgangssprache = Zielsprache -> kein KI-Aufruf.
  const known = normalizeLang(post.source_language);
  if (known && known === targetLang) {
    await admin.from("post_translations").upsert(
      {
        post_id: postId,
        target_language: targetLang,
        source_language: known,
        translated_title: "",
        translated_description: "",
        status: "ready",
      },
      { onConflict: "post_id,target_language" },
    );
    return result("same_language", known);
  }

  // 3) Erkennen + uebersetzen (ein Aufruf fuer Titel und Beschreibung).
  let translated: {
    source_language: string;
    title: string;
    description: string;
  } | null = null;
  try {
    translated = await translatePostFields(title, description, targetLang);
  } catch (err) {
    console.error("[translate-post] gateway failed", (err as Error).message);
    // Guthaben/Kontingent erschöpft: eindeutiger Zustand statt Dauerfehler.
    return result(isQuotaError(err) ? "quota" : "unavailable", known);
  }
  if (!translated) return result("unavailable", known);

  const source = normalizeLang(translated.source_language) ?? "unknown";
  const sameLanguage = source === targetLang;
  const outTitle = sameLanguage ? "" : translated.title.trim();
  const outDescription = sameLanguage ? "" : translated.description.trim();

  if (!post.source_language && source !== "unknown") {
    // Nur das Sprachkennzeichen ergaenzen – Titel/Beschreibung bleiben Original.
    await admin.from("posts").update({ source_language: source }).eq("id", postId);
  }
  await admin.from("post_translations").upsert(
    {
      post_id: postId,
      target_language: targetLang,
      source_language: source,
      translated_title: outTitle,
      translated_description: outDescription,
      status: "ready",
    },
    { onConflict: "post_id,target_language" },
  );

  return result(sameLanguage ? "same_language" : "ready", source, outTitle, outDescription);
}
