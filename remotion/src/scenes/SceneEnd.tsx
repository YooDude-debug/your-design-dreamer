import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup } from "../components/BrandLockup";

/**
 * End Card – offizieller Y-Dude Branding-Lockup auf Schwarz.
 * Identisch zum Logo-Auftakt: [Logo-Symbol] Dude + SPEAK LOCAL. CONNECT GLOBAL.
 */
export const SceneEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [16, 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#000000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -240,
          top: 200,
          width: 1560,
          height: 1520,
          background:
            "radial-gradient(circle at 50% 50%, rgba(47,240,140,0.14) 0%, rgba(47,240,140,0.04) 38%, rgba(0,0,0,0) 68%)",
          opacity: appear,
        }}
      />
      <BrandLockup frame={frame} appear={appear} sloganAppear={slogan} energy={0.85} />
    </AbsoluteFill>
  );
};
