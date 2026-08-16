import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";
import { FlagDE, HahaChip } from "../translate/icons";
import { BrandLockup } from "../../components/BrandLockup";
import { CoffeeCup, Face, PhoneCard, SpeechBubble } from "../saxony/faces";

const HUE = "47,240,140";

/** Szene 1 – Hook (3 s): "Google Translate kann Woerter uebersetzen ... aber Sachsen?" */
export const ExHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const face = spring({ frame, fps, config: { damping: 11, stiffness: 210 } });
  const phone = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 180 } });
  const punch = spring({ frame: frame - 46, fps, config: { damping: 10, stiffness: 200 } });
  const haha = spring({ frame: frame - 62, fps, config: { damping: 9, stiffness: 200 } });
  const flash = interpolate(frame, [0, 3, 9], [0.4, 0.12, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.14} hue={HUE} />
      <AbsoluteFill style={{ padding: "0 72px", justifyContent: "center", gap: 30 }}>
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
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 6, color: C.ink }}>
            DIALEKT-TEST
          </span>
        </div>

        <KineticLine text="Google Translate kann Wörter übersetzen…" frame={frame} start={0} size={78} />

        <PhoneCard
          appear={phone}
          bar={interpolate(frame, [10, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          width={880}
          text="“translating…”"
        />

        <div
          style={{
            opacity: punch,
            transform: `translateY(${interpolate(punch, [0, 1], [40, 0])}px)`,
          }}
        >
          <KineticLine text="…aber kann es Sachsen verstehen?" frame={frame} start={46} size={104} color={C.green} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <Face size={300} appear={face} frame={frame} shock mouth="o" />
          <div style={{ paddingBottom: 34 }}>
            <HahaChip size={46} opacity={haha} scale={0.6 + haha * 0.4} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** Szene 2 – Beispiel (5 s): Sachse redet schnell, Tourist versteht nichts. */
export const ExExample: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = spring({ frame, fps, config: { damping: 13, stiffness: 190 } });
  const bar = interpolate(frame, [40, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = spring({ frame: frame - 62, fps, config: { damping: 12, stiffness: 180 } });
  const shake = out > 0 && out < 1 ? Math.sin((frame - 62) / 2) * (1 - out) * 12 : 0;
  const confused = spring({ frame: frame - 100, fps, config: { damping: 10, stiffness: 210 } });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.11} hue={HUE} />
      <AbsoluteFill style={{ padding: "0 68px", justifyContent: "center", gap: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Face size={225} appear={local} frame={frame} cap mouth="talk" />
          <SpeechBubble
            appear={local}
            who="SACHSE"
            size={58}
            text="„Nu, machn wer’s so: erschd n Schälchen Heeßn, dann gugge mer weiter, gell?“"
          />
        </div>

        <PhoneCard
          appear={out}
          bar={bar}
          shake={shake}
          width={920}
          text={
            <>
              “Now we do it so: first a{" "}
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
              …?”
            </>
          }
        />

        <div style={{ display: "flex", alignItems: "flex-end", gap: 26, opacity: confused }}>
          <Face size={300} appear={confused} frame={frame} shock mouth="wide" />
          <div style={{ paddingBottom: 40 }}>
            <div style={{ fontSize: 58, fontWeight: 800, color: C.ink, lineHeight: 1.05 }}>
              „…was?!“
            </div>
            <div style={{ marginTop: 10 }}>
              <CoffeeCup size={110} frame={frame} opacity={confused} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 3 – Y-Dude erklaert (3,5 s): drei kurze Nutzen-Zeilen. */
export const ExYDude: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame, fps, config: { damping: 200 } });
  const rows = ["Slang hören.", "Bedeutung checken.", "Weltweit verstehen."];

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.2} hue={HUE} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
        <div style={{ opacity: brand, transform: `scale(${0.9 + brand * 0.1})` }}>
          <KineticLine text="Dafür gibt's Y-Dude." frame={frame} start={0} size={104} align="center" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22, padding: "0 76px" }}>
          {rows.map((r, i) => {
            const t = spring({
              frame: frame - 18 - i * 12,
              fps,
              config: { damping: 14, stiffness: 190 },
            });
            return (
              <div
                key={r}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  opacity: t,
                  transform: `translateX(${interpolate(t, [0, 1], [-60, 0])}px)`,
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 30,
                  padding: "22px 32px",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 99,
                    background: C.green,
                    boxShadow: `0 0 24px ${C.green}`,
                  }}
                />
                <div style={{ fontSize: 62, fontWeight: 800, letterSpacing: -2, color: C.ink }}>
                  {r}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 4 – CTA (2,7 s): Logo-Lockup + Domain. */
export const ExCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const brand = spring({ frame: frame - 2, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const url = interpolate(frame, [38, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.18} hue={HUE} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 54 }}>
        <BrandLockup
          frame={frame}
          appear={brand}
          sloganAppear={slogan}
          markWidth={230}
          textHeight={132}
          energy={0.6}
        />
        <div
          style={{
            opacity: url,
            transform: `translateY(${interpolate(url, [0, 1], [18, 0])}px)`,
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: 4,
            color: C.green,
            padding: "16px 40px",
            borderRadius: 999,
            border: `1px solid ${C.green}55`,
            background: "rgba(47,240,140,0.08)",
          }}
        >
          ydude.com
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
