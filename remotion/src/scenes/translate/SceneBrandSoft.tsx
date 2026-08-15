import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandLockup } from "../../components/BrandLockup";
import { Backdrop } from "../challenge/parts";

/** Sehr dezentes Ende (2,6 s): nur Logo + Slogan, kein Call-to-Action. */
export const SceneBrandSoft: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [22, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.16} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <BrandLockup
          frame={frame}
          appear={brand * 0.92}
          sloganAppear={slogan * 0.88}
          markWidth={210}
          textHeight={120}
          energy={0.55}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
