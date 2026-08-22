import React from "react";
import {
  AbsoluteFill,
  Easing,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";
import { ArenaScreen, ChatScreen, FeedScreen, GlobeScreen, SH, SW } from "./scenes/tour/screens";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

// Griechische Glyphen (Chatnachrichten) fehlen in Outfit -> Inter mit Greek-Subset.
const inter = loadInter("normal", { weights: ["400", "600"], subsets: ["latin", "greek"] });

const UI_FONT = `${fontFamily}, NotoColorEmojiLocal, sans-serif`;
const CHAT_FONT = `${inter.fontFamily}, NotoColorEmojiLocal, sans-serif`;

// Farb-Emoji (Flaggen, 🌐) sind im Render-Chromium nicht installiert -> nachladen.
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

/** Übergangs-Fortschritt eines Swipes (0..1) – schnell, aber weich. */
const swipe = (frame: number, at: number, dur = 11) =>
  interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });

/** Szenen-Startframes. */
const T = { globe: 56, arena: 118, chat: 178, outro: 258 };

const PHONE_W = 1024;
const PHONE_H = 1802;

const Caption: React.FC<{
  frame: number;
  from: number;
  to: number;
  main: string;
  accent?: string;
  top?: boolean;
  offset?: number;
}> = ({ frame, from, to, main, accent, top = false, offset = 0 }) => {
  const a = interpolate(frame, [from, from + 8, to - 8, to], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        ...(top ? { top: 330 + offset } : { bottom: 150 + offset }),
        textAlign: "center",
        opacity: a,
        transform: `translateY(${interpolate(frame, [from, from + 10], [top ? -24 : 26, 0], clamp)}px)`,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "22px 34px",
          borderRadius: 34,
          background: "rgba(0,0,0,0.62)",
          border: `1px solid ${C.green}33`,
          boxShadow: `0 0 80px rgba(0,0,0,0.8)`,
          color: C.ink,
          fontSize: 58,
          fontWeight: 800,
          letterSpacing: -1.6,
          lineHeight: 1.12,
        }}
      >
        {main}
        {accent ? <span style={{ color: C.green }}> {accent}</span> : null}
      </div>
    </div>
  );
};

/** Sichtbarer Wisch-Impuls über dem Screen. */
const SwipeFlash: React.FC<{ frame: number; at: number; dir: "left" | "right" }> = ({
  frame,
  at,
  dir,
}) => {
  const p = interpolate(frame, [at - 6, at + 10], [0, 1], clamp);
  if (p <= 0 || p >= 1) return null;
  const x = dir === "left" ? interpolate(p, [0, 1], [340, -340]) : interpolate(p, [0, 1], [-340, 340]);
  const fade = interpolate(p, [0, 0.3, 1], [0, 1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "56%",
        transform: `translate(-50%, -50%) translateX(${x}px)`,
        opacity: fade,
        display: "flex",
        alignItems: "center",
        gap: 18,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 220,
          height: 8,
          borderRadius: 99,
          background: `linear-gradient(${dir === "left" ? "270deg" : "90deg"}, ${C.green}, transparent)`,
          boxShadow: `0 0 40px ${C.green}88`,
        }}
      />
      <div
        style={{
          width: 74,
          height: 74,
          borderRadius: 99,
          background: "rgba(255,255,255,0.9)",
          boxShadow: `0 0 60px ${C.green}aa`,
        }}
      />
    </div>
  );
};

/**
 * Y-Dude App-Werbespot – exakt 10 s (300 Frames, 9:16).
 *
 * 0–2 s Feed · 2–4 s Swipe links → Globe · 4–6 s Swipe rechts → Arena ·
 * 6–9 s Messenger mit Live-Übersetzung · 9–10 s Logo + Claim.
 * Alles frame-basiert, kein Ton nötig.
 */
export const AppTourVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p1 = swipe(frame, T.globe);
  const p2 = swipe(frame, T.arena);
  const p3 = swipe(frame, T.chat);

  const xFeed = -SW * p1;
  const xGlobe = SW * (1 - p1) + SW * p2;
  const xArena = -SW * (1 - p2) - SW * p3;
  const xChat = SW * (1 - p3);

  // Kamera: Hook-Punch am Anfang, kurze Kicks bei jedem Swipe, Zoom-out zum Logo.
  const entry = spring({ frame, fps, config: { damping: 200 } });
  const kick =
    1 -
    0.035 *
      [T.globe, T.arena, T.chat].reduce(
        (acc, at) => acc + interpolate(frame, [at - 4, at + 4, at + 16], [0, 1, 0], clamp),
        0,
      );
  const hook = interpolate(frame, [0, 14], [1.1, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const out = interpolate(frame, [T.outro, T.outro + 16], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const drift = Math.sin(frame / 48) * 6;

  const phoneScale = hook * kick * interpolate(out, [0, 1], [1, 0.72]) * interpolate(entry, [0, 1], [1.06, 1]);
  const phoneOpacity = interpolate(frame, [T.outro + 2, T.outro + 16], [1, 0], clamp);

  const brandIn = spring({ frame: frame - (T.outro + 6), fps, config: { damping: 200 } });
  const sloganIn = spring({ frame: frame - (T.outro + 15), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: UI_FONT, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(78% 50% at 50% 42%, ${C.green}1c 0%, rgba(0,0,0,0.97) 72%)`,
        }}
      />

      {/* Smartphone mit den vier App-Screens */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: PHONE_W,
            height: PHONE_H,
            borderRadius: 74,
            padding: 12,
            background: "linear-gradient(160deg, #2a2f2d, #0a0b0b 55%, #1b1f1e)",
            boxShadow: `0 70px 160px rgba(0,0,0,0.8), 0 0 120px ${C.green}22`,
            transform: `translateY(${drift + interpolate(out, [0, 1], [0, -60])}px) scale(${phoneScale})`,
            opacity: phoneOpacity,
          }}
        >
          <div
            style={{
              width: SW,
              height: SH,
              borderRadius: 62,
              overflow: "hidden",
              position: "relative",
              background: C.bg,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {frame < T.arena + 14 && (
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${xFeed}px)` }}>
                <FeedScreen frame={frame} />
              </div>
            )}

            {frame >= T.globe - 12 && frame < T.chat && (
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${xGlobe}px)` }}>
                <GlobeScreen frame={frame - T.globe} />
              </div>
            )}

            {frame >= T.arena - 12 && (
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${xArena}px)` }}>
                <ArenaScreen frame={frame - T.arena} />
              </div>
            )}

            {frame >= T.chat - 12 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: `translateX(${xChat}px)`,
                  fontFamily: CHAT_FONT,
                }}
              >
                <ChatScreen frame={frame - T.chat} />
              </div>
            )}

            {/* Wisch-Impulse direkt auf dem Screen */}
            <SwipeFlash frame={frame} at={T.globe} dir="left" />
            <SwipeFlash frame={frame} at={T.arena} dir="right" />

            {/* Kontrast-Scrim für die Texte */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 66%, rgba(0,0,0,0.55) 100%)",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>

      {/* Kurze Texte – „show it, don't explain it“ */}
      {frame < T.outro && (
        <>
          <Caption
            frame={frame}
            from={4}
            to={T.globe}
            main="What if social media"
            accent="spoke your language?"
          />
          <Caption
            frame={frame}
            from={T.globe + 8}
            to={T.arena}
            main="Local slang →"
            accent="global discovery"
            top
          />
          <Caption
            frame={frame}
            from={T.arena + 8}
            to={T.chat}
            main="Your community."
            accent="Your arena."
            offset={120}
          />
          <Caption
            frame={frame}
            from={T.chat + 10}
            to={T.outro}
            main="Different languages."
            accent="Same conversation."
            top
          />
        </>
      )}

      {/* Logo-Abschluss */}
      {frame >= T.outro + 4 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <BrandLockup
            markWidth={300}
            textHeight={172}
            appear={brandIn}
            sloganAppear={sloganIn}
            frame={frame}
            energy={0.95}
          />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
