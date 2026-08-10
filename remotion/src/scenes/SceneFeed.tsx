import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  spring,
  useVideoConfig,
} from "remotion";
import { C } from "../theme";
import { PhoneFrame } from "../components/PhoneFrame";

/**
 * Szene 1 – Person nutzt Y-Dude.
 * Im Telefon laeuft eine echte Screen-Aufnahme der bestehenden Y-Dude-App
 * (public/video/real-feed.mp4): echter Feed, echter Beitrag, echter SlangTag
 * mit reagierendem Equalizer, leichtes Weiterscrollen. Keine nachgebaute UI.
 */
export const SceneFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = interpolate(frame, [0, 185], [1.12, 1.2]);
  const enter = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const phoneY = interpolate(enter, [0, 1], [200, 40]);
  const phoneOpacity = interpolate(enter, [0, 1], [0, 1]);
  // Sehr leichte Kamerabewegung, damit die Szene nicht statisch wirkt.
  const drift = Math.sin(frame / 46) * 6;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Img
        src={staticFile("images/person-night.jpg")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale})`,
          filter: "brightness(0.5) saturate(0.9) blur(2px)",
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(90% 60% at 50% 42%, rgba(0,0,0,0.25), rgba(0,0,0,0.88))" }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translateY(${phoneY + drift}px) rotate(-1.4deg)`,
            opacity: phoneOpacity,
          }}
        >
          <PhoneFrame width={640} height={1360}>
            <OffthreadVideo
              src={staticFile("video/real-feed.mp4")}
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </PhoneFrame>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          top: 96,
          opacity: interpolate(frame, [10, 30, 163, 179], [0, 1, 1, 0]),
        }}
      >
        <div style={{ color: C.muted, fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>
          Slang. Stimme. Ort.
        </div>
        <div style={{ color: C.ink, fontSize: 56, fontWeight: 700, letterSpacing: -1.6, marginTop: 10 }}>
          Hör, wie deine
          <br />
          Region klingt.
        </div>
      </div>
    </AbsoluteFill>
  );
};
