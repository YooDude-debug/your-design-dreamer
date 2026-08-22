import React from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { MessengerScreen } from "./components/messenger/MessengerScreen";
import { BrandLockup } from "./components/BrandLockup";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

// Farb-Emoji (Flaggen, 😂) sind im Render-Chromium nicht installiert -> nachladen.
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

/**
 * "Dein Messenger spricht deine Sprache" – Produktdemo-Short (9:16, 14 s).
 * Ein durchgehender Messenger-Screen (@nikos_demo), Kamera zoomt/faehrt,
 * die Auto-Uebersetzung ist der eigentliche visuelle Effekt.
 */
export const MessengerDemoVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = interpolate(frame, [0, 50, 280, 356, 420], [1.0, 1.06, 1.06, 0.8, 0.78], clamp);
  const drift = Math.sin(frame / 60) * 8;

  const hook = interpolate(frame, [4, 20, 44, 54], [0, 1, 1, 0], clamp);
  const recording = interpolate(frame, [286, 296, 326, 334], [0, 1, 1, 0], clamp);
  const chain = frame - 292;
  const outro = interpolate(frame, [356, 376], [0, 1], clamp);
  const brand = spring({ frame: frame - 372, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [392, 412], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        fontFamily: `${fontFamily}, NotoColorEmojiLocal`,
        overflow: "hidden",
      }}
    >
      {/* dezenter gruener Schimmer hinter dem Geraet */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% ${40 + Math.sin(frame / 50) * 6}%, rgba(47,240,140,0.10), rgba(0,0,0,0) 62%)`,
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${scale}) translateY(${drift}px)`,
            transformOrigin: "50% 64%",
          }}
        >
          <MessengerScreen frame={frame} recording={recording} />
        </div>
      </AbsoluteFill>

      {/* Szene 1 – Hook */}
      {hook > 0.01 ? (
        <AbsoluteFill style={{ justifyContent: "flex-start", padding: "430px 90px 0" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.8) 46%, rgba(0,0,0,0) 74%)",
              opacity: hook,
            }}
          />
          <div
            style={{
              position: "relative",
              fontSize: 96,
              lineHeight: 1.1,
              fontWeight: 800,
              color: C.ink,
              opacity: hook,
              transform: `translateY(${interpolate(hook, [0, 1], [26, 0])}px)`,
            }}
          >
            Was wäre, wenn dein Messenger einfach{" "}
            <span style={{ color: C.green }}>deine Sprache</span> spricht?
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Szene 5 – Voice-Translation-Kette */}
      {recording > 0.01 ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              opacity: recording,
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 30,
              opacity: recording,
            }}
          >
            {[
              { t: "🎤 Deutsch gesprochen", at: 0 },
              { t: "↓ Text erkannt", at: 10 },
              { t: "🇬🇷 Griechisch übersetzt", at: 20, green: true },
            ].map((s) => {
              const p = interpolate(chain, [s.at, s.at + 8], [0, 1], clamp);
              return (
                <div
                  key={s.t}
                  style={{
                    fontSize: 72,
                    fontWeight: 700,
                    color: s.green ? C.green : C.ink,
                    opacity: p,
                    transform: `translateY(${interpolate(p, [0, 1], [24, 0])}px)`,
                  }}
                >
                  {s.t}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* Szene 6 – Abschluss */}
      {outro > 0.01 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.9)",
              opacity: outro,
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 90,
              opacity: outro,
            }}
          >
            <div
              style={{
                fontSize: 70,
                fontWeight: 800,
                color: C.ink,
                textAlign: "center",
                transform: `translateY(${interpolate(outro, [0, 1], [22, 0])}px)`,
              }}
            >
              Deutsch 🇩🇪 <span style={{ color: C.green }}>⇄</span> Griechisch 🇬🇷
            </div>
            <BrandLockup
              frame={frame}
              appear={brand}
              sloganAppear={slogan}
              markWidth={210}
              textHeight={120}
              energy={0.6}
            />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
