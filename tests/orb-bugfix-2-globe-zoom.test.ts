// BUG 2: Memory-Kugel bleibt nach Cognitive-Updates erreichbar; Benutzer-Zoom bleibt.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateFramingDistance,
  clampZoomDistance,
  memoryMinDistance,
  nextFramedDistance,
} from "@/lib/orb-knowledge-graph/graph-engine";

const FOV = 50;
const memoryMin = memoryMinDistance(10);
const small = calculateFramingDistance(10, FOV, 1);
const big = calculateFramingDistance(41.5, FOV, 1);

describe("BUG 2 – Globe Zoom", () => {
  it("min. Abstand: knapp vor der Memory-Kugel, nie darin", () => {
    expect(memoryMin).toBeGreaterThan(10);
    expect(memoryMin).toBeLessThanOrEqual(11);
    expect(clampZoomDistance(1, memoryMin, big)).toBe(memoryMin);
    // deutlich näher als der frühere Wert (Rahmen × 0,55 ≈ 14)
    expect(memoryMin).toBeLessThan(calculateFramingDistance(10, FOV, 1) * 0.55 - 2);
  });
  it("min. Abstand ungültiger Radius → sicherer Standard", () => {
    expect(memoryMinDistance(Number.NaN)).toBe(memoryMinDistance(10));
    expect(memoryMinDistance(0)).toBe(memoryMinDistance(10));
  });
  it("max. Abstand folgt den äußeren Ebenen", () => {
    expect(clampZoomDistance(1e6, memoryMin, big)).toBeCloseTo(big * 2.5);
  });
  it("ohne manuellen Zoom: neuer Rahmen", () =>
    expect(
      nextFramedDistance({
        userZoomed: false,
        distance: 5,
        prevFraming: small,
        framing: big,
        min: memoryMin,
        keepRatio: false,
      }),
    ).toBe(big));
  it("Layer-/Cognitive-Update zerstört manuellen Zoom nicht", () =>
    expect(
      nextFramedDistance({
        userZoomed: true,
        distance: memoryMin + 1,
        prevFraming: small,
        framing: big,
        min: memoryMin,
        keepRatio: false,
      }),
    ).toBe(memoryMin + 1));
  it("Resize hält den manuellen Abstand (kein Herauszoomen)", () => {
    const src = readFileSync("src/lib/orb-knowledge-graph/graph-engine.ts", "utf8");
    expect(src).toContain("this.updateFraming(false);");
    expect(src).not.toContain("this.updateFraming(true)");
    expect(
      nextFramedDistance({
        userZoomed: true,
        distance: memoryMin,
        prevFraming: small,
        framing: small * 1.2,
        min: memoryMin,
        keepRatio: false,
      }),
    ).toBe(memoryMin);
  });
});
