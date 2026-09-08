import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  continueRender,
  delayRender,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";
import { SlangChip } from "./components/SlangChip";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });
const inter = loadInter("normal", { weights: ["400", "600"], subsets: ["latin", "greek"] });
const UI_FONT = `${fontFamily}, ${inter.fontFamily}, NotoColorEmojiLocal, sans-serif`;

// Farb-Emoji (Flaggen) sind im Render-Chromium nicht installiert.
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

/** Demo-Beispielinhalte – keine echten Nutzer, keine Likes, keine Zahlen. */
const DEMOS = [
  { flag: "🇬🇷", region: "Griechenland", place: "Athen · GR", tag: "Έλα ρε!", image: "athens.jpg" },
  { flag: "🇩🇪", region: "Deutschland", place: "Berlin · DE", tag: "Was geht?", image: "berlin.jpg" },
  { flag: "🇬🇧", region: "UK", place: "London · UK", tag: "You good?", image: "london.jpg" },
  { flag: "🇮🇹", region: "Italien", place: "Rom · IT", tag: "Come va?", image: "rome.jpg" },
] as const;

const DemoBadge: React.FC = () => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 20px",
      borderRadius: 999,
      background: "rgba(0,0,0,0.6)",
      border: `1px solid ${C.border}`,
      color: C.muted,
      fontSize: 24,
      fontWeight: 600,
      letterSpacing: 2,
      textTransform: "uppercase",
    }}
  >
    Demo-Beispiel
  </div>
);

const Headline: React.FC<{
  frame: number;
  from: number;
  to: number;
  main: string;
  accent?: string;
  size?: number;
  bottom?: number;
}> = ({ frame, from, to, main, accent, size = 82, bottom = 300 }) => {
  const a = interpolate(frame, [from, from + 9, to - 8, to], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom,
        textAlign: "center",
        opacity: a,
        transform: `translateY(${interpolate(a, [0, 1], [34, 0])}px)`,
        color: C.ink,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: -2.4,
        lineHeight: 1.06,
        textShadow: "0 18px 70px rgba(0,0,0,0.85)",
      }}
    >
      {main}
      {accent && (
        <>
          {" "}
          <span style={{ color: C.green }}>{accent}</span>
        </>
      )}
    </div>
  );
};

/** Ein Demo-Feed-Beitrag (bewusst ohne Likes / Nutzerzahlen). */
const DemoCard: React.FC<{
  data: (typeof DEMOS)[number];
  frame: number;
  local: number;
}> = ({ data, frame, local }) => {
  const rise = interpolate(local, [0, 12], [70, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const zoom = interpolate(local, [0, 34], [1.12, 1.02], clamp);
  return (
    <div
      style={{
        width: 880,
        borderRadius: 42,
        overflow: "hidden",
        background: C.card,
        border: `1px solid ${C.green}44`,
        boxShadow: `0 40px 140px rgba(0,0,0,0.8), 0 0 90px ${C.green}22`,
        transform: `translateY(${rise}px)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "26px 30px" }}>
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 999,
            background: `linear-gradient(140deg, ${C.green}, ${C.cyan})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 38,
          }}
        >
          {data.flag}
        </div>
        <div style={{ lineHeight: 1.22 }}>
          <div style={{ color: C.ink, fontSize: 34, fontWeight: 700 }}>{data.region}</div>
          <div style={{ color: C.muted, fontSize: 25 }}>{data.place}</div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <DemoBadge />
        </div>
      </div>

      <div style={{ position: "relative", height: 700, overflow: "hidden" }}>
        <Img
          src={staticFile(`images/${data.image}`)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            transform: `scale(${zoom})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.5))",
          }}
        />
        <div style={{ position: "absolute", left: 36, bottom: 36 }}>
          <SlangChip label={data.tag} frame={frame} playing scale={1.05} meta={data.place} />
        </div>
      </div>
    </div>
  );
};

/** Stimme, die in die Mitte fliegt (Finale). */
const VoiceTile: React.FC<{ p: number; angle: number; label: string; flag: string }> = ({
  p,
  angle,
  label,
  flag,
}) => {
  const r = interpolate(p, [0, 1], [620, 190], { easing: Easing.inOut(Easing.cubic) });
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * r}px, ${
          Math.sin(angle) * r * 1.25
        }px) scale(${interpolate(p, [0, 0.85, 1], [1, 0.9, 0.85])})`,
        opacity: interpolate(p, [0, 0.75, 1], [1, 1, 0.95], clamp),
        padding: "22px 34px",
        borderRadius: 999,
        background: "rgba(10,13,12,0.92)",
        border: `2px solid ${C.green}77`,
        boxShadow: `0 0 70px ${C.green}44`,
        color: C.ink,
        fontSize: 40,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {flag} {label}
    </div>
  );
};

// Timeline (30 fps) – exakt 14 s = 420 Frames
const T = {
  intro: [0, 60],
  feed: [60, 120],
  demos: [120, 240],
  regions: [240, 300],
  connect: [300, 360],
  cta: [360, 420],
} as const;

/**
 * Y-Dude Social-Media-Short (exakt 14 s, 420 Frames, 9:16).
 *
 * 0–2 s Lockup + „DAS NEUE SOCIAL NETWORK“ · 2–4 s Feed + „FÜR SLANG &
 * STIMMEN“ · 4–8 s vier Demo-SlangTags (GR/DE/UK/IT) · 8–10 s Regionenwechsel
 * · 10–12 s Stimmen verbinden sich · 12–14 s Lockup + CTA.
 */
export const SocialShortVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pulse = 1 + Math.sin(frame / 9) * 0.012;
  const bgShift = interpolate(frame, [0, 420], [0, 26]);

  // Demo-Karten: 4 × 30 Frames
  const demoIndex = Math.min(3, Math.floor((frame - T.demos[0]) / 30));
  const demoLocal = frame - T.demos[0] - demoIndex * 30;

  // Regionen-Flicker 8–10 s: 8 harte Wechsel
  const flickIndex = Math.floor((frame - T.regions[0]) / 7.5) % DEMOS.length;

  const connectP = interpolate(frame, [T.connect[0], T.connect[1] - 6], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });

  const ctaSpring = spring({
    frame: frame - T.cta[0],
    fps,
    config: { damping: 16, stiffness: 160 },
  });
  const introSpring = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{ background: C.bg, fontFamily: UI_FONT, overflow: "hidden", color: C.ink }}
    >
      {/* Hintergrund-Glow */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 70% at 50% ${18 + bgShift}%, ${C.green}22, transparent 62%),
                       radial-gradient(90% 60% at 20% 88%, ${C.blue}1f, transparent 65%)`,
        }}
      />

      {/* 0–2 s Intro-Lockup */}
      {frame < T.intro[1] && (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 90,
            opacity: interpolate(frame, [T.intro[1] - 10, T.intro[1]], [1, 0], clamp),
            transform: `scale(${interpolate(introSpring, [0, 1], [1.06, 1]) * pulse})`,
          }}
        >
          <BrandLockup
            frame={frame}
            appear={introSpring}
            sloganAppear={interpolate(frame, [10, 24], [0, 1], clamp)}
            markWidth={240}
            textHeight={140}
          />
          <div
            style={{
              opacity: interpolate(frame, [22, 36], [0, 1], clamp),
              transform: `translateY(${interpolate(frame, [22, 36], [30, 0], clamp)}px)`,
              fontSize: 88,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.02,
              textAlign: "center",
              padding: "0 70px",
            }}
          >
            DAS NEUE
            <br />
            <span style={{ color: C.green }}>SOCIAL NETWORK</span>
          </div>
        </AbsoluteFill>
      )}

      {/* 2–4 s Feed-Anschnitt */}
      {frame >= T.feed[0] && frame < T.demos[0] && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              transform: `translateY(${interpolate(
                frame,
                [T.feed[0], T.feed[0] + 16],
                [220, 0],
                { ...clamp, easing: Easing.out(Easing.cubic) },
              )}px) scale(${interpolate(frame, [T.feed[0], T.feed[1]], [0.92, 1], clamp)})`,
              opacity: interpolate(frame, [T.feed[1] - 8, T.feed[1]], [1, 0], clamp),
              display: "flex",
              flexDirection: "column",
              gap: 26,
              alignItems: "center",
            }}
          >
            {DEMOS.slice(0, 3).map((d, i) => (
              <div
                key={d.tag}
                style={{
                  width: 860,
                  height: 190,
                  borderRadius: 34,
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  padding: "0 32px",
                  opacity: interpolate(
                    frame,
                    [T.feed[0] + i * 6, T.feed[0] + 12 + i * 6],
                    [0, 1],
                    clamp,
                  ),
                }}
              >
                <Img
                  src={staticFile(`images/${d.image}`)}
                  style={{
                    width: 150,
                    height: 150,
                    borderRadius: 24,
                    objectFit: "cover",
                  }}
                />
                <div>
                  <SlangChip label={d.tag} frame={frame} playing scale={0.86} meta={d.place} />
                </div>
              </div>
            ))}
          </div>
          <Headline
            frame={frame}
            from={T.feed[0] + 6}
            to={T.feed[1]}
            main="FÜR SLANG &"
            accent="STIMMEN"
            size={86}
            bottom={210}
          />
        </AbsoluteFill>
      )}

      {/* 4–8 s Demo-SlangTags */}
      {frame >= T.demos[0] && frame < T.regions[0] && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <DemoCard data={DEMOS[demoIndex]!} frame={frame} local={demoLocal} />
        </AbsoluteFill>
      )}

      {/* 8–10 s schneller Regionenwechsel */}
      {frame >= T.regions[0] && frame < T.connect[0] && (
        <AbsoluteFill>
          <Img
            src={staticFile(`images/${DEMOS[flickIndex]!.image}`)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.14 + (flickIndex % 2) * 0.04})`,
              filter: "saturate(1.1) contrast(1.05)",
            }}
          />
          <AbsoluteFill
            style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0.82))" }}
          />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <SlangChip
              label={DEMOS[flickIndex]!.tag}
              frame={frame}
              playing
              scale={1.35}
              meta={DEMOS[flickIndex]!.place}
            />
          </AbsoluteFill>
          <div style={{ position: "absolute", top: 120, left: 0, right: 0, textAlign: "center" }}>
            <DemoBadge />
          </div>
          <Headline
            frame={frame}
            from={T.regions[0] + 4}
            to={T.connect[0]}
            main="Jede Region hat"
            accent="ihren Sound."
            size={80}
            bottom={260}
          />
        </AbsoluteFill>
      )}

      {/* 10–12 s Stimmen verbinden sich */}
      {frame >= T.connect[0] && frame < T.cta[0] && (
        <AbsoluteFill>
          {DEMOS.map((d, i) => (
            <VoiceTile
              key={d.tag}
              p={connectP}
              angle={(i / DEMOS.length) * Math.PI * 2 + 0.5}
              label={d.tag}
              flag={d.flag}
            />
          ))}
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                width: interpolate(connectP, [0.4, 1], [0, 300], clamp),
                height: interpolate(connectP, [0.4, 1], [0, 300], clamp),
                borderRadius: 999,
                background: `radial-gradient(circle, ${C.green}55, transparent 70%)`,
                filter: "blur(6px)",
              }}
            />
          </AbsoluteFill>
          <Headline
            frame={frame}
            from={T.connect[0] + 6}
            to={T.cta[0]}
            main="Gemeinsam geben wir"
            accent="eine Stimme."
            size={78}
            bottom={300}
          />
        </AbsoluteFill>
      )}

      {/* 12–14 s Lockup + CTA */}
      {frame >= T.cta[0] && (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            gap: 80,
            transform: `scale(${interpolate(ctaSpring, [0, 1], [0.9, 1]) * pulse})`,
          }}
        >
          <BrandLockup
            frame={frame}
            appear={ctaSpring}
            sloganAppear={interpolate(frame, [T.cta[0] + 8, T.cta[0] + 22], [0, 1], clamp)}
            markWidth={250}
            textHeight={146}
          />
          <div
            style={{
              opacity: interpolate(frame, [T.cta[0] + 10, T.cta[0] + 24], [0, 1], clamp),
              transform: `translateY(${interpolate(
                frame,
                [T.cta[0] + 10, T.cta[0] + 24],
                [34, 0],
                clamp,
              )}px)`,
              padding: "30px 54px",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`,
              color: "#04120b",
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: -1.4,
              boxShadow: `0 0 90px ${C.green}55`,
            }}
          >
            KOSTENLOS REGISTRIEREN →
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
