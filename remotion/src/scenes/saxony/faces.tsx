import React from "react";
import { C } from "../../theme";

/**
 * Comic-Gesichter als Vektor (der Renderer hat keine Emoji-Schrift).
 * Bewusst im bestehenden Y-Dude-Look: dunkle Karten, gruene Akzente.
 */
export const Face: React.FC<{
  size?: number;
  appear?: number;
  frame?: number;
  /** Mundform – treibt den Gesichtsausdruck. */
  mouth?: "smile" | "o" | "flat" | "wide" | "talk";
  /** Augen weit aufgerissen (Schock). */
  shock?: boolean;
  /** Kleine Sachsen-Schiebermuetze. */
  cap?: boolean;
  skin?: string;
}> = ({
  size = 300,
  appear = 1,
  frame = 0,
  mouth = "smile",
  shock = false,
  cap = false,
  skin = "#e8b591",
}) => {
  const wob = Math.sin(frame / 8) * 2.4;
  const eyeR = shock ? size * 0.075 : size * 0.045;
  const talk = mouth === "talk" ? (Math.sin(frame / 3.2) + 1) / 2 : 0;

  const mouthStyle: React.CSSProperties =
    mouth === "o"
      ? {
          width: size * 0.19,
          height: size * 0.23,
          borderRadius: "50%",
          background: "#4a2222",
        }
      : mouth === "flat"
        ? { width: size * 0.3, height: size * 0.035, borderRadius: 99, background: "#4a2222" }
        : mouth === "wide"
          ? {
              width: size * 0.4,
              height: size * 0.2,
              borderRadius: `${size * 0.05}px ${size * 0.05}px ${size * 0.2}px ${size * 0.2}px`,
              background: "#4a2222",
            }
          : mouth === "talk"
            ? {
                width: size * 0.26,
                height: size * (0.06 + talk * 0.13),
                borderRadius: 99,
                background: "#4a2222",
              }
            : {
                width: size * 0.32,
                height: size * 0.16,
                borderRadius: `${size * 0.03}px ${size * 0.03}px ${size * 0.18}px ${size * 0.18}px`,
                background: "#4a2222",
              };

  return (
    <div
      style={{
        width: size,
        height: size * 1.02,
        position: "relative",
        opacity: appear,
        transform: `scale(${0.7 + appear * 0.3}) rotate(${wob}deg)`,
      }}
    >
      {/* Kopf */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: size * 0.12,
          marginLeft: -size * 0.4,
          width: size * 0.8,
          height: size * 0.84,
          borderRadius: "46% 46% 44% 44%",
          background: `linear-gradient(180deg, ${skin}, #cf9673)`,
          boxShadow: "inset 0 -14px 26px rgba(0,0,0,0.12)",
        }}
      />
      {/* Ohren */}
      {[-1, 1].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute",
            top: size * 0.44,
            left: `calc(50% + ${s * size * 0.4}px)`,
            marginLeft: -size * 0.05,
            width: size * 0.1,
            height: size * 0.16,
            borderRadius: "50%",
            background: skin,
          }}
        />
      ))}
      {/* Augenbrauen */}
      {[-1, 1].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute",
            top: size * (shock ? 0.28 : 0.33),
            left: `calc(50% + ${s * size * 0.17}px)`,
            marginLeft: -size * 0.09,
            width: size * 0.18,
            height: size * 0.03,
            borderRadius: 99,
            background: "#3b2a22",
            transform: `rotate(${s * (shock ? -14 : 4)}deg)`,
          }}
        />
      ))}
      {/* Augen */}
      {[-1, 1].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute",
            top: size * 0.4,
            left: `calc(50% + ${s * size * 0.17}px)`,
            marginLeft: -eyeR,
            width: eyeR * 2,
            height: eyeR * 2,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 0 0 3px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: eyeR * 0.5,
              top: eyeR * 0.6,
              width: eyeR * 0.9,
              height: eyeR * 0.9,
              borderRadius: "50%",
              background: "#20221f",
            }}
          />
        </div>
      ))}
      {/* Nase */}
      <div
        style={{
          position: "absolute",
          top: size * 0.54,
          left: "50%",
          marginLeft: -size * 0.03,
          width: size * 0.06,
          height: size * 0.1,
          borderRadius: 99,
          background: "#c2855f",
        }}
      />
      {/* Mund */}
      <div
        style={{
          position: "absolute",
          top: size * 0.68,
          left: "50%",
          transform: "translateX(-50%)",
          ...mouthStyle,
        }}
      />
      {cap ? (
        <>
          <div
            style={{
              position: "absolute",
              top: size * 0.04,
              left: "50%",
              marginLeft: -size * 0.44,
              width: size * 0.88,
              height: size * 0.24,
              borderRadius: "50% 50% 24% 24%",
              background: "#3a4a44",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: size * 0.24,
              left: "50%",
              marginLeft: -size * 0.5,
              width: size * 0.66,
              height: size * 0.07,
              borderRadius: 99,
              background: "#2c3a35",
            }}
          />
        </>
      ) : null}
    </div>
  );
};

/** Smartphone mit Translate-Zeile – klar von echten Dialogen unterscheidbar. */
export const PhoneCard: React.FC<{
  width?: number;
  appear?: number;
  label?: string;
  text: React.ReactNode;
  shake?: number;
  bar?: number;
}> = ({ width = 720, appear = 1, label = "GOOGLE TRANSLATE", text, shake = 0, bar = 1 }) => (
  <div
    style={{
      width,
      opacity: appear,
      transform: `translateY(${(1 - appear) * 40}px) translateX(${shake}px)`,
      background: "#0b1a2a",
      border: "2px solid rgba(79,209,245,0.5)",
      borderRadius: 40,
      padding: "30px 34px 34px",
      boxShadow: "0 0 60px rgba(79,209,245,0.16)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${C.cyan}, ${C.blue})`,
        }}
      />
      <div style={{ fontSize: 30, letterSpacing: 5, fontWeight: 800, color: C.cyan }}>{label}</div>
    </div>
    <div
      style={{
        marginTop: 16,
        height: 5,
        borderRadius: 99,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${bar * 100}%`,
          background: `linear-gradient(90deg, ${C.cyan}, ${C.blue})`,
        }}
      />
    </div>
    <div
      style={{
        marginTop: 20,
        fontSize: 66,
        fontWeight: 800,
        letterSpacing: -3,
        lineHeight: 1.06,
        color: "#eaf6ff",
        fontStyle: "italic",
      }}
    >
      {text}
    </div>
  </div>
);

/** Sprechblase fuer echte Dialoge (gruen = Mensch). */
export const SpeechBubble: React.FC<{
  appear?: number;
  who: string;
  text: string;
  size?: number;
  color?: string;
}> = ({ appear = 1, who, text, size = 72, color = C.green }) => (
  <div
    style={{
      opacity: appear,
      transform: `translateY(${(1 - appear) * 34}px)`,
      background: "rgba(47,240,140,0.08)",
      border: `2px solid ${color}55`,
      borderRadius: 40,
      padding: "26px 34px 30px",
      maxWidth: 900,
    }}
  >
    <div style={{ fontSize: 28, letterSpacing: 5, fontWeight: 800, color }}>{who}</div>
    <div
      style={{
        marginTop: 12,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: -2,
        lineHeight: 1.08,
        color: C.ink,
      }}
    >
      {text}
    </div>
  </div>
);

/** Kaffeetasse ("Schälchen Heeßn") als Vektor. */
export const CoffeeCup: React.FC<{ size?: number; opacity?: number; frame?: number }> = ({
  size = 150,
  opacity = 1,
  frame = 0,
}) => (
  <div style={{ width: size, height: size, position: "relative", opacity }}>
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: size * 0.1,
        width: size * 0.66,
        height: size * 0.5,
        borderRadius: `${size * 0.08}px ${size * 0.08}px ${size * 0.3}px ${size * 0.3}px`,
        background: "linear-gradient(180deg,#f4f7f5,#cfd8d4)",
      }}
    />
    <div
      style={{
        position: "absolute",
        bottom: size * 0.12,
        left: size * 0.72,
        width: size * 0.22,
        height: size * 0.24,
        borderRadius: "50%",
        border: `${size * 0.06}px solid #dfe6e2`,
      }}
    />
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          bottom: size * 0.52,
          left: size * (0.2 + i * 0.18),
          width: size * 0.05,
          height: size * 0.3,
          borderRadius: 99,
          background: "rgba(255,255,255,0.28)",
          transform: `translateY(${Math.sin(frame / 9 + i) * 6}px)`,
        }}
      />
    ))}
  </div>
);
