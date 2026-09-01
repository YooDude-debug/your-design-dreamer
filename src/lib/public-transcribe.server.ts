/**
 * Speech-to-Text für den öffentlichen SlangTag Tester der Landingpage.
 *
 * Nutzt dieselbe Lovable-AI-Transkription wie die Moderation
 * (`openai/gpt-4o-mini-transcribe`), aber ohne Datenbank, Storage oder
 * Statistik: die Testaufnahme wird nur transkribiert und wieder verworfen.
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const STT_MODEL = "openai/gpt-4o-mini-transcribe";

/** Maximale Uploadgröße einer Testaufnahme (roh, vor Base64). */
export const MAX_TEST_AUDIO_BYTES = 2 * 1024 * 1024;

/** Timeout für den externen Aufruf – verhindert hängende Requests. */
const TRANSCRIBE_TIMEOUT_MS = 20_000;

/**
 * Maximal erlaubte Audiodauer. Testaufnahmen sind SlangTags (1–5s); mit
 * Toleranz gilt hier eine harte Obergrenze.
 */
export const MAX_TEST_AUDIO_SECONDS = 15;


const EXT: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
};

/** Zerlegt eine Data-URL in Bytes und MIME-Typ. */
export function decodeDataUrl(dataUrl: string): { bytes: Uint8Array<ArrayBuffer>; mime: string } {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) throw new Error("invalid audio payload");
  const mime = match[1]!.toLowerCase();
  if (!EXT[mime]) throw new Error("unsupported audio format");
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (bytes.length < 1024) throw new Error("audio too short");
  if (bytes.length > MAX_TEST_AUDIO_BYTES) throw new Error("audio too large");
  return { bytes, mime };
}

/** Transkribiert eine kurze Testaufnahme und liefert den erkannten Text. */
export async function transcribeTestAudio(dataUrl: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const { bytes, mime } = decodeDataUrl(dataUrl);

  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([bytes], { type: mime }), `test.${EXT[mime]}`);

  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`transcription ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
