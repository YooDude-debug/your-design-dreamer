import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { GlobeSvg, type Cam } from "../../components/GlobeSvg";
import { SlangChip } from "../../components/SlangChip";
import { Backdrop } from "./parts";

const RACE = [
  { label: "na wa", meta: "Berlin", at: 6 },
  { label: "moin", meta: "Hamburg", at: 12 },
  { label: "joot", meta: "Köln", at: 18 },
  { label: "ela", meta: "Athens", at: 24 },
];

/** 🔥 SLANG CHALLENGE – "Welcher Slang gewinnt?" */
export const SceneChallenge: React.FC<{
  kicker?: string;
  headline?: string;
  race?: { label: string; meta: string; at: number }[];
  /** Grad pro Frame – klein = ruhige, kinoartige Drehung. */
  spin?: number;
}> = ({
  kicker = "🔥 Slang Challenge",
  headline = "Welcher Slang gewinnt?",
  race = RACE,
  spin = 0.5,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 15, stiffness: 180 } });
  const cam: Cam = { lon: 10 + frame * spin, lat: 24, scale: 720 + Math.sin(frame / 22) * 14 };

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.18} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.65 }}>
        <GlobeSvg cam={cam} width={1080} height={1920} cx={540} cy={1320} />
      </div>

      <AbsoluteFill style={{ padding: "220px 92px 0", alignItems: "center" }}>
        <div
          style={{
            fontSize: 40,
            letterSpacing: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            color: C.green,
            opacity: head,
            transform: `translateY(${interpolate(head, [0, 1], [-40, 0])}px)`,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 118,
            fontWeight: 800,
            letterSpacing: -6,
            color: C.ink,
            textAlign: "center",
            opacity: interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(frame, [8, 24], [0.9, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            marginTop: 70,
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
            maxWidth: 900,
          }}
        >
          {race.map((r) => {
            const t = spring({
              frame: frame - r.at,
              fps,
              config: { damping: 12, stiffness: 200 },
            });
            return (
              <div
                key={r.label}
                style={{
                  opacity: t,
                  transform: `translateY(${interpolate(t, [0, 1], [40, 0])}px) scale(${
                    0.9 + t * 0.1
                  })`,
                }}
              >
                <SlangChip label={r.label} meta={r.meta} frame={frame} playing scale={1.15} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
