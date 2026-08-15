import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";

/** Hook (3 s): reiner Meme-Einstieg – noch keine Marke, nur die Pointe. */
export const SceneTransHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 30, fps, config: { damping: 11, stiffness: 190 } });
  const flash = interpolate(frame, [0, 4, 12], [0.28, 0.08, 0], { extrapolateRight: "clamp" });

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
          Kleiner Sprachtest
        </div>

        <KineticLine text="Google Translate" frame={frame} start={2} size={112} />
        <KineticLine text="würde jetzt" frame={frame} start={9} size={112} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <KineticLine text="aufgeben" frame={frame} start={16} size={150} color={C.green} />
          <div
            style={{
              fontSize: 130,
              paddingBottom: 6,
              opacity: pop,
              transform: `scale(${0.6 + pop * 0.4}) rotate(${interpolate(pop, [0, 1], [-18, 0])}deg)`,
            }}
          >
            😂
          </div>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ background: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
