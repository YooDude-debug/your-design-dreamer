import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { SlangChip } from "../../components/SlangChip";
import { Waveform } from "../../components/Waveform";
import { Backdrop, BrandCorner } from "./parts";

const STEPS = [
  "Sprich deinen Slang ein.",
  "Erstelle deinen SlangTag.",
  "Zeig der Welt, woher du kommst.",
];

/** Der SlangTag entsteht live: Aufnahme → Chip → Welt. */
export const SceneMakeTag: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chip = spring({ frame: frame - 34, fps, config: { damping: 13, stiffness: 160 } });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.15} />
      <BrandCorner frame={frame} opacity={0.7} />

      <AbsoluteFill style={{ padding: "0 92px", justifyContent: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 26,
            transform: `translateY(${interpolate(chip, [0, 1], [60, 0])}px)`,
          }}
        >
          {STEPS.map((s, i) => {
            const t = interpolate(frame - i * 16, [0, 12], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  opacity: t,
                  transform: `translateX(${(1 - t) * -50}px)`,
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 99,
                    background: C.green,
                    boxShadow: `0 0 22px ${C.green}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 74, fontWeight: 700, letterSpacing: -3, color: C.ink }}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 78,
            display: "flex",
            alignItems: "center",
            gap: 34,
            opacity: chip,
            transform: `scale(${0.86 + chip * 0.14}) rotate(${interpolate(chip, [0, 1], [-4, -1.5])}deg)`,
            transformOrigin: "left center",
          }}
        >
          <SlangChip label="deinslang" meta="Deine Region" frame={frame} playing scale={1.85} />
        </div>

        <div style={{ marginTop: 52, opacity: interpolate(frame, [50, 64], [0, 0.95]) }}>
          <Waveform frame={frame} bars={34} height={92} width={8} color={C.green} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
