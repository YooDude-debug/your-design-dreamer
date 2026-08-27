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
import { MessengerAdScreen, type TargetLang } from "./components/messenger/MessengerAdScreen";
import { BrandLockup } from "./components/BrandLockup";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
});

const EMOJI_URL =
  "https://id-preview--28c6b349-006b-4137-bd0e-13eee9cc6ca0.lovable.app/__l5e/assets-v1/88076456-9a8e-4249-8abc-f8bdfe0bf88d/NotoColorEmoji.ttf";

if (typeof document !== "undefined" && typeof FontFace !== "undefined") {
  const handle = delayRender("noto-color-emoji-ad");
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

/** Sprachkette der Szene 5–8 s: Deutsch → Englisch → Griechisch → Spanisch. */
const LANGS: { from: number; lang: TargetLang }[] = [
  {
    from: 0,
    lang: {
      flag: "🇩🇪",
      label: "Deutsch",
      translated: "Hey Alter, bei mir alles gut! Und bei dir?",
      reply: "Alles top – lass uns nachher schreiben!",
    },
  },
  {
    from: 150,
    lang: {
      flag: "🇬🇧",
      label: "English",
      translated: "Hey mate, all good here! And you?",
      reply: "All good – let's talk later!",
    },
  },
  {
    from: 186,
    lang: {
      flag: "🇬🇷",
      label: "Ελληνικά",
      translated: "Γεια σου φίλε, όλα καλά εδώ! Εσύ;",
      reply: "Όλα καλά – τα λέμε μετά!",
    },
  },
  {
    from: 222,
    lang: {
      flag: "🇪🇸",
      label: "Español",
      translated: "¡Hola tío, todo bien por aquí! ¿Y tú?",
      reply: "¡Todo genial, hablamos luego!",
    },
  },
];

const pickLang = (frame: number) => {
  let current = LANGS[0];
  for (const entry of LANGS) if (frame >= entry.from) current = entry;
  return current;
};

/**
 * "Alle Sprachen. Ein Messenger." – 11-Sekunden-Werbeclip (330 Frames, 9:16).
 * Zentrales Element ist die bestehende Y-Dude-Messenger-Vorschau.
 */
export const MessengerAdVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entry = pickLang(frame);
  const sinceSwap = frame - entry.from;
  const swap = entry.from === 0 ? 0 : interpolate(sinceSwap, [0, 6, 14], [1, 0.5, 0], clamp);

  const scale = interpolate(
    frame,
    [0, 40, 150, 200, 280, 300, 330],
    [1.04, 1.1, 1.1, 1.02, 1.0, 0.86, 0.84],
    clamp,
  );
  const drift = Math.sin(frame / 55) * 6;

  // 2–5 s: "Automatisch übersetzt"
  const badge = interpolate(frame, [62, 74, 138, 148], [0, 1, 1, 0], clamp);
  const badgePop = spring({ frame: frame - 62, fps, config: { damping: 18, stiffness: 190 } });

  // 5–8 s: Sprachkette als dezente Leiste
  const chain = interpolate(frame, [150, 160, 232, 244], [0, 1, 1, 0], clamp);

  // 8–10 s: Sprachbarriere verschwindet
  const barrier = interpolate(frame, [244, 256, 288, 298], [0, 1, 1, 0], clamp);

  // 10–11 s: Branding
  const outro = interpolate(frame, [298, 310], [0, 1], clamp);
  const brand = spring({ frame: frame - 308, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [316, 328], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        background: "#000",
        fontFamily: `${fontFamily}, NotoColorEmojiLocal`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 50% ${42 + Math.sin(frame / 48) * 5}%, rgba(47,240,140,0.12), rgba(0,0,0,0) 62%)`,
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${scale}) translateY(${drift}px)`,
            transformOrigin: "50% 58%",
          }}
        >
          <MessengerAdScreen frame={frame} lang={entry.lang} swap={swap} />
        </div>
      </AbsoluteFill>

      {/* 2–5 s: Automatisch übersetzt */}
      {badge > 0.01 ? (
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 300 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "24px 46px",
              borderRadius: 99,
              border: "2px solid rgba(47,240,140,0.55)",
              background: "rgba(6,20,14,0.92)",
              color: C.ink,
              fontSize: 52,
              fontWeight: 700,
              opacity: badge,
              transform: `scale(${interpolate(badgePop, [0, 1], [0.9, 1])})`,
              boxShadow: "0 0 80px rgba(47,240,140,0.22)",
            }}
          >
            <span style={{ color: C.green }}>🌐</span> Automatisch übersetzt
          </div>
        </AbsoluteFill>
      ) : null}

      {/* 5–8 s: Sprachkette */}
      {chain > 0.01 ? (
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 300 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "20px 38px",
              borderRadius: 99,
              border: `2px solid ${C.border}`,
              background: "rgba(0,0,0,0.86)",
              fontSize: 44,
              fontWeight: 600,
              color: C.muted,
              opacity: chain,
            }}
          >
            {LANGS.map((l, i) => {
              const active = l.from === entry.from;
              return (
                <React.Fragment key={l.lang.label}>
                  {i > 0 ? <span style={{ opacity: 0.5 }}>→</span> : null}
                  <span
                    style={{
                      color: active ? C.green : C.muted,
                      opacity: active ? 1 : 0.6,
                      transform: `scale(${active ? 1.06 : 1})`,
                    }}
                  >
                    {l.lang.flag} {l.lang.label}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        </AbsoluteFill>
      ) : null}

      {/* 8–10 s: Sprachbarriere verschwindet */}
      {barrier > 0.01 ? (
        <AbsoluteFill
          style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 286 }}
        >
          <div
            style={{
              textAlign: "center",
              fontSize: 62,
              fontWeight: 800,
              color: C.ink,
              opacity: barrier,
              transform: `translateY(${interpolate(barrier, [0, 1], [18, 0])}px)`,
              textShadow: "0 0 60px rgba(0,0,0,0.9)",
            }}
          >
            Du schreibst in <span style={{ color: C.green }}>deiner</span> Sprache.
            <br />
            Sie liest in <span style={{ color: C.cyan }}>ihrer</span>.
          </div>
        </AbsoluteFill>
      ) : null}

      {/* 10–11 s: Branding */}
      {outro > 0.01 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.92)",
              opacity: outro,
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 80,
              opacity: outro,
            }}
          >
            <div
              style={{
                fontSize: 104,
                lineHeight: 1.08,
                fontWeight: 800,
                letterSpacing: 2,
                textAlign: "center",
                color: C.ink,
                transform: `translateY(${interpolate(outro, [0, 1], [24, 0])}px)`,
              }}
            >
              ALLE <span style={{ color: C.green }}>SPRACHEN</span>.
              <br />
              EIN MESSENGER.
            </div>
            <BrandLockup
              frame={frame}
              appear={brand}
              sloganAppear={slogan}
              markWidth={220}
              textHeight={126}
              energy={0.7}
            />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
