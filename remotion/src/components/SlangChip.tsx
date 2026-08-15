import React from "react";
import { C } from "../theme";
import { Waveform } from "./Waveform";

/** SlangTag-Chip im Y-Dude-Stil (Glassmorphism). */
export const SlangChip: React.FC<{
  label: string;
  kind?: "community" | "creator" | "hashtag";
  frame: number;
  playing?: boolean;
  scale?: number;
  /** Optionale Standort-/Sprachangabe (z. B. "Berlin · DE"). */
  meta?: string;
}> = ({ label, kind = "community", frame, playing = false, scale = 1, meta }) => {
  const color = kind === "creator" ? C.blue : kind === "hashtag" ? C.red : C.green;
  const prefix = kind === "creator" ? "$$" : kind === "hashtag" ? "#" : "$";
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14 * scale,
        padding: `${14 * scale}px ${22 * scale}px`,
        borderRadius: 999,
        background: "rgba(12,14,13,0.62)",
        border: `${1.5 * scale}px solid ${color}66`,
        boxShadow: `0 0 ${40 * scale}px ${color}33, inset 0 1px 0 rgba(255,255,255,0.06)`,
        color: C.ink,
        fontSize: 30 * scale,
        fontWeight: 600,
        letterSpacing: -0.4,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color, fontWeight: 700 }}>{prefix}</span>
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.08 }}>
        <span>{label}</span>
        {meta && (
          <span style={{ fontSize: 19 * scale, fontWeight: 600, color: `${color}cc`, letterSpacing: 0 }}>
            {meta}
          </span>
        )}
      </span>
      <Waveform
        frame={frame}
        bars={10}
        height={26 * scale}
        width={3 * scale}
        color={color}
        active={playing}
      />
    </div>
  );
};
