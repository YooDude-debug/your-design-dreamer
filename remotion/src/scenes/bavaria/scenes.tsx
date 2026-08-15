import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";
import { FlagDE, HahaChip } from "../translate/icons";
import { BavariaMap, ClockIcon, LozengePattern, Pretzel } from "./parts";
import { BrandLockup } from "../../components/BrandLockup";

/** Szene 1 – sofortiger Einstieg mit dem Spruch (2,7 s). */
export const BavHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chip = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  const map = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const flash = interpolate(frame, [0, 4, 12], [0.3, 0.08, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.12} />
      <LozengePattern opacity={0.07} />
      <AbsoluteFill style={{ padding: "0 82px", justifyContent: "center", gap: 34 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 18,
            padding: "14px 28px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${C.border}`,
            opacity: chip,
          }}
        >
          <FlagDE height={30} />
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: 6, color: C.ink }}>
            BAYERN
          </span>
        </div>

        <div>
          <KineticLine text="„Schau ma moi," frame={frame} start={1} size={110} />
          <KineticLine text="dann seng" frame={frame} start={7} size={110} />
          <KineticLine text="ma scho.“" frame={frame} start={13} size={132} color={C.green} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 30 }}>
          <BavariaMap height={230} appear={map} />
          <div style={{ paddingBottom: 26 }}>
            <Pretzel size={96} opacity={map * 0.9} rotate={-8} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** Szene 2 – absurde KI-Übersetzung (4,3 s) inkl. "times"-Gag. */
export const BavLiteral: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bar = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = spring({ frame: frame - 24, fps, config: { damping: 13, stiffness: 170 } });
  const gag = spring({ frame: frame - 56, fps, config: { damping: 11, stiffness: 190 } });
  const shake = gag > 0 && gag < 1 ? Math.sin((frame - 56) / 2.1) * (1 - gag) * 13 : 0;
  const haha = spring({ frame: frame - 86, fps, config: { damping: 10, stiffness: 200 } });

  const clocks = [0, 1, 2, 3, 4];

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.1} />
      <AbsoluteFill style={{ padding: "0 78px", justifyContent: "center", gap: 34 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ fontSize: 32, letterSpacing: 5, color: C.muted, fontWeight: 700 }}>
            KI ÜBERSETZT
          </div>
          <div
            style={{
              flex: 1,
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
                background: `linear-gradient(90deg, ${C.green}, ${C.cyan})`,
              }}
            />
          </div>
        </div>

        <div
          style={{
            opacity: out,
            transform: `translateY(${interpolate(out, [0, 1], [46, 0])}px) translateX(${shake}px)`,
            background: C.card2,
            border: `1px solid ${C.border}`,
            borderRadius: 40,
            padding: "40px 42px",
          }}
        >
          <div style={{ fontSize: 32, letterSpacing: 4, color: C.muted, fontWeight: 700 }}>
            ENGLISH · WÖRTLICH
          </div>
          <div
            style={{
              fontSize: 94,
              fontWeight: 800,
              letterSpacing: -4,
              color: C.ink,
              marginTop: 14,
              lineHeight: 1.05,
            }}
          >
            “Look{" "}
            <span
              style={{
                color: C.red,
                textDecoration: "underline",
                textDecorationStyle: "wavy",
                textDecorationColor: C.red,
              }}
            >
              times
            </span>
            , then see{" "}
            <span
              style={{
                color: C.red,
                textDecoration: "underline",
                textDecorationStyle: "wavy",
                textDecorationColor: C.red,
              }}
            >
              times
            </span>{" "}
            already.”
          </div>
        </div>

        {/* Gag: "moi" wird zu "times" – plötzlich lauter Uhren */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            opacity: gag,
            transform: `translateY(${interpolate(gag, [0, 1], [30, 0])}px)`,
          }}
        >
          {clocks.map((i) => (
            <div
              key={i}
              style={{
                transform: `scale(${0.6 + gag * (0.4 + i * 0.06)}) rotate(${(1 - gag) * (i % 2 ? 18 : -18)}deg)`,
              }}
            >
              <ClockIcon size={104} frame={frame - 56 - i * 4} spin={1 + i * 0.35} />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: C.red,
              opacity: interpolate(frame, [78, 92], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            „moi“ ≠ „times“
          </div>
          <HahaChip size={50} opacity={haha} scale={0.6 + haha * 0.4} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 3 – tatsächliche Bedeutung (3,6 s). */
export const BavMeaning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 160 } });
  const alt = interpolate(frame, [52, 68], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const map = spring({ frame: frame - 40, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.2} />
      <LozengePattern opacity={0.05} size={190} />
      <AbsoluteFill style={{ padding: "0 84px", justifyContent: "center", gap: 32 }}>
        <div
          style={{
            fontSize: 42,
            letterSpacing: 4,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase",
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Was es wirklich heißt:
        </div>

        <div
          style={{
            opacity: reveal,
            transform: `translateY(${interpolate(reveal, [0, 1], [44, 0])}px)`,
            fontSize: 112,
            fontWeight: 800,
            letterSpacing: -4,
            color: C.green,
            lineHeight: 1.03,
          }}
        >
          „Mal abwarten, was passiert.“
        </div>

        <div
          style={{
            height: 5,
            width: 320,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${C.green}, rgba(47,240,140,0))`,
          }}
        />

        <div style={{ display: "flex", alignItems: "flex-end", gap: 34 }}>
          <div style={{ fontSize: 50, fontWeight: 600, color: C.ink, opacity: alt * 0.85, flex: 1 }}>
            Kein Stress. Einfach schauen, was kommt.
          </div>
          <BavariaMap height={220} appear={map} dotLabel="Bayern" />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 4 – humorvoller Abschluss (2,8 s). */
export const BavEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = interpolate(frame, [2, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brand = spring({ frame: frame - 24, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.16} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 58 }}>
        <div
          style={{
            fontSize: 70,
            fontWeight: 700,
            color: C.ink,
            textAlign: "center",
            padding: "0 90px",
            opacity: line,
            transform: `translateY(${interpolate(line, [0, 1], [22, 0])}px)`,
          }}
        >
          Manche Sprachen versteht
          <br />
          nur die Region.
        </div>
        <BrandLockup
          frame={frame}
          appear={brand * 0.94}
          sloganAppear={slogan * 0.9}
          markWidth={200}
          textHeight={116}
          energy={0.5}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
