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

/** Szene 2 – Fokus auf einen SlangTag, Audio läuft. */
export const SceneSlang: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const zoom = interpolate(frame, [0, 110], [1.18, 1.04]);
  const chipIn = spring({ frame: frame - 6, fps, config: { damping: 18, stiffness: 140 } });
  const playing = frame > 16 && frame < 86;

  const ring = (delay: number) => {
    const t = interpolate(frame - delay, [0, 46], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      transform: `scale(${0.5 + t * 1.5})`,
      opacity: (1 - t) * 0.35,
    };
  };

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Img
        src={staticFile("images/rostock.jpg")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${zoom})`,
          filter: "brightness(0.42) saturate(0.85)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "radial-gradient(70% 45% at 50% 50%, rgba(0,0,0,0.1), rgba(0,0,0,0.9))",
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {[0, 16, 32].map((d) => (
            <div
              key={d}
              style={{
                position: "absolute",
                width: 760,
                height: 760,
                borderRadius: 999,
                border: `2px solid ${C.green}`,
                ...ring(d + 14),
              }}
            />
          ))}
          <div
            style={{
              transform: `scale(${interpolate(chipIn, [0, 1], [0.82, 1])})`,
              opacity: chipIn,
            }}
          >
            <SlangChip label="moin-moin" frame={frame} playing={playing} scale={1.5} />
          </div>
        </div>

        <div
          style={{
            marginTop: 78,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
            opacity: interpolate(frame, [22, 40], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <Waveform
            frame={frame}
            bars={30}
            height={70}
            width={5}
            active={playing}
            color={C.greenSoft}
          />
          <div
            style={{ color: C.muted, fontSize: 30, letterSpacing: 5, textTransform: "uppercase" }}
          >
            Norddeutschland · 1,8 s
          </div>
          <div style={{ color: C.ink, fontSize: 46, fontWeight: 600, letterSpacing: -1 }}>
            Ein Wort. Eine Stimme.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
