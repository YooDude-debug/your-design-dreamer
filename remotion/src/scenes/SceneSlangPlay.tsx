import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { C } from "../theme";
import { SlangChip } from "../components/SlangChip";
import { Waveform } from "../components/Waveform";

/**
 * Zusatzszene B – Interaktion: Tippen auf den SlangTag im Beitrag, Audio läuft,
 * Wellenform reagiert. Kurz, kein Tutorial-Look.
 */
export const SceneSlangPlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoom = interpolate(frame, [0, 96], [1.08, 1.16]);
  const tap = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 220 } });
  const playing = frame > 22;

  const ring = (delay: number) => {
    const t = interpolate(frame - delay, [0, 34], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return { transform: `scale(${0.6 + t * 1.1})`, opacity: (1 - t) * 0.4 };
  };

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Img
        src={staticFile("images/berlin.jpg")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom})`,
          filter: "brightness(0.4) saturate(0.9)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(65% 42% at 50% 52%, rgba(0,0,0,0.12), rgba(0,0,0,0.92))",
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
          {[0, 14, 28].map((d) => (
            <div
              key={d}
              style={{
                position: "absolute",
                width: 640,
                height: 640,
                borderRadius: 999,
                border: `2px solid ${C.blue}`,
                ...ring(d + 20),
              }}
            />
          ))}
          <div style={{ transform: `scale(${interpolate(tap, [0, 1], [1.06, 0.98])})` }}>
            <SlangChip label="digga" kind="creator" frame={frame} playing={playing} scale={1.35} />
          </div>
          {/* Fingertipp */}
          <div
            style={{
              position: "absolute",
              width: 96,
              height: 96,
              borderRadius: 999,
              border: `3px solid ${C.ink}`,
              background: "rgba(255,255,255,0.10)",
              transform: `translate(150px, 70px) scale(${interpolate(
                frame,
                [8, 20, 34],
                [0.4, 1, 0.2],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                },
              )})`,
              opacity: interpolate(frame, [8, 16, 32], [0, 0.85, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
        </div>

        <div
          style={{
            marginTop: 76,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            opacity: interpolate(frame, [24, 40, 86, 98], [0, 1, 1, 0]),
          }}
        >
          <Waveform frame={frame} bars={28} height={62} width={5} active={playing} color={C.cyan} />
          <div
            style={{ color: C.muted, fontSize: 28, letterSpacing: 5, textTransform: "uppercase" }}
          >
            Tippen. Hören. Verstehen.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
