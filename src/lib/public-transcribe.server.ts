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
  if (audioSeconds(bytes, mime) > MAX_TEST_AUDIO_SECONDS) throw new Error("audio too long");
  return { bytes, mime };
}

/**
 * Schätzt/liest die Audiodauer. Für WAV wird der Header exakt ausgewertet,
 * für komprimierte Formate wird konservativ über eine Mindest-Bitrate
 * geschätzt (nur zur Ablehnung offensichtlich zu langer Uploads).
 */
export function audioSeconds(bytes: Uint8Array, mime: string): number {
  if (EXT[mime] === "wav" && bytes.length > 44) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const byteRate = view.getUint32(28, true);
    if (byteRate > 0) return (bytes.length - 44) / byteRate;
  }
  // ~24 kbit/s als untere Schranke gängiger Sprach-Codecs (Opus/AAC).
  return bytes.length / (24_000 / 8);
}

/** Transkribiert eine kurze Testaufnahme und liefert den erkannten Text. */
export async function transcribeTestAudio(dataUrl: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const { bytes, mime } = decodeDataUrl(dataUrl);

  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new Blob([bytes], { type: mime }), `test.${EXT[mime]}`);

  // Genau EIN externer Aufruf, kein Retry, mit hartem Timeout.
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Details nur ins Server-Log, nie an den Client (kein Key-/Quota-Leak).
    console.error("[public-transcribe] gateway", res.status);
    throw new Error(`transcription failed (${res.status})`);
  }
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}
