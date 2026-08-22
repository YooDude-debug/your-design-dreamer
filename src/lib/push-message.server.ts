/**
 * Push-Inhalt einer Chat-Nachricht in der Sprache des Empfaengers.
 *
 * Es wird ausschliesslich die bestehende Messenger-Uebersetzung genutzt
 * (`translateMessageForViewer` inkl. Cache `message_translations` und
 * Speech-to-Text fuer Sprachnachrichten). Es gibt hier keine zweite
 * Uebersetzungslogik. Faellt die Uebersetzung aus, wird sicher auf den
 * vorhandenen Text bzw. nur den Titel zurueckgefallen.
 */
import type { PushLang } from "@/lib/push-shared";
import { translateMessageForViewer } from "@/lib/translate-message.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase-Client bewusst locker typisiert
type AnyClient = { from: (table: string) => any };

type MessageRow = {
  id: string;
  conversation_id: string | null;
  kind: string;
  body: string | null;
  transcript: string | null;
};

const MAX_PUSH_CHARS = 160;

function clip(text: string): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > MAX_PUSH_CHARS ? `${value.slice(0, MAX_PUSH_CHARS - 1)}…` : value;
}

export type MessagePushContent = {
  voice: boolean;
  body: string;
  /** Unterhaltung der Nachricht – der Push-Worker unterdrueckt damit
   * Benachrichtigungen fuer den gerade geoeffneten Chat und gruppiert sie. */
  conversationId: string | null;
};

/**
 * Liefert Kennzeichen (Text/Sprachnachricht) und den fuer den Empfaenger
 * passenden Push-Text. `null`, wenn die Nachricht nicht existiert.
 */
export async function messagePushContent(
  admin: unknown,
  messageId: string,
  lang: PushLang,
): Promise<MessagePushContent | null> {
  const db = admin as AnyClient;
  const { data } = await db
    .from("messages")
    .select("id, conversation_id, kind, body, transcript")
    .eq("id", messageId)
    .maybeSingle();
  const msg = data as MessageRow | null;
  if (!msg) return null;

  const voice = msg.kind === "audio" || msg.kind === "chat_slangtag";
  const original = (msg.body ?? "").trim();

  // Bilder/Videos ohne Text: kein Inhalt in die Push aufnehmen.
  const conversationId = msg.conversation_id ?? null;
  if (!voice && !original) return { voice, body: "", conversationId };

  let translated = "";
  let transcript = (msg.transcript ?? "").trim();
  try {
    const result = await translateMessageForViewer(admin, messageId, lang as never);
    translated = (result.text ?? "").trim();
    transcript = (result.transcript ?? "").trim() || transcript;
  } catch (error) {
    console.error("[push] translation failed", (error as Error).message);
  }

  // Vorrang: Uebersetzung fuer den Empfaenger. Sonst Original bzw. Transkript.
  const body = translated || original || transcript;
  return { voice, body: clip(body), conversationId };
}
