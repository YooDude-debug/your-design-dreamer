import React from "react";
import { interpolate } from "remotion";
import { C } from "../../theme";

const ease = (frame: number, start: number, dur = 14) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Sanftes Einblenden mit leichtem Hochgleiten (Y-Dude-Standardauftritt). */
const appearStyle = (p: number): React.CSSProperties => ({
  opacity: p,
  transform: `translateY(${interpolate(p, [0, 1], [26, 0])}px) scale(${interpolate(
    p,
    [0, 1],
    [0.97, 1],
  )})`,
});

export const Bubble: React.FC<{
  frame: number;
  start: number;
  outgoing?: boolean;
  time: string;
  children: React.ReactNode;
  translated?: React.ReactNode;
}> = ({ frame, start, outgoing = false, time, children, translated }) => {
  const p = ease(frame, start, 12);
  if (p <= 0) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: outgoing ? "flex-end" : "flex-start",
        ...appearStyle(p),
      }}
    >
      <div
        style={{
          maxWidth: "82%",
          borderRadius: 30,
          padding: "26px 30px 18px",
          background: outgoing ? "rgba(20,54,36,0.92)" : "rgba(12,26,24,0.92)",
          border: `2px solid ${outgoing ? "rgba(47,240,140,0.55)" : "rgba(47,240,140,0.22)"}`,
          color: C.ink,
          fontSize: 42,
          lineHeight: 1.28,
          boxShadow: outgoing ? `0 0 60px rgba(47,240,140,0.10)` : "none",
        }}
      >
        <div>{children}</div>
        {translated}
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 10,
            fontSize: 28,
            color: C.muted,
          }}
        >
          {time}
          {outgoing ? <span style={{ color: C.cyan }}>🌐</span> : null}
        </div>
      </div>
    </div>
  );
};

/** Die eingeblendete Übersetzung – der eigentliche visuelle Effekt des Clips. */
export const TranslationBlock: React.FC<{
  frame: number;
  start: number;
  text: string;
  showButtons?: boolean;
  buttonsStart?: number;
  highlight?: boolean;
}> = ({ frame, start, text, showButtons = false, buttonsStart = 0, highlight = false }) => {
  const p = ease(frame, start, 16);
  if (p <= 0) return null;
  const b = showButtons ? ease(frame, buttonsStart, 10) : 0;
  const glow = highlight ? interpolate(Math.sin((frame - start) / 7), [-1, 1], [0.12, 0.34]) : 0.1;

  return (
    <div
      style={{
        overflow: "hidden",
        marginTop: interpolate(p, [0, 1], [0, 18]),
        maxHeight: interpolate(p, [0, 1], [0, 420]),
        opacity: p,
      }}
    >
      <div
        style={{
          borderTop: `2px solid rgba(47,240,140,${glow})`,
          paddingTop: 18,
          transform: `translateY(${interpolate(p, [0, 1], [-14, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 42, lineHeight: 1.28, color: C.ink }}>{text}</div>
        <div style={{ marginTop: 12, fontSize: 27, color: C.muted }}>Übersetzt aus Griechisch</div>
        {b > 0 ? (
          <div
            style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, opacity: b }}
          >
            <Pill label="Original anzeigen" icon="Aa" glow={highlight} />
            <Pill label="Übersetzung anhören" icon="◁»" glow={highlight} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Pill: React.FC<{ label: string; icon: string; glow?: boolean }> = ({ label, icon, glow }) => (
  <div
    style={{
      alignSelf: "flex-start",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 22px",
      borderRadius: 99,
      border: `2px solid rgba(47,240,140,${glow ? 0.45 : 0.18})`,
      background: glow ? "rgba(47,240,140,0.08)" : "rgba(255,255,255,0.03)",
      color: C.ink,
      fontSize: 30,
    }}
  >
    <span style={{ opacity: 0.8 }}>{icon}</span>
    {label}
  </div>
);

/** Sprachnachricht-Blase mit Balken (frame-basiert, keine CSS-Animation). */
export const VoiceBubble: React.FC<{ frame: number; start: number; time: string }> = ({
  frame,
  start,
  time,
}) => {
  const p = ease(frame, start, 12);
  if (p <= 0) return null;
  const bars = new Array(22).fill(0);

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", ...appearStyle(p) }}>
      <div
        style={{
          maxWidth: "82%",
          borderRadius: 30,
          padding: "24px 30px 16px",
          background: "rgba(20,54,36,0.92)",
          border: "2px solid rgba(47,240,140,0.55)",
          color: C.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ fontSize: 40 }}>🎤</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: 54 }}>
            {bars.map((_, i) => {
              const h = 14 + Math.abs(Math.sin((frame - start) / 5 + i * 0.7)) * 40;
              return (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: h,
                    borderRadius: 99,
                    background: C.green,
                    opacity: 0.45 + (i % 3) * 0.2,
                  }}
                />
              );
            })}
          </div>
          <span style={{ fontSize: 30, color: C.muted }}>0:03</span>
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            fontSize: 28,
            color: C.muted,
          }}
        >
          {time}
          <span style={{ color: C.cyan }}>🌐</span>
        </div>
      </div>
    </div>
  );
};
