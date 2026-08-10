import React from "react";
import { C } from "../theme";

/** Kleine Wellenform – Anzeige eines SlangTag-Audios. */
export const Waveform: React.FC<{
  frame: number;
  bars?: number;
  height?: number;
  color?: string;
  active?: boolean;
  width?: number;
}> = ({ frame, bars = 22, height = 34, color = C.green, active = true, width = 3 }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height }}>
      {new Array(bars).fill(0).map((_, i) => {
        const seed = (i * 37) % 11;
        const base = 0.25 + ((seed % 5) / 5) * 0.5;
        const wobble = active ? Math.sin((frame / 4.5) + i * 0.7) * 0.35 : 0;
        const h = Math.max(0.14, Math.min(1, base + wobble)) * height;
        return (
          <div
            key={i}
            style={{
              width,
              height: h,
              borderRadius: 99,
              background: color,
              opacity: active ? 0.95 : 0.4,
            }}
          />
        );
      })}
    </div>
  );
};
