/**
 * Y-Dude – lokale Voice Activity Detection (VAD)
 * ------------------------------------------------------------------
 * Vollständig eigene Implementierung (Energie + Zero-Crossing-Rate mit
 * adaptivem Rauschteppich). Sie läuft ausschließlich im Browser auf den
 * rohen Samples der bereits vorhandenen Web-Audio-Pipeline – es werden
 * keinerlei Audiodaten an einen externen Dienst übertragen und es
 * entstehen keine laufenden Kosten oder Lizenzgebühren.
 *
 * Lizenz: Teil des Y-Dude-Quellcodes (keine Fremdbibliothek).
 * Siehe docs/VAD_LIZENZ.md.
 */

/** Analysefenster: 20 ms – feinkörnig genug für 250-ms-Pre-Roll. */
export const VAD_FRAME_MS = 20;
/** Audio, das vor dem erkannten Sprachbeginn erhalten bleibt. */
export const VAD_PRE_ROLL_MS = 250;
/** Audio, das nach dem erkannten Sprachende erhalten bleibt. */
export const VAD_POST_ROLL_MS = 400;

export type VadOptions = {
  sampleRate: number;
  preRollMs?: number;
  postRollMs?: number;
  /** Mindestdauer zusammenhängender Sprache, damit ein Start gilt. */
  minSpeechMs?: number;
  /** Stille-Dauer, nach der Sprache als beendet gilt. */
  minSilenceMs?: number;
};

export type VadResult = {
  /** Erster Sample-Index des Nutzbereichs (inkl. Pre-Roll). */
  startSample: number;
  /** Exklusiver letzter Sample-Index (inkl. Post-Roll). */
  endSample: number;
  /** Wurde überhaupt Sprache erkannt? */
  speechDetected: boolean;
};

function frameEnergy(data: Float32Array, from: number, to: number) {
  let sum = 0;
  let crossings = 0;
  let prev = data[from] ?? 0;
  for (let i = from; i < to; i += 1) {
    const v = data[i] ?? 0;
    sum += v * v;
    if ((v >= 0 && prev < 0) || (v < 0 && prev >= 0)) crossings += 1;
    prev = v;
  }
  const n = Math.max(1, to - from);
  return { rms: Math.sqrt(sum / n), zcr: crossings / n };
}

/**
 * Streaming-VAD: Samples werden fortlaufend eingespeist, Sprachbeginn und
 * Sprachende werden in Sample-Positionen zurückgegeben.
 */
export class VoiceActivityDetector {
  private readonly sampleRate: number;
  private readonly frameSize: number;
  private readonly preRoll: number;
  private readonly postRoll: number;
  private readonly minSpeechFrames: number;
  private readonly minSilenceFrames: number;

  /** Adaptiver Rauschteppich (RMS). */
  private noiseFloor = 0.004;
  private noiseFrames = 0;
  private speechRun = 0;
  private silenceRun = 0;
  private frameIndex = 0;
  private pending: Float32Array | null = null;

  private speechStart: number | null = null;
  private speechEnd: number | null = null;
  /** Sprache gilt als abgeschlossen (Stille + Post-Roll erreicht). */
  private finished = false;

  constructor(opts: VadOptions) {
    const perMs = opts.sampleRate / 1000;
    this.sampleRate = opts.sampleRate;
    this.frameSize = Math.max(64, Math.round(VAD_FRAME_MS * perMs));
    this.preRoll = Math.round((opts.preRollMs ?? VAD_PRE_ROLL_MS) * perMs);
    this.postRoll = Math.round((opts.postRollMs ?? VAD_POST_ROLL_MS) * perMs);
    this.minSpeechFrames = Math.max(1, Math.round((opts.minSpeechMs ?? 100) / VAD_FRAME_MS));
    this.minSilenceFrames = Math.max(1, Math.round((opts.minSilenceMs ?? 550) / VAD_FRAME_MS));
  }

  get speaking() {
    return this.speechStart !== null && this.speechEnd === null;
  }

  get hasSpeech() {
    return this.speechStart !== null;
  }

  /** true, sobald Sprache erkannt und danach lange genug still war. */
  get complete() {
    return this.finished;
  }

  /** Speist neue Samples ein (beliebige Blockgröße). */
  push(chunk: Float32Array) {
    let data = chunk;
    if (this.pending && this.pending.length > 0) {
      const merged = new Float32Array(this.pending.length + chunk.length);
      merged.set(this.pending, 0);
      merged.set(chunk, this.pending.length);
      data = merged;
    }
    let offset = 0;
    while (offset + this.frameSize <= data.length) {
      this.analyze(data, offset);
      offset += this.frameSize;
    }
    this.pending = data.slice(offset);
  }

  private analyze(data: Float32Array, offset: number) {
    const { rms, zcr } = frameEnergy(data, offset, offset + this.frameSize);
    const frameStart = this.frameIndex * this.frameSize;
    this.frameIndex += 1;

    // Rauschteppich in den ersten Frames schnell, danach langsam nachziehen.
    const alpha = this.noiseFrames < 8 ? 0.4 : 0.02;
    // Sprache klingt anders als Rauschen: mittlere ZCR, deutlich mehr Energie.
    const onThreshold = Math.max(this.noiseFloor * 3.2, 0.0075);
    const offThreshold = Math.max(this.noiseFloor * 2.0, 0.0045);
    const tonal = zcr < 0.42; // sehr hohe ZCR ⇒ Zischen/Rauschen
    const isSpeech = this.speaking ? rms > offThreshold : rms > onThreshold && tonal;

    if (!isSpeech) {
      this.noiseFrames += 1;
      this.noiseFloor = this.noiseFloor * (1 - alpha) + rms * alpha;
    }

    if (isSpeech) {
      this.speechRun += 1;
      this.silenceRun = 0;
      if (this.speechStart === null && this.speechRun >= this.minSpeechFrames) {
        this.speechStart = Math.max(0, frameStart - this.speechRun * this.frameSize);
      }
      if (this.speechStart !== null) this.speechEnd = null;
      if (this.speechStart !== null) this.lastSpeechEnd = frameStart + this.frameSize;
    } else {
      this.speechRun = 0;
      if (this.speechStart !== null) {
        this.silenceRun += 1;
        if (this.silenceRun >= this.minSilenceFrames) {
          this.speechEnd = this.lastSpeechEnd;
          this.finished = true;
        }
      }
    }
  }

  private lastSpeechEnd = 0;

  /** Ergebnisbereich inkl. Pre-/Post-Roll, begrenzt auf die Gesamtlänge. */
  result(totalSamples: number): VadResult {
    if (this.speechStart === null) {
      return { startSample: 0, endSample: totalSamples, speechDetected: false };
    }
    const end = this.speechEnd ?? this.lastSpeechEnd ?? totalSamples;
    return {
      startSample: Math.max(0, this.speechStart - this.preRoll),
      endSample: Math.min(totalSamples, Math.max(end + this.postRoll, this.speechStart + 1)),
      speechDetected: true,
    };
  }

  /** Nur für Diagnose/Tests. */
  debug() {
    return {
      sampleRate: this.sampleRate,
      noiseFloor: this.noiseFloor,
      speechStart: this.speechStart,
      speechEnd: this.speechEnd,
      lastSpeechEnd: this.lastSpeechEnd,
    };
  }
}
