import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../../theme";
import { Backdrop, KineticLine } from "../challenge/parts";

/** Message (3 s): eine ruhige Zeile, kein Verkauf. */
export const SceneMessage: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 46) * 8;

  return (
    <AbsoluteFill>
      <Backdrop frame={frame} strength={0.12} />

      <AbsoluteFill
        style={{ padding: "0 96px", justifyContent: "center", transform: `translateY(${drift}px)` }}
      >
        <KineticLine text="Sprache ist manchmal" frame={frame} start={2} size={104} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 26, flexWrap: "wrap" }}>
          <KineticLine text="mehr als" frame={frame} start={12} size={104} />
          <KineticLine text="Übersetzung." frame={frame} start={20} size={116} color={C.green} />
        </div>
        <div
          style={{
            marginTop: 44,
            height: 5,
            width: interpolate(frame, [34, 64], [0, 380], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            background: `linear-gradient(90deg, ${C.green}, rgba(47,240,140,0))`,
            borderRadius: 99,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
