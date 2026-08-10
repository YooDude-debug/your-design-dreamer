import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../theme";
import { LogoMark, MARK_H, MARK_W, WordmarkDude, WordmarkY } from "../components/LogoLockup";

/**
 * 7-Phasen Logo-Animation (1080 x 1920, 30 fps, 150 Frames).
 *
 * 1  0- 24  Bildmarke erscheint mittig
 * 2 24- 62  Equalizer (SlangTag) pulsiert
 * 3 62- 82  Bildmarke verkleinert sich und wandert nach links
 * 4 82-106  "Y-" und "Dude" ziehen von rechts ein
 * 5 106-122 Impuls auf dem gesamten Lockup
 * 6 122-140 "Y-" verschwindet hinter der Bildmarke, "Dude" rueckt nach
 * 7 140-150 Ruhige Endeinstellung mit Slogan
 */

const CY = 880;

// Layout A: Bildmarke + "Y-" + "Dude"
const MARK_SMALL = 260;
const TEXT_H = 150;
const Y_W = (258 / 174) * TEXT_H;
const DUDE_W = (565 / 179) * TEXT_H;

const A_TOTAL = MARK_SMALL + 26 + Y_W + 10 + DUDE_W;
const A_MARK_X = (1080 - A_TOTAL) / 2;
const A_Y_X = A_MARK_X + MARK_SMALL + 26;
const A_DUDE_X = A_Y_X + Y_W + 10;

// Layout B: Bildmarke ersetzt das "Y"
const B_TOTAL = MARK_SMALL + 26 + DUDE_W;
const B_MARK_X = (1080 - B_TOTAL) / 2;
const B_DUDE_X = B_MARK_X + MARK_SMALL + 26;

export const SceneLogoIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1 – Auftritt
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 110, mass: 1.1 } });
  const introOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  // Phase 2 – Equalizer
  const energy = interpolate(frame, [22, 34, 118, 132], [0, 1, 1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3 – Verkleinern und nach links
  const shrink = interpolate(frame, [62, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Phase 4 – Text zieht ein
  const textIn = spring({
    frame: frame - 82,
    fps,
    config: { damping: 18, stiffness: 90 },
    durationInFrames: 26,
  });

  // Phase 5 – Impuls
  const pulse =
    interpolate(frame, [106, 112, 122], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * 0.06;

  // Phase 6 – "Y-" weicht der Bildmarke
  const swap = interpolate(frame, [122, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  // Phase 7 – Slogan
  const slogan = interpolate(frame, [138, 152], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const breathe = 1 + Math.sin(frame * 0.09) * 0.006;

  // Bildmarke: Groesse und Position
  const markW = interpolate(shrink, [0, 1], [620, MARK_SMALL]);
  const markH = (markW / MARK_W) * MARK_H;
  const markXCentered = (1080 - markW) / 2;
  const markXTarget = interpolate(swap, [0, 1], [A_MARK_X, B_MARK_X]);
  const markX = interpolate(shrink, [0, 1], [markXCentered, markXTarget]);

  const dudeX = interpolate(swap, [0, 1], [A_DUDE_X, B_DUDE_X]);
  const yOpacity = interpolate(swap, [0, 0.55], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      {/* Sanfter Lichtkegel hinter dem Logo */}
      <div
        style={{
          position: "absolute",
          left: -240,
          top: CY - 760,
          width: 1560,
          height: 1520,
          background:
            "radial-gradient(circle at 50% 50%, rgba(47,240,140,0.16) 0%, rgba(47,240,140,0.05) 38%, rgba(0,0,0,0) 68%)",
          opacity: introOpacity,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${(1 + pulse) * breathe})`,
          transformOrigin: `540px ${CY}px`,
        }}
      >
        {/* Bildmarke */}
        <div
          style={{
            position: "absolute",
            left: markX,
            top: CY - markH / 2,
            opacity: introOpacity,
            transform: `scale(${interpolate(enter, [0, 1], [0.72, 1])}) rotate(${interpolate(
              enter,
              [0, 1],
              [-7, 0],
            )}deg)`,
            transformOrigin: "center",
          }}
        >
          <LogoMark
            width={markW}
            energy={energy}
            frame={frame}
            glow={0.35 + energy * 0.5 + pulse * 6}
          />
        </div>

        {/* "Y-" (weiss) */}
        <div
          style={{
            position: "absolute",
            left: interpolate(swap, [0, 1], [A_Y_X, A_Y_X - 130]),
            top: CY - TEXT_H / 2 - 6,
            opacity: textIn * yOpacity,
            transform: `translateX(${interpolate(textIn, [0, 1], [220, 0])}px) scale(${interpolate(
              swap,
              [0, 1],
              [1, 0.7],
            )})`,
            transformOrigin: "left center",
          }}
        >
          <WordmarkY height={TEXT_H} />
        </div>

        {/* "Dude" (gruen) */}
        <div
          style={{
            position: "absolute",
            left: dudeX,
            top: CY - TEXT_H / 2 - 4,
            opacity: textIn,
            transform: `translateX(${interpolate(textIn, [0, 1], [320, 0])}px)`,
          }}
        >
          <WordmarkDude height={TEXT_H} />
        </div>
      </div>

      {/* Slogan */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: CY + 230,
          textAlign: "center",
          opacity: slogan,
          transform: `translateY(${interpolate(slogan, [0, 1], [16, 0])}px)`,
          fontSize: 42,
          letterSpacing: 4,
          fontWeight: 600,
          textTransform: "uppercase",
          color: C.ink,
        }}
      >
        Speak local. <span style={{ color: C.green }}>Connect global.</span>
      </div>
    </AbsoluteFill>
  );
};
