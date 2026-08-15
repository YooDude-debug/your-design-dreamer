import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Waveform } from "../../components/Waveform";
import { Backdrop, BrandCorner, KineticLine } from "./parts";

/** "Jede Region spricht anders." – kurze Pause – "Jetzt bist DU dran." */
export const SceneYourTurn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeFirst = interpolate(frame, [30, 40], [1, 0], { extrapolateLeft: "clamp" });
  const turn = spring({ frame: frame - 40, fps, config: { damping: 14, stiffness: 170 } });
  const mic = spring({ frame: frame - 52, fps, config: { damping: 9 } });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.14} />
      <BrandCorner frame={frame} opacity={0.7} />

      <AbsoluteFill style={{ padding: "0 92px", justifyContent: "center" }}>
        <div style={{ opacity: fadeFirst, transform: `translateY(${(1 - fadeFirst) * -40}px)` }}>
          <KineticLine text="Jede Region" frame={frame} start={2} size={100} />
          <KineticLine text="spricht anders." frame={frame} start={8} size={100} color={C.muted} />
        </div>

        <div
          style={{
            position: "absolute",
            left: 92,
            right: 92,
            opacity: turn,
            transform: `translateY(${interpolate(turn, [0, 1], [70, 0])}px)`,
          }}
        >
          <div style={{ fontSize: 130, fontWeight: 800, letterSpacing: -7, color: C.ink }}>
            Jetzt bist{" "}
            <span
              style={{
                color: C.green,
                textShadow: `0 0 ${40 + Math.sin(frame / 7) * 16}px rgba(47,240,140,0.5)`,
              }}
            >
              DU
            </span>{" "}
            dran.
          </div>
          <div
            style={{
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 26,
              opacity: mic,
              transform: `scale(${0.8 + mic * 0.2})`,
              transformOrigin: "left center",
            }}
          >
            <span style={{ fontSize: 92 }}>🎙️</span>
            <Waveform frame={frame} bars={22} height={72} width={7} color={C.green} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
