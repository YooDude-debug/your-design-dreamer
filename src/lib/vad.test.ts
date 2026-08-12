import { describe, expect, it } from "vitest";
import { VAD_POST_ROLL_MS, VAD_PRE_ROLL_MS, VoiceActivityDetector } from "@/lib/vad";

const RATE = 48000;
const MAX_SECONDS = 5;

function silence(seconds: number) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i += 1) out[i] = (Math.random() - 0.5) * 0.0006;
  return out;
}

function speech(seconds: number) {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i += 1) {
    const t = i / RATE;
    out[i] = 0.28 * Math.sin(2 * Math.PI * 160 * t) + 0.1 * Math.sin(2 * Math.PI * 320 * t);
  }
  return out;
}

/**
 * Simuliert die Recorder-Zeitsteuerung: Das Aufnahmefenster von maxSeconds
 * startet erst beim ersten VAD-Speech-Event, nicht beim Druck auf "Aufnehmen".
 */
function simulate(leadSilenceSeconds: number, speechSeconds: number) {
  const vad = new VoiceActivityDetector({
    sampleRate: RATE,
    preRollMs: VAD_PRE_ROLL_MS,
    postRollMs: VAD_POST_ROLL_MS,
  });
  const stream = new Float32Array([...silence(leadSilenceSeconds), ...speech(speechSeconds)]);
  const speechWindow = Math.round((MAX_SECONDS + VAD_POST_ROLL_MS / 1000 + 0.2) * RATE);
  const block = 2048;
  let total = 0;
  let speechStartSample: number | null = null;
  let timerStartedAt: number | null = null;
  let stoppedAt: number | null = null;

  for (let i = 0; i < stream.length; i += block) {
    const chunk = stream.subarray(i, Math.min(i + block, stream.length));
    total += chunk.length;
    vad.push(chunk as Float32Array);
    if (speechStartSample === null && vad.speechStartSample !== null) {
      speechStartSample = vad.speechStartSample;
      timerStartedAt = total;
    }
    if (vad.complete) {
      stoppedAt = total;
      break;
    }
    if (speechStartSample !== null) {
      if (total - speechStartSample >= speechWindow) {
        stoppedAt = total;
        break;
      }
    }
  }

  return {
    speechDetected: speechStartSample !== null,
    timerStartSeconds: timerStartedAt === null ? null : timerStartedAt / RATE,
    stopSeconds: stoppedAt === null ? null : stoppedAt / RATE,
    recordedSpeechSeconds:
      stoppedAt === null || speechStartSample === null
        ? null
        : (stoppedAt - speechStartSample) / RATE,
  };
}

describe("SlangTag-Aufnahme: Zeitfenster startet erst bei erkannter Sprache", () => {
  for (const lead of [0, 1, 3, 6]) {
    it(`nach ${lead}s Stille stehen volle ${MAX_SECONDS}s ab Spracherkennung zur Verfügung`, () => {
      const r = simulate(lead, 8);
      expect(r.speechDetected).toBe(true);
      expect(r.timerStartSeconds!).toBeGreaterThanOrEqual(lead - 0.2);
      // Aufnahme endet erst maxSeconds (+ Post-Roll) nach Sprachbeginn.
      expect(r.recordedSpeechSeconds!).toBeGreaterThanOrEqual(MAX_SECONDS);
      expect(r.stopSeconds!).toBeGreaterThanOrEqual(lead + MAX_SECONDS - 0.3);
    });
  }

  it("ohne Sprache wird kein Timer gestartet und nicht vorzeitig beendet", () => {
    const r = simulate(12, 0);
    expect(r.speechDetected).toBe(false);
    expect(r.timerStartSeconds).toBeNull();
    expect(r.stopSeconds).toBeNull();
  });
});
