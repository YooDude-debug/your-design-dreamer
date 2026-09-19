import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  distance,
  isDefaultViewport,
  midpoint,
  normalizeWheelDelta,
  panBy,
  toGraphPoint,
  transformOf,
  wheelZoomFactor,
  zoomAt,
  zoomPercent,
} from "@/components/orb/graph-viewport";

const graph = readFileSync("src/components/orb/OrbGraph.tsx", "utf8");
const RECT = { left: 0, top: 0, width: 320, height: 215 };

describe("ORB Spiderweb Zoom/Pan – reine Ansichtsmathematik", () => {
  it("hält den Zoom in sinnvollen Grenzen", () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(MIN_ZOOM).toBeLessThan(1);
    expect(MAX_ZOOM).toBeGreaterThanOrEqual(4);
  });

  it("normalisiert Wheel-Deltas und zoomt proportional (kein Fixfaktor)", () => {
    expect(normalizeWheelDelta(3, 1)).toBe(48);
    expect(normalizeWheelDelta(3, 2)).toBe(300);
    expect(normalizeWheelDelta(120, 0)).toBe(120);
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(-200)).toBeGreaterThan(wheelZoomFactor(-100));
  });

  it("Desktop Wheel-Zoom IN/OUT bleibt am Cursor verankert", () => {
    const zoomedIn = zoomAt(DEFAULT_VIEWPORT, 2, 100, 50);
    expect(zoomedIn.zoom).toBeCloseTo(2, 6);
    // Ankerpunkt bleibt unter dem Cursor: x' = anchor*(1-k) + x*k
    expect(zoomedIn.x + 100 * zoomedIn.zoom).toBeCloseTo(100, 6);
    expect(zoomedIn.y + 50 * zoomedIn.zoom).toBeCloseTo(50, 6);

    const zoomedOut = zoomAt(zoomedIn, 0.5, 100, 50);
    expect(zoomedOut.zoom).toBeCloseTo(1, 6);
    expect(zoomedOut.x).toBeCloseTo(0, 6);
    expect(zoomedOut.y).toBeCloseTo(0, 6);
  });

  it("Mobile Pinch IN/OUT nutzt die Mitte der beiden Finger", () => {
    const a = { x: 100, y: 100 };
    const b = { x: 200, y: 100 };
    const mid = midpoint(a, b);
    expect(mid).toEqual({ x: 150, y: 100 });
    expect(distance(a, b)).toBe(100);

    const spreadFactor = distance({ x: 80, y: 100 }, { x: 220, y: 100 }) / distance(a, b);
    const zoomedIn = zoomAt(DEFAULT_VIEWPORT, spreadFactor, mid.x, mid.y);
    expect(zoomedIn.zoom).toBeCloseTo(1.4, 6);
    expect(zoomedIn.x + mid.x * zoomedIn.zoom).toBeCloseTo(mid.x, 6);

    const pinchFactor = distance({ x: 130, y: 100 }, { x: 170, y: 100 }) / distance(a, b);
    const zoomedOut = zoomAt({ zoom: 2, x: -150, y: -100 }, pinchFactor, mid.x, mid.y);
    expect(zoomedOut.zoom).toBeCloseTo(0.8, 6);
    expect(zoomedOut.zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
  });

  it("Pan verschiebt nur die Ansicht, nicht den Zoom", () => {
    const panned = panBy({ zoom: 2, x: 10, y: 20 }, -30, 15);
    expect(panned).toEqual({ zoom: 2, x: -20, y: 35 });
  });

  it("rechnet Client-Pixel korrekt in die feste viewBox um", () => {
    const point = toGraphPoint(160, 107.5, RECT, 640, 430);
    expect(point.x).toBeCloseTo(320, 6);
    expect(point.y).toBeCloseTo(215, 6);
  });

  it("Reset stellt Standardzoom und Standardposition her", () => {
    expect(DEFAULT_VIEWPORT).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(isDefaultViewport(DEFAULT_VIEWPORT)).toBe(true);
    expect(isDefaultViewport(zoomAt(DEFAULT_VIEWPORT, 2, 10, 10))).toBe(false);
    expect(zoomPercent(1)).toBe("100%");
    expect(zoomPercent(2.5)).toBe("250%");
  });

  it("erzeugt einen gemeinsamen SVG-Transform", () => {
    expect(transformOf({ zoom: 1.5, x: -20, y: 10 })).toBe("translate(-20 10) scale(1.5)");
  });
});

describe("ORB Spiderweb Zoom/Pan – Einbindung in die Darstellung", () => {
  it("skaliert Nodes und Connections über einen gemeinsamen Transform", () => {
    expect(graph).toContain('data-testid="orb-graph-viewport"');
    expect(graph).toContain("transform={transformOf(viewport)}");
    // Der Transform liegt vor den Verbindungen und Knoten im selben <g>.
    const viewportIndex = graph.indexOf('data-testid="orb-graph-viewport"');
    expect(viewportIndex).toBeLessThan(graph.indexOf('data-testid="orb-memory-connection"'));
    expect(viewportIndex).toBeLessThan(graph.indexOf('data-testid="orb-memory-node"'));
  });

  it("nutzt Pointer Events für Maus, Touch und Pen", () => {
    for (const handler of ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel"]) {
      expect(graph).toContain(handler);
    }
    expect(graph).toContain("pointersRef");
    expect(graph).toContain("gestureRef");
  });

  it("verhindert Seiten-Scrollen beim Pinch/Wheel über dem Graphen", () => {
    expect(graph).toContain("touch-none");
    expect(graph).toContain('addEventListener("wheel", onWheel, { passive: false })');
    expect(graph).toContain("event.preventDefault()");
  });

  it("erhält Klick/Auswahl und unterdrückt nur echtes Ziehen", () => {
    expect(graph).toContain("selectNode(node.id, isSelected)");
    expect(graph).toContain("movedRef.current > 5");
    expect(graph).toContain("setSelectedId(isSelected ? null : nodeId)");
    expect(graph).toContain('data-testid="orb-memory-detail"');
  });

  it("bietet Reset sowie kompakte Zoom-Bedienelemente außerhalb des Transforms", () => {
    expect(graph).toContain('data-testid="orb-graph-reset-view"');
    expect(graph).toContain("setViewport(DEFAULT_VIEWPORT)");
    expect(graph).toContain('data-testid="orb-graph-zoom-in"');
    expect(graph).toContain('data-testid="orb-graph-zoom-out"');
    expect(graph).toContain('data-testid="orb-graph-zoom-level"');
    expect(graph.indexOf("</g>")).toBeLessThan(graph.indexOf('data-testid="orb-graph-reset-view"'));
  });

  it("führt keine neuen ORB-Berechnungen ein", () => {
    const viewportModule = readFileSync("src/components/orb/graph-viewport.ts", "utf8");
    for (const forbidden of [
      "supabase",
      "orb-sdk",
      "orb-core",
      "node.importance",
      "scoreImportance",
    ]) {
      expect(viewportModule).not.toContain(forbidden);
    }
  });
});
