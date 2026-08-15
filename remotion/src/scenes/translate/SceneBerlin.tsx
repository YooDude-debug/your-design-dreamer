import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Waveform } from "../../components/Waveform";
import { Backdrop, KineticLine } from "../challenge/parts";

/** Auflösung (5 s): Berlin-Karte, echter Sinn, kleiner Lacher. */
export const SceneBerlin: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const city = spring({ frame, fps, config: { damping: 14, stiffness: 200 } });
  const reveal = spring({ frame: frame - 46, fps, config: { damping: 12, stiffness: 160 } });
  const laugh = spring({ frame: frame - 66, fps, config: { damping: 9, stiffness: 210 } });
  const bar = interpolate(frame, [46, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.22} />

      <AbsoluteFill style={{ padding: "0 84px", justifyContent: "center", gap: 46 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 20,
            padding: "18px 34px",
            borderRadius: 999,
            background: "rgba(47,240,140,0.12)",
            border: `1px solid rgba(47,240,140,0.4)`,
            opacity: city,
            transform: `translateX(${interpolate(city, [0, 1], [-60, 0])}px)`,
          }}
        >
          <span style={{ fontSize: 54 }}>🇩🇪</span>
          <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: 6, color: C.green }}>
            BERLIN
          </span>
          <Waveform frame={frame} bars={9} height={40} width={6} color={C.green} />
        </div>

        <KineticLine text="Mach keinen Film." frame={frame} start={12} size={126} />

        <div style={{ marginTop: 6 }}>
          <div
            style={{
              height: 6,
              width: `${bar * 100}%`,
              maxWidth: 620,
              background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`,
              borderRadius: 99,
              marginBottom: 30,
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 24,
              opacity: reveal,
              transform: `translateY(${interpolate(reveal, [0, 1], [46, 0])}px)`,
            }}
          >
            <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -4, color: C.green }}>
              = Reg dich nicht auf.
            </div>
            <div
              style={{
                fontSize: 104,
                paddingBottom: 6,
                opacity: laugh,
                transform: `scale(${0.5 + laugh * 0.5}) rotate(${interpolate(laugh, [0, 1], [22, 0])}deg)`,
              }}
            >
              😂
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
