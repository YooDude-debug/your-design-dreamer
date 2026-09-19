/**
 * ORB Avatar – ruhigere, koordinierte Bewegung (rein visuell).
 * Grundlage: docs/ORB_AVATAR_ANIMATION_ANALYSIS_2026-09-19.md
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  BLINK_MAX_GAP_MS,
  BLINK_MIN_GAP_MS,
  BLINK_SPEECH_DEFER_MS,
  LID_OFFSET_MS,
  SPEECH_BUSY_LEVEL,
  SPEECH_LEVEL_STEP,
  breathVisible,
  faceAnimationFromState,
  gazeHoldMs,
  nextBlinkDelay,
  smoothSpeechLevel,
} from "@/integrations/y-dude-orb/avatar";
import type { OrbState } from "@/orb-core/core";

const base: OrbState = {
  curiosity: 0.5,
  joy: 0.5,
  fear: 0.2,
  trust: 0.5,
  uncertainty: 0.3,
  energy: 0.5,
};

const FACE = readFileSync("src/components/orb/OrbRealFace.tsx", "utf8");
const VOICE = readFileSync("src/components/orb/OrbVoice.tsx", "utf8");

describe("Blinkabstand", () => {
  it("hält den Mindestabstand von 3 Sekunden in jedem Zustand ein", () => {
    const states: OrbState[] = [
      base,
      { ...base, energy: 1, fear: 1, trust: 0 },
      { ...base, energy: 0, fear: 0, trust: 1 },
    ];
    for (const s of states) {
      for (const activity of ["idle", "listening", "thinking", "speaking"] as const) {
        const anim = faceAnimationFromState(s, activity);
        for (const rand of [0, 0.25, 0.5, 0.75, 1]) {
          const delay = nextBlinkDelay(anim, rand);
          expect(delay).toBeGreaterThanOrEqual(BLINK_MIN_GAP_MS);
          expect(delay).toBeLessThanOrEqual(BLINK_MAX_GAP_MS);
        }
      }
    }
  });

  it("liegt im Zielbereich von etwa 3–6,5 Sekunden und variiert", () => {
    const anim = faceAnimationFromState(base, "idle");
    expect(nextBlinkDelay(anim, 1)).toBeGreaterThan(nextBlinkDelay(anim, 0));
    expect(BLINK_MAX_GAP_MS).toBeLessThanOrEqual(6500);
  });

  it("ist nicht mehr der frühere Abstand von rund einer Sekunde", () => {
    expect(BLINK_MIN_GAP_MS).toBeGreaterThanOrEqual(3000);
  });
});

describe("Lider und Mund", () => {
  it("nutzt einen sehr kleinen, subtilen Lid-Versatz", () => {
    expect(LID_OFFSET_MS).toBeGreaterThan(0);
    expect(LID_OFFSET_MS).toBeLessThanOrEqual(80);
    expect(FACE).toContain("lidStyle(LID_OFFSET_MS");
  });

  it("verschiebt das Blinken bei starker Mundbewegung", () => {
    expect(SPEECH_BUSY_LEVEL).toBeGreaterThan(0.2);
    expect(SPEECH_BUSY_LEVEL).toBeLessThan(0.6);
    expect(BLINK_SPEECH_DEFER_MS).toBeGreaterThan(200);
    expect(FACE).toContain("speechRef.current > SPEECH_BUSY_LEVEL");
    expect(FACE).toContain("BLINK_SPEECH_DEFER_MS");
  });
});

describe("Blickbewegung", () => {
  it("hat echte Standzeiten von mehreren Sekunden", () => {
    for (const activity of ["idle", "listening", "thinking", "speaking"] as const) {
      expect(gazeHoldMs(activity, 0)).toBeGreaterThanOrEqual(2600);
      expect(gazeHoldMs(activity, 1)).toBeLessThanOrEqual(8000);
    }
  });

  it("bleibt beim Sprechen und Zuhören länger stabil als beim Nachdenken", () => {
    expect(gazeHoldMs("speaking", 0)).toBeGreaterThan(gazeHoldMs("thinking", 0));
  });
});

describe("Sprachpegel-Glättung", () => {
  it("folgt weich und springt nicht", () => {
    let level = 0;
    for (let i = 0; i < 3; i++) level = smoothSpeechLevel(level, 1);
    expect(level).toBeGreaterThan(0);
    expect(level).toBeLessThan(0.8);
  });

  it("öffnet schneller als es schliesst", () => {
    const rise = smoothSpeechLevel(0.4, 0.9) - 0.4;
    const fall = 0.4 - smoothSpeechLevel(0.4, 0);
    expect(rise).toBeGreaterThan(fall);
  });

  it("bleibt in den Grenzen 0–1", () => {
    expect(smoothSpeechLevel(1, 5)).toBeLessThanOrEqual(1);
    expect(smoothSpeechLevel(0, -3)).toBeGreaterThanOrEqual(0);
  });

  it("wird nur bei merklicher Änderung weitergegeben (keine 60-Hz-Updates)", () => {
    expect(SPEECH_LEVEL_STEP).toBeGreaterThanOrEqual(0.04);
    expect(VOICE).toContain("smoothSpeechLevel(smooth");
    expect(VOICE).toContain(">= SPEECH_LEVEL_STEP");
    expect(VOICE).not.toContain("onSpeechLevel?.(Math.min(1, rms * 4.5))");
  });

  it("weichere Mundbewegung in der Darstellung", () => {
    expect(FACE).toContain("transform 190ms ease-out");
    expect(FACE).not.toContain("transform 70ms linear");
  });
});

describe("Atmung", () => {
  it("nur bei ausreichender Energie oder beim Sprechen sichtbar", () => {
    expect(breathVisible({ ...base, energy: 0 }, "idle")).toBe(false);
    expect(breathVisible({ ...base, energy: 0 }, "speaking")).toBe(true);
    expect(breathVisible({ ...base, energy: 0.6 }, "idle")).toBe(true);
  });

  it("die Atembewegung ist deutlich dezenter als vorher", () => {
    expect(FACE).toContain("translateY(-0.14%) scale(1.0015)");
    expect(FACE).not.toContain("translateY(-0.35%) scale(1.004)");
  });
});

describe("Koordination und Performance", () => {
  it("verwendet einen einzigen Bewegungsablauf statt vier unabhängiger Zeitgeber", () => {
    expect(FACE).not.toContain("blinkTimer");
    expect(FACE).not.toContain("gazeTimer");
    expect(FACE).toContain("const timer = useRef");
    // Blink folgt auf eine Standzeit, Blick folgt auf das Blinken.
    expect(FACE).toContain("setTimeout(blinkPhase, gazeHoldMs(activity))");
    expect(FACE).toContain("setTimeout(moveGaze, nextBlinkDelay(anim))");
  });

  it("nutzt keine Frame-Loop und keine neue Animationsbibliothek im Gesicht", () => {
    expect(FACE).not.toContain("requestAnimationFrame");
    expect(FACE).not.toMatch(/framer-motion|gsap|lottie/);
  });

  it("die bestehende Sprachaufnahme bleibt erhalten", () => {
    expect(VOICE).toContain("getByteTimeDomainData");
    expect(VOICE).toContain("requestAnimationFrame(loop)");
  });
});
