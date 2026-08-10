import React from "react";
import { interpolate } from "remotion";
import { C } from "../theme";
import { LogoMark, MARK_H, MARK_W, WordmarkDude } from "./LogoLockup";

/**
 * OFFIZIELLER Y-DUDE BRANDING-LOCKUP (Standard fuer alle Clips).
 *
 *   [ Y-Dude Logo-Symbol ] Dude
 *      SPEAK LOCAL. CONNECT GLOBAL.
 *
 * Das Logo-Symbol uebernimmt visuell das "Y" – es steht nie ein separates "y"
 * vor "Dude". Es wird ausschliesslich die offizielle Wort-Bild-Marke verwendet
 * (Bilddateien `ydude-mark.png` und der Wortmarken-Ausschnitt `wm-dude.png`).
 */

export const SLOGAN = "Speak local. Connect global.";

type Props = {
  /** Breite des Logo-Symbols in Pixel. */
  markWidth?: number;
  /** Hoehe der Wortmarke "Dude" in Pixel. */
  textHeight?: number;
  /** 0..1 – Auftritt des Lockups. */
  appear?: number;
  /** 0..1 – Auftritt des Slogans. */
  sloganAppear?: number;
  /** Fortlaufender Frame fuer die Equalizer-Bewegung. */
  frame: number;
  /** 0 = Balken ruhen (Originallogo), 1 = volle Bewegung. */
  energy?: number;
};

export const BrandLockup: React.FC<Props> = ({
  markWidth = 260,
  textHeight = 150,
  appear = 1,
  sloganAppear = 1,
  frame,
  energy = 0.85,
}) => {
  const markHeight = (markWidth / MARK_W) * MARK_H;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 46,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 26,
          opacity: appear,
          transform: `translateY(${interpolate(appear, [0, 1], [26, 0])}px) scale(${interpolate(
            appear,
            [0, 1],
            [0.94, 1],
          )})`,
        }}
      >
        <LogoMark width={markWidth} energy={energy} frame={frame} glow={0.45} />
        <WordmarkDude height={textHeight} style={{ marginTop: markHeight * 0.02 }} />
      </div>

      <div
        style={{
          opacity: sloganAppear,
          transform: `translateY(${interpolate(sloganAppear, [0, 1], [16, 0])}px)`,
          fontSize: 42,
          letterSpacing: 4,
          fontWeight: 600,
          textTransform: "uppercase",
          color: C.ink,
          textAlign: "center",
        }}
      >
        Speak local. <span style={{ color: C.green }}>Connect global.</span>
      </div>
    </div>
  );
};
