import React from "react";
import { interpolate } from "remotion";
import { C } from "../../theme";

const BAV_BLUE = "#3b7ddd";

/** Dezentes bayerisches Rauten-Muster (weiss-blau), als Textur im Hintergrund. */
export const LozengePattern: React.FC<{ opacity?: number; size?: number }> = ({
  opacity = 0.1,
  size = 150,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      opacity,
      backgroundColor: BAV_BLUE,
      backgroundImage: `linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%),
        linear-gradient(45deg, #fff 25%, transparent 25%, transparent 75%, #fff 75%)`,
      backgroundSize: `${size}px ${size}px`,
      backgroundPosition: `0 0, ${size / 2}px ${size / 2}px`,
      maskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.9), rgba(0,0,0,0) 72%)",
      WebkitMaskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,0.9), rgba(0,0,0,0) 72%)",
    }}
  />
);

/** Stark vereinfachte Bayern-Silhouette als Vektor. */
export const BavariaMap: React.FC<{
  height?: number;
  appear?: number;
  stroke?: string;
  dotLabel?: string;
}> = ({ height = 320, appear = 1, stroke = C.green, dotLabel }) => {
  const d =
    "M96 12 L134 30 L150 22 L182 44 L206 40 L214 66 L242 84 L236 118 L252 150 L232 176 L240 206 L214 232 L182 240 L150 262 L118 250 L86 262 L58 236 L40 200 L22 168 L34 132 L18 100 L44 70 L52 40 Z";
  const dash = 1400;
  return (
    <div style={{ position: "relative", opacity: interpolate(appear, [0, 1], [0, 1]) }}>
      <svg height={height} viewBox="0 0 270 280" style={{ display: "block", overflow: "visible" }}>
        <path
          d={d}
          fill={`rgba(59,125,221,${0.14 * appear})`}
          stroke={stroke}
          strokeWidth={4}
          strokeLinejoin="round"
          strokeDasharray={dash}
          strokeDashoffset={dash * (1 - appear)}
        />
        <circle cx={168} cy={196} r={9} fill={stroke} opacity={appear} />
      </svg>
      {dotLabel ? (
        <div
          style={{
            position: "absolute",
            left: (168 / 270) * height * (270 / 280) + 22,
            top: (196 / 280) * height - 18,
            fontSize: 34,
            fontWeight: 700,
            color: C.ink,
            opacity: appear,
            whiteSpace: "nowrap",
          }}
        >
          {dotLabel}
        </div>
      ) : null}
    </div>
  );
};

/** Analoge Uhr – Gag-Element fuer die "times"-Fehlübersetzung. */
export const ClockIcon: React.FC<{ size?: number; frame?: number; opacity?: number; spin?: number }> = ({
  size = 120,
  frame = 0,
  opacity = 1,
  spin = 1,
}) => {
  const minute = frame * 9 * spin;
  const hour = frame * 1.4 * spin + 40;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity, display: "block" }}>
      <circle cx="50" cy="50" r="44" fill="rgba(255,255,255,0.06)" stroke={C.ink} strokeWidth="5" />
      <circle cx="50" cy="50" r="4" fill={C.green} />
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="26"
        stroke={C.ink}
        strokeWidth="6"
        strokeLinecap="round"
        transform={`rotate(${hour} 50 50)`}
      />
      <line
        x1="50"
        y1="50"
        x2="50"
        y2="16"
        stroke={C.green}
        strokeWidth="4"
        strokeLinecap="round"
        transform={`rotate(${minute} 50 50)`}
      />
    </svg>
  );
};

/** Bayerische Wies'n-Brezn als kleiner Akzent. */
export const Pretzel: React.FC<{ size?: number; opacity?: number; rotate?: number }> = ({
  size = 90,
  opacity = 1,
  rotate = 0,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={{ opacity, display: "block", transform: `rotate(${rotate}deg)` }}
  >
    <path
      d="M22 30c-10 12-2 30 14 30 14 0 20-12 14-24-5-11-2-20 8-20s14 10 8 20c-6 12 0 24 14 24 16 0 24-18 14-30"
      fill="none"
      stroke="#d9a25a"
      strokeWidth="9"
      strokeLinecap="round"
    />
    <path
      d="M28 60c8 14 30 18 44 0"
      fill="none"
      stroke="#c98f45"
      strokeWidth="9"
      strokeLinecap="round"
    />
  </svg>
);
