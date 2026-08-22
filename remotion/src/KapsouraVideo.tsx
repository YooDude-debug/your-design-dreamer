import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  continueRender,
  delayRender,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { loadFont as loadGreekFont } from "@remotion/google-fonts/Inter";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";
import { Waveform } from "./components/Waveform";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

// Outfit hat keine griechischen Glyphen -> Inter fuer ΚΑΨΟΥΡΑ.
const { fontFamily: greekFontFamily } = loadGreekFont("normal", {
  weights: ["800"],
  subsets: ["greek", "latin"],
});

// Farb-Emoji (Flaggen, 👀, ❤️‍🔥) sind im Render-Chromium nicht installiert -> nachladen.
const EMOJI_URL =
  "https://id-preview--28c6b349-006b-4137-bd0e-13eee9cc6ca0.lovable.app/__l5e/assets-v1/88076456-9a8e-4249-8abc-f8bdfe0bf88d/NotoColorEmoji.ttf";

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("noto-color-emoji");
  const face = new FontFace("NotoColorEmojiLocal", `url(${EMOJI_URL})`);
  face
    .load()
    .then((loaded) => {
      document.fonts.add(loaded);
      continueRender(handle);
    })
    .catch(() => continueRender(handle));
}

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/**
 * "A word that doesn't exist in English…" – KAPSOURA (10 s, 9:16, 300 Frames).
 *
 * 0–2 s Hook · 2–4 s Wort ΚΑΨΟΥΡΑ + griechischer SlangTag ·
 * 4–7 s Bedeutung · 7–10 s Kommentar-Aufruf + Branding.
 */

const Backdrop: React.FC<{ energy?: number; warm?: boolean }> = ({ energy = 0, warm = false }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 44) * 44;
  const glow = warm ? "255,90,69" : "47,240,140";
  return (
    <AbsoluteFill style={{ background: "#050706" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 900px at ${540 + drift}px ${
            740 - drift * 0.6
          }px, rgba(${glow},${0.06 + energy * 0.2}) 0%, rgba(5,7,6,0) 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.72) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** 0–2 s · Hook. */
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 13, stiffness: 200 } });
  const b = spring({ frame: frame - 10, fps, config: { damping: 13, stiffness: 200 } });
  const eyes = spring({ frame: frame - 26, fps, config: { damping: 10, stiffness: 220 } });
  const flash = interpolate(frame, [0, 4, 12], [0.3, 0.08, 0], clamp);
  const out = interpolate(frame, [52, 60], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={0.25} />
      <AbsoluteFill
        style={{
          padding: "0 84px",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 30,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 122,
            fontWeight: 800,
            lineHeight: 1.03,
            letterSpacing: -5,
            color: C.ink,
            opacity: a,
            transform: `translateY(${interpolate(a, [0, 1], [46, 0])}px)`,
            textShadow: "0 22px 66px rgba(0,0,0,0.9)",
          }}
        >
          A word that
          <br />
          doesn’t exist
        </div>
        <div
          style={{
            fontSize: 122,
            fontWeight: 800,
            letterSpacing: -5,
            color: C.green,
            opacity: b,
            transform: `translateY(${interpolate(b, [0, 1], [40, 0])}px)`,
          }}
        >
          in English…
        </div>
        <div
          style={{
            fontSize: 92,
            display: "flex",
            gap: 26,
            opacity: eyes,
            transform: `scale(${0.6 + eyes * 0.4})`,
          }}
        >
          <span>🇬🇷</span>
          <span>👀</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** 2–4 s · Das Wort + hörbarer griechischer SlangTag. */
const SceneWord: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 200 } });
  const lat = spring({ frame: frame - 9, fps, config: { damping: 200 } });
  const chip = spring({ frame: frame - 14, fps, config: { damping: 200 } });
  const ring = interpolate(frame, [0, 30], [0, 1], clamp);
  const playing = frame >= 4 && frame <= 54;
  const out = interpolate(frame, [52, 60], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={playing ? 0.85 : 0.3} />
      <Sequence from={4}>
        <Audio src={staticFile("audio/el-kapsoura.mp3")} volume={1} />
      </Sequence>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: 420 + ring * 640,
            height: 420 + ring * 640,
            borderRadius: 999,
            border: `3px solid rgba(47,240,140,${(1 - ring) * 0.5})`,
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 30,
        }}
      >
        <div style={{ fontSize: 74, opacity: pop }}>🇬🇷</div>
        <div
          style={{
            fontSize: 140,
            fontFamily: greekFontFamily,
            fontWeight: 800,
            letterSpacing: -4,
            color: C.ink,
            opacity: pop,
            transform: `scale(${interpolate(pop, [0, 1], [0.82, 1])}) scale(${
              playing ? 1 + Math.sin(frame / 3.2) * 0.015 : 1
            })`,
            textShadow: `0 0 80px rgba(47,240,140,0.35), 0 22px 66px rgba(0,0,0,0.9)`,
          }}
        >
          ΚΑΨΟΥΡΑ
        </div>
        <div
          style={{
            fontSize: 62,
            fontWeight: 600,
            letterSpacing: 10,
            color: C.muted,
            opacity: lat,
            transform: `translateY(${interpolate(lat, [0, 1], [18, 0])}px)`,
          }}
        >
          KAPSOÚRA
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 24,
            marginTop: 14,
            padding: "22px 40px",
            borderRadius: 999,
            background: "rgba(10,13,12,0.82)",
            border: `2px solid ${C.green}77`,
            boxShadow: `0 0 ${playing ? 60 : 20}px ${C.green}44`,
            opacity: chip,
            transform: `translateY(${interpolate(chip, [0, 1], [22, 0])}px)`,
            color: C.green,
            fontSize: 50,
            fontWeight: 600,
          }}
        >
          <span>$Kapsoura</span>
          <Waveform frame={frame} bars={16} height={38} width={5} active={playing} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 4–7 s · Bedeutung. */
const SceneMeaning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 200 } });
  const b = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const glow = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const pulse = 1 + Math.sin(frame / 6) * 0.05;
  const out = interpolate(frame, [80, 90], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={0.5} warm />
      <AbsoluteFill
        style={{
          background: `radial-gradient(720px 720px at 50% 52%, rgba(255,90,69,${
            0.1 + glow * 0.12
          }) 0%, rgba(0,0,0,0) 70%)`,
        }}
      />

      <AbsoluteFill
        style={{
          padding: "0 92px",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 40,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: C.muted,
            opacity: a,
          }}
        >
          Kapsoúra
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: -4,
            color: C.ink,
            opacity: b,
            transform: `translateY(${interpolate(b, [0, 1], [34, 0])}px)`,
            textShadow: "0 22px 66px rgba(0,0,0,0.9)",
          }}
        >
          Being <span style={{ color: C.green }}>crazy in love</span>
          <br />
          with someone.
        </div>
        <div
          style={{
            fontSize: 96,
            opacity: glow,
            transform: `scale(${glow * pulse})`,
          }}
        >
          ❤️‍🔥
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** 7–10 s · Interaktion + Branding. */
const SceneCall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 14, stiffness: 190 } });
  const b = spring({ frame: frame - 14, fps, config: { damping: 12, stiffness: 200 } });
  const brand = spring({ frame: frame - 44, fps, config: { damping: 200 } });
  const slogan = spring({ frame: frame - 56, fps, config: { damping: 200 } });
  const bounce = 1 + Math.sin(frame / 5) * 0.03;
  const lift = interpolate(frame, [40, 62], [0, -110], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const textFade = interpolate(frame, [46, 62], [1, 0.18], clamp);

  return (
    <AbsoluteFill>
      <Backdrop energy={0.7} />
      <AbsoluteFill
        style={{
          padding: "0 84px",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 44,
          textAlign: "center",
          transform: `translateY(${lift}px)`,
          opacity: textFade,
        }}
      >
        <div
          style={{
            fontSize: 106,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -4,
            color: C.ink,
            opacity: a,
            transform: `translateY(${interpolate(a, [0, 1], [40, 0])}px)`,
            textShadow: "0 22px 66px rgba(0,0,0,0.9)",
          }}
        >
          What does your
          <br />
          language call this? 🌍
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 18,
            padding: "26px 48px",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${C.green} 0%, ${C.greenSoft} 100%)`,
            color: "#04120a",
            fontSize: 60,
            fontWeight: 800,
            opacity: b,
            transform: `scale(${interpolate(b, [0, 1], [0.8, 1]) * bounce})`,
            boxShadow: `0 0 70px ${C.green}55`,
          }}
        >
          Comment it below! 👇
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 210,
        }}
      >
        <div style={{ transform: "scale(0.62)", transformOrigin: "bottom center" }}>
          <BrandLockup
            markWidth={250}
            textHeight={146}
            appear={brand}
            sloganAppear={slogan}
            frame={frame}
            energy={0.85}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const KapsouraVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily: `${fontFamily}, NotoColorEmojiLocal` }}>
    <Sequence durationInFrames={60}>
      <SceneHook />
    </Sequence>
    <Sequence from={60} durationInFrames={60}>
      <SceneWord />
    </Sequence>
    <Sequence from={120} durationInFrames={90}>
      <SceneMeaning />
    </Sequence>
    <Sequence from={210} durationInFrames={90}>
      <SceneCall />
    </Sequence>
  </AbsoluteFill>
);
