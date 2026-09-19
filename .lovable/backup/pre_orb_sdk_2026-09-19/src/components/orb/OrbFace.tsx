/**
 * Animiertes ORB-Gesicht (SVG + CSS, keine Bibliothek).
 *
 * Jede Bewegung wird aus dem tatsächlichen Innenzustand berechnet
 * (`faceFromState`) – es gibt keine zustandslose Zufallsanimation. Risse
 * entstehen ausschliesslich aus gespeicherten Lernereignissen.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { faceFromState, type OrbState } from "@/lib/orb-core";

type Props = {
  state: OrbState;
  /** Anzahl bedeutender Lernerfahrungen – sichtbare Risse. */
  cracks: number;
  /** true = ORB denkt gerade nach (Reaktionspause). */
  thinking?: boolean;
  /** Kurze Reaktion aus einem echten Ereignis (keine Zufallsanimation). */
  reaction?: "learned" | "reactivated" | "interested" | null;
  className?: string;
};

/** Risslinien, abhängig von der Anzahl der Lernereignisse. */
const CRACK_PATHS = [
  "M 100 34 L 112 62 L 98 78 L 108 104",
  "M 40 96 L 62 104 L 52 124 L 70 140",
  "M 158 88 L 140 104 L 152 122",
  "M 100 166 L 92 142 L 106 128",
];

export function OrbFace({ state, cracks, thinking = false, reaction = null, className }: Props) {
  const face = useMemo(() => faceFromState(state), [state]);
  const [blink, setBlink] = useState(false);
  const [look, setLook] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Blinzeln und Blickwandern folgen dem Zustand: viel Unsicherheit wandert
  // häufiger, viel Angst bewegt sich weniger.
  useEffect(() => {
    let alive = true;
    const step = () => {
      if (!alive) return;
      setBlink(true);
      setLook((prev) => {
        const range = face.gaze * face.motion;
        return prev >= 0 ? -range : range;
      });
      timer.current = setTimeout(() => {
        setBlink(false);
        const wait = 1600 + 3200 * (1 - face.gaze) + 800 * (1 - face.motion);
        timer.current = setTimeout(step, wait);
      }, 130);
    };
    timer.current = setTimeout(step, 1200);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [face.gaze, face.motion]);

  const eyeH = Math.max(2, (blink ? 0.12 : face.eyeOpen) * 16);
  const pupil = 4 + 2 * state.curiosity;
  const gazeX = look * 5;
  const mouth = face.mouthCurve;
  // Mundpfad: positiver Wert = Lächeln, negativer = vorsichtig.
  const mouthPath = `M 78 ${132} Q 100 ${132 + mouth * 18} 122 ${132}`;
  const glow = 0.25 + 0.5 * state.energy;
  // Reaktionsfarbe: neu gelernt, wiedererkannt oder interessiert.
  const reactionColor =
    reaction === "learned"
      ? "oklch(0.85 0.16 140)"
      : reaction === "reactivated"
        ? "oklch(0.85 0.15 250)"
        : reaction === "interested"
          ? "oklch(0.88 0.16 90)"
          : null;

  return (
    <div className={className}>
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label="ORB Core"
        className="h-full w-full"
        style={{
          transform: `rotate(${face.tilt.toFixed(2)}deg)`,
          transition: "transform 900ms ease-in-out",
        }}
      >
        <defs>
          <radialGradient id="orb-body" cx="40%" cy="35%">
            <stop offset="0%" stopColor="oklch(0.85 0.14 200)" />
            <stop offset="60%" stopColor="oklch(0.55 0.15 255)" />
            <stop offset="100%" stopColor="oklch(0.28 0.12 275)" />
          </radialGradient>
        </defs>

        {/* Puls: Dauer ergibt sich aus der Energie. */}
        <circle
          cx="100"
          cy="100"
          r="82"
          fill="url(#orb-body)"
          style={{
            filter: `drop-shadow(0 0 ${(14 * glow).toFixed(1)}px oklch(0.7 0.16 250 / ${glow.toFixed(2)}))`,
            animation: `orb-pulse ${face.pulseSeconds.toFixed(2)}s ease-in-out infinite`,
            transformOrigin: "100px 100px",
          }}
        />

        {/* Augen */}
        {[76, 124].map((cx) => (
          <g key={cx}>
            <ellipse
              cx={cx}
              cy={92}
              rx={13}
              ry={eyeH}
              fill="oklch(0.97 0.02 250)"
              style={{ transition: "ry 140ms ease-out" }}
            />
            {!blink && (
              <circle
                cx={cx + gazeX}
                cy={92}
                r={pupil}
                fill="oklch(0.22 0.06 270)"
                style={{ transition: "cx 700ms ease-in-out, r 600ms ease-out" }}
              />
            )}
          </g>
        ))}

        {/* Mund */}
        <path
          d={mouthPath}
          fill="none"
          stroke="oklch(0.97 0.02 250)"
          strokeWidth={5}
          strokeLinecap="round"
          style={{ transition: "d 700ms ease-in-out" }}
        />

        {/* Nachdenken: dezente Punkte über dem Gesicht */}
        {thinking && (
          <g>
            {[86, 100, 114].map((cx, i) => (
              <circle key={cx} cx={cx} cy={58} r={3} fill="oklch(0.95 0.03 250 / 0.8)">
                <animate
                  attributeName="opacity"
                  values="0.15;1;0.15"
                  dur="1.2s"
                  begin={`${i * 0.25}s`}
                  repeatCount="indefinite"
                />
              </circle>
            ))}
          </g>
        )}

        {/* Reaktion: dezenter Ring, sobald ein echtes Ereignis eintrat. */}
        {reactionColor && (
          <circle cx="100" cy="100" r="88" fill="none" stroke={reactionColor} strokeWidth={2.5}>
            <animate attributeName="opacity" values="0;0.9;0" dur="1.8s" repeatCount="1" />
          </circle>
        )}

        {/* Risse: „Aus diesem Fehler wurde gelernt.“ */}
        {CRACK_PATHS.slice(0, Math.min(cracks, CRACK_PATHS.length)).map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="oklch(0.9 0.14 85 / 0.75)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ))}
      </svg>

      <style>{`@keyframes orb-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.025); }
      }`}</style>
    </div>
  );
}
