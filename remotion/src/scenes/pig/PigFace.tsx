import React from "react";

/** Kleiner Schweine-Gag als Vektor (der Renderer hat keine Emoji-Schrift). */
export const PigFace: React.FC<{
  size?: number;
  /** 0..1 – Auftritt/Skalierung. */
  appear?: number;
  /** Fortlaufender Frame fuer das Wackeln. */
  frame?: number;
  /** true = ueberraschtes Gesicht (grosse Augen, O-Mund). */
  surprised?: boolean;
}> = ({ size = 220, appear = 1, frame = 0, surprised = false }) => {
  const wob = Math.sin(frame / 7) * 3;
  const eye = surprised ? size * 0.1 : size * 0.055;

  return (
    <div
      style={{
        width: size,
        height: size * 0.88,
        position: "relative",
        opacity: appear,
        transform: `scale(${0.6 + appear * 0.4}) rotate(${wob}deg)`,
      }}
    >
      {/* Ohren */}
      {[-1, 1].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute",
            top: size * 0.02,
            left: `calc(50% + ${s * size * 0.3}px)`,
            width: size * 0.22,
            height: size * 0.24,
            marginLeft: -size * 0.11,
            background: "#f2a3b6",
            borderRadius: "60% 60% 20% 20%",
            transform: `rotate(${s * 16}deg)`,
          }}
        />
      ))}
      {/* Kopf */}
      <div
        style={{
          position: "absolute",
          top: size * 0.12,
          left: "50%",
          marginLeft: -size * 0.4,
          width: size * 0.8,
          height: size * 0.7,
          background: "linear-gradient(180deg, #ffc2d1, #f299b0)",
          borderRadius: "48% 48% 46% 46%",
          boxShadow: "inset 0 -10px 24px rgba(0,0,0,0.08)",
        }}
      />
      {/* Augen */}
      {[-1, 1].map((s) => (
        <div
          key={s}
          style={{
            position: "absolute",
            top: size * 0.3,
            left: `calc(50% + ${s * size * 0.17}px)`,
            marginLeft: -eye / 2,
            width: eye,
            height: eye,
            background: "#231a1d",
            borderRadius: 999,
          }}
        />
      ))}
      {/* Ruessel */}
      <div
        style={{
          position: "absolute",
          top: size * 0.46,
          left: "50%",
          marginLeft: -size * 0.16,
          width: size * 0.32,
          height: size * 0.22,
          background: "#e8809b",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: size * 0.06,
        }}
      >
        <div
          style={{ width: size * 0.05, height: size * 0.08, background: "#b85d75", borderRadius: 999 }}
        />
        <div
          style={{ width: size * 0.05, height: size * 0.08, background: "#b85d75", borderRadius: 999 }}
        />
      </div>
      {surprised ? (
        <div
          style={{
            position: "absolute",
            top: size * 0.68,
            left: "50%",
            marginLeft: -size * 0.05,
            width: size * 0.1,
            height: size * 0.1,
            border: `${size * 0.022}px solid #b85d75`,
            borderRadius: 999,
          }}
        />
      ) : null}
    </div>
  );
};

/** Zwei kleine Notenzeichen, die aus dem Ruessel "pfeifen". */
export const WhistleNotes: React.FC<{ frame: number; appear?: number; color?: string }> = ({
  frame,
  appear = 1,
  color = "#2ff08c",
}) => (
  <div style={{ position: "relative", width: 160, height: 130 }}>
    {[0, 1, 2].map((i) => {
      const t = ((frame + i * 12) % 42) / 42;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 10 + i * 34 + Math.sin((frame + i * 9) / 8) * 8,
            bottom: t * 108,
            fontSize: 52 - i * 6,
            fontWeight: 700,
            color,
            opacity: appear * (1 - t) * 0.95,
          }}
        >
          {i % 2 === 0 ? "♪" : "♫"}
        </div>
      );
    })}
  </div>
);
