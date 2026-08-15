import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { BrandLockup } from "../../components/BrandLockup";
import { Backdrop } from "./parts";

const LINES = ["DEIN SLANG.", "DEINE REGION.", "DEINE CHALLENGE."];

/**
 * Ending (4,2 s): drei harte Zeilen, danach der offizielle Y-Dude-Lockup
 * inklusive Slogan und der Call-to-Action.
 */
export const SceneChallengeEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lift = interpolate(frame, [42, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brand = spring({ frame: frame - 46, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [62, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cta = spring({ frame: frame - 84, fps, config: { damping: 13, stiffness: 150 } });
  const glow = 0.34 + Math.sin(frame / 8) * 0.14;
  const arrow = Math.sin(frame / 6) * 8;

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.22} />

      <AbsoluteFill style={{ padding: "0 88px", justifyContent: "center" }}>
        <div
          style={{
            opacity: 1 - lift,
            transform: `translateY(${lift * -120}px) scale(${1 - lift * 0.06})`,
          }}
        >
          {LINES.map((l, i) => {
            const t = spring({
              frame: frame - i * 9,
              fps,
              config: { damping: 14, stiffness: 210 },
            });
            return (
              <div
                key={l}
                style={{
                  fontSize: 124,
                  fontWeight: 800,
                  letterSpacing: -6,
                  lineHeight: 1.04,
                  color: i === 2 ? C.green : C.ink,
                  opacity: t,
                  transform: `translateX(${interpolate(t, [0, 1], [-70, 0])}px)`,
                }}
              >
                {l}
              </div>
            );
          })}
        </div>

        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: brand,
            transform: `translateY(${interpolate(cta, [0, 1], [0, -70])}px)`,
          }}
        >
          <BrandLockup
            frame={frame}
            appear={brand}
            sloganAppear={slogan}
            markWidth={230}
            textHeight={132}
            energy={0.95}
          />
        </AbsoluteFill>

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 250,
            display: "flex",
            justifyContent: "center",
            opacity: cta,
            transform: `scale(${0.88 + cta * 0.12})`,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 20,
              padding: "28px 56px",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.green} 0%, ${C.cyan} 100%)`,
              color: "#04150c",
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: 1,
              boxShadow: `0 0 ${70}px rgba(47,240,140,${glow})`,
            }}
          >
            JETZT MITMACHEN
            <span style={{ transform: `translateX(${arrow}px)` }}>→</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
