/**
 * Einheitliches internes Y-Dude-SlangTag-Audioformat.
 *
 * Jede Audioquelle (Mikrofon-Aufnahme oder hochgeladene Datei) wird vor dem
 * Upload in exakt dasselbe Zielformat überführt:
 *   • Mono
 *   • 24 kHz Samplerate
 *   • 16 Bit PCM (WAV-Container, streamingfreundlicher Header, keine Metadaten)
 *   • auf einheitliche Lautstärke normalisiert (Peak + sanftes Fade)
 *   • maximal 5 Sekunden
 *
 * Der Container ist bewusst WAV/PCM: er wird auf Web, Android und iPhone
 * identisch dekodiert, enthält keinerlei Metadaten (ID3/Vorbis-Comments werden
 * durch die Neukodierung vollständig entfernt) und ist bei ≤ 5 Sekunden klein
 * genug für sofortiges Streaming.
 */

import { isBusinessSlangTag } from "@/lib/slangtag-rules";

/** Maximale Größe einer hochgeladenen Audiodatei: 10 MB. */
export const MAX_AUDIO_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Unterstützte Upload-Formate: MP3, WAV, M4A, AAC, OGG, FLAC. */
export const AUDIO_UPLOAD_EXTENSIONS = ["mp3", "wav", "m4a", "aac", "ogg", "oga", "flac"] as const;

/** `accept`-Attribut für den Datei-Dialog. */
export const AUDIO_UPLOAD_ACCEPT = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
  ...AUDIO_UPLOAD_EXTENSIONS.map((e) => `.${e}`),
].join(",");

/** Zielwerte des internen Formats. */
export const SLANGTAG_SAMPLE_RATE = 24_000;
/** Community-SlangTags (grün): immer maximal 5 Sekunden. */
export const SLANGTAG_MAX_SECONDS = 5;
/** Creator-/Unternehmer-SlangTags (blau): maximal 10 Sekunden. */
export const SLANGTAG_MAX_SECONDS_EXTENDED = 10;
export const SLANGTAG_MIN_SECONDS = 1;

/**
 * Einheitliche Regel für die maximale Aufnahmedauer:
 * Community-SlangTags 5 Sekunden, Creator-/Unternehmer-SlangTags 10 Sekunden
 * (letztere nur für berechtigte Konten: Creator, Unternehmer, Admin).
 */
export function slangTagMaxSeconds(kind: "community" | "creator", extendedAllowed: boolean) {
  return isBusinessSlangTag(kind) && extendedAllowed
    ? SLANGTAG_MAX_SECONDS_EXTENDED
    : SLANGTAG_MAX_SECONDS;
}

export type AudioFormatError =
  | "too-large"
  | "unsupported-format"
  | "decode-failed"
  | "too-short"
  | "no-audio-support";

export class AudioProcessingError extends Error {
  reason: AudioFormatError;
  constructor(reason: AudioFormatError) {
    super(reason);
    this.reason = reason;
  }
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Prüft Größe und Format einer Datei, ohne sie zu dekodieren. */
export function validateAudioFile(file: File): AudioFormatError | null {
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) return "too-large";
  const ext = extensionOf(file.name);
  const okExt = (AUDIO_UPLOAD_EXTENSIONS as readonly string[]).includes(ext);
  const okMime = file.type.startsWith("audio/");
  if (!okExt && !okMime) return "unsupported-format";
  return null;
}

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Dekodiert eine beliebige unterstützte Audiodatei zu rohen Samples.
 * Der Browser-Decoder erledigt MP3/WAV/M4A/AAC/OGG/FLAC formatunabhängig.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const invalid = validateAudioFile(file);
  if (invalid) throw new AudioProcessingError(invalid);

  const Ctor = audioContextCtor();
  if (!Ctor) throw new AudioProcessingError("no-audio-support");

  const ctx = new Ctor();
  try {
    const bytes = await file.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes);
    if (buffer.duration < 0.2) throw new AudioProcessingError("too-short");
    return buffer;
  } catch (err) {
    if (err instanceof AudioProcessingError) throw err;
    throw new AudioProcessingError("decode-failed");
  } finally {
    void ctx.close();
  }
}

/** Mischt auf Mono und resampelt auf die Ziel-Samplerate. */
async function toMono24k(buffer: AudioBuffer, start: number, end: number): Promise<Float32Array> {
  const from = Math.max(0, Math.min(start, buffer.duration));
  const to = Math.max(from, Math.min(end, buffer.duration));
  const length = Math.max(1, Math.round((to - from) * SLANGTAG_SAMPLE_RATE));

  const OfflineCtor =
    typeof window === "undefined"
      ? null
      : ((window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext })
          .OfflineAudioContext ?? null);
  if (!OfflineCtor) throw new AudioProcessingError("no-audio-support");

  const offline = new OfflineCtor(1, length, SLANGTAG_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0, from, to - from);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Nur sehr kurze Ein-/Ausblendungen (8 ms) gegen Klick-Geräusche an den
 * Schnittkanten. Keine Normalisierung, keine Kompression, keine
 * Lautstärkeanpassung – die Dynamik der Stimme bleibt unverändert.
 */
function applyEdgeFades(samples: Float32Array) {
  const fade = Math.min(Math.floor(SLANGTAG_SAMPLE_RATE * 0.008), Math.floor(samples.length / 4));
  if (fade <= 0) return samples;
  for (let i = 0; i < samples.length; i += 1) {
    let v = samples[i]!;
    if (i < fade) v *= i / fade;
    const tail = samples.length - 1 - i;
    if (tail < fade) v *= tail / fade;
    samples[i] = Math.max(-1, Math.min(1, v));
  }
  return samples;
}


/** Kodiert Mono-Samples als 16-Bit-PCM-WAV (ohne Metadaten). */
function encodeWav(samples: Float32Array): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SLANGTAG_SAMPLE_RATE, true);
  view.setUint32(28, SLANGTAG_SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (const s of samples) {
    view.setInt16(offset, Math.round(s * 32767), true);
    offset += 2;
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new AudioProcessingError("decode-failed"));
    fr.readAsDataURL(blob);
  });
}

/** Dauer im SlangTag-Anzeigeformat, z. B. `0:03`. */
export function slangTagDurationLabel(seconds: number, maxSeconds = SLANGTAG_MAX_SECONDS) {
  const s = Math.max(1, Math.min(maxSeconds, Math.round(seconds)));
  return `0:${String(s).padStart(2, "0")}`;
}

export type ConvertedAudio = { dataUrl: string; seconds: number; duration: string; bytes: number };

/**
 * Vollständige Konvertierung in das interne SlangTag-Format:
 * zuschneiden → Mono/24 kHz → normalisieren → 16-Bit-WAV ohne Metadaten.
 */
export async function convertToSlangTagAudio(
  buffer: AudioBuffer,
  startSeconds: number,
  endSeconds: number,
  maxSeconds = SLANGTAG_MAX_SECONDS,
): Promise<ConvertedAudio> {
  const span = Math.min(maxSeconds, Math.max(0, endSeconds - startSeconds));
  if (span < 0.2) throw new AudioProcessingError("too-short");
  const samples = normalize(await toMono24k(buffer, startSeconds, startSeconds + span));
  const blob = encodeWav(samples);
  return {
    dataUrl: await blobToDataUrl(blob),
    seconds: span,
    duration: slangTagDurationLabel(span, maxSeconds),
    bytes: blob.size,
  };
}

/** Reduziert einen Puffer auf Peak-Werte für die Wellenform-Darstellung. */
export function waveformPeaks(buffer: AudioBuffer, buckets = 600): number[] {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / buckets));
  const peaks: number[] = [];
  for (let i = 0; i < buckets; i += 1) {
    let peak = 0;
    const from = i * step;
    for (let j = from; j < from + step && j < data.length; j += 1) {
      const abs = Math.abs(data[j]!);
      if (abs > peak) peak = abs;
    }
    peaks.push(peak);
  }
  const max = Math.max(0.0001, ...peaks);
  return peaks.map((p) => p / max);
}
