import { useEffect, useRef, useState } from "react";

interface WaveformProps {
  bars?: number;
  color?: string;
  className?: string;
  animated?: boolean;
  /**
   * Optionale Kopplung an die echte Audio-Wiedergabe (SlangShot): die Balken
   * folgen der laufenden Zeit des Mediums. Pausiert oder endet das Audio,
   * steht die Wellenform sofort still (keine unabhaengige CSS-Animation).
   */
  media?: HTMLMediaElement | null;
}

/** Balkenhoehe aus Index + Zeitposition – deterministisch und guenstig. */
function level(i: number, time: number) {
  const v =
    Math.sin(i * 1.3 + time * 7.5) * 0.5 +
    Math.cos(i * 0.7 - time * 5.1) * 0.3 +
    Math.sin(time * 11 + i * 0.31) * 0.2;
  return Math.max(0.15, Math.min(1, Math.abs(v) + 0.2));
}

export function Waveform({
  bars = 40,
  color = "var(--brand)",
  className = "",
  animated = false,
  media = null,
}: WaveformProps) {
  /** Zeitposition der echten Wiedergabe (nur bei gekoppeltem Medium). */
  const [time, setTime] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!media || !animated) {
      setTime(0);
      return;
    }
    let last = 0;
    const tick = () => {
      raf.current = requestAnimationFrame(tick);
      // Steht das Audio (Pause/Ende), bleibt die Wellenform stehen.
      if (media.paused || media.ended) return;
      const now = media.currentTime;
      if (Math.abs(now - last) < 0.04) return;
      last = now;
      setTime(now);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [media, animated]);

  const live = !!media && animated;
  const heights = Array.from({ length: bars }, (_, i) => level(i, live ? time : 0));

  return (
    <div className={`flex items-center gap-[2px] h-8 ${className}`}>
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full"
          style={{
            height: `${h * 100}%`,
            background: color,
            opacity: 0.85,
            transformOrigin: "center",
            transition: live ? "height 60ms linear" : undefined,
            animation:
              animated && !live
                ? `waveform-bounce 0.9s ease-in-out ${(i % 8) * 0.08}s infinite`
                : undefined,
          }}
        />
      ))}
    </div>
  );
}
