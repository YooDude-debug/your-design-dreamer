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
import { ArenaScreen, ChatScreen, GlobeScreen, SH, SW } from "./scenes/tour/screens";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const inter = loadInter("normal", { weights: ["400", "600"], subsets: ["latin", "greek"] });

const UI_FONT = `${fontFamily}, NotoColorEmojiLocal, sans-serif`;
const CHAT_FONT = `${inter.fontFamily}, NotoColorEmojiLocal, sans-serif`;
const MONO_FONT = `"DejaVu Sans Mono", ui-monospace, monospace`;
/* Retro-Windows-Optik: klassische UI-Schrift, absichtlich pixelig gerendert. */
const XP_FONT = `Tahoma, Verdana, "DejaVu Sans", NotoColorEmojiLocal, sans-serif`;

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

/** Szenen-Startframes (30 fps, 450 Frames = 15 s). */
const T = {
  stats: 20,
  xp: 130,
  refresh: 226,
  works: 268,
  app: 294,
  battle: 390,
  outro: 426,
};

const STATS = [
  "128.550 aktive Codezeilen",
  "813 Dateien",
  "115 DB-Tabellen",
  "284 RLS-Policies",
  "449/449 Tests grün",
  "79/100 Gesamtscore",
];

/* ------------------------------------------------------------------ */
/* 1 · Startup – trocken, technisch                                    */
/* ------------------------------------------------------------------ */

const StartupScene: React.FC<{ frame: number }> = ({ frame }) => {
  const out = interpolate(frame, [T.xp - 8, T.xp], [1, 0], clamp);
  const titleIn = interpolate(frame, [0, 10], [0, 1], clamp);
  return (
    <AbsoluteFill
      style={{
        opacity: out,
        alignItems: "center",
        justifyContent: "center",
        padding: "0 90px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 880 }}>
        <div
          style={{
            fontSize: 74,
            fontWeight: 800,
            letterSpacing: -2,
            color: C.ink,
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [18, 0])}px)`,
            marginBottom: 56,
          }}
        >
          STARTUP GEGRÜNDET.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, fontFamily: MONO_FONT }}>
          {STATS.map((s, i) => {
            const at = T.stats + i * 15;
            const a = interpolate(frame, [at, at + 6], [0, 1], clamp);
            if (a <= 0) return null;
            return (
              <div
                key={s}
                style={{
                  opacity: a,
                  transform: `translateX(${interpolate(a, [0, 1], [-16, 0])}px)`,
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  fontSize: 44,
                  color: C.ink,
                  borderLeft: `4px solid ${C.green}`,
                  paddingLeft: 22,
                }}
              >
                <span style={{ color: C.muted, fontSize: 30 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 2 · XP-Chaos                                                        */
/* ------------------------------------------------------------------ */

const XpWindow: React.FC<{
  title: string;
  headline: string;
  body: string;
  x: number;
  y: number;
  rot: number;
  appear: number;
  highlight?: boolean;
  cursorAt?: boolean;
}> = ({ title, headline, body, x, y, rot, appear, highlight, cursorAt }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 660,
      transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${interpolate(appear, [0, 1], [0.82, 1])})`,
      opacity: appear,
      fontFamily: XP_FONT,
      imageRendering: "pixelated",
      boxShadow: "6px 8px 0 rgba(0,0,0,0.55)",
      border: "2px solid #0a246a",
      borderRadius: 6,
      overflow: "hidden",
      background: "#ece9d8",
    }}
  >
    <div
      style={{
        background: "linear-gradient(180deg, #4a7fce 0%, #0a246a 55%, #1b4a9c 100%)",
        color: "#fff",
        fontSize: 30,
        fontWeight: 700,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        textShadow: "1px 1px 0 rgba(0,0,0,0.6)",
      }}
    >
      <span>{title}</span>
      <span style={{ display: "flex", gap: 6 }}>
        {["_", "□", "×"].map((s) => (
          <span
            key={s}
            style={{
              width: 34,
              height: 30,
              background: "linear-gradient(180deg, #7fa9e4, #2c5aa8)",
              border: "2px solid #dbe6f7",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            {s}
          </span>
        ))}
      </span>
    </div>
    <div style={{ padding: "28px 26px", display: "flex", gap: 22, alignItems: "flex-start" }}>
      <div
        style={{
          width: 66,
          height: 66,
          minWidth: 66,
          borderRadius: 99,
          background: "#d40000",
          border: "3px solid #7a0000",
          color: "#fff",
          fontWeight: 800,
          fontSize: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </div>
      <div style={{ color: "#101010" }}>
        <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 8 }}>{headline}</div>
        <div style={{ fontSize: 27, lineHeight: 1.3 }}>{body}</div>
      </div>
    </div>
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        padding: "0 26px 26px",
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 26,
          padding: "12px 30px",
          background: highlight ? "#d6e6ff" : "linear-gradient(180deg,#fdfdfd,#d6d2c2)",
          border: "2px solid #7b7563",
          borderRadius: 5,
          color: "#101010",
          fontWeight: 700,
          boxShadow: highlight ? "0 0 0 3px #0a246a" : "none",
        }}
      >
        Refresh
      </div>
      <div
        style={{
          fontSize: 26,
          padding: "12px 30px",
          background: "linear-gradient(180deg,#fdfdfd,#d6d2c2)",
          border: "2px solid #7b7563",
          borderRadius: 5,
          color: "#101010",
        }}
      >
        OK
      </div>
      {cursorAt ? (
        <div style={{ position: "absolute", right: 118, bottom: -4, fontSize: 54 }}>➤</div>
      ) : null}
    </div>
  </div>
);

const ERRORS = [
  { at: 0, title: "Y-DUDE.EXE", head: "Unexpected Error.", body: "OH NO…", x: 540, y: 760, rot: -3 },
  {
    at: 26,
    title: "ERROR 2",
    head: "Module not responding.",
    body: "slangtag.dll",
    x: 400,
    y: 940,
    rot: 4,
  },
  {
    at: 38,
    title: "ERROR 3",
    head: "Illegal operation.",
    body: "feed.exe",
    x: 690,
    y: 1080,
    rot: -6,
  },
  {
    at: 48,
    title: "ERROR 4",
    head: "Stack overflow.",
    body: "globe.sys",
    x: 430,
    y: 1220,
    rot: 7,
  },
  {
    at: 58,
    title: "ERROR 5",
    head: "System says nope.",
    body: "battle.bat",
    x: 660,
    y: 1370,
    rot: -4,
  },
];

const XpScene: React.FC<{ frame: number }> = ({ frame }) => {
  const local = frame - T.xp;
  const out = interpolate(frame, [T.works - 14, T.works - 4], [1, 0], clamp);
  const shake = local < 74 ? Math.sin(local * 2.2) * (local > 24 ? 8 : 0) : 0;
  const clicked = frame >= T.refresh + 8;
  return (
    <AbsoluteFill style={{ opacity: out, transform: `translateX(${shake}px)` }}>
      <AbsoluteFill style={{ background: "#0b3b6f" }} />
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, rgba(0,0,0,0) 2px 4px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 300,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: XP_FONT,
          color: "#fff",
          fontSize: 96,
          fontWeight: 800,
          textShadow: "4px 4px 0 rgba(0,0,0,0.6)",
          opacity: interpolate(local, [6, 16], [0, 1], clamp),
        }}
      >
        OH NO… 💀
      </div>

      {ERRORS.map((e, i) => {
        const appear = interpolate(local, [e.at, e.at + 5], [0, 1], clamp);
        if (appear <= 0) return null;
        return (
          <XpWindow
            key={e.title}
            title={e.title}
            headline={e.head}
            body={e.body}
            x={e.x}
            y={e.y}
            rot={e.rot}
            appear={appear}
            highlight={i === ERRORS.length - 1 && frame >= T.refresh}
            cursorAt={i === ERRORS.length - 1 && frame >= T.refresh - 6}
          />
        );
      })}

      {/* Klick-Impuls auf Refresh */}
      {clicked && frame < T.works ? (
        <AbsoluteFill
          style={{
            background: "#fff",
            opacity: interpolate(frame, [T.refresh + 8, T.refresh + 14], [0.85, 0], clamp),
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 3 · „AHHH… JETZT GEHT'S.“                                           */
/* ------------------------------------------------------------------ */

const WorksScene: React.FC<{ frame: number }> = ({ frame }) => {
  const a = interpolate(frame, [T.works, T.works + 8, T.app + 4, T.app + 14], [0, 1, 1, 0], clamp);
  if (a <= 0) return null;
  const glitch = frame < T.works + 10 ? (frame % 2 === 0 ? -10 : 10) : 0;
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: a,
        background: "rgba(0,0,0,0.72)",
      }}
    >
      <div
        style={{
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: -3,
          color: C.ink,
          textAlign: "center",
          transform: `translateX(${glitch}px)`,
          textShadow: `0 0 60px ${C.green}66`,
        }}
      >
        AHHH…
        <br />
        <span style={{ color: C.green }}>JETZT GEHT'S.</span>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* 4 · Echtes Y-Dude – bestehende Screens                              */
/* ------------------------------------------------------------------ */

const PHONE_W = 1024;
const PHONE_H = 1802;

const AppScene: React.FC<{ frame: number }> = ({ frame }) => {
  const local = frame - T.app;
  const chatTo = 36;
  const globeTo = 74;
  const p1 = interpolate(local, [chatTo, chatTo + 10], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const p2 = interpolate(local, [globeTo, globeTo + 10], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const xChat = -SW * p1;
  const xGlobe = SW * (1 - p1) + -SW * p2 * 0;
  const xArena = SW * (1 - p2);

  const drift = Math.sin(frame / 48) * 6;
  const inScale = interpolate(local, [0, 14], [1.08, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const outFade = interpolate(frame, [T.outro - 12, T.outro], [1, 0], clamp);

  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", opacity: outFade * 1 }}
    >
      <div
        style={{
          width: PHONE_W,
          height: PHONE_H,
          borderRadius: 74,
          padding: 12,
          background: "linear-gradient(160deg, #2a2f2d, #0a0b0b 55%, #1b1f1e)",
          boxShadow: `0 70px 160px rgba(0,0,0,0.8), 0 0 120px ${C.green}22`,
          transform: `translateY(${drift}px) scale(${inScale})`,
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translateX(${xChat}px)`,
              fontFamily: CHAT_FONT,
            }}
          >
            <ChatScreen frame={local} />
          </div>
          {local >= chatTo - 12 && (
            <div style={{ position: "absolute", inset: 0, transform: `translateX(${xGlobe}px)` }}>
              <GlobeScreen frame={local - chatTo} />
            </div>
          )}
          {local >= globeTo - 12 && (
            <div style={{ position: "absolute", inset: 0, transform: `translateX(${xArena}px)` }}>
              <ArenaScreen frame={local - globeTo} />
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const BattleOverlay: React.FC<{ frame: number }> = ({ frame }) => {
  const a = interpolate(
    frame,
    [T.battle, T.battle + 8, T.outro - 6, T.outro],
    [0, 1, 1, 0],
    clamp,
  );
  if (a <= 0) return null;
  const pulse = 0.6 + Math.abs(Math.sin((frame - T.battle) / 6)) * 0.4;
  const City: React.FC<{ flag: string; name: string; delay: number }> = ({
    flag,
    name,
    delay,
  }) => {
    const s = interpolate(frame, [T.battle + delay, T.battle + delay + 8], [0, 1], clamp);
    return (
      <div
        style={{
          opacity: s,
          transform: `translateY(${interpolate(s, [0, 1], [22, 0])}px)`,
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: -2,
          color: C.ink,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}
      >
        <span>{flag}</span>
        {name}
      </div>
    );
  };
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.86)",
        opacity: a,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <City flag="🇩🇪" name="BERLIN" delay={0} />
        <div style={{ fontSize: 58, fontWeight: 800, color: C.red, letterSpacing: 6 }}>VS</div>
        <City flag="🇬🇷" name="ATHEN" delay={8} />
        <div
          style={{
            marginTop: 34,
            padding: "22px 40px",
            borderRadius: 34,
            border: `2px solid ${C.green}`,
            color: C.green,
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: 1,
            boxShadow: `0 0 ${40 * pulse}px ${C.green}66`,
            opacity: interpolate(frame, [T.battle + 12, T.battle + 20], [0, 1], clamp),
          }}
        >
          🔥 SLANG BATTLE STARTET
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * "Startup → XP-Chaos → Refresh → echtes Y-Dude" (15 s, 9:16).
 *
 * Nur Teil 1+2 sind neu inszeniert; ab Frame 300 werden ausschliesslich die
 * bestehenden Y-Dude-Screens (Chat, Globe, Arena) und der offizielle
 * Branding-Lockup wiederverwendet.
 */
export const XpChaosVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const brandIn = spring({ frame: frame - (T.outro + 2), fps, config: { damping: 200 } });
  const sloganIn = spring({ frame: frame - (T.outro + 10), fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: UI_FONT, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(78% 50% at 50% 42%, ${C.green}1c 0%, rgba(0,0,0,0.97) 72%)`,
        }}
      />

      {frame < T.xp && <StartupScene frame={frame} />}
      {frame >= T.xp && frame < T.works + 6 && <XpScene frame={frame} />}
      {frame >= T.works && frame < T.app + 16 && <WorksScene frame={frame} />}
      {frame >= T.app && frame < T.outro && <AppScene frame={frame} />}
      {frame >= T.battle && frame < T.outro && <BattleOverlay frame={frame} />}

      {frame >= T.outro && (
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
