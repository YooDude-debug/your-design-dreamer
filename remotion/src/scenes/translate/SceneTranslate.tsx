import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop } from "../challenge/parts";

/** Uebersetzer-Szene (4 s): der Satz, darunter die absurde Woertlich-Version. */
export const SceneTranslate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const card = spring({ frame, fps, config: { damping: 200 } });
  const typed = Math.round(
    interpolate(frame, [8, 34], [0, 16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const src = "Mach keinen Film.".slice(0, typed);
  const out = spring({ frame: frame - 44, fps, config: { damping: 13, stiffness: 170 } });
  const wtf = spring({ frame: frame - 72, fps, config: { damping: 10, stiffness: 200 } });
  const shake = wtf > 0 ? Math.sin((frame - 72) / 2.2) * (1 - wtf) * 14 : 0;

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.1} />

      <AbsoluteFill style={{ padding: "0 78px", justifyContent: "center", gap: 40 }}>
        <div
          style={{
            opacity: card,
            transform: `translateY(${interpolate(card, [0, 1], [40, 0])}px)`,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 40,
            padding: "44px 46px",
          }}
        >
          <div style={{ fontSize: 34, letterSpacing: 4, color: C.muted, fontWeight: 700 }}>
            DEUTSCH
          </div>
          <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3, color: C.ink, marginTop: 14 }}>
            {src}
            <span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: C.green }}>|</span>
          </div>
        </div>

        <div
          style={{
            alignSelf: "center",
            fontSize: 72,
            color: C.green,
            opacity: out,
            transform: `translateY(${interpolate(out, [0, 1], [-20, 0])}px)`,
          }}
        >
          ↓
        </div>

        <div
          style={{
            opacity: out,
            transform: `translateY(${interpolate(out, [0, 1], [50, 0])}px) translateX(${shake}px)`,
            background: C.card2,
            border: `1px solid ${C.border}`,
            borderRadius: 40,
            padding: "44px 46px",
          }}
        >
          <div style={{ fontSize: 34, letterSpacing: 4, color: C.muted, fontWeight: 700 }}>
            ENGLISH · WÖRTLICH
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -4,
              color: C.ink,
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 22,
            }}
          >
            “Make no movie.”
            <span style={{ fontSize: 78, opacity: wtf, transform: `scale(${0.5 + wtf * 0.5})` }}>
              🎬
            </span>
          </div>
        </div>

        <div
          style={{
            alignSelf: "center",
            marginTop: 12,
            fontSize: 44,
            fontWeight: 700,
            color: C.red,
            opacity: interpolate(frame, [86, 100], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          ...ähm. Nein.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
