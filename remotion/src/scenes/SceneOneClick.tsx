import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { GlobeSvg, project, type Cam } from "../components/GlobeSvg";
import { SlangChip } from "../components/SlangChip";
import { BrandLockup } from "../components/BrandLockup";

/**
 * "Ein Klick" – Promo 9:16 (11 s).
 *
 * Visuelle Grundlage ist bewusst der bestehende Globe-Spot: gleicher Globus,
 * gleiche SlangTag-Chips, gleiche Vignette und dasselbe Branding-Lockup.
 * Neu sind ausschliesslich Hook, Textablauf und Timing.
 */

const W = 1080;
const H = 1920;
const CX = W / 2;
const CY = 940;

// frame, lon, lat, scale – kurzer Push-in auf den Hook, dann Welt-Ueberblick.
const CAM: [number, number, number, number][] = [
  [0, 13.4, 47, 1180],
  [26, 13.4, 52.5, 1520],
  [92, 30, 40, 900],
  [150, 90, 22, 740],
  [210, 170, 8, 690],
  [270, 250, 16, 720],
  [330, 320, 22, 760],
];

function camAt(frame: number): Cam {
  const f = CAM.map((k) => k[0]);
  const opt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  const lon = interpolate(frame, f, CAM.map((k) => k[1]), opt);
  const lat = interpolate(frame, f, CAM.map((k) => k[2]), opt);
  const scale = interpolate(frame, f, CAM.map((k) => k[3]), opt);
  return { lon, lat, scale: scale * (1 + Math.sin(frame / 24) * 0.007) };
}

type Tag = { label: string; lon: number; lat: number; at: number; kind?: "community" | "creator" };

const TAGS: Tag[] = [
  { label: "moin", lon: 13.4, lat: 52.5, at: 14 },
  { label: "wesh", lon: 2.35, lat: 48.85, at: 96 },
  { label: "innit", lon: -0.13, lat: 51.5, at: 102 },
  { label: "re", lon: 23.7, lat: 38.0, at: 108 },
  { label: "abi", lon: 28.98, lat: 41.0, at: 118 },
  { label: "bindaas", lon: 72.87, lat: 19.07, at: 152 },
  { label: "yabai", lon: 139.7, lat: 35.7, at: 162 },
  { label: "daebak", lon: 126.98, lat: 37.57, at: 172, kind: "creator" },
  { label: "arvo", lon: 151.2, lat: -33.87, at: 186 },
  { label: "deadass", lon: -74.0, lat: 40.7, at: 216 },
  { label: "chido", lon: -99.1, lat: 19.4, at: 226 },
  { label: "mano", lon: -43.2, lat: -22.9, at: 236 },
  { label: "che", lon: -58.4, lat: -34.6, at: 246 },
  { label: "wahala", lon: 3.4, lat: 6.5, at: 288 },
  { label: "shukran", lon: 55.27, lat: 25.2, at: 296 },
];

const AnchoredTag: React.FC<{ tag: Tag; cam: Cam; frame: number; fps: number; playing?: boolean }> = ({
  tag,
  cam,
  frame,
  fps,
  playing = false,
}) => {
  const p = project(tag.lon, tag.lat, cam, CX, CY);
  if (!p) return null;
  const local = frame - tag.at;
  if (local < 0) return null;
  const pop = spring({ frame: local, fps, config: { damping: 13, stiffness: 200 } });
  const depth = interpolate(p.z, [0.02, 1], [0.35, 1]);
  const pulse = 1 + Math.sin(frame / 7) * (playing ? 0.06 : 0.02);

  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: `translate(-50%,-100%) scale(${pulse})`,
        opacity: pop * depth,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -14,
          width: 20,
          height: 20,
          marginLeft: -10,
          borderRadius: 999,
          background: C.green,
          boxShadow: `0 0 30px ${C.green}`,
        }}
      />
      <SlangChip
        label={tag.label}
        kind={tag.kind ?? "community"}
        frame={frame}
        playing={playing}
        scale={0.78 * interpolate(pop, [0, 1], [0.6, 1])}
      />
    </div>
  );
};

/** Linear-Mix zweier Hex-Farben – fuer weiche Farbuebergaenge ohne neue Farben. */
function mix(a: string, b: string, t: number): string {
  const hex = (s: string) => {
    const h = s.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [
      parseInt(v.slice(0, 2), 16),
      parseInt(v.slice(2, 4), 16),
      parseInt(v.slice(4, 6), 16),
    ] as const;
  };
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const k = Math.max(0, Math.min(1, t));
  const c = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

/**
 * Zeile mit weichem Auftritt. Die Zielfarbe wird ueber den Einstieg langsam
 * eingemischt (Start: neutrales Ink), damit kein harter Farbsprung entsteht.
 */
const Line: React.FC<{
  text: string;
  start: number;
  end: number;
  frame: number;
  fps: number;
  size: number;
  color?: string;
  weight?: number;
  letter?: number;
}> = ({ text, start, end, frame, fps, size, color = C.ink, weight = 700, letter = -2 }) => {
  const local = frame - start;
  if (local < 0 || frame > end) return null;
  const inn = spring({ frame: local, fps, config: { damping: 15, stiffness: 220 } });
  const out = interpolate(frame, [end - 16, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Farb-Crossfade: langsamer als die Bewegung, damit die Farbe "einschwebt".
  const tint = interpolate(local, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shown = color === C.ink ? C.ink : mix(C.ink, color, tint);
  return (
    <div
      style={{
        color: shown,
        fontSize: size,
        lineHeight: 1.06,
        fontWeight: weight,
        letterSpacing: letter,
        opacity: inn * out,
        filter: `blur(${interpolate(inn, [0, 1], [10, 0])}px)`,
        transform: `translateY(${interpolate(inn, [0, 1], [34, 0])}px)`,
        textShadow: "0 8px 40px rgba(0,0,0,0.85), 0 0 70px rgba(0,0,0,0.7)",
      }}
    >
      {text}
    </div>
  );
};

export const SceneOneClick: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cam = camAt(frame);

  // Hook: Tap-Ring auf Berlin in den ersten Frames.
  const tap = project(13.4, 52.5, cam, CX, CY);
  const ring = interpolate(frame, [4, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Weicher, deutlich dezenterer Kontrast-Impuls (Weiss nur als Akzent).
  const flash = interpolate(frame, [2, 10, 15, 34], [0, 0.12, 0.08, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Laengerer Uebergang in die Endcard, damit kein harter Schnitt entsteht.
  const endIn = interpolate(frame, [252, 278], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#000000", overflow: "hidden" }}>
      <GlobeSvg cam={cam} width={W} height={H} cx={CX} cy={CY} />

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.9) 100%)",
        }}
      />

      {tap && frame >= 4 && frame < 42 && (
        <div
          style={{
            position: "absolute",
            left: tap.x,
            top: tap.y,
            width: 40 + ring * 420,
            height: 40 + ring * 420,
            marginLeft: -(20 + ring * 210),
            marginTop: -(20 + ring * 210),
            borderRadius: 999,
            border: `5px solid ${mix(C.green, C.greenSoft, ring * 0.6)}`,
            opacity: Math.pow(1 - ring, 1.7) * 0.85,
          }}
        />
      )}

      {TAGS.map((t) => (
        <AnchoredTag
          key={t.label}
          tag={t}
          cam={cam}
          frame={frame}
          fps={fps}
          playing={t.label === "moin" && frame < 90}
        />
      ))}

      {/* Textblock: links-gebunden, oben – nie zentriert-langweilig. */}
      <div
        style={{
          position: "absolute",
          left: 76,
          right: 90,
          top: 150,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Line text="Ein Klick –" start={2} end={92} frame={frame} fps={fps} size={124} color={C.green} />
        <Line text="und du kennst" start={16} end={92} frame={frame} fps={fps} size={98} />
        <Line text="jeden Slang der Welt." start={26} end={92} frame={frame} fps={fps} size={98} />

        {/* Schneller Dreier-Schlag */}
        <Line text="Bedeutung." start={96} end={150} frame={frame} fps={fps} size={112} />
        <Line text="Aussprache." start={108} end={150} frame={frame} fps={fps} size={112} color={C.greenSoft} />
        <Line text="Herkunft." start={120} end={150} frame={frame} fps={fps} size={112} />

        <Line text="Immer aktuell." start={158} end={252} frame={frame} fps={fps} size={110} />
        <Line text="Überall." start={172} end={252} frame={frame} fps={fps} size={132} color={C.green} />
      </div>

      {/* Endcard */}
      <AbsoluteFill
        style={{
          background: "#000000",
          opacity: endIn,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {endIn > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 52 }}>
            <div
              style={{
                color: C.ink,
                fontSize: 78,
                fontWeight: 700,
                letterSpacing: -1.5,
                opacity: interpolate(frame, [266, 282], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Das ist
            </div>
            <BrandLockup
              frame={frame}
              appear={interpolate(frame, [272, 292], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}
              sloganAppear={interpolate(frame, [290, 308], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}
              markWidth={230}
              textHeight={132}
              energy={0.9}
            />
            <div
              style={{
                opacity: interpolate(frame, [306, 322], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                color: C.ink,
                fontSize: 46,
                fontWeight: 600,
                letterSpacing: 3,
              }}
            >
              www.y-dude.com
            </div>
          </div>
        )}
      </AbsoluteFill>

      <AbsoluteFill style={{ background: C.ink, opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
