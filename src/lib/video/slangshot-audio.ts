/**
 * SlangShot-Audio: die Tonspur einer 5-Sekunden-Videoaufnahme wird zur
 * Grundlage eines SlangTags.
 *
 * Ablauf (siehe CreatePostDialog):
 *  Aufnahme mit Mikrofon → Tonspur hier extrahieren → SlangTag-Draft
 *  (bestehende Draft-Architektur, keine zweite Audio-Logik) → Video stumm
 *  speichern (`prepareSilentShort`) → SlangShot referenziert den SlangTag.
 *
 * Das Audio wird in das bestehende interne SlangTag-Format konvertiert
 * (Mono, 24 kHz, 16-Bit-WAV, normalisiert) – exakt wie bei einer normalen
 * SlangTag-Aufnahme.
 */
import {
  SLANGTAG_MAX_SECONDS,
  convertToSlangTagAudio,
  type ConvertedAudio,
} from "@/lib/audio-format";

/** Unterhalb dieses Spitzenwerts gilt eine Spur als tonlos. */
const SILENCE_PEAK = 0.008;

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function peakOf(buffer: AudioBuffer): number {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i += 1) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

export type ShotAudioResult =
  | { status: "ok"; audio: ConvertedAudio }
  /** Video ohne (hörbare) Tonspur – der Nutzer waehlt einen SlangTag. */
  | { status: "no-audio" }
  /** Ton vorhanden, aber technisch nicht verwertbar. */
  | { status: "failed" };

/**
 * Extrahiert die Tonspur eines (kurzen) Videos und liefert sie im internen
 * SlangTag-Format zurueck. Das Video selbst wird nicht veraendert.
 */
export async function extractShotAudio(
  source: Blob,
  maxSeconds: number = SLANGTAG_MAX_SECONDS,
): Promise<ShotAudioResult> {
  const Ctor = audioContextCtor();
  if (!Ctor) return { status: "failed" };
  const ctx = new Ctor();
  try {
    const bytes = await source.arrayBuffer();
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(bytes.slice(0));
    } catch {
      return { status: "no-audio" };
    }
    if (buffer.duration < 0.2) return { status: "no-audio" };
    if (peakOf(buffer) < SILENCE_PEAK) return { status: "no-audio" };
    const audio = await convertToSlangTagAudio(
      buffer,
      0,
      Math.min(buffer.duration, maxSeconds),
      maxSeconds,
    );
    return { status: "ok", audio };
  } catch {
    return { status: "failed" };
  } finally {
    void ctx.close();
  }
}

/** Automatischer, eindeutiger Draft-Name fuer einen SlangShot-SlangTag. */
export function shotTagName(existing: { name: string }[]): string {
  const used = new Set(existing.map((t) => t.name.toLowerCase()));
  for (let i = 1; i < 999; i += 1) {
    const candidate = i === 1 ? "Shot" : `Shot${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  return `Shot${Date.now().toString(36).slice(-4)}`;
}
