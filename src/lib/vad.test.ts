import { describe, expect, it } from "vitest";
import { VAD_PRE_ROLL_MS, VoiceActivityDetector } from "@/lib/vad";

const RATE = 48000;

function noise(samples: number, level = 0.002) {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) out[i] = (Math.random() * 2 - 1) * level;
  return out;
}

function speech(samples: number, amp = 0.25) {
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const t = i / RATE;
    // Grundton + Formanten + Amplitudenmodulation ⇒ sprachähnlich
    const env = 0.6 + 0.4 * Math.sin(2 * Math.PI * 4 * t);
    out[i] =
      amp *
      env *
      (Math.sin(2 * Math.PI * 130 * t) * 0.7 +
        Math.sin(2 * Math.PI * 700 * t) * 0.25 +
        Math.sin(2 * Math.PI * 1800 * t) * 0.1);
  }
  return out;
}

function concat(parts: Float32Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function run(signal: Float32Array) {
  const vad = new VoiceActivityDetector({ sampleRate: RATE });
  // realistische Blockgröße wie im Recorder
  for (let i = 0; i < signal.length; i += 2048) vad.push(signal.subarray(i, i + 2048));
  return { vad, result: vad.result(signal.length) };
}

const ms = (n: number) => Math.round((n / RATE) * 1000);

describe("lokale VAD", () => {
  it("erkennt normale Sprache mit ~250 ms Pre-Roll", () => {
    const lead = Math.round(RATE * 0.8);
    const signal = concat([noise(lead), speech(RATE), noise(RATE)]);
    const { result } = run(signal);
    expect(result.speechDetected).toBe(true);
    // Start liegt rund 250 ms vor dem tatsächlichen Sprachbeginn
    expect(ms(lead - result.startSample)).toBeGreaterThanOrEqual(VAD_PRE_ROLL_MS - 60);
    expect(ms(lead - result.startSample)).toBeLessThanOrEqual(VAD_PRE_ROLL_MS + 160);
  });

  it("schneidet den Anfang nicht ab, wenn sofort gesprochen wird", () => {
    const signal = concat([speech(RATE), noise(RATE)]);
    const { result } = run(signal);
    expect(result.speechDetected).toBe(true);
    expect(result.startSample).toBe(0);
  });

  it("hält Post-Roll nach dem Sprachende und schneidet keine Endsilbe ab", () => {
    const lead = Math.round(RATE * 0.5);
    const speechLen = Math.round(RATE * 1.2);
    const signal = concat([noise(lead), speech(speechLen), noise(RATE * 2)]);
    const { result } = run(signal);
    const speechEnd = lead + speechLen;
    expect(result.endSample).toBeGreaterThan(speechEnd + RATE * 0.25);
    expect(ms(result.endSample - speechEnd)).toBeLessThanOrEqual(700);
  });

  it("beendet nicht bei kurzen Wortpausen", () => {
    const signal = concat([
      noise(RATE * 0.3),
      speech(RATE * 0.5),
      noise(Math.round(RATE * 0.2)),
      speech(RATE * 0.5),
      noise(RATE * 2),
    ]);
    const { result } = run(signal);
    const secondEnd = Math.round(RATE * (0.3 + 0.5 + 0.2 + 0.5));
    expect(result.endSample).toBeGreaterThan(secondEnd);
  });

  it("erkennt leise Sprache", () => {
    const signal = concat([noise(RATE * 0.5, 0.0015), speech(RATE, 0.03), noise(RATE * 1.5, 0.0015)]);
    const { result } = run(signal);
    expect(result.speechDetected).toBe(true);
  });

  it("erkennt laute und sehr kurze Sprache", () => {
    const loud = concat([noise(RATE * 0.4), speech(RATE * 0.8, 0.9), noise(RATE)]);
    expect(run(loud).result.speechDetected).toBe(true);
    const short = concat([noise(RATE * 0.4), speech(Math.round(RATE * 0.35)), noise(RATE * 1.5)]);
    expect(run(short).result.speechDetected).toBe(true);
  });

  it("hält Hintergrundrauschen nicht für Sprache", () => {
    const { result } = run(noise(RATE * 3, 0.004));
    expect(result.speechDetected).toBe(false);
    // Fallback: gesamte Aufnahme bleibt erhalten
    expect(result.startSample).toBe(0);
  });
});
