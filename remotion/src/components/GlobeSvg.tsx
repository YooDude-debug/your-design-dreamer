import React, { useMemo } from "react";
import { C } from "../theme";
import landRaw from "../data/land-50m.json";
import bordersRaw from "../data/borders-50m.json";

/**
 * Y-Dude Globe als SVG-Orthografie (nur fuer den Werbespot).
 *
 * Bewusst eigenstaendig: die App-Engine (three.js) laeuft nicht im
 * Remotion-Renderer. Optik uebernimmt die Y-Dude-Sprache: dunkelgruene
 * Landmassen, hellgruene Kuestenlinie, blaue Innengrenzen, gruene Atmosphaere.
 */

type Ring = [number, number][];
const land = landRaw as unknown as Ring[][];
const borders = bordersRaw as unknown as Ring[];

const RAD = Math.PI / 180;

export type Cam = { lon: number; lat: number; scale: number };

/** Orthografische Projektion; `null` wenn der Punkt auf der Rueckseite liegt. */
export function project(
  lon: number,
  lat: number,
  cam: Cam,
  cx: number,
  cy: number,
): { x: number; y: number; z: number } | null {
  const l = (lon - cam.lon) * RAD;
  const p = lat * RAD;
  const p0 = cam.lat * RAD;
  const cosP = Math.cos(p);
  const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cosP * Math.cos(l);
  if (z <= 0.02) return null;
  const x = cosP * Math.sin(l);
  const y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cosP * Math.cos(l);
  return { x: cx + cam.scale * x, y: cy - cam.scale * y, z };
}

/** Linie: unsichtbare Punkte unterbrechen den Pfad (Kuesten/Grenzen). */
function ringToPath(ring: Ring, cam: Cam, cx: number, cy: number, step: number): string {
  let d = "";
  let open = false;
  for (let i = 0; i < ring.length; i += step) {
    const pt = ring[i]!;
    const p = project(pt[0], pt[1], cam, cx, cy);
    if (!p) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    open = true;
  }
  return d;
}

/**
 * Flaeche: Punkte hinter dem Horizont werden auf den Kugelrand geklemmt.
 * Ohne dieses Clipping schliesst SVG die Flaeche mit einer geraden Sehne –
 * sichtbar als harte Kante quer ueber den Globus.
 */
function ringToFillPath(ring: Ring, cam: Cam, cx: number, cy: number, step: number): string {
  const l0 = cam.lon * RAD;
  const p0 = cam.lat * RAD;
  let d = "";
  let first = true;
  for (let i = 0; i < ring.length; i += step) {
    const pt = ring[i]!;
    const l = pt[0] * RAD - l0;
    const p = pt[1] * RAD;
    const cosP = Math.cos(p);
    const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * cosP * Math.cos(l);
    let x = cosP * Math.sin(l);
    let y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * cosP * Math.cos(l);
    if (z <= 0) {
      const len = Math.hypot(x, y) || 1;
      x /= len;
      y /= len;
    }
    const sx = cx + cam.scale * x;
    const sy = cy - cam.scale * y;
    d += `${first ? "M" : "L"}${sx.toFixed(1)} ${sy.toFixed(1)} `;
    first = false;
  }
  return d ? `${d}Z ` : "";
}


export const GlobeSvg: React.FC<{
  cam: Cam;
  width: number;
  height: number;
  cx: number;
  cy: number;
}> = ({ cam, width, height, cx, cy }) => {
  // Weit weg = groeberer Schritt (Performance), nah = feiner (Schaerfe).
  const step = cam.scale > 1200 ? 1 : cam.scale > 800 ? 2 : 3;
  const borderOpacity = cam.scale > 1200 ? 0.9 : cam.scale > 800 ? 0.6 : 0.34;

  const landFill = useMemo(() => {
    let d = "";
    for (const poly of land) {
      for (const ring of poly) {
        if (ring.length < 6) continue;
        d += ringToFillPath(ring, cam, cx, cy, step);
      }
    }
    return d;
  }, [cam.lon, cam.lat, cam.scale, step, cx, cy]);

  const landPath = useMemo(() => {
    let d = "";
    for (const poly of land) {
      for (const ring of poly) {
        if (ring.length < 6) continue;
        d += ringToPath(ring, cam, cx, cy, step);
      }
    }
    return d;
  }, [cam.lon, cam.lat, cam.scale, step, cx, cy]);


  const borderPath = useMemo(() => {
    let d = "";
    for (const line of borders) {
      if (line.length < 3) continue;
      d += ringToPath(line, cam, cx, cy, step);
    }
    return d;
  }, [cam.lon, cam.lat, cam.scale, step, cx, cy]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      <defs>
        {/* userSpaceOnUse: verhindert Banding-Kanten bei sehr grossen Kreisen */}
        <radialGradient
          id="ocean"
          gradientUnits="userSpaceOnUse"
          cx={cx - cam.scale * 0.28}
          cy={cy - cam.scale * 0.34}
          r={cam.scale * 1.5}
        >
          <stop offset="0%" stopColor="#08251e" />
          <stop offset="55%" stopColor="#04140f" />
          <stop offset="100%" stopColor="#010705" />
        </radialGradient>
        <radialGradient
          id="atmo"
          gradientUnits="userSpaceOnUse"
          cx={cx}
          cy={cy}
          r={cam.scale * 1.14}
        >
          <stop offset="74%" stopColor="rgba(47,240,140,0)" />
          <stop offset="93%" stopColor="rgba(47,240,140,0.18)" />
          <stop offset="100%" stopColor="rgba(47,240,140,0)" />
        </radialGradient>
      </defs>

      <circle cx={cx} cy={cy} r={cam.scale} fill="#04140f" />
      <circle cx={cx} cy={cy} r={cam.scale} fill="url(#ocean)" />
      <circle cx={cx} cy={cy} r={cam.scale * 1.14} fill="url(#atmo)" />
      <circle
        cx={cx}
        cy={cy}
        r={cam.scale}
        fill="none"
        stroke="rgba(47,240,140,0.35)"
        strokeWidth={2}
      />

      <clipPath id="sphere">
        <circle cx={cx} cy={cy} r={cam.scale} />
      </clipPath>

      <g clipPath="url(#sphere)">
        <path d={landFill} fill="rgba(20,86,58,0.92)" stroke="none" fillRule="nonzero" />
        <path
          d={landPath}
          fill="none"
          stroke={C.greenSoft}
          strokeOpacity={0.45}
          strokeWidth={1}
        />
        <path
          d={borderPath}
          fill="none"
          stroke="#4aa8ff"
          strokeOpacity={borderOpacity}
          strokeWidth={1.4}
        />
      </g>
    </svg>
  );
};
