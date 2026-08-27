import React from "react";
import { Easing, Img, interpolate, staticFile } from "remotion";
import { C } from "../../theme";
import { GlobeSvg, project, type Cam } from "../../components/GlobeSvg";
import { SlangChip } from "../../components/SlangChip";
import { Waveform } from "../../components/Waveform";

/** Innenmaße des Smartphone-Screens (identisch zum App-Tour-Clip). */
export const SW = 1000;
export const SH = 1778;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const ease = (frame: number, start: number, dur = 14) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

const rise = (p: number, y = 26): React.CSSProperties => ({
  opacity: p,
  transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px) scale(${interpolate(p, [0, 1], [0.97, 1])})`,
});

export const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      width: SW,
      height: SH,
      background: C.bg,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
    }}
  >
    {children}
    {/* Sichere Zone fuer die Untertitel des Clips. */}
    <div style={{ flex: "0 0 auto", height: 230 }} />
  </div>
);

const StatusBar: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "22px 40px 6px",
      color: C.ink,
      fontSize: 28,
      opacity: 0.75,
      flex: "0 0 auto",
    }}
  >
    <span>21:12</span>
    <span style={{ letterSpacing: 5 }}>▮▮▮ 86 %</span>
  </div>
);

const TopBar: React.FC<{ title: string; sub?: string }> = ({ title, sub }) => (
  <div
    style={{
      flex: "0 0 auto",
      padding: "8px 34px 20px",
      borderBottom: `1px solid ${C.border}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ color: C.ink, fontSize: 42, fontWeight: 700, letterSpacing: -1 }}>{title}</div>
      <div style={{ display: "flex", gap: 18, color: C.muted, fontSize: 32 }}>
        <span>🔍</span>
        <span style={{ color: C.green }}>🌐</span>
      </div>
    </div>
    {sub ? <div style={{ marginTop: 10, color: C.muted, fontSize: 27 }}>{sub}</div> : null}
  </div>
);

const Avatar: React.FC<{
  label: string;
  size?: number;
  color?: string;
}> = ({ label, size = 92, color = C.green }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: 999,
      flex: "0 0 auto",
      background: `linear-gradient(160deg, ${color}, rgba(0,0,0,0.6))`,
      border: `2px solid ${color}66`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.44,
      fontWeight: 700,
      color: "#04150c",
    }}
  >
    {label}
  </div>
);

/* ───────────────────────── 1 · GLOBE (0–2 s) ───────────────────────── */

const PEOPLE = [
  { lon: 13.4, lat: 52.5, name: "Lena", flag: "🇩🇪", at: 2 },
  { lon: 23.7, lat: 38.0, name: "Nikos", flag: "🇬🇷", at: 8 },
  { lon: 2.35, lat: 48.85, name: "Amel", flag: "🇫🇷", at: 13 },
  { lon: 28.98, lat: 41.0, name: "Emre", flag: "🇹🇷", at: 18 },
  { lon: -3.7, lat: 40.4, name: "Sofia", flag: "🇪🇸", at: 24 },
  { lon: 12.5, lat: 41.9, name: "Marco", flag: "🇮🇹", at: 30 },
];

export const GlobeScene: React.FC<{ frame: number }> = ({ frame }) => {
  const cam: Cam = {
    lon: interpolate(frame, [0, 70], [-14, 24], clamp),
    lat: interpolate(frame, [0, 70], [30, 42], clamp),
    scale: interpolate(frame, [0, 70], [760, 980], { ...clamp, easing: Easing.out(Easing.cubic) }),
  };
  const cx = SW / 2;
  const cy = 880;

  return (
    <Screen>
      <StatusBar />
      <TopBar title="Slang Globe" sub="Menschen. Sprachen. Ein Ort." />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <GlobeSvg cam={cam} width={SW} height={SH - 260} cx={cx} cy={cy} />

        {PEOPLE.map((p) => {
          const pt = project(p.lon, p.lat, cam, cx, cy);
          if (!pt) return null;
          const a = ease(frame, p.at, 12);
          if (a <= 0) return null;
          const float = Math.sin((frame + p.at * 4) / 22) * 6;
          return (
            <div
              key={p.name}
              style={{
                position: "absolute",
                left: pt.x,
                top: pt.y + float,
                transform: `translate(-50%, -150%) scale(${interpolate(a, [0, 1], [0.6, 1])})`,
                opacity: a,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 20px 10px 10px",
                borderRadius: 999,
                background: "rgba(10,13,12,0.78)",
                border: `1.5px solid ${C.green}55`,
                boxShadow: `0 0 46px ${C.green}33`,
                color: C.ink,
                fontSize: 28,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              <Avatar label={p.name[0]!} size={54} />
              <span>{p.flag}</span>
              {p.name}
            </div>
          );
        })}
      </div>
    </Screen>
  );
};

/* ──────────────────────── 2 · MESSENGER (2–4 s) ──────────────────────── */

const ChatBubble: React.FC<{
  frame: number;
  start: number;
  outgoing?: boolean;
  original: string;
  translated: string;
  flag: string;
}> = ({ frame, start, outgoing = false, original, translated, flag }) => {
  const p = ease(frame, start, 10);
  if (p <= 0) return null;
  const t = ease(frame, start + 8, 10);
  return (
    <div
      style={{ display: "flex", justifyContent: outgoing ? "flex-end" : "flex-start", ...rise(p) }}
    >
      <div
        style={{
          maxWidth: "84%",
          borderRadius: 34,
          padding: "26px 30px 20px",
          background: outgoing ? "rgba(20,54,36,0.92)" : "rgba(12,26,24,0.92)",
          border: `2px solid ${outgoing ? `${C.green}8c` : `${C.green}38`}`,
          color: C.ink,
          fontSize: 40,
          lineHeight: 1.26,
        }}
      >
        <div style={{ opacity: 0.9 }}>
          {flag} {original}
        </div>
        <div
          style={{
            marginTop: 18 * t,
            maxHeight: 200 * t,
            opacity: t,
            overflow: "hidden",
            borderTop: `1px solid ${C.green}33`,
            paddingTop: 16 * t,
            fontSize: 34,
            color: C.greenSoft,
          }}
        >
          <span style={{ fontSize: 24, letterSpacing: 2, color: C.green }}>ÜBERSETZT</span>
          <div style={{ marginTop: 8 }}>{translated}</div>
        </div>
      </div>
    </div>
  );
};

export const ChatScene: React.FC<{ frame: number }> = ({ frame }) => (
  <Screen>
    <StatusBar />
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "10px 34px 22px",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <Avatar label="N" size={86} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: C.ink }}>@nikos</div>
        <div style={{ marginTop: 6, fontSize: 26, color: C.ink }}>
          <span style={{ color: C.green }}>🌐</span> 🇬🇷 Ελληνικά{" "}
          <span style={{ color: C.muted }}>→</span> 🇩🇪 Deutsch
        </div>
      </div>
      <div style={{ fontSize: 26, color: C.green, fontWeight: 700 }}>LIVE</div>
    </div>

    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 26,
        padding: "24px 34px 24px",
        overflow: "hidden",
      }}
    >
      <ChatBubble
        frame={frame}
        start={0}
        flag="🇬🇷"
        original="Καλησπέρα! Από πού είσαι;"
        translated="Guten Abend! Woher kommst du?"
      />
      <ChatBubble
        frame={frame}
        start={14}
        outgoing
        flag="🇩🇪"
        original="Aus München – wie läuft's bei dir?"
        translated="Από το Μόναχο – πώς πάει;"
      />
      <ChatBubble
        frame={frame}
        start={32}
        flag="🇬🇷"
        original="Όλα καλά φίλε, σε καταλαβαίνω!"
        translated="Alles gut, Alter – ich versteh dich!"
      />
    </div>
  </Screen>
);

/* ───────────────────────── 3 · CHANNEL (4–6 s) ───────────────────────── */

const MEMBERS = [
  { name: "Lena", city: "Rostock", flag: "🇩🇪", tag: "moin-moin" },
  { name: "Amel", city: "Paris", flag: "🇫🇷", tag: "wesh" },
  { name: "Nikos", city: "Athen", flag: "🇬🇷", tag: "re-file" },
  { name: "Duda", city: "Rio", flag: "🇧🇷", tag: "sextou" },
];

export const ChannelScene: React.FC<{ frame: number }> = ({ frame }) => (
  <Screen>
    <StatusBar />
    <TopBar title="Channel · Street Slang" sub="1.482 Mitglieder aus 26 Regionen" />
    <div
      style={{ flex: 1, padding: "30px 34px", display: "flex", flexDirection: "column", gap: 24 }}
    >
      {MEMBERS.map((m, i) => {
        const p = ease(frame, 4 + i * 9, 12);
        if (p <= 0) return null;
        return (
          <div
            key={m.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "26px 28px",
              borderRadius: 34,
              background: "rgba(14,16,15,0.9)",
              border: `1.5px solid ${C.border}`,
              ...rise(p),
            }}
          >
            <Avatar label={m.name[0]!} size={84} color={i % 2 ? C.cyan : C.green} />
            <div style={{ flex: 1 }}>
              <div style={{ color: C.ink, fontSize: 34, fontWeight: 700 }}>
                {m.name}{" "}
                <span style={{ fontSize: 28, color: C.muted }}>
                  · {m.flag} {m.city}
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <SlangChip label={m.tag} frame={frame + i * 7} playing scale={0.62} />
              </div>
            </div>
            <Waveform frame={frame + i * 11} bars={9} height={40} color={C.green} />
          </div>
        );
      })}

      <div
        style={{
          marginTop: "auto",
          textAlign: "center",
          color: C.ink,
          fontSize: 32,
          fontWeight: 600,
          opacity: ease(frame, 34, 12),
        }}
      >
        Ein Channel · <span style={{ color: C.green }}>viele Regionen</span>
      </div>
    </div>
  </Screen>
);

/* ────────────────── 4 · MARKET mit Audio-Verhandlung (6–9 s) ────────────────── */

const VoiceNote: React.FC<{
  frame: number;
  start: number;
  outgoing?: boolean;
  who: string;
  flag: string;
  text: string;
  price: string;
  accent?: string;
  seconds?: string;
}> = ({
  frame,
  start,
  outgoing = false,
  who,
  flag,
  text,
  price,
  accent = C.green,
  seconds = "0:04",
}) => {
  const p = ease(frame, start, 10);
  if (p <= 0) return null;
  const playing = frame > start + 6 && frame < start + 34;
  return (
    <div
      style={{ display: "flex", justifyContent: outgoing ? "flex-end" : "flex-start", ...rise(p) }}
    >
      <div
        style={{
          maxWidth: "88%",
          borderRadius: 34,
          padding: "24px 28px",
          background: outgoing ? "rgba(20,54,36,0.94)" : "rgba(12,20,30,0.94)",
          border: `2px solid ${accent}80`,
          boxShadow: playing ? `0 0 70px ${accent}44` : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 74,
              height: 74,
              borderRadius: 999,
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              color: "#04150c",
              transform: `scale(${playing ? 1 + Math.sin(frame / 5) * 0.05 : 1})`,
            }}
          >
            ▶
          </div>
          <Waveform frame={frame} bars={16} height={46} color={accent} active={playing} width={4} />
          <span style={{ color: C.muted, fontSize: 26 }}>{seconds}</span>
        </div>
        <div style={{ marginTop: 16, color: C.ink, fontSize: 32, lineHeight: 1.25 }}>
          <span style={{ color: accent, fontWeight: 700 }}>
            {flag} {who}:
          </span>{" "}
          „{text}“
        </div>
        <div
          style={{ marginTop: 12, color: accent, fontSize: 46, fontWeight: 800, letterSpacing: -1 }}
        >
          {price}
        </div>
      </div>
    </div>
  );
};

export const MarketScene: React.FC<{ frame: number }> = ({ frame }) => {
  const micPulse = frame > 10 && frame < 34;
  const deal = ease(frame, 66, 12);
  return (
    <Screen>
      <StatusBar />
      <TopBar title="Y-Dude Market" sub="Verhandeln mit Stimme" />
      <div
        style={{ flex: 1, padding: "24px 30px", display: "flex", flexDirection: "column", gap: 22 }}
      >
        <div
          style={{
            display: "flex",
            gap: 22,
            padding: 20,
            borderRadius: 34,
            background: "rgba(14,16,15,0.92)",
            border: `1.5px solid ${C.border}`,
            ...rise(ease(frame, 0, 10)),
          }}
        >
          <Img
            src={staticFile("images/vinyl.jpg")}
            style={{
              width: 220,
              height: 220,
              objectFit: "cover",
              borderRadius: 26,
              flex: "0 0 auto",
            }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ color: C.ink, fontSize: 36, fontWeight: 700 }}>Vintage Vinyl-Set</div>
            <div style={{ marginTop: 8, color: C.muted, fontSize: 27 }}>
              Berlin · Abholung & Versand
            </div>
            <div style={{ marginTop: 14, color: C.green, fontSize: 52, fontWeight: 800 }}>
              120 €
            </div>
          </div>
        </div>

        {/* Mikrofon-Highlight: der Käufer spricht sein Angebot ein. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            padding: "20px 26px",
            borderRadius: 999,
            background: "rgba(12,14,13,0.9)",
            border: `2px solid ${C.green}${micPulse ? "cc" : "44"}`,
            boxShadow: micPulse ? `0 0 90px ${C.green}55` : "none",
            ...rise(ease(frame, 6, 10)),
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              background: C.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              color: "#04150c",
              transform: `scale(${micPulse ? 1 + Math.sin(frame / 4) * 0.07 : 1})`,
            }}
          >
            🎤
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.ink, fontSize: 30, fontWeight: 700 }}>
              {micPulse ? "Angebot wird aufgenommen …" : "Sprich dein Angebot ein"}
            </div>
            <div style={{ marginTop: 10 }}>
              <Waveform
                frame={frame}
                bars={26}
                height={38}
                color={C.green}
                active={micPulse}
                width={4}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 6 }}>
          <VoiceNote
            frame={frame}
            start={22}
            outgoing
            who="Käufer"
            flag="🇩🇪"
            text="Ich biete 90 € und hole es heute ab."
            price="90 €"
          />
          <VoiceNote
            frame={frame}
            start={44}
            who="Verkäufer"
            flag="🇬🇷"
            text="Για 105 € είναι δικό σου."
            price="105 €"
            accent={C.cyan}
          />
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            padding: "22px 30px",
            borderRadius: 30,
            background: `${C.green}1f`,
            border: `2px solid ${C.green}aa`,
            color: C.ink,
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: -0.6,
            opacity: deal,
            transform: `scale(${interpolate(deal, [0, 1], [0.9, 1])})`,
          }}
        >
          <span style={{ color: C.green, fontSize: 44 }}>✓</span> Einigung: 98 € · per Sprache
        </div>
      </div>
    </Screen>
  );
};

/* ───────────────────────── 5 · BEITRÄGE (9–11 s) ───────────────────────── */

const POSTS = [
  {
    image: "berlin.jpg",
    name: "Kaan",
    place: "Berlin",
    tag: "wat-kickste",
    kind: "creator" as const,
  },
  {
    image: "athens.jpg",
    name: "Nikos",
    place: "Athen",
    tag: "re-file",
    kind: "community" as const,
  },
  { image: "rio.jpg", name: "Duda", place: "Rio", tag: "sextou", kind: "community" as const },
];

export const PostsScene: React.FC<{ frame: number }> = ({ frame }) => {
  const scroll = interpolate(frame, [0, 60], [0, 430], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <Screen>
      <StatusBar />
      <TopBar title="Feed" sub="Bild · SlangTag · Stimme" />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 30,
            right: 30,
            top: 26,
            display: "flex",
            flexDirection: "column",
            gap: 28,
            transform: `translateY(${-scroll}px)`,
          }}
        >
          {POSTS.map((p, i) => {
            const a = ease(frame, i * 8, 12);
            return (
              <div
                key={p.tag}
                style={{
                  borderRadius: 38,
                  overflow: "hidden",
                  background: "rgba(14,16,15,0.95)",
                  border: `1.5px solid ${C.border}`,
                  ...rise(a, 34),
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 26px" }}
                >
                  <Avatar
                    label={p.name[0]!}
                    size={70}
                    color={p.kind === "creator" ? C.blue : C.green}
                  />
                  <div style={{ color: C.ink, fontSize: 32, fontWeight: 700 }}>
                    {p.name} <span style={{ color: C.muted, fontSize: 26 }}>· {p.place}</span>
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <Img
                    src={staticFile(`images/${p.image}`)}
                    style={{ width: "100%", height: 520, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", left: 34, bottom: 34 }}>
                    <SlangChip
                      label={p.tag}
                      kind={p.kind}
                      frame={frame + i * 9}
                      playing
                      scale={0.9}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Screen>
  );
};
