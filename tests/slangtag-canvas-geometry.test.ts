import { describe, expect, it } from "vitest";

import { fittedImageRect } from "@/lib/slangtag-geometry";

/**
 * Overlay-Geometrie des Feed-Rahmens (framed): seit dem object-cover-Fix muss
 * die SlangTag-Ebene dieselbe Cover-Geometrie wie das gerenderte Bild nutzen.
 * Referenz-Frame: 400 x 500 px (Seitenverhältnis 4:5 wie der Feed).
 */
const W = 400;
const H = 500;

describe("fittedImageRect – cover (gerahmter Feed)", () => {
  it("A) gleiches Seitenverhältnis wie der Frame füllt exakt ohne Versatz", () => {
    const r = fittedImageRect("cover", W, H, 800, 1000);
    expect(r).toEqual({ x: 0, y: 0, w: W, h: H });
  });

  it("B) breites Bild: volle Höhe, seitlicher Crop (x negativ, Breite > Container)", () => {
    // 1600x900 (16:9) im 4:5-Frame: cover skaliert auf die Höhe.
    const r = fittedImageRect("cover", W, H, 1600, 900);
    const s = H / 900;
    expect(r.h).toBeCloseTo(H, 6);
    expect(r.w).toBeCloseTo(1600 * s, 6);
    expect(r.y).toBeCloseTo(0, 6);
    expect(r.x).toBeCloseTo((W - 1600 * s) / 2, 6);
    expect(r.x).toBeLessThan(0);
  });

  it("C) hohes Bild: volle Breite, Crop oben/unten (y negativ, Höhe > Container)", () => {
    // 900x1600 (9:16) im 4:5-Frame: cover skaliert auf die Breite.
    const r = fittedImageRect("cover", W, H, 900, 1600);
    const s = W / 900;
    expect(r.w).toBeCloseTo(W, 6);
    expect(r.h).toBeCloseTo(1600 * s, 6);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo((H - 1600 * s) / 2, 6);
    expect(r.y).toBeLessThan(0);
  });

  it("E) die Geometrie ist rein funktional – beliebig viele Tags teilen denselben Layer", () => {
    const a = fittedImageRect("cover", W, H, 900, 1600);
    const b = fittedImageRect("cover", W, H, 900, 1600);
    expect(a).toEqual(b);
  });

  it("F) Chip-Skalierungsbasis: Layer-Breite folgt der Bildskalierung (cover)", () => {
    // Hohes Bild: sichtbare Bildbreite = Containerbreite -> Basis unverändert.
    expect(fittedImageRect("cover", W, H, 900, 1600).w).toBeCloseTo(W, 6);
    // Breites Bild: Bild ist größer skaliert, Layer wächst mit dem Bild.
    expect(fittedImageRect("cover", W, H, 1600, 900).w).toBeGreaterThan(W);
  });

  it("bleibt ohne Bild- oder Container-Maße auf dem Container stehen", () => {
    expect(fittedImageRect("cover", W, H, 0, 0)).toEqual({ x: 0, y: 0, w: W, h: H });
    expect(fittedImageRect("cover", 0, 0, 900, 1600)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("fittedImageRect – contain (Arbeitsfläche, unverändert)", () => {
  it("D) pannable-Contain-Verhalten bleibt exakt wie bisher", () => {
    // Hochformat 900x1600 in 400x500: contain passt auf die Höhe ein,
    // zentriert mit seitlichen Rändern (Pillarbox).
    const r = fittedImageRect("contain", W, H, 900, 1600);
    const s = H / 1600;
    expect(r.h).toBeCloseTo(H, 6);
    expect(r.w).toBeCloseTo(900 * s, 6);
    expect(r.x).toBeCloseTo((W - 900 * s) / 2, 6);
    expect(r.y).toBeCloseTo(0, 6);
    expect(r.x).toBeGreaterThan(0);
  });

  it("breites Bild per contain: volle Breite, Ränder oben/unten", () => {
    const r = fittedImageRect("contain", W, H, 1600, 900);
    expect(r.w).toBeCloseTo(W, 6);
    expect(r.h).toBeCloseTo((900 * W) / 1600, 6);
    expect(r.y).toBeGreaterThan(0);
  });
});
