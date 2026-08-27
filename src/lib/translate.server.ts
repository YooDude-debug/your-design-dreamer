/**
 * Automatische Uebersetzung fuer den Y-Dude Messenger.
 *
 * Nutzt dieselbe bestehende Infrastruktur wie die Moderation
 * (Lovable AI Gateway, `LOVABLE_API_KEY` ausschliesslich serverseitig):
 *  - Text: Spracherkennung + slang-bewusste Uebersetzung in einem Aufruf
 *  - Sprachnachricht: Speech-to-Text, danach dieselbe Uebersetzung
 *
 * Das Original (Text, Audio, Transkript) wird niemals veraendert oder
 * ueberschrieben. Uebersetzungen landen im Cache `message_translations`,
 * damit jede Nachricht pro Zielsprache nur ein einziges Mal Kosten erzeugt.
 */
import { isTranslationLang, type TranslationLang } from "@/lib/lang-detect";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "google/gemini-3.7-flash";
const STT_MODEL = "openai/gpt-4o-mini-transcribe";

/** Obergrenze fuer Audio, das transkribiert wird (Kostenschutz). */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
/** Sehr kurze Aufnahmen enthalten keine verwertbare Sprache. */
const MIN_AUDIO_BYTES = 1024;
/** Obergrenze fuer Uebersetzungstext. */
const MAX_TEXT_CHARS = 4000;

const LANG_LABEL: Record<TranslationLang, string> = {
  de: "Deutsch",
  en: "Englisch",
  el: "Griechisch",
};

/**
 * Fehler eines Gateway-Aufrufs mit HTTP-Status.
 *
 * Nur `429`/`5xx` sind vorübergehend. `402` (Guthaben erschöpft) und `403`
 * (Kontingent/Policy) sind endgültig: sie werden nicht erneut versucht,
 * sondern der Oberfläche als eigener Zustand gemeldet.
 */
export class AiGatewayError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AiGatewayError";
  }
}

/** true = Guthaben erschöpft oder durch Policy/Limit blockiert. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof AiGatewayError && (err.status === 402 || err.status === 403);
}

export type TranslationResult = {
  status: "ready" | "same_language" | "unavailable" | "empty" | "quota";
  sourceLanguage: string | null;
  /** Transkript einer Sprachnachricht (nur bei Audio gesetzt). */
  transcript: string | null;
  /** Uebersetzter Text – leer, wenn keine Uebersetzung noetig/moeglich war. */
  text: string;
};

function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return key;
}

const AUDIO_EXT: Record<string, string> = {
  wav: "wav",
  webm: "webm",
  mp4: "mp4",
  m4a: "mp4",
  mp3: "mp3",
  mpeg: "mp3",
  ogg: "ogg",
};
const AUDIO_MIME: Record<string, string> = {
  wav: "audio/wav",
  webm: "audio/webm",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
};

function audioFormat(path: string): { ext: string; mime: string } {
  const raw = (path.split(".").pop() ?? "").toLowerCase();
  const ext = AUDIO_EXT[raw] ?? "webm";
  return { ext, mime: AUDIO_MIME[ext] ?? "audio/webm" };
}

/** Transkribiert Original-Audio; das Original bleibt unangetastet im Speicher. */
export async function transcribeStoredAudio(path: string, bytes: Uint8Array): Promise<string> {
  if (bytes.length < MIN_AUDIO_BYTES) return "";
  if (bytes.length > MAX_AUDIO_BYTES) throw new Error("audio too large");
  const { ext, mime } = audioFormat(path);
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mime }), `voice.${ext}`);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
  if (!res.ok) {
    throw new AiGatewayError(
      res.status,
      `transcription ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

type AiTranslation = { source_language: string; translated_text: string };

/**
 * Erkennt die Ausgangssprache und uebersetzt sinnwahrend (Slang bleibt Slang).
 * Liefert `null`, wenn die KI nicht erreichbar ist – die Originalnachricht
 * funktioniert dann unveraendert weiter.
 */
export async function detectAndTranslate(
  text: string,
  target: TranslationLang,
): Promise<AiTranslation | null> {
  const value = text.trim().slice(0, MAX_TEXT_CHARS);
  if (!value) return null;

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du bist Uebersetzer fuer eine Plattform rund um lokale Sprache, Dialekte und Slang. " +
            "Erkenne zuerst die Ausgangssprache der Nachricht (ISO-639-1, z. B. de, en, el). " +
            `Uebersetze die Nachricht danach nach ${LANG_LABEL[target]} (${target}). ` +
            "Uebersetze sinnwahrend statt wortwoertlich: Umgangssprache, lokale Ausdruecke, " +
            "Anrede und Tonfall bleiben erhalten. Formuliere nicht formeller als das Original. " +
            "Emojis, Namen, @Mentions, #Hashtags und $SlangTags bleiben unveraendert stehen. " +
            "Wenn die Nachricht bereits in der Zielsprache ist, gib sie unveraendert zurueck. " +
            "Antworte ausschliesslich mit dem JSON-Objekt, ohne Kommentar.",
        },
        { role: "user", content: value },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              source_language: { type: "string" },
              translated_text: { type: "string" },
            },
            required: ["source_language", "translated_text"],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new AiGatewayError(
      res.status,
      `translation ${res.status}: ${await res.text().catch(() => "")}`,
    );
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = json.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    ) as Partial<AiTranslation>;
    const source = (parsed.source_language ?? "").slice(0, 8).toLowerCase();
    const translated = (parsed.translated_text ?? "").trim();
    if (!translated) return null;
    return { source_language: source || "unknown", translated_text: translated };
  } catch {
    return null;
  }
}

export function normalizeLang(value: string | null | undefined): string | null {
  if (!value) return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return base ? base : null;
}

export { isTranslationLang, MAX_AUDIO_BYTES };

/**
 * Uebersetzt Titel und Beschreibung eines Beitrags in einem einzigen Aufruf.
 *
 * SlangTags ($name / $$name), Hashtags (#tag) und @Mentions bleiben dabei
 * unveraendert – sie sind eigenstaendige Inhalte und duerfen nicht uebersetzt
 * werden. Liefert `null`, wenn die KI nicht erreichbar ist; der Originaltext
 * bleibt dann sichtbar.
 */
export async function translatePostFields(
  title: string,
  description: string,
  target: TranslationLang,
): Promise<{ source_language: string; title: string; description: string } | null> {
  const t = title.trim().slice(0, MAX_TEXT_CHARS);
  const d = description.trim().slice(0, MAX_TEXT_CHARS);
  if (!t && !d) return null;

  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du uebersetzt Beitraege einer Plattform rund um lokale Sprache, Dialekte und Slang. " +
            "Erkenne zuerst die Ausgangssprache des Beitrags (ISO-639-1, z. B. de, en, el). " +
            `Uebersetze Titel und Beschreibung danach nach ${LANG_LABEL[target]} (${target}). ` +
            "Uebersetze sinnwahrend statt wortwoertlich; Tonfall und Umgangssprache bleiben erhalten. " +
            "SlangTags ($name und $$name), Hashtags (#tag), @Mentions, Emojis, Links und Eigennamen " +
            "bleiben exakt unveraendert stehen und werden NIEMALS uebersetzt. " +
            "Leere Felder bleiben leer. " +
            "Ist der Beitrag bereits in der Zielsprache, gib ihn unveraendert zurueck. " +
            "Antworte ausschliesslich mit dem JSON-Objekt.",
        },
        { role: "user", content: JSON.stringify({ title: t, description: d }) },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "post_translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              source_language: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["source_language", "title", "description"],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`post translation ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(
      raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim(),
    ) as Partial<{ source_language: string; title: string; description: string }>;
    const source = (parsed.source_language ?? "").slice(0, 8).toLowerCase();
    const outTitle = (parsed.title ?? "").trim();
    const outDescription = (parsed.description ?? "").trim();
    if (!outTitle && !outDescription) return null;
    return {
      source_language: source || "unknown",
      // Leere Originalfelder bleiben leer – nichts hinzuerfinden.
      title: t ? outTitle : "",
      description: d ? outDescription : "",
    };
  } catch {
    return null;
  }
}
