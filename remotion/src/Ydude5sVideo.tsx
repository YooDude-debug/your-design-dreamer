import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const PAIRS = [
  { q: "Sprachatlas?", a: "Ja." },
  { q: "Social Media?", a: "Ja." },
  { q: "Slang & Dialekte?", a: "Ja." },
  { q: "Deine Plattform?", a: "Ja." },
];

const BEAT = 15; // 0.5 s

export const Ydude5sVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Top-Frage bleibt stehen und verschwindet erst am Ende
  const topOpacity = interpolate(frame, [110, 120], [1, 0], clamp);

  const endIn = interpolate(frame, [120, 128], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily, overflow: "hidden" }}>
      {/* Ruhiger, konsistenter Hintergrund */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(47,240,140,0.07) 0%, transparent 55%)",
        }}
      />

      {/* Dauerhafte Top-Frage */}
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 80,
          right: 80,
          textAlign: "center",
          color: C.ink,
          fontSize: 62,
          fontWeight: 600,
          lineHeight: 1.08,
          letterSpacing: -1,
          opacity: topOpacity,
          textShadow: "0 8px 40px rgba(0,0,0,0.75)",
        }}
      >
        Was ist Y-Dude eigentlich?
      </div>

      {/* Q&A-Paare */}
      <div
        style={{
          position: "absolute",
          top: 420,
          left: 80,
          right: 80,
          bottom: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {PAIRS.map((pair, index) => {
          const qStart = index * BEAT * 2;
          const aStart = qStart + BEAT;
          const end = aStart + BEAT;

          if (frame < qStart || frame > end) return null;

          const localQ = frame - qStart;
          const localA = frame - aStart;

          const qIn = spring({
            frame: localQ,
            fps,
            config: { damping: 18, stiffness: 220 },
          });
          const aIn = spring({
            frame: localA,
            fps,
            config: { damping: 11, stiffness: 300 },
          });

          const out = interpolate(frame, [end - 4, end], [1, 0], clamp);

          const isQuestion = frame < aStart;

          return (
            <div
              key={pair.q}
              style={{
                position: "absolute",
                textAlign: "center",
                color: isQuestion ? C.ink : C.green,
                fontSize: isQuestion ? 96 : 170,
                fontWeight: isQuestion ? 700 : 800,
                lineHeight: 1,
                letterSpacing: isQuestion ? -2 : -5,
                opacity: isQuestion ? qIn * out : aIn * out,
                transform: isQuestion
                  ? `translateY(${interpolate(qIn, [0, 1], [22, 0])}px)`
                  : `scale(${interpolate(aIn, [0, 1], [1.08, 1])})`,
                textShadow: isQuestion
                  ? "0 8px 40px rgba(0,0,0,0.75)"
                  : `0 0 70px ${C.green}66, 0 8px 40px rgba(0,0,0,0.75)`,
              }}
            >
              {isQuestion ? pair.q : pair.a}
            </div>
          );
        })}
      </div>

      {/* Endcard – letzte Sekunde */}
      <AbsoluteFill
        style={{
          opacity: endIn,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 54,
          background: "#000",
        }}
      >
        <div
          style={{
            color: C.ink,
            fontSize: 118,
            fontWeight: 800,
            letterSpacing: -4,
            lineHeight: 1,
            opacity: spring({
              frame: frame - 120,
              fps,
              config: { damping: 14, stiffness: 240 },
            }),
            transform: `translateY(${interpolate(
              spring({
                frame: frame - 120,
                fps,
                config: { damping: 14, stiffness: 240 },
              }),
              [0, 1],
              [30, 0],
            )}px)`,
            textShadow: "0 8px 40px rgba(0,0,0,0.75)",
          }}
        >
          Y-Dude. 😎
        </div>

        <BrandLockup
          frame={frame}
          appear={interpolate(frame, [128, 138], [0, 1], clamp)}
          sloganAppear={interpolate(frame, [134, 144], [0, 1], clamp)}
          markWidth={170}
          textHeight={100}
          energy={0.55}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
