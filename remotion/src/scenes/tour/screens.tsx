import React from "react";
import { interpolate, Easing } from "remotion";
import { C } from "../../theme";
import { FeedCard, type CardData } from "../../components/FeedCard";
import { GlobeSvg, project, type Cam } from "../../components/GlobeSvg";
import { SlangChip } from "../../components/SlangChip";
import { Bubble, TranslationBlock } from "../../components/messenger/ChatParts";

/** Innenmaße des Smartphone-Screens für den App-Tour-Clip. */
export const SW = 1000;
export const SH = 1778;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const Screen: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
  </div>
);

/** Statusleiste – gibt dem Ganzen echtes Smartphone-Gefühl. */
const StatusBar: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "22px 40px 6px",
      color: C.ink,
      fontSize: 30,
      opacity: 0.8,
      flex: "0 0 auto",
    }}
  >
    <span>21:12</span>
    <span style={{ letterSpacing: 5 }}>▮▮▮ 86 %</span>
  </div>
);

const TopBar: React.FC<{ title: string; tabs?: string[]; active?: number }> = ({
  title,
  tabs,
  active = 0,
}) => (
  <div
    style={{
      flex: "0 0 auto",
      padding: "10px 34px 18px",
      borderBottom: `1px solid ${C.border}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ color: C.ink, fontSize: 40, fontWeight: 700, letterSpacing: -0.8 }}>
        {title}
      </div>
      <div style={{ display: "flex", gap: 18, color: C.muted, fontSize: 34 }}>
        <span>🔍</span>
        <span style={{ color: C.green }}>🌐</span>
      </div>
    </div>
    {tabs ? (
      <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
        {tabs.map((t, i) => (
          <div
            key={t}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              fontSize: 26,
              fontWeight: 600,
              color: i === active ? "#04150c" : C.muted,
              background: i === active ? C.green : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === active ? C.green : C.border}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
    ) : null}
  </div>
);

/** Untere App-Navigation (Feed · Globe · Arena · Messenger). */
const TabBar: React.FC<{ active: number }> = ({ active }) => {
  const items = [
    { icon: "▤", label: "Feed" },
    { icon: "◍", label: "Globe" },
    { icon: "⚡", label: "Arena" },
    { icon: "✉", label: "Chat" },
  ];
  return (
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "20px 20px 34px",
        borderTop: `1px solid ${C.border}`,
        background: "rgba(0,0,0,0.9)",
      }}
    >
      {items.map((it, i) => (
        <div
          key={it.label}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            color: i === active ? C.green : C.muted,
            fontSize: 22,
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 36 }}>{it.icon}</span>
          {it.label}
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────── 1 · FEED ─────────────────────────── */

const CARDS: CardData[] = [
  { image: "rostock.jpg", name: "Lena", handle: "@lena", place: "Rostock", tag: "moin-moin", likes: "1,2k" },
  { image: "berlin.jpg", name: "Kaan", handle: "@kaan", place: "Berlin", tag: "wat-kickste", kind: "creator", likes: "3,4k" },
  { image: "athens.jpg", name: "Nikos", handle: "@nikos", place: "Athen", tag: "re-malaka", likes: "890" },
  { image: "rio.jpg", name: "Duda", handle: "@duda", place: "Rio", tag: "sextou", likes: "5,6k" },
];

export const FeedScreen: React.FC<{ frame: number }> = ({ frame }) => {
  // Zwei schnelle, ruckartige Wischer – wie echtes Scrollen.
  const scroll = interpolate(frame, [0, 16, 26, 42, 56], [0, 340, 380, 820, 900], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const focus = frame > 22 ? 1 : 0;

  return (
    <Screen>
      <StatusBar />
      <TopBar title="Feed" tabs={["Lokal", "Global", "Trending", "Folge ich"]} active={1} />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 28,
            right: 28,
            top: 26,
            display: "flex",
            flexDirection: "column",
            gap: 30,
            transform: `translateY(${-scroll}px)`,
          }}
        >
          {CARDS.map((c, i) => (
            <div key={c.tag} style={{ opacity: i === focus ? 1 : 0.9 }}>
              <FeedCard
                data={c}
                frame={frame + i * 9}
                playing={i === focus}
                glow={i === focus ? 1 : 0}
              />
            </div>
          ))}
        </div>
      </div>
      <TabBar active={0} />
    </Screen>
  );
};

/* ─────────────────────────── 2 · GLOBE ─────────────────────────── */

const GLOBE_TAGS = [
  { label: "moin", lon: 13.4, lat: 52.5, at: 4 },
  { label: "re", lon: 23.7, lat: 38.0, at: 12 },
  { label: "wesh", lon: 2.35, lat: 48.85, at: 20 },
  { label: "innit", lon: -0.13, lat: 51.5, at: 28 },
  { label: "abi", lon: 28.98, lat: 41.0, at: 34 },
  { label: "yalla", lon: 35.5, lat: 33.9, at: 40 },
];

export const GlobeScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const cam: Cam = {
    lon: interpolate(frame, [0, 60], [-4, 30], clamp),
    lat: interpolate(frame, [0, 60], [28, 44], clamp),
    scale: interpolate(frame, [0, 60], [740, 1080], {
      ...clamp,
      easing: Easing.out(Easing.cubic),
    }),
  };
  const cx = SW / 2;
  const cy = 900;

  return (
    <Screen>
      <StatusBar />
      <TopBar title="Slang Globe" />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <GlobeSvg cam={cam} width={SW} height={SH - 300} cx={cx} cy={cy} />

        {GLOBE_TAGS.map((t) => {
          const p = project(t.lon, t.lat, cam, cx, cy);
          if (!p) return null;
          const a = interpolate(frame, [t.at, t.at + 10], [0, 1], clamp);
          if (a <= 0) return null;
          return (
            <div
              key={t.label}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                transform: `translate(-50%, -140%) scale(${interpolate(a, [0, 1], [0.7, 1])})`,
                opacity: a,
              }}
            >
              <SlangChip label={t.label} frame={frame} playing scale={0.5} />
            </div>
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            bottom: 34,
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          {["🇬🇷 Athen", "🇩🇪 Berlin", "🇫🇷 Paris", "🇹🇷 Istanbul"].map((r, i) => (
            <div
              key={r}
              style={{
                padding: "12px 20px",
                borderRadius: 999,
                fontSize: 26,
                fontWeight: 600,
                color: C.ink,
                background: "rgba(12,14,13,0.7)",
                border: `1px solid ${C.green}44`,
                opacity: interpolate(frame, [10 + i * 6, 20 + i * 6], [0, 1], clamp),
              }}
            >
              {r}
            </div>
          ))}
        </div>
      </div>
      <TabBar active={1} />
    </Screen>
  );
};

/* ─────────────────────────── 3 · ARENA ─────────────────────────── */

const DUELS = [
  { a: "$digga", b: "$alter", pa: 62, pb: 38, place: "Berlin" },
  { a: "$re", b: "$malaka", pa: 48, pb: 52, place: "Athen" },
];

export const ArenaScreen: React.FC<{ frame: number }> = ({ frame }) => (
  <Screen>
    <StatusBar />
    <TopBar title="Arena" tabs={["Live", "Heute", "Champions"]} active={0} />
    <div style={{ flex: 1, padding: "26px 32px", display: "flex", flexDirection: "column", gap: 26 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: C.green,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          opacity: interpolate(frame, [0, 10], [0, 1], clamp),
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 99,
            background: C.green,
            opacity: 0.5 + Math.abs(Math.sin(frame / 6)) * 0.5,
          }}
        />
        {`${1240 + Math.floor(frame * 3.4)} Votes live`}
      </div>

      {DUELS.map((d, i) => {
        const app = interpolate(frame, [4 + i * 10, 20 + i * 10], [0, 1], clamp);
        const grow = interpolate(frame, [10 + i * 10, 46 + i * 10], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        return (
          <div
            key={d.a}
            style={{
              borderRadius: 34,
              padding: "30px 32px",
              background: "rgba(12,16,14,0.92)",
              border: `2px solid ${C.green}33`,
              boxShadow: `0 0 60px ${C.green}14`,
              opacity: app,
              transform: `translateY(${interpolate(app, [0, 1], [40, 0])}px)`,
            }}
          >
            <div style={{ color: C.muted, fontSize: 26, marginBottom: 18 }}>
              Duell · {d.place}
            </div>
            {[
              { label: d.a, p: d.pa, color: C.green },
              { label: d.b, p: d.pb, color: C.cyan },
            ].map((s) => (
              <div key={s.label} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: C.ink,
                    fontSize: 34,
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ color: s.color }}>{Math.round(s.p * grow)}%</span>
                </div>
                <div
                  style={{
                    height: 22,
                    borderRadius: 99,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${s.p * grow}%`,
                      height: "100%",
                      borderRadius: 99,
                      background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`,
                      boxShadow: `0 0 30px ${s.color}66`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 6 }}>
        {[
          { t: "$sextou", m: "Rio · +214%" },
          { t: "$yabai", m: "Tokio · +182%" },
          { t: "$moin-moin", m: "Rostock · +97%" },
        ].map((x, i) => (
          <div
            key={x.t}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 26px",
              borderRadius: 26,
              background: "rgba(255,255,255,0.035)",
              border: `1px solid ${C.border}`,
              opacity: interpolate(frame, [22 + i * 7, 34 + i * 7], [0, 1], clamp),
              transform: `translateX(${interpolate(
                frame,
                [22 + i * 7, 34 + i * 7],
                [60, 0],
                clamp,
              )}px)`,
            }}
          >
            <span style={{ color: C.green, fontSize: 32, fontWeight: 700 }}>{x.t}</span>
            <span style={{ color: C.muted, fontSize: 26 }}>{x.m}</span>
          </div>
        ))}
      </div>
    </div>
    <TabBar active={2} />
  </Screen>
);

/* ────────────────────── 4 · MESSENGER (LIVE) ────────────────────── */

export const ChatScreen: React.FC<{ frame: number }> = ({ frame }) => (
  <Screen>
    <StatusBar />
    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "12px 34px 22px",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 40, color: C.ink, opacity: 0.6 }}>←</span>
      <div
        style={{
          width: 92,
          height: 92,
          borderRadius: 99,
          background: "linear-gradient(160deg, #2ff08c, #0f7f4c)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
          fontWeight: 700,
          color: "#04150c",
        }}
      >
        N
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: C.ink }}>@nikos_demo</div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 27,
            color: C.ink,
          }}
        >
          <span style={{ color: C.green }}>🌐</span> 🇬🇷 Ελληνικά
          <span style={{ color: C.muted }}>→</span> 🇩🇪 Deutsch
        </div>
      </div>
    </div>

    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 24,
        padding: "24px 34px 20px",
        overflow: "hidden",
      }}
    >
      <Bubble frame={frame} start={0} time="21:06" outgoing>
        Hey, alles gut bei dir?
      </Bubble>

      <Bubble
        frame={frame}
        start={6}
        time="21:07"
        translated={
          <TranslationBlock
            frame={frame}
            start={22}
            text="Na Alter, mir geht's jetzt gut 😂"
            showButtons
            buttonsStart={38}
          />
        }
      >
        Γεια σου φίλε, τώρα είμαι καλά 😂
      </Bubble>

      <Bubble
        frame={frame}
        start={48}
        time="21:08"
        translated={
          <TranslationBlock
            frame={frame}
            start={60}
            text="Du hast Talent – du solltest Programmierer werden."
            highlight
          />
        }
      >
        Έχεις ταλέντο, θα έπρεπε να γίνεις προγραμματιστής.
      </Bubble>
    </div>

    <div
      style={{
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        gap: 22,
        padding: "20px 34px 36px",
        borderTop: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 38, opacity: 0.5 }}>☺</span>
      <div
        style={{
          flex: 1,
          borderRadius: 30,
          border: `2px solid ${C.border}`,
          padding: "18px 24px",
          color: C.muted,
          fontSize: 30,
        }}
      >
        Nachricht schreiben — $ für SlangTag
      </div>
      <div
        style={{
          width: 82,
          height: 82,
          borderRadius: 99,
          background: C.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 38,
          color: "#04150c",
        }}
      >
        ➤
      </div>
    </div>
  </Screen>
);
