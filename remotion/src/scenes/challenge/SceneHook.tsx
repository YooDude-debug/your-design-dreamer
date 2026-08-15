import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme";
import { Waveform } from "../../components/Waveform";
import { Backdrop, BrandCorner, KineticLine } from "./parts";

/**
 * Hook (2,2 s): der erste Satz sitzt in Frame 2 – kein Vorlauf, kein Logo-Bumper
 * vor der Aussage. Die Marke laeuft nur klein als Anker mit.
 */
export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 4, 10], [0.35, 0.1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.2} />
      <BrandCorner frame={frame} opacity={interpolate(frame, [8, 22], [0, 0.85])} />

      <AbsoluteFill
        style={{
          padding: "0 92px",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 132,
            fontWeight: 800,
            color: C.green,
            letterSpacing: -6,
            opacity: interpolate(frame, [0, 3], [0, 1], { extrapolateRight: "clamp" }),
            transform: `translateX(${interpolate(frame, [0, 8], [-40, 0], {
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          Ey…
        </div>

        <div style={{ height: 18 }} />
        <KineticLine text="welchen Slang kennt" frame={frame} start={7} size={104} />
        <KineticLine text="man nur bei" frame={frame} start={14} size={104} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 26 }}>
          <KineticLine text="DIR?" frame={frame} start={20} size={148} color={C.green} />
          <div style={{ paddingBottom: 34, opacity: interpolate(frame, [26, 34], [0, 1]) }}>
            <Waveform frame={frame} bars={14} height={54} width={7} color={C.green} />
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
