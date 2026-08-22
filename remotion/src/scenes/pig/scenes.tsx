import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";
import { FlagDE, HahaChip } from "../translate/icons";
import { PigFace, WhistleNotes } from "./PigFace";
import { BrandLockup } from "../../components/BrandLockup";

/** Union-Jack-artige Flagge als Vektor (vereinfacht). */
const FlagGB: React.FC<{ height?: number }> = ({ height = 40 }) => (
  <div
    style={{
      width: height * 1.6,
      height,
      borderRadius: 6,
      overflow: "hidden",
      position: "relative",
      background: "#0b2a6b",
      boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(to bottom right, transparent 45%, #fff 45%, #fff 55%, transparent 55%), linear-gradient(to bottom left, transparent 45%, #fff 45%, #fff 55%, transparent 55%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "40%",
        height: "20%",
        background: "#fff",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "40%",
        width: "20%",
        background: "#fff",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: "44%",
        height: "12%",
        background: "#c8102e",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: "44%",
        width: "12%",
        background: "#c8102e",
      }}
    />
  </div>
);

/** Szene 1 – Hook (3 s). */
export const PigHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 34, fps, config: { damping: 11, stiffness: 190 } });
  const flash = interpolate(frame, [0, 4, 12], [0.3, 0.08, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.14} />
      <AbsoluteFill style={{ padding: "0 86px", justifyContent: "center" }}>
        <div
          style={{
            fontSize: 40,
            letterSpacing: 8,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase",
            opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
            marginBottom: 26,
          }}
        >
          Sprachtest
        </div>
        <KineticLine text="Wenn du deutsche" frame={frame} start={2} size={104} />
        <KineticLine text="Redewendungen" frame={frame} start={9} size={104} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <KineticLine
            text="wörtlich übersetzt"
            frame={frame}
            start={16}
            size={124}
            color={C.green}
          />
          <div style={{ paddingBottom: 20 }}>
            <HahaChip size={52} opacity={pop} scale={0.6 + pop * 0.4} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

/** Szene 2 – deutsches Original (3 s). */
export const PigOriginal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame, fps, config: { damping: 200 } });
  const pig = spring({ frame: frame - 40, fps, config: { damping: 10, stiffness: 180 } });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.12} />
      <AbsoluteFill style={{ padding: "0 78px", justifyContent: "center", gap: 46 }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            alignItems: "center",
            gap: 20,
            padding: "16px 30px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${C.border}`,
            opacity: card,
          }}
        >
          <FlagDE height={34} />
          <span style={{ fontSize: 38, fontWeight: 800, letterSpacing: 6, color: C.ink }}>
            DEUTSCH
          </span>
        </div>

        <div>
          <KineticLine text="„Ich glaub," frame={frame} start={4} size={110} />
          <KineticLine text="mein Schwein" frame={frame} start={12} size={110} />
          <KineticLine text="pfeift!“" frame={frame} start={20} size={140} color={C.green} />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 6 }}>
          <PigFace size={200} appear={pig} frame={frame} surprised />
          <div style={{ marginBottom: 40 }}>
            <WhistleNotes frame={frame} appear={pig} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 3 – woertliche Uebersetzung (4 s). */
export const PigLiteral: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bar = interpolate(frame, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = spring({ frame: frame - 28, fps, config: { damping: 13, stiffness: 170 } });
  const wtf = spring({ frame: frame - 62, fps, config: { damping: 10, stiffness: 200 } });
  const shake = wtf > 0 && wtf < 1 ? Math.sin((frame - 62) / 2.2) * (1 - wtf) * 14 : 0;

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.1} />
      <AbsoluteFill style={{ padding: "0 78px", justifyContent: "center", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ fontSize: 34, letterSpacing: 5, color: C.muted, fontWeight: 700 }}>
            ÜBERSETZE
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
            transform: `translateY(${interpolate(out, [0, 1], [50, 0])}px) translateX(${shake}px)`,
            background: C.card2,
            border: `1px solid ${C.border}`,
            borderRadius: 40,
            padding: "42px 44px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <FlagGB height={34} />
            <div style={{ fontSize: 34, letterSpacing: 4, color: C.muted, fontWeight: 700 }}>
              ENGLISH · WÖRTLICH
            </div>
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -4,
              color: C.ink,
              marginTop: 16,
            }}
          >
            “I think my pig whistles!”
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <PigFace size={190} appear={wtf} frame={frame} surprised />
            <div style={{ marginBottom: 34 }}>
              <WhistleNotes frame={frame} appear={wtf} color={C.cyan} />
            </div>
          </div>
          <div
            style={{
              paddingBottom: 26,
              fontSize: 44,
              fontWeight: 700,
              color: C.red,
              opacity: interpolate(frame, [84, 100], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            ...ähm. Nein.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 4 – echte Bedeutung (4 s). */
export const PigMeaning: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 22, fps, config: { damping: 12, stiffness: 160 } });
  const alt1 = interpolate(frame, [56, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const alt2 = interpolate(frame, [68, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const laugh = spring({ frame: frame - 74, fps, config: { damping: 9, stiffness: 210 } });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.2} />
      <AbsoluteFill style={{ padding: "0 84px", justifyContent: "center", gap: 34 }}>
        <div
          style={{
            fontSize: 44,
            letterSpacing: 4,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase",
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Was damit wirklich gemeint ist:
        </div>

        <div
          style={{
            opacity: reveal,
            transform: `translateY(${interpolate(reveal, [0, 1], [46, 0])}px)`,
          }}
        >
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -4, color: C.green }}>
            „Das ist ja wohl nicht zu fassen!“
          </div>
        </div>

        <div
          style={{
            height: 5,
            width: 340,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${C.green}, rgba(47,240,140,0))`,
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 52, fontWeight: 600, color: C.ink, opacity: alt1 * 0.85 }}>
            „Ich fass’ es nicht.“
          </div>
          <div style={{ fontSize: 52, fontWeight: 600, color: C.ink, opacity: alt2 * 0.85 }}>
            „Du willst mich wohl veräppeln.“
          </div>
        </div>

        <div style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <HahaChip size={50} opacity={laugh} scale={0.6 + laugh * 0.4} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Szene 5 – ruhiger Abschluss (3 s). */
export const PigEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = interpolate(frame, [2, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const brand = spring({ frame: frame - 26, fps, config: { damping: 200 } });
  const slogan = interpolate(frame, [44, 64], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.16} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70 }}>
        <div
          style={{
            fontSize: 74,
            fontWeight: 700,
            color: C.ink,
            textAlign: "center",
            opacity: line,
            transform: `translateY(${interpolate(line, [0, 1], [22, 0])}px)`,
          }}
        >
          Sprache ist mehr als Wörter.
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
