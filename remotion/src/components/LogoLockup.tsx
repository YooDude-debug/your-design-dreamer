import React from "react";
import { Img, staticFile } from "remotion";

/**
 * Y-Dude Logo-Lockup fuer die Intro-Animation.
 *
 * Die Bildmarke (`ydude-mark.png`) enthaelt fuenf ausgestanzte Equalizer-Balken.
 * Fuer die Animation werden diese Ausschnitte mit dem Logo-Gruen ueberdeckt und
 * darueber frei animierbare Balken in der Hintergrundfarbe gezeichnet.
 *
 * Alle Koordinaten sind in der natuerlichen Groesse der PNG (948 x 1125).
 */

export const MARK_W = 948;
export const MARK_H = 1125;

const BAR_X = [108, 175, 244, 313, 380.5];
const BAR_HALF = [40.5, 81, 126, 81, 41.5];
const BAR_W = 29;
const BAR_CY = 220;
const COVER_HALF = 133;

type Props = {
  /** Angezeigte Breite der Bildmarke in Pixel. */
  width: number;
  /** 0 = Balken ruhen (Originalhoehe), 1 = volle Bewegung. */
  energy: number;
  /** Fortlaufender Frame fuer die Balkenbewegung. */
  frame: number;
  glow?: number;
};

export const LogoMark: React.FC<Props> = ({ width, energy, frame, glow = 0.5 }) => {
  const scale = width / MARK_W;

  return (
    <div
      style={{
        width,
        height: MARK_H * scale,
        position: "relative",
        filter: `drop-shadow(0 0 ${34 * glow}px rgba(47,240,140,${0.55 * glow}))`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: MARK_W,
          height: MARK_H,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <Img
          src={staticFile("images/ydude-mark.png")}
          style={{ width: MARK_W, height: MARK_H, display: "block" }}
        />

        {BAR_X.map((x, i) => {
          const speed = 0.34 + i * 0.05;
          const wave =
            0.5 +
            0.5 *
              Math.sin(frame * speed + i * 1.35) *
              (0.65 + 0.35 * Math.sin(frame * 0.11 + i));
          const half = BAR_HALF[i]! * (1 - energy) + (18 + wave * 108) * energy;

          return (
            <React.Fragment key={x}>
              {/* Original-Ausschnitt abdecken */}
              <div
                style={{
                  position: "absolute",
                  left: x - BAR_W / 2 - 4,
                  top: BAR_CY - COVER_HALF,
                  width: BAR_W + 8,
                  height: COVER_HALF * 2,
                  background: "linear-gradient(180deg,#9bf859 0%,#8bf758 55%,#84f65f 100%)",
                }}
              />
              {/* Animierter Balken */}
              <div
                style={{
                  position: "absolute",
                  left: x - BAR_W / 2,
                  top: BAR_CY - half,
                  width: BAR_W,
                  height: half * 2,
                  borderRadius: BAR_W / 2,
                  background: "#000000",
                }}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export const WordmarkY: React.FC<{ height: number; style?: React.CSSProperties }> = ({
  height,
  style,
}) => (
  <Img
    src={staticFile("images/wm-y.png")}
    style={{ height, width: (258 / 174) * height, display: "block", ...style }}
  />
);

export const WordmarkDude: React.FC<{ height: number; style?: React.CSSProperties }> = ({
  height,
  style,
}) => (
  <Img
    src={staticFile("images/wm-dude.png")}
    style={{ height, width: (565 / 179) * height, display: "block", ...style }}
  />
);
