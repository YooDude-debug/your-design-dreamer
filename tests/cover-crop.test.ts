import { describe, expect, it } from "vitest";
import {
  COVER_MAX_SCALE,
  clampCoverOffset,
  computeCoverCrop,
  coverDisplaySize,
  coverFitSize,
} from "@/lib/cover-crop";

// Rahmen 393×262 (Android-Header), Bild 4:3 – füllt die Breite, überragt die Höhe.
const base = {
  frameW: 393,
  frameH: 262,
  imageW: 1200,
  imageH: 900,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

describe("Hintergrundbild-Positionierung", () => {
  it("passt das Bild formatfüllend ein", () => {
    const fit = coverFitSize(base);
    expect(fit.w).toBeCloseTo(393);
    expect(fit.h).toBeCloseTo(294.75);
  });

  it("zeigt ohne Zoom und Verschiebung einen zentrierten Ausschnitt", () => {
    const crop = computeCoverCrop(base);
    expect(crop.w).toBeCloseTo(1);
    expect(crop.h).toBeLessThan(1);
    expect(crop.y + crop.h / 2).toBeCloseTo(0.5, 5);
  });

  it("begrenzt die Verschiebung, das Bild bleibt randlos", () => {
    const v = { ...base, offsetX: 99999, offsetY: 99999 };
    const off = clampCoverOffset(v);
    const disp = coverDisplaySize(v);
    expect(off.x).toBe(0);
    expect(off.y).toBeCloseTo((disp.h - v.frameH) / 2);
    const crop = computeCoverCrop(v);
    expect(crop.y).toBeCloseTo(0);
    expect(crop.y + crop.h).toBeLessThanOrEqual(1.000001);
  });

  it("verkleinert den Ausschnitt beim Zoomen", () => {
    const a = computeCoverCrop(base);
    const b = computeCoverCrop({ ...base, scale: 2 });
    expect(b.w).toBeLessThan(a.w);
    expect(b.h).toBeLessThan(a.h);
  });

  it("begrenzt den Zoom nach oben und unten", () => {
    expect(coverDisplaySize({ ...base, scale: 0.1 }).h).toBeCloseTo(294.75);
    expect(coverDisplaySize({ ...base, scale: 99 }).h).toBeCloseTo(294.75 * COVER_MAX_SCALE);
  });

  it("verschiebt den Ausschnitt nach oben, wenn das Bild nach unten gezogen wird", () => {
    const centered = computeCoverCrop(base);
    const moved = computeCoverCrop({ ...base, offsetY: 10 });
    expect(moved.y).toBeLessThan(centered.y);
  });

  it("nutzt bei gleichem Seitenverhältnis das ganze Bild", () => {
    const crop = computeCoverCrop({ ...base, imageW: 786, imageH: 524 });
    expect(crop).toMatchObject({ x: 0, y: 0 });
    expect(crop.w).toBeCloseTo(1);
    expect(crop.h).toBeCloseTo(1);
  });
});
