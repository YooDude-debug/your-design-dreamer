import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";
import { Waveform } from "./components/Waveform";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** Dunkler, leicht atmender Hintergrund – kein reines Schwarz. */
const Backdrop: React.FC<{ energy?: number }> = ({ energy = 0 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 42) * 40;
  return (
    <AbsoluteFill style={{ background: "#050706" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 900px at ${540 + drift}px ${
            760 - drift * 0.6
          }px, rgba(47,240,140,${0.06 + energy * 0.22}) 0%, rgba(5,7,6,0) 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** 0–2 s · Stummer Hashtag. */
const SceneMute: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 } });
  const sub = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  const out = interpolate(frame, [48, 60], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 44,
        }}
      >
        <div
          style={{
            fontSize: 176,
            fontWeight: 800,
            letterSpacing: -8,
            color: C.ink,
            opacity: s,
            transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px) scale(${interpolate(
              s,
              [0, 1],
              [0.9, 1],
            )})`,
            textShadow: "0 24px 70px rgba(0,0,0,0.9)",
          }}
        >
          <span style={{ color: C.red }}>#</span>Berlin
        </div>
        {/* Ruhende, tote Waveform: visuell "stumm" */}
        <div style={{ opacity: sub * 0.5 }}>
          <Waveform frame={0} bars={16} height={34} width={5} color="#5a6a66" active={false} />
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 600,
            color: C.muted,
            opacity: sub,
            transform: `translateY(${interpolate(sub, [0, 1], [22, 0])}px)`,
          }}
        >
          Hashtags sind stumm.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 2–3,5 s · Harter Wechsel. */
const SceneTurn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 170 } });
  const wipe = interpolate(frame, [0, 12], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const out = interpolate(frame, [36, 45], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={0.4} />
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, rgba(47,240,140,0.16) 0%, rgba(0,0,0,0) 100%)`,
          clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`,
        }}
      />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 136,
            fontWeight: 800,
            letterSpacing: -6,
            textAlign: "center",
            lineHeight: 1.02,
            color: C.ink,
            opacity: interpolate(s, [0, 0.4], [0, 1], clamp),
            transform: `translateX(${interpolate(s, [0, 1], [-90, 0])}px)`,
            textShadow: "0 20px 60px rgba(0,0,0,0.9)",
          }}
        >
          Deine Stadt
          <br />
          <span style={{ color: C.green }}>nicht.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 3,5–7,5 s · Der Original-SlangTag spielt hörbar. */
const SceneSlang: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 190 } });
  const label = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const hint = spring({ frame: frame - 62, fps, config: { damping: 200 } });
  const playing = frame >= 6 && frame <= 70;
  const pulse = playing ? 1 + Math.sin(frame / 3.2) * 0.02 : 1;
  const ring = interpolate(frame, [4, 34], [0, 1], clamp);
  const out = interpolate(frame, [108, 120], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={playing ? 0.9 : 0.3} />
      {/* Tap-Ring als Aktivierungsmoment */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 420 + ring * 620,
            height: 420 + ring * 620,
            borderRadius: 999,
            border: `3px solid rgba(47,240,140,${(1 - ring) * 0.5})`,
          }}
        />
      </AbsoluteFill>

      <Sequence from={6}>
        <Audio src={staticFile("audio/berlin-kickste.mp3")} volume={1} />
      </Sequence>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 52,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 26,
            padding: "30px 46px",
            borderRadius: 999,
            background: "rgba(10,13,12,0.82)",
            border: `2px solid ${C.green}77`,
            boxShadow: `0 0 ${60 * (playing ? 1 : 0.4)}px ${C.green}44`,
            color: C.ink,
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: -1.6,
            opacity: interpolate(pop, [0, 0.3], [0, 1], clamp),
            transform: `scale(${interpolate(pop, [0, 1], [0.7, 1]) * pulse})`,
          }}
        >
          <span style={{ color: C.green, fontWeight: 800 }}>$</span>
          <span>Was kickste so?</span>
          <Waveform frame={frame} bars={12} height={52} width={7} color={C.green} active={playing} />
        </div>

        <div
          style={{
            fontSize: 52,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: C.green,
            opacity: label,
          }}
        >
          SlangTag · Berlin
        </div>

        <div
          style={{
            fontSize: 62,
            fontWeight: 800,
            letterSpacing: -2,
            color: C.ink,
            opacity: hint,
            transform: `translateY(${interpolate(hint, [0, 1], [24, 0])}px)`,
          }}
        >
          Das spricht.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 7,5–10 s · Branding. */
const SceneBrand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame, fps, config: { damping: 200 } });
  const claim = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const url = spring({ frame: frame - 30, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Backdrop energy={0.5} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 74,
        }}
      >
        <BrandLockup
          frame={frame}
          appear={brand}
          sloganAppear={claim}
          markWidth={280}
          textHeight={158}
          energy={0.85}
        />
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -3,
              color: C.ink,
              opacity: claim,
              transform: `translateY(${interpolate(claim, [0, 1], [26, 0])}px)`,
            }}
          >
            Deine Stadt <span style={{ color: C.green }}>spricht.</span>
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 40,
              fontWeight: 600,
              letterSpacing: 6,
              color: C.muted,
              opacity: url,
            }}
          >
            y-dude.com
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const SilentCityVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily }}>
    <Sequence from={0} durationInFrames={60}>
      <SceneMute />
    </Sequence>
    <Sequence from={60} durationInFrames={45}>
      <SceneTurn />
    </Sequence>
    <Sequence from={105} durationInFrames={120}>
      <SceneSlang />
    </Sequence>
    <Sequence from={225} durationInFrames={75}>
      <SceneBrand />
    </Sequence>
  </AbsoluteFill>
);
