import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { PhoneFrame } from "../components/PhoneFrame";
import { FeedCard, type CardData } from "../components/FeedCard";

/**
 * Zusatzszene A – schneller Feed-Roll: mehrere Beiträge, jeder mit eigenem SlangTag.
 * Zeigt: SlangTags sind überall im Feed, nicht nur ein Extra.
 */
const CARDS: CardData[] = [
  {
    image: "rostock.jpg",
    name: "Lena",
    handle: "@lena",
    place: "Rostock",
    tag: "moin-moin",
    likes: "1,2k",
  },
  {
    image: "berlin.jpg",
    name: "Kaan",
    handle: "@kaan",
    place: "Berlin",
    tag: "digga",
    kind: "creator",
    likes: "3,4k",
  },
  {
    image: "athens.jpg",
    name: "Nikos",
    handle: "@nikos",
    place: "Athen",
    tag: "malaka-nice",
    likes: "890",
  },
  {
    image: "tokyo.jpg",
    name: "Yui",
    handle: "@yui",
    place: "Tokio",
    tag: "yabai",
    kind: "creator",
    likes: "2,1k",
  },
  { image: "rio.jpg", name: "Duda", handle: "@duda", place: "Rio", tag: "sextou", likes: "5,6k" },
];

const CARD_H = 690;
const GAP = 34;

export const SceneSlangFeedRoll: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const drift = Math.sin(frame / 40) * 5;

  // Ruckartiges, natürliches Weiterwischen: pro Beat ein Stück, dann kurz halten.
  const steps = [0, 26, 52, 78, 104];
  const scroll = steps.reduce((acc, at, i) => {
    if (i === 0) return acc;
    const s = spring({ frame: frame - at, fps, config: { damping: 26, stiffness: 190 } });
    return acc + s * (CARD_H + GAP) * 0.62;
  }, 0);

  // Welcher Beitrag ist gerade im Fokus? Sein SlangTag spielt.
  const focus = Math.min(CARDS.length - 1, Math.floor(interpolate(frame, [0, 130], [0, 4.6])));

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(75% 50% at 50% 40%, ${C.green}14, rgba(0,0,0,0.94))`,
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translateY(${interpolate(enter, [0, 1], [120, 46]) + drift}px) rotate(-1.4deg)`,
            opacity: enter,
          }}
        >
          <PhoneFrame width={640} height={1360}>
            <div
              style={{
                position: "absolute",
                left: 20,
                right: 20,
                top: 30,
                transform: `translateY(${-scroll}px)`,
                display: "flex",
                flexDirection: "column",
                gap: GAP,
              }}
            >
              {CARDS.map((c, i) => (
                <div
                  key={c.tag}
                  style={{
                    opacity: i === focus ? 1 : 0.78,
                    transform: `scale(${i === focus ? 1 : 0.985})`,
                  }}
                >
                  <FeedCard
                    data={c}
                    frame={frame + i * 9}
                    playing={i === focus}
                    glow={i === focus ? 1 : 0}
                  />
                </div>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.7) 100%)",
              }}
            />
          </PhoneFrame>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          top: 92,
          opacity: interpolate(frame, [6, 22, 112, 128], [0, 1, 1, 0]),
        }}
      >
        <div style={{ color: C.muted, fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>
          Jeder Beitrag klingt
        </div>
        <div
          style={{
            color: C.ink,
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -1.6,
            marginTop: 10,
          }}
        >
          SlangTags. Überall
          <br />
          im Feed.
        </div>
      </div>
    </AbsoluteFill>
  );
};
