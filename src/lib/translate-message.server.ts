/**
 * Serverseitige Uebersetzungslogik einer einzelnen Chat-Nachricht.
 *
 * Das Lesen der Nachricht laeuft mit den Rechten des angemeldeten Nutzers
 * (RLS: nur eigene Chats). Nur das Schreiben von Transkript/Cache nutzt den
 * Serverschluessel, weil Nachrichten aus der App nicht veraendert werden
 * duerfen. Originaltext und Original-Audio werden nie ueberschrieben.
 */
import type { TranslationLang } from "@/lib/lang-detect";
import {
  detectAndTranslate,
  isQuotaError,
  normalizeLang,
  transcribeStoredAudio,
  type TranslationResult,
} from "@/lib/translate.server";

const BUCKET = "media";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase-Client bewusst locker typisiert
type AnyClient = { from: (table: string) => any };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TypedClient = any;

type MessageRow = {
  id: string;
  conversation_id: string;
  kind: string;
  body: string | null;
  media_url: string | null;
  chat_slang_tag_id: string | null;
  source_language: string | null;
  transcript: string | null;
};

/** Fasst das Ergebnis in die Antwortform der App. */
function result(
  status: TranslationResult["status"],
  sourceLanguage: string | null,
  transcript: string | null,
  text: string,
): TranslationResult {
  return { status, sourceLanguage, transcript, text };
}

export async function translateMessageForViewer(
  client: TypedClient,
  messageId: string,
  targetLang: TranslationLang,
): Promise<TranslationResult> {
  const supabase = client as unknown as AnyClient;

  const { data: message } = await supabase
    .from("messages")
    .select(
      "id, conversation_id, kind, body, media_url, chat_slang_tag_id, source_language, transcript",
    )
    .eq("id", messageId)
    .maybeSingle();
  const msg = message as MessageRow | null;
  if (!msg) return result("unavailable", null, null, "");

  // 1) Cache – kostet keinen KI-Aufruf.
  const { data: cached } = await supabase
    .from("message_translations")
    .select("source_language, translated_text, transcript, status")
    .eq("message_id", messageId)
    .eq("target_language", targetLang)
    .maybeSingle();
  const hit = cached as {
    source_language: string | null;
    translated_text: string;
    transcript: string | null;
    status: string;
  } | null;
  if (hit && hit.status === "ready") {
    return result(
      hit.translated_text ? "ready" : "same_language",
      normalizeLang(hit.source_language),
      hit.transcript ?? msg.transcript ?? null,
      hit.translated_text ?? "",
    );
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  /* eslint-disable @typescript-eslint/no-explicit-any -- Admin-Client bewusst locker typisiert */
  const admin = supabaseAdmin as unknown as {
    from: (table: string) => any;
    storage: { from: (bucket: string) => any };
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // 2) Quelltext bestimmen: Text direkt, Sprachnachricht per Transkript.
  let sourceText = (msg.body ?? "").trim();
  let transcript = msg.transcript ?? null;
  const isVoice = msg.kind === "audio" || msg.kind === "chat_slangtag";

  if (isVoice && !sourceText) {
    if (!transcript) {
      let audioPath = msg.media_url;
      if (!audioPath && msg.chat_slang_tag_id) {
        const { data: tag } = await supabase
          .from("chat_slang_tags")
          .select("audio_url")
          .eq("id", msg.chat_slang_tag_id)
          .maybeSingle();
        audioPath = (tag as { audio_url: string | null } | null)?.audio_url ?? null;
      }
      if (!audioPath) return result("empty", null, null, "");
      try {
        const { data: file, error } = await admin.storage.from(BUCKET).download(audioPath);
        if (error || !file) return result("unavailable", null, null, "");
        const bytes = new Uint8Array(await (file as Blob).arrayBuffer());
        transcript = await transcribeStoredAudio(audioPath, bytes);
      } catch (err) {
        console.error("[translate] transcription failed", (err as Error).message);
        // Guthaben/Kontingent erschöpft: kein Codefehler, kein erneuter Versuch.
        return result(isQuotaError(err) ? "quota" : "unavailable", null, null, "");
      }
      if (!transcript) return result("empty", null, null, "");
      // Transkript einmalig sichern (Original-Audio bleibt unberuehrt).
      await admin.from("messages").update({ transcript }).eq("id", messageId);
    }
    sourceText = transcript;
  }

  if (!sourceText) return result("empty", normalizeLang(msg.source_language), transcript, "");

  // 3) Bereits bekannte Ausgangssprache = Zielsprache -> kein KI-Aufruf.
  const known = normalizeLang(msg.source_language);
  if (known && known === targetLang) {
    await admin.from("message_translations").upsert(
      {
        message_id: messageId,
        target_language: targetLang,
        source_language: known,
        translated_text: "",
        transcript,
        status: "ready",
      },
      { onConflict: "message_id,target_language" },
    );
    return result("same_language", known, transcript, "");
  }

  // 4) Erkennen + uebersetzen.
  let translated: { source_language: string; translated_text: string } | null = null;
  try {
    translated = await detectAndTranslate(sourceText, targetLang);
  } catch (err) {
    console.error("[translate] gateway failed", (err as Error).message);
    return result(isQuotaError(err) ? "quota" : "unavailable", known, transcript, "");
  }
  if (!translated) return result("unavailable", known, transcript, "");

  const source = normalizeLang(translated.source_language) ?? "unknown";
  const sameLanguage = source === targetLang;
  const text = sameLanguage ? "" : translated.translated_text;

  if (!msg.source_language && source !== "unknown") {
    await admin.from("messages").update({ source_language: source }).eq("id", messageId);
  }
  await admin.from("message_translations").upsert(
    {
      message_id: messageId,
      target_language: targetLang,
      source_language: source,
      translated_text: text,
      transcript,
      status: "ready",
    },
    { onConflict: "message_id,target_language" },
  );

  return result(sameLanguage ? "same_language" : "ready", source, transcript, text);
}
