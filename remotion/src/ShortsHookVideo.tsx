import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { FeedCard } from "./components/FeedCard";
import { GlobeSvg, project, type Cam } from "./components/GlobeSvg";
import { BrandLockup } from "./components/BrandLockup";
import { Waveform } from "./components/Waveform";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

// Farb-Emoji sind im Render-Chromium nicht installiert -> nachladen.
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

const UI_FONT = `${fontFamily}, NotoColorEmojiLocal, sans-serif`;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** Kurzer Kicker-Text (klein, uppercase) – trägt die Info auch ohne Ton. */
const Kicker: React.FC<{ text: React.ReactNode; appear: number; bottom?: number }> = ({
  text,
  appear,
  bottom = 190,
}) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom,
      textAlign: "center",
      fontSize: 54,
      fontWeight: 800,
      letterSpacing: 4,
      textTransform: "uppercase",
      color: C.ink,
      opacity: appear,
      transform: `translateY(${interpolate(appear, [0, 1], [22, 0])}px)`,
      textShadow: "0 18px 50px rgba(0,0,0,0.95)",
    }}
  >
    {text}
  </div>
);

/** Dezenter Hintergrund – nie reines Schwarz in den Produktszenen. */
const Backdrop: React.FC<{ energy?: number }> = ({ energy = 0 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 34) * 46;
  return (
    <AbsoluteFill style={{ background: "#050706" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1000px 860px at ${540 + drift}px ${
            720 - drift * 0.5
          }px, rgba(47,240,140,${0.07 + energy * 0.2}) 0%, rgba(5,7,6,0) 62%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Szene 1 · 0–1,5 s · HOOK auf schwarzem Grund. */
const SceneHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 2, fps, config: { damping: 12, stiffness: 220 } });
  const shake = Math.sin(frame * 1.7) * (frame > 24 ? 6 : 2);
  const flash = interpolate(frame, [36, 41, 45], [0, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 90 }}>
        <div
          style={{
            textAlign: "center",
            fontSize: 132,
            lineHeight: 0.98,
            fontWeight: 800,
            letterSpacing: -6,
            color: C.ink,
            opacity: interpolate(pop, [0, 0.25], [0, 1], clamp),
            transform: `scale(${interpolate(pop, [0, 1], [0.82, 1])}) translateX(${shake}px)`,
          }}
        >
          WAIT…
          <br />
          <span style={{ color: C.green }}>WHAT DID HE</span>
          <br />
          JUST SAY? <span style={{ fontSize: 108 }}>😂</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.green, opacity: flash * 0.85 }} />
    </AbsoluteFill>
  );
};

const FEED = {
  image: "berlin.jpg",
  name: "Lena",
  handle: "@lena",
  place: "Berlin · DE",
  tag: "Was kickste so?",
  kind: "community" as const,
  likes: "1.2k",
};

/** Szene 2 · 1,5–4 s · Echter Feed, SlangTag wird aktiviert. */
const SceneFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 120 } });
  const kicker = spring({ frame: frame - 20, fps, config: { damping: 200 } });
  const playing = frame >= 26;
  const ring = interpolate(frame, [22, 52], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Backdrop energy={playing ? 0.8 : 0.25} />
      <Sequence from={26}>
        <Audio src={staticFile("audio/berlin-kickste.mp3")} />
      </Sequence>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 54px",
          transform: `translateY(${interpolate(enter, [0, 1], [140, 0])}px) scale(${interpolate(
            enter,
            [0, 1],
            [1.06, 1],
          )})`,
          opacity: interpolate(enter, [0, 0.2], [0, 1], clamp),
        }}
      >
        <div style={{ width: 960, position: "relative" }}>
          <FeedCard data={FEED} frame={frame} playing={playing} glow={playing ? 1 : 0.2} />
          {/* Tap-Ring: der Moment der Aktivierung */}
          <div
            style={{
              position: "absolute",
              left: 150,
              bottom: 150,
              width: 60 + ring * 460,
              height: 60 + ring * 460,
              marginLeft: -(30 + ring * 230),
              marginBottom: -(30 + ring * 230),
              borderRadius: 999,
              border: `4px solid rgba(47,240,140,${(1 - ring) * 0.75})`,
            }}
          />
        </div>
      </AbsoluteFill>

      <Kicker
        text={
          <>
            HASHTAG <span style={{ color: C.green }}>→</span> SOUND
          </>
        }
        appear={kicker}
        bottom={150}
      />
    </AbsoluteFill>
  );
};

const GLOBE_TAGS: { lon: number; lat: number; label: string; color: string }[] = [
  { lon: 13.4, lat: 52.5, label: "$ Was kickste so?", color: C.green },
  { lon: 23.7, lat: 37.98, label: "$ Kapsoura", color: C.cyan },
  { lon: 11.6, lat: 48.1, label: "$ Oida", color: C.green },
  { lon: 10.0, lat: 53.55, label: "$ Moin Moin", color: C.greenSoft },
  { lon: 28.98, lat: 41.0, label: "$ Abi ya", color: C.cyan },
  { lon: -3.7, lat: 40.4, label: "$ Qué guay", color: C.blue },
];

/** Szene 3 · 4–6 s · Globaler Moment: Zoom über Europa, Slang verteilt sich. */
const SceneGlobe: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [0, 60], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const cam: Cam = {
    lon: interpolate(t, [0, 1], [12, 30]),
    lat: interpolate(t, [0, 1], [50, 40]),
    scale: interpolate(t, [0, 1], [620, 900]),
  };
  const kicker = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const cx = 540;
  const cy = 900;

  return (
    <AbsoluteFill>
      <Backdrop energy={0.35} />
      <div style={{ position: "absolute", inset: 0 }}>
        <GlobeSvg cam={cam} width={1080} height={1920} cx={cx} cy={cy} />
      </div>

      {GLOBE_TAGS.map((g, i) => {
        const p = project(g.lon, g.lat, cam, cx, cy);
        if (!p) return null;
        const a = spring({ frame: frame - 6 - i * 5, fps, config: { damping: 15, stiffness: 200 } });
        const float = Math.sin(frame / 18 + i) * 7;
        return (
          <div
            key={g.label}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y + float,
              transform: `translate(-50%, -50%) scale(${interpolate(a, [0, 1], [0.7, 1])})`,
              opacity: a,
              padding: "12px 22px",
              borderRadius: 999,
              background: "rgba(6,9,8,0.78)",
              border: `2px solid ${g.color}88`,
              boxShadow: `0 0 34px ${g.color}44`,
              color: C.ink,
              fontSize: 34,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {g.label}
          </div>
        );
      })}

      <Kicker
        text={
          <>
            LOCAL SLANG. <span style={{ color: C.green }}>GLOBAL WORLD.</span>
          </>
        }
        appear={kicker}
        bottom={210}
      />
    </AbsoluteFill>
  );
};

/** Szene 4 · 6–8 s · Aha: hören → verstehen → teilen. */
const SceneAha: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chip = spring({ frame, fps, config: { damping: 12, stiffness: 210 } });
  const mean = spring({ frame: frame - 18, fps, config: { damping: 200 } });
  const kicker = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const playing = frame >= 3 && frame <= 46;
  const pulse = playing ? 1 + Math.sin(frame / 3.4) * 0.015 : 1;

  return (
    <AbsoluteFill>
      <Backdrop energy={playing ? 0.9 : 0.3} />
      <Sequence from={3}>
        <Audio src={staticFile("audio/el-kapsoura.mp3")} />
      </Sequence>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 44,
          padding: "0 80px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 24,
            padding: "26px 42px",
            borderRadius: 999,
            background: "rgba(9,12,11,0.85)",
            border: `2px solid ${C.cyan}88`,
            boxShadow: `0 0 ${56 * (playing ? 1 : 0.4)}px ${C.cyan}44`,
            color: C.ink,
            fontSize: 62,
            fontWeight: 700,
            letterSpacing: -1.4,
            opacity: interpolate(chip, [0, 0.3], [0, 1], clamp),
            transform: `scale(${interpolate(chip, [0, 1], [0.75, 1]) * pulse})`,
          }}
        >
          <span style={{ color: C.cyan, fontWeight: 800 }}>$</span>
          <span>Kapsoura</span>
          <Waveform frame={frame} bars={11} height={48} width={7} color={C.cyan} active={playing} />
        </div>

        <div
          style={{
            textAlign: "center",
            opacity: mean,
            transform: `translateY(${interpolate(mean, [0, 1], [24, 0])}px)`,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 5, color: C.muted }}>
            ATHENS · GREEK
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 66,
              fontWeight: 800,
              letterSpacing: -2,
              color: C.ink,
              lineHeight: 1.06,
            }}
          >
            head over heels
            <br />
            in love
          </div>
        </div>
      </AbsoluteFill>

      <Kicker
        text={
          <>
            HEAR IT. LEARN IT. <span style={{ color: C.green }}>SHARE IT.</span>
          </>
        }
        appear={kicker}
        bottom={230}
      />
    </AbsoluteFill>
  );
};

/** Szene 5 · 8–10 s · Logo + CTA, letzter Frame steht ruhig. */
const SceneEndCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame, fps, config: { damping: 200, stiffness: 130 } });
  const claim = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const ask = spring({ frame: frame - 22, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Backdrop energy={0.5} />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 52,
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
        <div
          style={{
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: 3,
            color: C.muted,
            opacity: ask,
            transform: `translateY(${interpolate(ask, [0, 1], [18, 0])}px)`,
          }}
        >
          Would you use this?
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * YouTube-Shorts-Teaser (9:16, 300 Frames = 10 s):
 * HOOK (0–45) → FEED/SlangTag (45–120) → GLOBE (120–180) → AHA (180–240) → LOGO/CTA (240–300).
 */
export const ShortsHookVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily: UI_FONT }}>
    <Sequence from={0} durationInFrames={45}>
      <SceneHook />
    </Sequence>
    <Sequence from={45} durationInFrames={75}>
      <SceneFeed />
    </Sequence>
    <Sequence from={120} durationInFrames={60}>
      <SceneGlobe />
    </Sequence>
    <Sequence from={180} durationInFrames={60}>
      <SceneAha />
    </Sequence>
    <Sequence from={240} durationInFrames={60}>
      <SceneEndCta />
    </Sequence>
  </AbsoluteFill>
);
