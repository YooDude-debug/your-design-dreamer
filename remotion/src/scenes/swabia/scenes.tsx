import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";
import { FlagDE, HahaChip } from "../translate/icons";
import { Face, SpeechBubble } from "../saxony/faces";
import { BrandLockup } from "../../components/BrandLockup";

const HUE = "47,240,140";

/** Szene 1 (0–2 s) – Schwäbischer Satz + große Texteinblendung SCHWÄBISCH. */
export const SwHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chip = spring({ frame, fps, config: { damping: 200 } });
  const face = spring({ frame: frame - 4, fps, config: { damping: 12, stiffness: 190 } });
  const bubble = spring({ frame: frame - 10, fps, config: { damping: 13, stiffness: 180 } });
  const flash = interpolate(frame, [0, 4, 12], [0.22, 0.06, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.14} hue={HUE} />
      <AbsoluteFill style={{ padding: "0 76px", justifyContent: "center", gap: 30 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 18,
            padding: "12px 26px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${C.border}`,
            opacity: chip,
          }}
        >
          <FlagDE height={30} />
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: C.ink }}>
            SCHWÄBISCH
          </span>
        </div>

        <KineticLine text="SCHWÄBISCH" frame={frame} start={0} size={148} color={C.green} />

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Face size={240} appear={face} frame={frame} mouth="talk" />
          <SpeechBubble
            appear={bubble}
            who="SCHWABE"
            size={64}
            text="„Des isch aber au a bissle komisch.“"
          />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** Szene 2 (2–5 s) – die andere Person versteht nichts: „Äh… was?“ */
export const SwWhat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = spring({ frame: frame - 2, fps, config: { damping: 11, stiffness: 200 } });
  const bubble = spring({ frame: frame - 16, fps, config: { damping: 12, stiffness: 180 } });
  const marks = spring({ frame: frame - 34, fps, config: { damping: 10, stiffness: 190 } });
  const haha = spring({ frame: frame - 58, fps, config: { damping: 10, stiffness: 200 } });
  const zoom = interpolate(frame, [0, 90], [1, 1.08], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.1} hue={HUE} />
      <AbsoluteFill
        style={{
          padding: "0 76px",
          justifyContent: "center",
          gap: 34,
          transform: `scale(${zoom})`,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 26 }}>
          <div style={{ position: "relative" }}>
            <Face size={330} appear={face} frame={frame} shock mouth="o" />
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  right: -40 - i * 44,
                  top: -30 + i * 26,
                  fontSize: 74 - i * 14,
                  fontWeight: 800,
                  color: C.green,
                  opacity: marks * (1 - i * 0.22),
                  transform: `rotate(${i % 2 ? 12 : -10}deg) scale(${0.6 + marks * 0.4})`,
                }}
              >
                ?
              </div>
            ))}
          </div>
          <div style={{ paddingBottom: 34 }}>
            <HahaChip size={46} opacity={haha} scale={0.6 + haha * 0.4} />
          </div>
        </div>

        <SpeechBubble appear={bubble} who="GEGENÜBER" size={104} text="„Äh… was?“" />

        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: C.muted,
            opacity: interpolate(frame, [46, 62], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Kein Wort verstanden.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 3 (5–7 s) – Schwabe findet es völlig klar. */
export const SwClear: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = spring({ frame, fps, config: { damping: 12, stiffness: 190 } });
  const bubble = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 175 } });
  const line = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.2} hue={HUE} />
      <AbsoluteFill style={{ padding: "0 76px", justifyContent: "center", gap: 32 }}>
        <SpeechBubble
          appear={bubble}
          who="SCHWABE"
          size={92}
          text="„Ha, des isch doch ganz klar!“"
        />
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Face size={280} appear={face} frame={frame} mouth="wide" />
          <div
            style={{
              fontSize: 50,
              fontWeight: 700,
              color: C.green,
              opacity: line,
              transform: `translateY(${interpolate(line, [0, 1], [20, 0])}px)`,
            }}
          >
            Für ihn schon.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 4 (7–9 s) – Abschlussgrafik mit Community-Frage. */
export const SwEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = interpolate(frame, [1, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brand = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [28, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.18} hue={HUE} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 54 }}>
        <div
          style={{
            fontSize: 82,
            fontWeight: 800,
            letterSpacing: -2,
            color: C.ink,
            textAlign: "center",
            padding: "0 84px",
            opacity: line,
            transform: `translateY(${interpolate(line, [0, 1], [24, 0])}px)`,
          }}
        >
          Wie sagt man das
          <br />
          <span style={{ color: C.green }}>bei euch?</span>
        </div>
        <BrandLockup
          frame={frame}
          appear={brand}
          sloganAppear={slogan}
          markWidth={200}
          textHeight={116}
          energy={0.6}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
