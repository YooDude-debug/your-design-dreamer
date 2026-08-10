import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";

/** End Card – ausschliesslich Marke und Slogan auf Schwarz. */
export const SceneEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const brand = spring({ frame, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [16, 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          opacity: brand,
          transform: `translateY(${interpolate(brand, [0, 1], [26, 0])}px)`,
          fontSize: 138,
          fontWeight: 700,
          letterSpacing: -4,
          color: C.ink,
        }}
      >
        <span style={{ color: C.green }}>y</span>-Dude
      </div>
      <div
        style={{
          marginTop: 34,
          opacity: slogan,
          fontSize: 44,
          fontWeight: 400,
          letterSpacing: 1,
          color: C.muted,
        }}
      >
        Speak local. Connect Global.
      </div>
    </AbsoluteFill>
  );
};
