import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";

type Node = { x: number; y: number; label: string; img: string; color: string };

const NODES: Node[] = [
  { x: 300, y: 620, label: "Rostock", img: "rostock.jpg", color: C.green },
  { x: 790, y: 830, label: "Berlin", img: "berlin.jpg", color: C.green },
  { x: 250, y: 1130, label: "Athen", img: "athens.jpg", color: C.cyan },
  { x: 760, y: 1350, label: "Tokio", img: "tokyo.jpg", color: C.blue },
  { x: 330, y: 1580, label: "Rio", img: "rio.jpg", color: C.cyan },
];

const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 2],
  [1, 3],
];

/** Szene 3 – lokaler Slang verbindet Menschen weltweit. */
export const SceneConnect: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 26) * 10;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 40% at 50% 55%, ${C.green}14, rgba(0,0,0,0) 70%)`,
        }}
      />

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {LINKS.map(([a, b], i) => {
          const A = NODES[a];
          const B = NODES[b];
          const mx = (A.x + B.x) / 2 + (i % 2 === 0 ? 150 : -150);
          const my = (A.y + B.y) / 2;
          const len = 1400;
          const t = interpolate(frame - 8 - i * 7, [0, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <path
              key={i}
              d={`M ${A.x} ${A.y} Q ${mx} ${my} ${B.x} ${B.y}`}
              stroke={C.green}
              strokeOpacity={0.5}
              strokeWidth={2.5}
              fill="none"
              strokeDasharray={len}
              strokeDashoffset={len * (1 - t)}
            />
          );
        })}
      </svg>

      {NODES.map((n, i) => {
        const t = interpolate(frame - 4 - i * 8, [0, 24], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const size = 148;
        return (
          <div
            key={n.label}
            style={{
              position: "absolute",
              left: n.x - size / 2,
              top: n.y - size / 2 + drift * (i % 2 === 0 ? 1 : -1),
              opacity: t,
              transform: `scale(${0.8 + t * 0.2})`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                borderRadius: 999,
                overflow: "hidden",
                border: `2px solid ${n.color}99`,
                boxShadow: `0 0 46px ${n.color}44`,
              }}
            >
              <Img
                src={staticFile(`images/${n.img}`)}
                style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(1.25) saturate(1.05)" }}
              />
            </div>
            <div style={{ color: C.ink, fontSize: 26, marginTop: 12, fontWeight: 600 }}>{n.label}</div>
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          top: 220,
          opacity: interpolate(frame, [14, 34], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        <div style={{ color: C.muted, fontSize: 28, letterSpacing: 6, textTransform: "uppercase" }}>
          Lokaler Slang · Menschen · Welt
        </div>
        <div style={{ color: C.ink, fontSize: 66, fontWeight: 700, letterSpacing: -1.8, marginTop: 12 }}>
          Deine Sprache
          <br />
          verbindet.
        </div>
      </div>
    </AbsoluteFill>
  );
};
