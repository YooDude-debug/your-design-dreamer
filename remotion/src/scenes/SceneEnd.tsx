import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { BrandLockup } from "../components/BrandLockup";

/**
 * End Card – offizieller Y-Dude Branding-Lockup auf Schwarz, danach
 * nacheinander (nie gleichzeitig):
 *   1. [Logo-Symbol] Dude
 *   2. SPEAK LOCAL. CONNECT GLOBAL.
 *   3. ruhige Haltezeit
 *   4. www.y-dude.com
 *   5. WERDE BETA-TESTER
 */
export const SceneEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const appear = spring({ frame, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [16, 40], [0, 1], { extrapolateRight: "clamp" });

  // Ruhige Haltezeit nach dem Slogan, dann die URL.
  const url = spring({ frame: frame - 78, fps, config: { damping: 200 } });
  // Erst danach der abschliessende Call-to-Action.
  const cta = spring({ frame: frame - 118, fps, config: { damping: 18, stiffness: 130 } });
  const ctaGlow = 0.35 + Math.sin(frame / 9) * 0.12;

  // Der Lockup rueckt leicht nach oben, sobald URL und CTA erscheinen.
  const lift = interpolate(url, [0, 1], [0, -96]);

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

      <div style={{ transform: `translateY(${lift}px)` }}>
        <BrandLockup frame={frame} appear={appear} sloganAppear={slogan} energy={0.85} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1160,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 74,
        }}
      >
        <div
          style={{
            opacity: url,
            transform: `translateY(${interpolate(url, [0, 1], [22, 0])}px)`,
            color: C.ink,
            fontSize: 54,
            fontWeight: 600,
            letterSpacing: 3,
            textShadow: "0 0 26px rgba(255,255,255,0.18)",
          }}
        >
          www.y-dude.com
        </div>

        <div
          style={{
            opacity: cta,
            transform: `translateY(${interpolate(cta, [0, 1], [30, 0])}px) scale(${interpolate(
              cta,
              [0, 1],
              [0.9, 1],
            )})`,
            padding: "26px 58px",
            borderRadius: 999,
            border: `2px solid ${C.green}`,
            color: C.green,
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: 6,
            textTransform: "uppercase",
            boxShadow: `0 0 ${44 + ctaGlow * 60}px rgba(47,240,140,${0.18 + ctaGlow * 0.22})`,
            background: "rgba(47,240,140,0.06)",
          }}
        >
          Werde Beta-Tester
        </div>
      </div>
    </AbsoluteFill>
  );
};
