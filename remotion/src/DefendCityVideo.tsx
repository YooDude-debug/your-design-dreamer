import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
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

// 0–2 s: selbstbewusst | 2–5 s: frech | 5–8 s: energiegeladen | 8–10 s: outro

const Face: React.FC<{
  frame: number;
  fps: number;
  confidentW: number;
  cheekyW: number;
  intenseW: number;
  scale: number;
}> = ({ frame, fps, confidentW, cheekyW, intenseW, scale }) => {
  // Lidschläge für Lebendigkeit
  const blink =
    (frame >= 24 && frame < 30) ||
    (frame >= 78 && frame < 84) ||
    (frame >= 144 && frame < 150) ||
    (frame >= 190 && frame < 196) ||
    (frame >= 244 && frame < 250);
  const eyeScaleY = blink ? 0.08 : 1;

  // Atmung
  const breathe = 1 + Math.sin(frame / 20) * 0.014;

  // Intensiver Kopf-Shake bei 5–8 s
  const shake = intenseW * Math.sin(frame * 0.8) * 2.5;
  const bounce = intenseW * Math.abs(Math.sin(frame * 0.5)) * 8;

  return (
    <div
      style={{
        position: "absolute",
        left: CX,
        top: FACE_Y + bounce,
        width: 0,
        height: 0,
        transform: `scale(${scale * breathe}) rotate(${shake}deg)`,
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
          background:
            "radial-gradient(circle at 42% 36%, #1a1f1d 0%, #080a09 60%, #000000 100%)",
          boxShadow: `0 0 ${120 + intenseW * 120}px rgba(47,240,140,${0.22 + intenseW * 0.25}), inset 0 0 100px rgba(0,0,0,0.55)`,
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
        <div
          style={{
            width: 46 + intenseW * 8,
            height: 46 + intenseW * 8,
            borderRadius: "50%",
            background: "#000",
          }}
        />
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
        <div
          style={{
            width: 46 + intenseW * 8,
            height: 46 + intenseW * 8,
            borderRadius: "50%",
            background: "#000",
          }}
        />
      </div>

      {/* Augenbrauen – selbstbewusst leicht hoch, frech asymmetrisch, intensiv runter */}
      <div
        style={{
          position: "absolute",
          left: -170,
          top: -110,
          width: 120,
          height: 16,
          borderRadius: 8,
          background: C.ink,
          transform: `rotate(${interpolate(confidentW, [0, 1], [0, -8]) + interpolate(cheekyW, [0, 1], [0, -10]) + interpolate(intenseW, [0, 1], [0, 18])}deg)`,
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
          transform: `rotate(${interpolate(confidentW, [0, 1], [0, 8]) + interpolate(cheekyW, [0, 1], [0, 20]) + interpolate(intenseW, [0, 1], [0, -18])}deg)`,
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
        {/* Confident: freundlich geschwungener Mund */}
        <path
          d="M -70 12 Q 0 42 70 12"
          stroke={C.ink}
          strokeWidth={14}
          strokeLinecap="round"
          fill="none"
          opacity={confidentW}
        />
        {/* Cheeky: schiefer Smirk */}
        <path
          d="M -70 18 Q 0 55 70 -4"
          stroke={C.ink}
          strokeWidth={18}
          strokeLinecap="round"
          fill="none"
          opacity={cheekyW}
        />
        {/* Intense: offener, energischer Mund */}
        <path
          d="M -50 -20 C -70 60, 70 60, 50 -20 Z"
          stroke={C.ink}
          strokeWidth={12}
          strokeLinecap="round"
          fill="#000"
          opacity={intenseW}
        />
      </svg>

      {/* Wange bei Intensität (Adrenalin-Röte) */}
      <div
        style={{
          position: "absolute",
          left: -220,
          top: 40,
          width: 90,
          height: 70,
          borderRadius: "50%",
          background: `rgba(255,90,69,${0.14 * intenseW})`,
          filter: "blur(18px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 130,
          top: 40,
          width: 90,
          height: 70,
          borderRadius: "50%",
          background: `rgba(255,90,69,${0.14 * intenseW})`,
          filter: "blur(18px)",
        }}
      />
    </div>
  );
};

const Caption: React.FC<{
  frame: number;
  fps: number;
  start: number;
  end: number;
  text: React.ReactNode;
  size: number;
  color?: string;
  weight?: number;
}> = ({ frame, fps, start, end, text, size, color = C.ink, weight = 700 }) => {
  const local = frame - start;
  if (local < 0 || frame > end) return null;
  const inn = spring({ frame: local, fps, config: { damping: 16, stiffness: 200 } });
  const out = interpolate(frame, [end - 12, end], [1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: 1020,
        textAlign: "center",
        color,
        fontSize: size,
        lineHeight: 1.08,
        fontWeight: weight,
        letterSpacing: -2,
        opacity: inn * out,
        transform: `translateY(${interpolate(inn, [0, 1], [40, 0])}px) scale(${interpolate(
          inn,
          [0, 1],
          [0.92, 1]
        )})`,
        textShadow: "0 8px 40px rgba(0,0,0,0.85), 0 0 70px rgba(0,0,0,0.7)",
      }}
    >
      {text}
    </div>
  );
};

export const DefendCityVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Mood-Blending über die Szenen
  const confidentRaw = interpolate(frame, [0, 20], [1, 1], clamp) * interpolate(frame, [55, 70], [1, 0], clamp);
  const cheekyRaw = interpolate(frame, [55, 75], [0, 1], clamp) * interpolate(frame, [135, 155], [1, 0], clamp);
  const intenseRaw = interpolate(frame, [135, 160], [0, 1], clamp) * interpolate(frame, [235, 250], [1, 0], clamp);

  const total = confidentRaw + cheekyRaw + intenseRaw;
  const confidentW = total > 0 ? confidentRaw / total : 1;
  const cheekyW = total > 0 ? cheekyRaw / total : 0;
  const intenseW = total > 0 ? intenseRaw / total : 0;

  // Gesichts-Skala: kurzer Punch bei jedem Sprech-Beat
  let punch = 0;
  const punches = [0, 60, 150];
  for (const p of punches) {
    const local = frame - p;
    if (local >= 0 && local <= 20) {
      punch += spring({ frame: local, fps, config: { damping: 8, stiffness: 300 } });
    }
  }
  const faceScale = 1 + punch * 0.05 + intenseW * 0.08;

  // Endcard
  const endIn = interpolate(frame, [240, 256], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily, overflow: "hidden" }}>
      {/* Dynamischer Hintergrund-Glow – wird bei Intensität stärker */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% ${42 - intenseW * 8}%, rgba(47,240,140,${0.07 + intenseW * 0.1}) 0%, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 52%, rgba(255,90,69,${0.04 * intenseW}) 0%, transparent 45%)`,
        }}
      />

      {/* Persistent Headline */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 70,
          right: 70,
          textAlign: "center",
          color: C.ink,
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: -2,
          lineHeight: 1.05,
          textShadow: "0 8px 40px rgba(0,0,0,0.85), 0 0 70px rgba(0,0,0,0.7)",
          zIndex: 10,
        }}
      >
        VERTEIDIGE DEINE STADT 🔥
      </div>

      {/* Gesicht */}
      <Face
        frame={frame}
        fps={fps}
        confidentW={confidentW}
        cheekyW={cheekyW}
        intenseW={intenseW}
        scale={faceScale}
      />

      {/* 0–2 s: Hook */}
      <Caption
        frame={frame}
        fps={fps}
        start={0}
        end={60}
        text={
          <>
            DEINE STADT.
            <br />
            DEIN SLANG!
          </>
        }
        size={96}
        color={C.green}
      />

      {/* 2–5 s: Cheeky */}
      <Caption
        frame={frame}
        fps={fps}
        start={60}
        end={150}
        text={
          <>
            Lass dir nicht
            <br />
            irgendein Hochdeutsch
            <br />
            andrehen!
          </>
        }
        size={78}
      />

      {/* 5–8 s: Intense */}
      <Caption
        frame={frame}
        fps={fps}
        start={150}
        end={240}
        text={
          <>
            SCHÜTZE DEINEN DIALEKT!
            <br />
            <span style={{ color: C.green }}>VERTEIDIGE DEINEN SLANG!</span>
          </>
        }
        size={82}
      />

      {/* Endcard */}
      <AbsoluteFill
        style={{
          background: "#000",
          opacity: endIn,
          alignItems: "center",
          justifyContent: "center",
          display: "flex",
          zIndex: 20,
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
              sloganAppear={interpolate(frame, [256, 272], [0, 1], clamp)}
              markWidth={230}
              textHeight={132}
              energy={0.9}
            />
            <div
              style={{
                opacity: interpolate(frame, [264, 278], [0, 1], clamp),
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
