/**
 * ORB Core V0.2 – Sprachschicht (nur Server).
 *
 * Spracheingabe: Aufnahme des Benutzers (WAV) → Spracherkennung → deutscher Text.
 * Sprachausgabe: deutscher Antworttext → Sprachsynthese → MP3.
 *
 * Der Schlüssel der Plattform-KI bleibt vollständig serverseitig. Das Mikrofon
 * wird ausschliesslich durch eine ausdrückliche Benutzeraktion aktiviert; diese
 * Datei erhält nur eine fertige Aufnahme.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const STT_MODEL = "google/gemini-3.5-transcribe";
const TTS_MODEL = "openai/gpt-4o-mini-tts";
/** Obergrenze einer Aufnahme (rund 8 MB WAV). */
export const MAX_AUDIO_BYTES = 8_000_000;
/** Obergrenze des vorgelesenen Textes. */
export const MAX_SPEAK_CHARS = 600;

function decodeBase64(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.includes(",") ? (base64.split(",").pop() ?? "") : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export type TranscriptResult = {
  text: string;
  status: "ok" | "empty" | "quota" | "unavailable";
};

/** Aufnahme (WAV, base64) → deutscher Text. */
export async function transcribe(audioBase64: string): Promise<TranscriptResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { text: "", status: "unavailable" };

  const bytes = decodeBase64(audioBase64);
  // Sehr kurze Aufnahmen enthalten keine Sprache – gar nicht erst senden.
  if (bytes.byteLength < 2048) return { text: "", status: "empty" };
  if (bytes.byteLength > MAX_AUDIO_BYTES) return { text: "", status: "unavailable" };

  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("language", "de");
  form.append("file", new Blob([bytes], { type: "audio/wav" }), "aufnahme.wav");

  try {
    const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (res.status === 402 || res.status === 403) return { text: "", status: "quota" };
    if (!res.ok) return { text: "", status: "unavailable" };
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return text ? { text, status: "ok" } : { text: "", status: "empty" };
  } catch {
    return { text: "", status: "unavailable" };
  }
}

export type SpeechResult = {
  /** MP3 als base64 – wird im Browser direkt abgespielt. */
  audioBase64: string;
  status: "ok" | "quota" | "unavailable";
};

/** Deutscher Text → gesprochene Antwort (MP3, base64). */
export async function synthesize(text: string): Promise<SpeechResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { audioBase64: "", status: "unavailable" };

  const body = text.trim().slice(0, MAX_SPEAK_CHARS);
  if (!body) return { audioBase64: "", status: "unavailable" };

  try {
    const res = await fetch(`${GATEWAY}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: TTS_MODEL,
        input: body,
        voice: "alloy",
        instructions: "Sprich natürlich und ruhig auf Deutsch.",
        response_format: "mp3",
        stream_format: "audio",
      }),
    });
    if (res.status === 402 || res.status === 403) return { audioBase64: "", status: "quota" };
    if (!res.ok) return { audioBase64: "", status: "unavailable" };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) return { audioBase64: "", status: "unavailable" };
    return { audioBase64: encodeBase64(bytes), status: "ok" };
  } catch {
    return { audioBase64: "", status: "unavailable" };
  }
}
