import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Outfit";
import { C } from "./theme";
import { BrandLockup } from "./components/BrandLockup";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
});

const W = 1080;
const H = 1920;
const CX = W / 2;
const FACE_Y = 540;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const BEATS = [
  { start: 60, end: 96, question: "Sprachatlas?" },
  { start: 96, end: 132, question: "Social Media?" },
  { start: 132, end: 168, question: "Slangs & Dialekte?" },
  { start: 168, end: 204, question: "Deine Werbung selbst bestimmen?" },
];

const Face: React.FC<{
  frame: number;
  fps: number;
  neutralW: number;
  annoyedW: number;
  smirkW: number;
  scale: number;
}> = ({ frame, neutralW, annoyedW, smirkW, scale }) => {
  // Blinking: kurze Lidschläge für Lebendigkeit
  const blink =
    (frame >= 30 && frame < 36) ||
    (frame >= 90 && frame < 96) ||
    (frame >= 140 && frame < 146) ||
    (frame >= 180 && frame < 186) ||
    (frame >= 244 && frame < 250);
  const eyeScaleY = blink ? 0.08 : 1;

  // Atmung
  const breathe = 1 + Math.sin(frame / 22) * 0.012;

  return (
    <div
      style={{
        position: "absolute",
        left: CX,
        top: FACE_Y,
        width: 0,
        height: 0,
        transform: `scale(${scale * breathe})`,
      }}
    >
      {/* Kopf */}
      <div
        style={{
          position: "absolute",
          left: -310,
          top: -310,
          width: 620,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle at 42% 36%, #1a1f1d 0%, #080a09 60%, #000000 100%)",
          boxShadow: `0 0 140px rgba(47,240,140,0.20), inset 0 0 100px rgba(0,0,0,0.55)`,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />

      {/* Augen */}
      <div
        style={{
          position: "absolute",
          left: -150,
          top: -40,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: C.ink,
          display: "grid",
          placeItems: "center",
          transform: `scaleY(${eyeScaleY})`,
        }}
      >
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#000" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 30,
          top: -40,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: C.ink,
          display: "grid",
          placeItems: "center",
          transform: `scaleY(${eyeScaleY})`,
        }}
      >
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#000" }} />
      </div>

      {/* Augenbrauen */}
      <div
        style={{
          position: "absolute",
          left: -170,
          top: -110,
          width: 120,
          height: 16,
          borderRadius: 8,
          background: C.ink,
          transform: `rotate(${interpolate(annoyedW, [0, 1], [0, -18])}deg)`,
          transformOrigin: "center",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 50,
          top: -110,
          width: 120,
          height: 16,
          borderRadius: 8,
          background: C.ink,
          transform: `rotate(${interpolate(annoyedW, [0, 1], [0, 22])}deg)`,
          transformOrigin: "center",
        }}
      />

      {/* Mund – drei Shapes, überblended */}
      <svg
        viewBox="-100 -60 200 120"
        style={{
          position: "absolute",
          left: -100,
          top: 90,
          width: 200,
          height: 120,
          overflow: "visible",
        }}
      >
        {/* Neutral: gerade Linie */}
        <path
          d="M -70 0 L 70 0"
          stroke={C.ink}
          strokeWidth={16}
          strokeLinecap="round"
          fill="none"
          opacity={neutralW}
        />
        {/* Genervt: leicht geöffneter ovaler Mund */}
        <path
          d="M -30 -25 C -30 45, 30 45, 30 -25"
          stroke={C.ink}
          strokeWidth={12}
          strokeLinecap="round"
          fill="#000"
          opacity={annoyedW}
        />
        {/* Smirk: schiefe Linie */}
        <path
          d="M -70 12 Q 0 55 70 -8"
          stroke={C.ink}
          strokeWidth={18}
          strokeLinecap="round"
          fill="none"
          opacity={smirkW}
        />
      </svg>
    </div>
  );
};

const TextLine: React.FC<{
  frame: number;
  fps: number;
  start: number;
  end: number;
  text: string;
  size: number;
  color?: string;
  weight?: number;
  springConfig?: { damping: number; stiffness: number };
}> = ({
  frame,
  fps,
  start,
  end,
  text,
  size,
  color = C.ink,
  weight = 700,
  springConfig = { damping: 16, stiffness: 200 },
}) => {
  const local = frame - start;
  if (local < 0 || frame > end) return null;
  const inn = spring({ frame: local, fps, config: springConfig });
  const out = interpolate(frame, [end - 12, end], [1, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top: 1020,
        textAlign: "center",
        color,
        fontSize: size,
        lineHeight: 1.05,
        fontWeight: weight,
        letterSpacing: -2,
        opacity: inn * out,
        transform: `translateY(${interpolate(inn, [0, 1], [40, 0])}px) scale(${interpolate(
          inn,
          [0, 1],
          [0.9, 1],
        )})`,
        textShadow: "0 8px 40px rgba(0,0,0,0.85), 0 0 70px rgba(0,0,0,0.7)",
      }}
    >
      {text}
    </div>
  );
};

const QABeat: React.FC<{
  frame: number;
  fps: number;
  start: number;
  question: string;
}> = ({ frame, fps, start, question }) => {
  const local = frame - start;
  if (local < 0 || local >= 36) return null;

  const questionIn = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 220 },
  });
  const questionOut = interpolate(local, [10, 12], [1, 0], clamp);

  const answerLocal = local - 12;
  const answerIn = spring({
    frame: answerLocal,
    fps,
    config: { damping: 9, stiffness: 340 },
  });
  const answerOut = interpolate(local, [30, 36], [1, 0], clamp);
  const answerScale = interpolate(answerIn, [0, 1], [1.35, 1]);

  const flash = interpolate(local, [12, 14, 20], [0.35, 0.12, 0], clamp);

  return (
    <>
      {/* Harter Farb-Blitz beim „Ja.“ */}
      <AbsoluteFill
        style={{
          background: C.green,
          opacity: flash,
          pointerEvents: "none",
        }}
      />

      {/* Frage */}
      {local < 14 && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 1020,
            textAlign: "center",
            color: C.ink,
            fontSize: 92,
            lineHeight: 1.05,
            fontWeight: 700,
            letterSpacing: -2,
            opacity: questionIn * questionOut,
            transform: `translateY(${interpolate(questionIn, [0, 1], [30, 0])}px)`,
            textShadow: "0 8px 40px rgba(0,0,0,0.85), 0 0 70px rgba(0,0,0,0.7)",
          }}
        >
          {question}
        </div>
      )}

      {/* Antwort „Ja.“ */}
      {local >= 12 && (
        <div
          style={{
            position: "absolute",
            left: 70,
            right: 70,
            top: 940,
            textAlign: "center",
            color: C.green,
            fontSize: 210,
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: -4,
            opacity: answerIn * answerOut,
            transform: `scale(${answerScale})`,
            textShadow: `0 0 80px ${C.green}88, 0 8px 40px rgba(0,0,0,0.85)`,
          }}
        >
          Ja.
        </div>
      )}
    </>
  );
};

export const WasIstYdudeVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mood-Blending
  const annoyedRaw = interpolate(frame, [204, 214], [0, 1], clamp);
  const smirkRaw = interpolate(frame, [240, 250], [0, 1], clamp);
  const annoyedW = annoyedRaw * (1 - smirkRaw);
  const smirkW = smirkRaw;
  const neutralW = Math.max(0, 1 - annoyedW - smirkW);

  // Kleiner „Ja.“-Nod pro Antwort
  let yesScale = 0;
  for (const beat of BEATS) {
    const local = frame - beat.start - 12;
    if (local >= 0 && local <= 18) {
      yesScale += spring({
        frame: local,
        fps,
        config: { damping: 8, stiffness: 300 },
      });
    }
  }
  const faceScale = 1 + yesScale * 0.045;

  // Endcard
  const endIn = interpolate(frame, [258, 270], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily, overflow: "hidden" }}>
      {/* Subtiler strukturierter Hintergrund */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(47,240,140,0.08) 0%, transparent 55%)",
        }}
      />

      {/* Gesicht */}
      <Face
        frame={frame}
        fps={fps}
        neutralW={neutralW}
        annoyedW={annoyedW}
        smirkW={smirkW}
        scale={faceScale}
      />

      {/* Hook-Frage */}
      <TextLine
        frame={frame}
        fps={fps}
        start={0}
        end={60}
        text="Was ist Y-Dude eigentlich?"
        size={98}
        weight={700}
      />

      {/* Q&A-Schnitte */}
      {BEATS.map((beat) => (
        <QABeat
          key={beat.question}
          frame={frame}
          fps={fps}
          start={beat.start}
          question={beat.question}
        />
      ))}

      {/* Finale Frage */}
      <TextLine
        frame={frame}
        fps={fps}
        start={210}
        end={228}
        text="Kann Y-Dude das alles?"
        size={92}
        color={C.ink}
      />

      {/* Finale Antwort */}
      {frame >= 240 && frame < 264 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 900,
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: C.green,
              fontSize: 180,
              fontWeight: 800,
              letterSpacing: -4,
              lineHeight: 1,
              opacity: spring({
                frame: frame - 240,
                fps,
                config: { damping: 12, stiffness: 260 },
              }),
              transform: `scale(${interpolate(
                spring({
                  frame: frame - 240,
                  fps,
                  config: { damping: 10, stiffness: 300 },
                }),
                [0, 1],
                [1.25, 1],
              )})`,
              textShadow: `0 0 90px ${C.green}88`,
            }}
          >
            Ja.
          </div>
          <div
            style={{
              color: C.ink,
              fontSize: 90,
              fontWeight: 800,
              letterSpacing: -2,
              marginTop: 18,
              opacity: interpolate(frame, [244, 252], [0, 1], clamp),
              transform: `translateY(${interpolate(frame, [244, 252], [30, 0], clamp)}px)`,
              textShadow: "0 8px 40px rgba(0,0,0,0.85)",
            }}
          >
            Y-Dude.
          </div>
        </div>
      )}

      {/* Endcard */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: endIn,
          alignItems: "center",
          justifyContent: "center",
          display: "flex",
        }}
      >
        {endIn > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 50,
            }}
          >
            <BrandLockup
              frame={frame}
              appear={endIn}
              sloganAppear={interpolate(frame, [264, 276], [0, 1], clamp)}
              markWidth={230}
              textHeight={132}
              energy={0.9}
            />
            <div
              style={{
                opacity: interpolate(frame, [272, 282], [0, 1], clamp),
                color: C.ink,
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: 3,
              }}
            >
              www.y-dude.com
            </div>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
