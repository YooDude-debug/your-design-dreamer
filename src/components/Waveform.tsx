import { memo, useEffect, useMemo, useRef } from "react";

interface WaveformProps {
  bars?: number;
  color?: string;
  className?: string;
  animated?: boolean;
  /**
   * Optionale Kopplung an die echte Audio-Wiedergabe (SlangShot): die Balken
   * folgen der laufenden Zeit des Mediums. Pausiert oder endet das Audio,
   * steht die Wellenform sofort still (keine unabhaengige CSS-Animation).
   *
   * Wichtig fuer die Performance: die Animation laeuft ausschliesslich per
   * requestAnimationFrame direkt auf dem DOM (transform: scaleY) – ohne einen
   * einzigen React-State-Wechsel. Die Audio-Wiedergabe kann dadurch niemals
   * durch die Wellenform ins Stocken geraten.
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

/** Minimaler Zeitabstand zwischen zwei visuellen Updates (~25 fps). */
const FRAME_STEP = 0.04;

function WaveformImpl({
  bars = 40,
  color = "var(--brand)",
  className = "",
  animated = false,
  media = null,
}: WaveformProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const live = !!media && animated;

  useEffect(() => {
    if (!live || !media) return;
    const root = rootRef.current;
    if (!root) return;
    const els = Array.from(root.children) as HTMLElement[];

    // Ausserhalb des Sichtbereichs wird nicht animiert (Mobile-Ersparnis).
    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            visible = entries[entries.length - 1]?.isIntersecting ?? true;
          })
        : null;
    io?.observe(root);

    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || media.paused || media.ended) return;
      const t = media.currentTime;
      if (t >= last && t - last < FRAME_STEP) return;
      last = t;
      for (let i = 0; i < els.length; i += 1) {
        els[i].style.transform = `scaleY(${level(i, t).toFixed(3)})`;
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      for (const el of els) el.style.transform = "scaleY(0.2)";
    };
  }, [live, media]);

  const items = useMemo(() => Array.from({ length: bars }, (_, i) => i), [bars]);

  return (
    <div ref={rootRef} className={`flex items-center gap-[2px] h-8 ${className}`}>
      {items.map((i) => (
        <span
          key={i}
          className="h-full w-[2px] rounded-full will-change-transform"
          style={{
            background: color,
            opacity: 0.85,
            transformOrigin: "center",
            transform: "scaleY(0.2)",
            transition: live ? "transform 70ms linear" : undefined,
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

export const Waveform = memo(WaveformImpl);
