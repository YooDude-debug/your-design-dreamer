import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";
import { FlagDE, HahaChip } from "../translate/icons";
import { BrandLockup } from "../../components/BrandLockup";
import { CoffeeCup, Face, PhoneCard, SpeechBubble } from "./faces";

const CAFE_HUE = "47,240,140";

/** Sehr dezente Café-Andeutung: warme Lichtflecken im Hintergrund. */
const CafeGlow: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: 120 + i * 380 + Math.sin(frame / 30 + i) * 16,
          top: 180 + (i % 2) * 1180,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,196,120,0.14), rgba(0,0,0,0) 70%)",
        }}
      />
    ))}
  </>
);

/** Szene 1 – Hook (1,3 s): erschrockener Tourist, sofortiger Einstieg. */
export const SaxHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = spring({ frame, fps, config: { damping: 11, stiffness: 200 } });
  const haha = spring({ frame: frame - 20, fps, config: { damping: 10, stiffness: 200 } });
  const flash = interpolate(frame, [0, 3, 10], [0.35, 0.1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.14} hue={CAFE_HUE} />
      <CafeGlow frame={frame} />
      <AbsoluteFill style={{ padding: "0 76px", justifyContent: "center", gap: 28 }}>
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
            opacity: face,
          }}
        >
          <FlagDE height={28} />
          <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: 6, color: C.ink }}>
            SACHSEN
          </span>
        </div>

        <div>
          <KineticLine text="Google Translate" frame={frame} start={0} size={100} />
          <KineticLine text="gegen Sachsen?" frame={frame} start={4} size={116} color={C.green} />
          <KineticLine text="Das kann nicht gutgehen." frame={frame} start={10} size={62} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 26 }}>
          <Face size={340} appear={face} frame={frame} shock mouth="o" />
          <div style={{ paddingBottom: 40 }}>
            <HahaChip size={46} opacity={haha} scale={0.6 + haha * 0.4} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** Szene 2 – Sachse spricht, KI uebersetzt absurd (3,3 s). */
export const SaxOrder: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = spring({ frame: frame - 2, fps, config: { damping: 13, stiffness: 180 } });
  const bar = interpolate(frame, [34, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = spring({ frame: frame - 52, fps, config: { damping: 12, stiffness: 180 } });
  const shake = out > 0 && out < 1 ? Math.sin((frame - 52) / 2) * (1 - out) * 12 : 0;

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.1} hue={CAFE_HUE} />
      <CafeGlow frame={frame} />
      <AbsoluteFill style={{ padding: "0 70px", justifyContent: "center", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Face size={230} appear={local} frame={frame} cap mouth="talk" />
          <SpeechBubble
            appear={local}
            who="SACHSE"
            size={62}
            text="„Nu freilich, mach mir ma fix n Schälchen Heeßn und e Eierschecke!“"
          />
        </div>

        <PhoneCard
          appear={out}
          bar={bar}
          shake={shake}
          width={940}
          text={
            <>
              “Now, of course, make me quickly a small{" "}
              <span
                style={{
                  color: C.red,
                  textDecoration: "underline",
                  textDecorationStyle: "wavy",
                  textDecorationColor: C.red,
                }}
              >
                bowl of hotness
              </span>
              .”
            </>
          }
        />

        <div style={{ display: "flex", alignItems: "center", gap: 26, opacity: out }}>
          <CoffeeCup size={140} frame={frame} opacity={out} />
          <div style={{ fontSize: 44, fontWeight: 700, color: C.red }}>
            „Schälchen Heeßn“ ≠ „bowl of hotness“
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 3 – Reaktion des Touristen (2,4 s), kurze Comedy-Pause. */
export const SaxReaction: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = spring({ frame, fps, config: { damping: 10, stiffness: 210 } });
  const line = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 190 } });
  const pop = 1 + Math.max(0, Math.sin((frame - 10) / 4)) * 0.03;

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.2} hue={CAFE_HUE} />
      <CafeGlow frame={frame} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 26 }}>
        <Face size={380} appear={face} frame={frame} shock mouth="wide" />
        <div
          style={{
            opacity: line,
            transform: `scale(${pop})`,
            textAlign: "center",
            padding: "0 70px",
          }}
        >
          <div style={{ fontSize: 66, fontWeight: 700, color: C.ink }}>„Ein…</div>
          <div
            style={{
              fontSize: 108,
              fontWeight: 800,
              letterSpacing: -4,
              color: C.green,
              lineHeight: 1.02,
            }}
          >
            BOWL OF HOTNESS?!“
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 99,
                background: C.muted,
                opacity: interpolate(frame, [30 + i * 8, 38 + i * 8], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 4 – zweite absurde Uebersetzung (3,2 s). */
export const SaxSecond: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = spring({ frame, fps, config: { damping: 13, stiffness: 190 } });
  const bar = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = spring({ frame: frame - 46, fps, config: { damping: 11, stiffness: 190 } });
  const meaning = interpolate(frame, [72, 86], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.12} hue={CAFE_HUE} />
      <CafeGlow frame={frame} />
      <AbsoluteFill style={{ padding: "0 70px", justifyContent: "center", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Face size={220} appear={local} frame={frame} cap mouth="flat" />
          <SpeechBubble
            appear={local}
            who="SACHSE"
            size={58}
            text="„Ei guggä maah, derdschiht scho widder nur Bahnhof, der Nischel-Bollermann.“"
          />
        </div>

        <PhoneCard
          appear={out}
          bar={bar}
          width={940}
          text={
            <>
              “
              <span
                style={{
                  color: C.red,
                  textDecoration: "underline",
                  textDecorationStyle: "wavy",
                  textDecorationColor: C.red,
                }}
              >
                Egg looker-maah
              </span>
              …{" "}
              <span
                style={{
                  color: C.red,
                  textDecoration: "underline",
                  textDecorationStyle: "wavy",
                  textDecorationColor: C.red,
                }}
              >
                skull-blockman
              </span>
              .”
            </>
          }
        />

        <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: meaning }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: C.muted }}>
            Heißt: „Er versteht wieder nichts.“
          </div>
          <HahaChip size={40} opacity={meaning} scale={0.8 + meaning * 0.2} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 5 – Punchline + dezentes Y-Dude-Ende (2,3 s). */
export const SaxEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = spring({ frame, fps, config: { damping: 13, stiffness: 190 } });
  const line = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brand = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [44, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.16} hue={CAFE_HUE} />
      <CafeGlow frame={frame} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <Face size={250} appear={face} frame={frame} mouth="flat" />
          <div style={{ paddingBottom: 30, opacity: face * 0.8 }}>
            <CoffeeCup size={120} frame={frame} />
          </div>
        </div>
        <div
          style={{
            opacity: line,
            fontSize: 74,
            fontWeight: 800,
            letterSpacing: -3,
            color: C.ink,
            textAlign: "center",
            padding: "0 80px",
            lineHeight: 1.06,
          }}
        >
          „Ich nehme einfach das vom Nachbartisch.“
        </div>
        <BrandLockup
          frame={frame}
          appear={brand * 0.9}
          sloganAppear={slogan * 0.85}
          markWidth={170}
          textHeight={96}
          energy={0.5}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
