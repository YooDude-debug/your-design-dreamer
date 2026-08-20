import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
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

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });

const FONTS = `${fontFamily}, "Noto Sans", "Noto Sans CJK JP", sans-serif`;

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/** Die vier Freunde – Ort, Stimme, SlangTag-Text. */
type Friend = {
  name: string;
  city: string;
  langCode: string;
  flag: string;
  label: string;
  audio: string;
  /** Position auf der Weltkarte (0..1). */
  mx: number;
  my: number;
  /** Position des SlangTags auf dem Bild (0..1). */
  tx: number;
  ty: number;
};

const FRIENDS: Friend[] = [
  {
    name: "Jonas",
    city: "Berlin",
    langCode: "DE",
    flag: "🇩🇪",
    label: "Alles Gute, Ronja!",
    audio: "audio/ronja-de.mp3",
    mx: 0.52,
    my: 0.32,
    tx: 0.28,
    ty: 0.17,
  },
  {
    name: "Elena",
    city: "Barcelona",
    langCode: "ES",
    flag: "🇪🇸",
    label: "Happy Birthday!",
    audio: "audio/ronja-en.mp3",
    mx: 0.46,
    my: 0.4,
    tx: 0.7,
    ty: 0.34,
  },
  {
    name: "Mike",
    city: "New York",
    langCode: "US",
    flag: "🇺🇸",
    label: "Alles Gute, Ronja!",
    audio: "audio/ronja-us.mp3",
    mx: 0.24,
    my: 0.36,
    tx: 0.3,
    ty: 0.55,
  },
  {
    name: "Aya",
    city: "Tokyo",
    langCode: "JA",
    flag: "🇯🇵",
    label: "ロンヤ、お誕生日おめでとう！",
    audio: "audio/ronja-jp.mp3",
    mx: 0.83,
    my: 0.38,
    tx: 0.62,
    ty: 0.76,
  },
];

const Backdrop: React.FC<{ energy?: number }> = ({ energy = 0 }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 46) * 34;
  return (
    <AbsoluteFill style={{ background: "#050706" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1000px 900px at ${540 + drift}px ${820 - drift * 0.5}px, rgba(47,240,140,${
            0.05 + energy * 0.2
          }) 0%, rgba(5,7,6,0) 62%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0) 36%, rgba(0,0,0,0.72) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Sehr reduzierte Weltkarten-Andeutung (Punktraster). */
const DotWorld: React.FC<{ width: number; height: number; appear: number }> = ({
  width,
  height,
  appear,
}) => {
  const dots: React.ReactNode[] = [];
  const cols = 46;
  const rows = 22;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const v = r / (rows - 1);
      // grobe Landmassen-Maske (Andeutung, kein exaktes Kartenbild)
      const land =
        (u > 0.11 && u < 0.29 && v > 0.16 && v < 0.52) || // Nordamerika
        (u > 0.2 && u < 0.31 && v > 0.52 && v < 0.86) || // Südamerika
        (u > 0.42 && u < 0.56 && v > 0.14 && v < 0.42) || // Europa
        (u > 0.45 && u < 0.62 && v > 0.42 && v < 0.82) || // Afrika
        (u > 0.6 && u < 0.9 && v > 0.18 && v < 0.55) || // Asien
        (u > 0.82 && u < 0.94 && v > 0.62 && v < 0.82); // Australien
      if (!land) continue;
      const idx = r * cols + c;
      const fade = interpolate(appear, [0, 1], [0, 1]);
      dots.push(
        <div
          key={idx}
          style={{
            position: "absolute",
            left: u * width,
            top: v * height,
            width: 7,
            height: 7,
            marginLeft: -3.5,
            marginTop: -3.5,
            borderRadius: 999,
            background: "rgba(120,150,140,0.5)",
            opacity: fade * (0.35 + ((idx * 37) % 10) / 22),
          }}
        />,
      );
    }
  }
  return <div style={{ position: "absolute", inset: 0 }}>{dots}</div>;
};

/** Szene 1 – vier Freunde, vier Orte. */
const SceneWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = spring({ frame, fps, config: { damping: 200 } });
  const out = interpolate(frame, [56, 66], [1, 0], clamp);
  const W = 1000;
  const H = 560;

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={0.25} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 90 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -3,
            color: C.ink,
            textAlign: "center",
            lineHeight: 1.06,
            opacity: appear,
            transform: `translateY(${interpolate(appear, [0, 1], [30, 0])}px)`,
          }}
        >
          Vier Freunde.
          <br />
          <span style={{ color: C.green }}>Vier Orte.</span>
        </div>

        <div style={{ position: "relative", width: W, height: H }}>
          <DotWorld width={W} height={H} appear={appear} />
          {FRIENDS.map((f, i) => {
            const pin = spring({ frame: frame - (8 + i * 9), fps, config: { damping: 12, stiffness: 200 } });
            return (
              <div
                key={f.city}
                style={{
                  position: "absolute",
                  left: f.mx * W,
                  top: f.my * H,
                  transform: `translate(-50%,-100%) scale(${interpolate(pin, [0, 1], [0.4, 1])})`,
                  opacity: pin,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 20px",
                    borderRadius: 999,
                    background: "rgba(10,13,12,0.86)",
                    border: `1.5px solid ${C.green}66`,
                    boxShadow: `0 0 34px ${C.green}33`,
                    color: C.ink,
                    fontSize: 30,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 32 }}>{f.flag}</span>
                  {f.city}
                </div>
                <div style={{ width: 12, height: 12, borderRadius: 999, background: C.green, boxShadow: `0 0 20px ${C.green}` }} />
              </div>
            );
          })}
        </div>

        <div
          style={{
            fontSize: 42,
            fontWeight: 600,
            color: C.muted,
            letterSpacing: 1,
            textAlign: "center",
            opacity: interpolate(frame, [26, 40], [0, 1], clamp),
          }}
        >
          Ronja hat Geburtstag.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PHONE_W = 860;
const PHONE_H = 1560;

/** Y-Dude-Post im App-Rahmen. */
const PostCard: React.FC<{
  frame: number;
  fps: number;
  /** Index des aktiven SlangTags, -1 = keiner. */
  active: number;
  /** 0..1 pro Tag – Auftritt. */
  tagAppear: (i: number) => number;
  showRonja?: boolean;
}> = ({ frame, fps, active, tagAppear, showRonja }) => {
  const IMG_W = PHONE_W - 60;
  const IMG_H = Math.round(IMG_W * 1.25);
  return (
    <div
      style={{
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: 62,
        padding: 12,
        background: "linear-gradient(160deg, #2a2f2d, #0a0b0b 55%, #1b1f1e)",
        boxShadow: `0 60px 140px rgba(0,0,0,0.75), 0 0 90px ${C.green}22`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 52,
          background: "#000",
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Topbar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "34px 34px 18px",
            color: C.ink,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 700 }}>
            <span style={{ color: C.green, fontSize: 34, fontWeight: 800 }}>$</span> Y-Dude
          </div>
          <div style={{ color: C.muted, fontSize: 26, fontWeight: 600 }}>
            {showRonja ? "Für dich" : "Feed"}
          </div>
        </div>

        {/* Autorenzeile */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 34px 18px" }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              background: `linear-gradient(140deg, ${C.green}, ${C.cyan})`,
            }}
          />
          <div style={{ lineHeight: 1.16 }}>
            <div style={{ color: C.ink, fontSize: 28, fontWeight: 700 }}>@jonas + 3</div>
            <div style={{ color: C.muted, fontSize: 22, fontWeight: 600 }}>
              Berlin · Barcelona · New York · Tokyo
            </div>
          </div>
        </div>

        {/* Bild mit SlangTags */}
        <div
          style={{
            position: "relative",
            width: IMG_W,
            height: IMG_H,
            margin: "0 auto",
            borderRadius: 34,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Img
            src={staticFile("images/ronja-birthday.jpg")}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          {FRIENDS.map((f, i) => {
            const a = tagAppear(i);
            if (a <= 0) return null;
            const isActive = active === i;
            const color = C.green;
            return (
              <div
                key={f.city}
                style={{
                  position: "absolute",
                  left: f.tx * IMG_W,
                  top: f.ty * IMG_H,
                  transform: `translate(-50%,-50%) scale(${interpolate(a, [0, 1], [0.55, 1]) * (isActive ? 1.14 : 1)})`,
                  opacity: a * (active >= 0 && !isActive ? 0.55 : 1),
                  filter: isActive ? `drop-shadow(0 0 28px ${color})` : "none",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 18px",
                    borderRadius: 999,
                    background: "rgba(8,11,10,0.82)",
                    border: `1.5px solid ${color}${isActive ? "cc" : "66"}`,
                    boxShadow: `0 0 34px ${color}${isActive ? "55" : "22"}`,
                    color: C.ink,
                    fontSize: 26,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {/* Play-Symbol */}
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      background: isActive ? color : `${color}33`,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isActive ? "#04120b" : color,
                      fontSize: 18,
                    }}
                  >
                    ▶
                  </span>
                  <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.1 }}>
                    <span>{f.label}</span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: `${color}cc` }}>
                      @{f.name.toLowerCase()} · {f.city} · {f.langCode}
                    </span>
                  </span>
                  <Waveform frame={frame} bars={8} height={22} width={3} color={color} active={isActive} />
                </div>
              </div>
            );
          })}

          {/* Tap-Ring beim aktiven Tag */}
          {active >= 0 && (
            <div
              style={{
                position: "absolute",
                left: FRIENDS[active]!.tx * IMG_W,
                top: FRIENDS[active]!.ty * IMG_H,
                width: 200,
                height: 200,
                marginLeft: -100,
                marginTop: -100,
                borderRadius: 999,
                border: `2px solid ${C.green}55`,
                opacity: 0.8,
              }}
            />
          )}
        </div>

        {/* Fußzeile */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 26,
            padding: "26px 40px",
            color: C.muted,
            fontSize: 26,
            fontWeight: 600,
          }}
        >
          <span style={{ color: C.green }}>♥ 128</span>
          <span>💬 24</span>
          <span style={{ marginLeft: "auto", color: C.green }}>▶ Play all</span>
        </div>
      </div>
    </div>
  );
};

/** Szene 2 – der gemeinsame Post entsteht. */
const ScenePost: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const out = interpolate(frame, [58, 66], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={0.35} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 120 }}>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            letterSpacing: -1.4,
            color: C.ink,
            textAlign: "center",
            opacity: interpolate(frame, [4, 18], [0, 1], clamp),
          }}
        >
          Ein Bild. <span style={{ color: C.green }}>Vier Stimmen.</span>
        </div>
        <div
          style={{
            marginTop: 42,
            transform: `translateY(${interpolate(rise, [0, 1], [260, 0])}px) scale(0.72)`,
            transformOrigin: "top center",
            opacity: rise,
          }}
        >
          <PostCard
            frame={frame}
            fps={fps}
            active={-1}
            tagAppear={(i) =>
              spring({ frame: frame - (14 + i * 8), fps, config: { damping: 13, stiffness: 190 } })
            }
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const TAP_LEN = 60;

/** Szene 3 – Ronja öffnet den Post und tippt die SlangTags an. */
const SceneListen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const open = spring({ frame, fps, config: { damping: 200 } });
  const idx = Math.floor((frame - 12) / TAP_LEN);
  const active = frame >= 12 && idx >= 0 && idx < FRIENDS.length ? idx : -1;
  const out = interpolate(frame, [228, 240], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ opacity: out }}>
      <Backdrop energy={active >= 0 ? 0.7 : 0.3} />

      {FRIENDS.map((f, i) => (
        <Sequence key={f.city} from={12 + i * TAP_LEN} durationInFrames={TAP_LEN}>
          <Audio src={staticFile(f.audio)} volume={1} />
        </Sequence>
      ))}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 100 }}>
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: C.green,
            opacity: interpolate(frame, [0, 14], [0, 1], clamp),
          }}
        >
          Ronja tippt · sie hört sie alle
        </div>
        <div
          style={{
            marginTop: 34,
            transform: `translateY(${interpolate(open, [0, 1], [140, 0])}px) scale(${
              0.74 * (1 + (active >= 0 ? 0.02 : 0))
            })`,
            transformOrigin: "top center",
            opacity: open,
          }}
        >
          <PostCard frame={frame} fps={fps} active={active} tagAppear={() => 1} showRonja />
        </div>
      </AbsoluteFill>

      {/* Untertitel der jeweils spielenden Stimme */}
      {active >= 0 && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            bottom: 120,
            textAlign: "center",
            opacity: interpolate((frame - 12) % TAP_LEN, [0, 6, TAP_LEN - 8, TAP_LEN], [0, 1, 1, 0], clamp),
          }}
        >
          <div style={{ color: C.ink, fontSize: 58, fontWeight: 800, letterSpacing: -1.6 }}>
            „{FRIENDS[active]!.label}“
          </div>
          <div style={{ marginTop: 12, color: C.green, fontSize: 34, fontWeight: 600 }}>
            {FRIENDS[active]!.flag} @{FRIENDS[active]!.name.toLowerCase()} · {FRIENDS[active]!.city}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Szene 4 – Ronja lächelt, Schlussclaim, Branding. */
const SceneEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const smile = interpolate(frame, [0, 20], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const claim = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const brand = spring({ frame: frame - 38, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Backdrop energy={0.55} />
      {/* Nahaufnahme Ronja, sanft ausblendend in die Endcard */}
      <AbsoluteFill style={{ opacity: smile * interpolate(frame, [34, 50], [1, 0.12], clamp) }}>
        <Img
          src={staticFile("images/ronja-birthday.jpg")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${interpolate(frame, [0, 84], [1.14, 1.24], clamp)})`,
          }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.9) 100%)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 70 }}>
        <div
          style={{
            fontSize: 94,
            fontWeight: 800,
            letterSpacing: -3.4,
            color: C.ink,
            textAlign: "center",
            lineHeight: 1.04,
            opacity: claim,
            transform: `translateY(${interpolate(claim, [0, 1], [28, 0])}px)`,
            textShadow: "0 20px 60px rgba(0,0,0,0.9)",
          }}
        >
          Far apart.
          <br />
          <span style={{ color: C.green }}>Still together.</span>
        </div>

        <div style={{ opacity: brand }}>
          <BrandLockup
            frame={frame}
            appear={brand}
            sloganAppear={brand}
            markWidth={240}
            textHeight={136}
            energy={0.8}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Y-Dude Social-Clip: „Far apart. Still together.“ (~15,2 s, 9:16) */
export const RonjaVideo: React.FC = () => (
  <AbsoluteFill style={{ background: "#000", fontFamily: FONTS }}>
    <Sequence from={0} durationInFrames={66}>
      <SceneWorld />
    </Sequence>
    <Sequence from={66} durationInFrames={66}>
      <ScenePost />
    </Sequence>
    <Sequence from={132} durationInFrames={240}>
      <SceneListen />
    </Sequence>
    <Sequence from={372} durationInFrames={84}>
      <SceneEndCard />
    </Sequence>
  </AbsoluteFill>
);
