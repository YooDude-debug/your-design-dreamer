import { describe, expect, it } from "vitest";

import { faceAnimationFromState, parseAvatarMode } from "@/lib/orb-avatar";
import type { OrbState } from "@/lib/orb-core";

const base: OrbState = {
  curiosity: 0.5,
  joy: 0.5,
  fear: 0.2,
  trust: 0.5,
  uncertainty: 0.3,
  energy: 0.5,
};

describe("orb avatar animation", () => {
  it("bleibt in subtilen Grenzen", () => {
    const a = faceAnimationFromState(base, "idle");
    expect(a.eyeOpen).toBeLessThanOrEqual(1);
    expect(a.eyeOpen).toBeGreaterThan(0.8);
    expect(Math.abs(a.tilt)).toBeLessThanOrEqual(1.6);
    expect(a.smile).toBeLessThanOrEqual(0.7);
  });

  it("Freude erzeugt mehr Lächeln als Angst", () => {
    const happy = faceAnimationFromState({ ...base, joy: 0.9, fear: 0 }, "idle");
    const afraid = faceAnimationFromState({ ...base, joy: 0.1, fear: 0.9 }, "idle");
    expect(happy.smile).toBeGreaterThan(afraid.smile);
    expect(afraid.tension).toBeGreaterThan(happy.tension);
  });

  it("Neugier öffnet die Augen weiter", () => {
    const curious = faceAnimationFromState({ ...base, curiosity: 1 }, "idle");
    const calm = faceAnimationFromState({ ...base, curiosity: 0 }, "idle");
    expect(curious.eyeOpen).toBeGreaterThan(calm.eyeOpen);
  });

  it("Unsicherheit hebt die Augenbrauen", () => {
    const unsure = faceAnimationFromState({ ...base, uncertainty: 1 }, "idle");
    expect(unsure.brow).toBeGreaterThan(faceAnimationFromState(base, "idle").brow);
  });

  it("hohe Energie blinzelt häufiger und atmet schneller", () => {
    const high = faceAnimationFromState({ ...base, energy: 1 }, "idle");
    const low = faceAnimationFromState({ ...base, energy: 0 }, "idle");
    expect(high.blinkBase).toBeLessThan(low.blinkBase);
    expect(high.breathSeconds).toBeLessThan(low.breathSeconds);
  });

  it("Nachdenken lässt den Blick mehr wandern", () => {
    expect(faceAnimationFromState(base, "thinking").gazeRange).toBeGreaterThan(
      faceAnimationFromState(base, "idle").gazeRange,
    );
  });

  it("speichert nur gültige Auswahl", () => {
    expect(parseAvatarMode("face")).toBe("face");
    expect(parseAvatarMode("emoji")).toBe("emoji");
    expect(parseAvatarMode(null)).toBe("emoji");
    expect(parseAvatarMode("unsinn")).toBe("emoji");
  });
});
