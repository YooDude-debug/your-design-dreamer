import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { C } from "../theme";
import { PhoneFrame } from "../components/PhoneFrame";
import { FeedCard, type CardData } from "../components/FeedCard";

const CARDS: CardData[] = [
  { image: "rostock.jpg", name: "Lena", handle: "@lena_hro", place: "Rostock", tag: "moin-moin", likes: "1,2k" },
  { image: "berlin.jpg", name: "Kaan", handle: "@kaan_bln", place: "Berlin", tag: "bruder-muss-los", likes: "3,4k" },
  { image: "athens.jpg", name: "Nikos", handle: "@nikos_ath", place: "Athen", tag: "re-malaka", kind: "creator", likes: "2,1k" },
];

/** Szene 1 – Person nutzt Y-Dude, Feed wird gescrollt. */
export const SceneFeed: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = interpolate(frame, [0, 140], [1.12, 1.2]);
  const enter = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const phoneY = interpolate(enter, [0, 1], [200, 74]);
  const phoneOpacity = interpolate(enter, [0, 1], [0, 1]);

  // Zwei ruhige Scroll-Bewegungen
  const scroll = interpolate(frame, [34, 58, 82, 96, 120], [0, -560, -560, -1120, -1120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const playing = frame > 62 && frame < 92;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Img
        src={staticFile("images/person-night.jpg")}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${bgScale})`,
          filter: "brightness(0.5) saturate(0.9) blur(2px)",
        }}
      />
      <AbsoluteFill
        style={{ background: "radial-gradient(90% 60% at 50% 42%, rgba(0,0,0,0.25), rgba(0,0,0,0.88))" }}
      />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translateY(${phoneY}px) rotate(-1.4deg)`,
            opacity: phoneOpacity,
          }}
        >
          <PhoneFrame width={640} height={1230}>
            <div style={{ padding: "110px 22px 0", transform: `translateY(${scroll}px)` }}>
              {CARDS.map((c, i) => (
                <div key={c.image} style={{ marginBottom: 26 }}>
                  <FeedCard data={c} frame={frame} playing={playing && i === 1} glow={playing && i === 1 ? 1 : 0} />
                </div>
              ))}
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: 84,
          right: 84,
          top: 96,
          opacity: interpolate(frame, [10, 30, 118, 134], [0, 1, 1, 0]),
        }}
      >
        <div style={{ color: C.muted, fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>
          Slang. Stimme. Ort.
        </div>
        <div style={{ color: C.ink, fontSize: 56, fontWeight: 700, letterSpacing: -1.6, marginTop: 10 }}>
          Hör, wie deine
          <br />
          Region klingt.
        </div>
      </div>
    </AbsoluteFill>
  );
};
