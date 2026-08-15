import React from "react";
import { interpolate } from "remotion";
import { C } from "../../theme";
import { LogoMark, MARK_H, MARK_W, WordmarkDude } from "../../components/LogoLockup";

/** Dezenter Y-Dude-Hintergrund: nie reines Schwarz, immer leichte Bewegung. */
export const Backdrop: React.FC<{ frame: number; hue?: string; strength?: number }> = ({
  frame,
  hue = "47,240,140",
  strength = 0.16,
}) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(180deg, #050706 0%, #000 55%, #040806 100%)`,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: -260 + Math.sin(frame / 40) * 40,
        top: 120 + Math.cos(frame / 34) * 46,
        width: 1600,
        height: 1500,
        background: `radial-gradient(circle at 50% 50%, rgba(${hue},${strength}) 0%, rgba(${hue},0.045) 40%, rgba(0,0,0,0) 70%)`,
      }}
    />
  </>
);

/** Kleiner Marken-Anker (oben links) fuer die Szenen zwischen Intro und Ende. */
export const BrandCorner: React.FC<{ frame: number; opacity?: number }> = ({
  frame,
  opacity = 0.9,
}) => (
  <div
    style={{
      position: "absolute",
      left: 62,
      top: 62,
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity,
    }}
  >
    <LogoMark width={72} energy={0.7} frame={frame} glow={0.3} />
    <WordmarkDude height={42} style={{ marginTop: (72 / MARK_W) * MARK_H * 0.02 }} />
  </div>
);

/** Grosse Zeile mit Kinetik: pro Wort gestaffelt hoch, leicht unscharf herein. */
export const KineticLine: React.FC<{
  text: string;
  frame: number;
  start?: number;
  size?: number;
  color?: string;
  weight?: number;
  stagger?: number;
  align?: "left" | "center";
  italic?: boolean;
}> = ({
  text,
  frame,
  start = 0,
  size = 108,
  color = C.ink,
  weight = 800,
  stagger = 3.5,
  align = "left",
  italic = false,
}) => {
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: `${size * 0.06}px ${size * 0.24}px`,
        justifyContent: align === "center" ? "center" : "flex-start",
        fontSize: size,
        fontWeight: weight,
        lineHeight: 1.02,
        letterSpacing: -size * 0.03,
        color,
        fontStyle: italic ? "italic" : "normal",
        textAlign: align,
      }}
    >
      {words.map((w, i) => {
        const t = interpolate(frame - start - i * stagger, [0, 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const e = 1 - Math.pow(1 - t, 3);
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: "inline-block",
              opacity: e,
              transform: `translateY(${(1 - e) * size * 0.42}px) scale(${0.94 + e * 0.06})`,
              filter: `blur(${(1 - e) * 10}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
