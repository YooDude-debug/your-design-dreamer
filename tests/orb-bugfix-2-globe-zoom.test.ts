// BUG 2: Memory-Kugel bleibt nach Cognitive-Updates erreichbar; Benutzer-Zoom bleibt.
import { describe, expect, it } from "vitest";
import {
  calculateFramingDistance,
  clampZoomDistance,
  nextFramedDistance,
} from "@/lib/orb-knowledge-graph/graph-engine";

const FOV = 50;
const memoryMin = calculateFramingDistance(10, FOV, 1) * 0.55;
const small = calculateFramingDistance(10, FOV, 1);
const big = calculateFramingDistance(41.5, FOV, 1);

describe("BUG 2 – Globe Zoom", () => {
  it("min. Abstand hängt nur an der Memory-Kugel, nicht an äußeren Ringen", () => {
    expect(clampZoomDistance(1, memoryMin, big)).toBe(memoryMin);
    expect(memoryMin).toBeLessThan(big * 0.55);
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
  it("Cognitive-Update zerstört manuellen Zoom nicht", () =>
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
  it("Resize hält das Zoomverhältnis", () => {
    const d = nextFramedDistance({
      userZoomed: true,
      distance: small,
      prevFraming: small,
      framing: small * 1.2,
      min: memoryMin,
      keepRatio: true,
    });
    expect(d).toBeCloseTo(small * 1.2);
  });
});
