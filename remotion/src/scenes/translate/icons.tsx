import React from "react";
import { C } from "../../theme";

/** Deutschlandflagge als Vektor – der Renderer hat keine Emoji-Schrift. */
export const FlagDE: React.FC<{ height?: number }> = ({ height = 40 }) => (
  <div
    style={{
      width: height * 1.6,
      height,
      borderRadius: 6,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
    }}
  >
    <div style={{ flex: 1, background: "#111111" }} />
    <div style={{ flex: 1, background: "#D32323" }} />
    <div style={{ flex: 1, background: "#F2C200" }} />
  </div>
);

/** Kleines Lach-Label statt Emoji. */
export const HahaChip: React.FC<{ size?: number; scale?: number; opacity?: number }> = ({
  size = 48,
  scale = 1,
  opacity = 1,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: size * 0.22,
      padding: `${size * 0.3}px ${size * 0.6}px`,
      borderRadius: 999,
      background: "rgba(47,240,140,0.14)",
      border: "1px solid rgba(47,240,140,0.45)",
      color: C.green,
      fontSize: size,
      fontWeight: 800,
      letterSpacing: 2,
      opacity,
      transform: `scale(${scale})`,
    }}
  >
    HAHA
  </div>
);

/** Filmklappe als Vektor (steht fuer die absurde "Movie"-Uebersetzung). */
export const Clapper: React.FC<{ height?: number }> = ({ height = 64 }) => (
  <div style={{ width: height * 1.25, height, position: "relative" }}>
    <div
      style={{
        position: "absolute",
        inset: `${height * 0.3}px 0 0 0`,
        background: "#1c1f1e",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 6,
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: height * 0.32,
        background: "#1c1f1e",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 4,
        display: "flex",
        overflow: "hidden",
        transform: "rotate(-8deg)",
        transformOrigin: "left bottom",
      }}
    >
      {new Array(6).fill(0).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            background: i % 2 === 0 ? "#f4f7f5" : "transparent",
            transform: "skewX(-18deg)",
          }}
        />
      ))}
    </div>
  </div>
);
