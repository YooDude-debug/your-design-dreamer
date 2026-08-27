import React from "react";
import {
  AbsoluteFill,
  Easing,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";
import { PhoneFrame } from "./components/PhoneFrame";
import {
  ChannelScene,
  ChatScene,
  GlobeScene,
  MarketScene,
  PostsScene,
  SH,
  SW,
} from "./scenes/oneplatform/screens";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });
const inter = loadInter("normal", { weights: ["400", "600"], subsets: ["latin", "greek"] });

const UI_FONT = `${fontFamily}, ${inter.fontFamily}, NotoColorEmojiLocal, sans-serif`;

// Farb-Emoji (Flaggen, 🌐, 🎤) sind im Render-Chromium nicht installiert.
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

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const PHONE_W = 1024;
const PHONE_H = 1802;

/** Szenenplan (Frames bei 30 fps) – 14 s = 420 Frames. */
const SCENES = [
  {
    key: "globe",
    from: 0,
    to: 62,
    Comp: GlobeScene,
    caption: "Eine Welt.",
    accent: "Viele Sprachen.",
  },
  {
    key: "chat",
    from: 62,
    to: 122,
    Comp: ChatScene,
    caption: "Chatten ohne",
    accent: "Sprachbarriere.",
  },
  {
    key: "channel",
    from: 122,
    to: 182,
    Comp: ChannelScene,
    caption: "Channels verbinden",
    accent: "Regionen.",
  },
  {
    key: "market",
    from: 182,
    to: 272,
    Comp: MarketScene,
    caption: "Market:",
    accent: "Verhandeln per Stimme.",
  },
  {
    key: "posts",
    from: 272,
    to: 336,
    Comp: PostsScene,
    caption: "Beiträge mit",
    accent: "SlangTag & Audio.",
  },
] as const;

const OUTRO = 336;
const XFADE = 11;

const Caption: React.FC<{
  frame: number;
  from: number;
  to: number;
  main: string;
  accent: string;
}> = ({ frame, from, to, main, accent }) => {
  const a = interpolate(frame, [from + 4, from + 16, to - 12, to], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 128,
        textAlign: "center",
        opacity: a,
        transform: `translateY(${interpolate(a, [0, 1], [26, 0])}px)`,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "22px 34px",
          borderRadius: 34,
          background: "rgba(0,0,0,0.66)",
          border: `1px solid ${C.green}33`,
          boxShadow: "0 0 80px rgba(0,0,0,0.8)",
          color: C.ink,
          fontSize: 56,
          fontWeight: 800,
          letterSpacing: -1.6,
          lineHeight: 1.12,
        }}
      >
        {main} <span style={{ color: C.green }}>{accent}</span>
      </div>
    </div>
  );
};

/** Kleine Kachel eines Bereichs – fliegt im Finale in die Mitte. */
const MergeTile: React.FC<{ p: number; angle: number; label: string; color: string }> = ({
  p,
  angle,
  label,
  color,
}) => {
  const r = interpolate(p, [0, 1], [560, 0], { easing: Easing.inOut(Easing.cubic) });
  const x = Math.cos(angle) * r;
  const y = Math.sin(angle) * r * 1.35;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "48%",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${interpolate(p, [0, 0.8, 1], [1, 0.5, 0.1])})`,
        opacity: interpolate(p, [0, 0.7, 1], [1, 0.9, 0], clamp),
        padding: "26px 40px",
        borderRadius: 34,
        background: "rgba(10,13,12,0.92)",
        border: `2px solid ${color}88`,
        boxShadow: `0 0 70px ${color}44`,
        color: C.ink,
        fontSize: 44,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

/**
 * Y-Dude – „One Platform. One Common Language.“ (14 s, 420 Frames, 9:16).
 *
 * 0–2 s Globe · 2–4 s Messenger · 4–6 s Channel · 6–9 s Market mit
 * Audio-Verhandlung (Angebot → Gegenangebot → Einigung) · 9–11 s Beiträge ·
 * 11–14 s Verschmelzung zur einen Plattform + Branding-Lockup.
 */
export const OnePlatformVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = spring({ frame, fps, config: { damping: 200 } });
  const hook = interpolate(frame, [0, 18], [1.08, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const out = interpolate(frame, [OUTRO, OUTRO + 22], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const drift = Math.sin(frame / 54) * 7;

  const phoneScale =
    hook * interpolate(entry, [0, 1], [1.05, 1]) * interpolate(out, [0, 1], [1, 0.62]);
  const phoneOpacity = interpolate(frame, [OUTRO + 4, OUTRO + 22], [1, 0], clamp);

  const merge = interpolate(frame, [OUTRO + 8, OUTRO + 46], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const headline = spring({ frame: frame - (OUTRO + 36), fps, config: { damping: 200 } });
  const brandIn = spring({ frame: frame - (OUTRO + 52), fps, config: { damping: 200 } });
  const sloganIn = spring({ frame: frame - (OUTRO + 60), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: UI_FONT, overflow: "hidden" }}>
      {/* Atmosphäre: weiche grüne Lichtwolken, langsam driftend. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(1100px 900px at 50% ${28 + drift}%, ${C.green}1c, transparent 70%),
                       radial-gradient(900px 800px at 12% 82%, ${C.cyan}14, transparent 72%),
                       linear-gradient(180deg, #040806 0%, #000 60%, #030705 100%)`,
        }}
      />

      {/* Telefon mit allen App-Bereichen */}
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", opacity: phoneOpacity }}
      >
        <div
          style={{
            transform: `scale(${phoneScale}) translateY(${drift}px)`,
          }}
        >
          <PhoneFrame width={PHONE_W} height={PHONE_H}>
            <div style={{ position: "relative", width: SW, height: SH }}>
              {SCENES.map((s) => {
                const a = interpolate(
                  frame,
                  [s.from - XFADE, s.from, s.to - XFADE, s.to],
                  [0, 1, 1, 0],
                  clamp,
                );
                if (a <= 0) return null;
                const zoom = interpolate(a, [0, 1], [1.04, 1]);
                return (
                  <div
                    key={s.key}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: a,
                      transform: `scale(${zoom})`,
                    }}
                  >
                    <s.Comp frame={frame - s.from} />
                  </div>
                );
              })}
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>

      {/* Cinematic dip: kurzer dunkler Impuls an jedem Szenenwechsel. */}
      {SCENES.slice(1).map((s) => {
        const d = interpolate(
          frame,
          [s.from - XFADE, s.from - XFADE / 2, s.from],
          [0, 0.62, 0],
          clamp,
        );
        if (d <= 0) return null;
        return <AbsoluteFill key={`dip-${s.key}`} style={{ background: "#000", opacity: d }} />;
      })}

      {SCENES.map((s) => (
        <Caption
          key={s.key}
          frame={frame}
          from={s.from}
          to={s.to}
          main={s.caption}
          accent={s.accent}
        />
      ))}

      {/* Finale: alle Bereiche verschmelzen */}
      {frame >= OUTRO && (
        <AbsoluteFill>
          {merge < 1 && (
            <>
              <MergeTile p={merge} angle={-Math.PI / 2} label="Globe" color={C.green} />
              <MergeTile p={merge} angle={-0.2} label="Messenger" color={C.cyan} />
              <MergeTile p={merge} angle={Math.PI / 2} label="Market" color={C.green} />
              <MergeTile p={merge} angle={Math.PI + 0.2} label="Channels" color={C.blue} />
              <MergeTile p={merge} angle={Math.PI * 0.75} label="Feed" color={C.greenSoft} />
            </>
          )}

          <AbsoluteFill
            style={{
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 74,
              padding: "0 70px",
            }}
          >
            <div
              style={{
                textAlign: "center",
                opacity: headline,
                transform: `translateY(${interpolate(headline, [0, 1], [30, 0])}px) scale(${interpolate(
                  headline,
                  [0, 1],
                  [0.94, 1],
                )})`,
                color: C.ink,
                fontSize: 92,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1.05,
                textShadow: `0 0 90px ${C.green}33`,
              }}
            >
              ONE PLATFORM.
              <br />
              <span style={{ color: C.green }}>ONE COMMON LANGUAGE.</span>
            </div>

            <BrandLockup
              frame={frame}
              markWidth={230}
              textHeight={132}
              appear={brandIn}
              sloganAppear={sloganIn}
              energy={0.85}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
