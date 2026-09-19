/**
 * Realistischer ORB-Avatar auf Basis des hinterlegten Referenzgesichts.
 *
 * Das Gesicht selbst wird nie neu erzeugt: animiert werden ausschliesslich
 * geklonte Bildbereiche (Augen, Lider, Brauen, Mund) desselben Bildes. Alle
 * Bewegungen leiten sich aus dem bestehenden ORB-Innenzustand ab – ohne
 * zusätzliche Server- oder Datenbankabfragen.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import faceAsset from "@/assets/orb-face.png.asset.json";
import { faceAnimationFromState, type OrbActivity } from "@/integrations/y-dude-orb/avatar";
import type { OrbState } from "@/orb-sdk";

type Props = {
  state: OrbState;
  activity?: OrbActivity;
  /** Lautstärke der Sprachausgabe 0–1 für die Lippenbewegung. */
  speechLevel?: number;
  className?: string;
};

/** Bildbereiche in Anteilen des Referenzbildes (1341 × 1173). */
const REGION = {
  leftEye: { x: 0.254, y: 0.266, w: 0.19, h: 0.13 },
  rightEye: { x: 0.556, y: 0.266, w: 0.19, h: 0.13 },
  leftBrow: { x: 0.2, y: 0.185, w: 0.26, h: 0.09 },
  rightBrow: { x: 0.54, y: 0.185, w: 0.26, h: 0.09 },
  mouth: { x: 0.36, y: 0.63, w: 0.28, h: 0.14 },
} as const;

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Geklonter Bildausschnitt. `srcShiftY` verschiebt die Bildquelle innerhalb des
 * Fensters (z. B. Haut oberhalb des Auges als Lid).
 */
function Patch({
  rect,
  srcShiftY = 0,
  style,
}: {
  rect: Rect;
  srcShiftY?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
        ...style,
      }}
    >
      <img
        src={faceAsset.url}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          width: `${(1 / rect.w) * 100}%`,
          height: `${(1 / rect.h) * 100}%`,
          left: `${(-rect.x / rect.w) * 100}%`,
          top: `${((-rect.y + srcShiftY) / rect.h) * 100}%`,
          maxWidth: "none",
        }}
      />
    </div>
  );
}

export function OrbRealFace({ state, activity = "idle", speechLevel = 0, className }: Props) {
  const anim = useMemo(() => faceAnimationFromState(state, activity), [state, activity]);
  const [blink, setBlink] = useState(0);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gazeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Natürliches Blinzeln mit unterschiedlichen Intervallen (keine Frame-Loop).
  useEffect(() => {
    let alive = true;
    const schedule = () => {
      const wait = anim.blinkBase + Math.random() * anim.blinkJitter;
      blinkTimer.current = setTimeout(() => {
        if (!alive) return;
        setBlink(1);
        blinkTimer.current = setTimeout(() => {
          if (!alive) return;
          setBlink(0);
          // Gelegentlich ein zweites, kurzes Blinzeln.
          if (Math.random() < 0.18) {
            blinkTimer.current = setTimeout(() => {
              if (!alive) return;
              setBlink(1);
              blinkTimer.current = setTimeout(() => {
                if (alive) setBlink(0);
                schedule();
              }, 90);
            }, 190);
          } else {
            schedule();
          }
        }, 110);
      }, wait);
    };
    schedule();
    return () => {
      alive = false;
      if (blinkTimer.current) clearTimeout(blinkTimer.current);
    };
  }, [anim.blinkBase, anim.blinkJitter]);

  // Ruhige Blickbewegungen; beim Zuhören und Sprechen bleibt der Blick nahe
  // am Gesprächspartner (Mitte), beim Nachdenken wandert er etwas mehr.
  useEffect(() => {
    let alive = true;
    const focus = activity === "listening" || activity === "speaking" ? 0.45 : 1;
    const step = () => {
      const range = anim.gazeRange * focus;
      setGaze({
        x: (Math.random() * 2 - 1) * range,
        y: (Math.random() * 2 - 1) * range * 0.45,
      });
      const wait =
        activity === "thinking" ? 1400 + Math.random() * 1200 : 2400 + Math.random() * 2600;
      gazeTimer.current = setTimeout(() => {
        if (alive) step();
      }, wait);
    };
    gazeTimer.current = setTimeout(step, 900);
    return () => {
      alive = false;
      if (gazeTimer.current) clearTimeout(gazeTimer.current);
    };
  }, [anim.gazeRange, activity]);

  const lidClose = blink === 1 ? 1 : 1 - anim.eyeOpen * 0.98;
  const speaking = activity === "speaking";
  const open = speaking ? Math.min(1, Math.max(0, speechLevel)) : 0;

  const eyeStyle: React.CSSProperties = {
    transform: `translate(${gaze.x.toFixed(2)}%, ${gaze.y.toFixed(2)}%)`,
    transition: "transform 900ms cubic-bezier(0.22, 0.61, 0.36, 1)",
  };

  const lidStyle = (delay: number): React.CSSProperties => ({
    transform: `scaleY(${lidClose.toFixed(3)})`,
    transformOrigin: "top",
    transition: `transform ${blink ? 90 : 150}ms ease-out ${delay}ms`,
  });

  const browStyle = (mirror: boolean): React.CSSProperties => ({
    transform: `translateY(${(-anim.brow * 0.9 - (mirror ? anim.tension * 0.2 : 0)).toFixed(2)}%)`,
    transition: "transform 1200ms ease-in-out",
  });

  return (
    <div className={className} role="img" aria-label="ORB Gesicht">
      <div
        className="h-full w-full"
        style={{
          transform: `rotate(${anim.tilt.toFixed(2)}deg)`,
          transition: "transform 1600ms ease-in-out",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-2xl bg-black"
          style={{
            animation: `orb-face-breathe ${anim.breathSeconds.toFixed(2)}s ease-in-out infinite`,
          }}
        >
          {/* Unverändertes Referenzgesicht als Basis. */}
          <img
            src={faceAsset.url}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Augenbrauen – minimale Veränderung (fragend / angespannt). */}
          <Patch rect={REGION.leftBrow} style={browStyle(false)} />
          <Patch rect={REGION.rightBrow} style={browStyle(true)} />

          {/* Augen: geklonte Augenpartie mit sehr kleiner Blickbewegung. */}
          <Patch rect={REGION.leftEye} style={eyeStyle} />
          <Patch rect={REGION.rightEye} style={eyeStyle} />

          {/* Lider: Haut oberhalb des Auges gleitet herab. */}
          <Patch rect={REGION.leftEye} srcShiftY={-REGION.leftEye.h * 0.92} style={lidStyle(0)} />
          <Patch
            rect={REGION.rightEye}
            srcShiftY={-REGION.rightEye.h * 0.92}
            style={lidStyle(18)}
          />

          {/* Mund: Lächeln aus dem Zustand, Öffnung aus der Sprachausgabe. */}
          <Patch
            rect={REGION.mouth}
            style={{
              transform: `scaleX(${(1 + anim.smile * 0.035).toFixed(3)}) scaleY(${(1 + open * 0.1 - anim.smile * 0.02).toFixed(3)}) translateY(${(open * 1.6 - anim.smile * 0.6).toFixed(2)}%)`,
              transformOrigin: "50% 35%",
              transition: speaking ? "transform 70ms linear" : "transform 900ms ease-in-out",
            }}
          />

          {/* Dezente Andeutung der Mundöffnung beim Sprechen. */}
          {speaking && open > 0.06 && (
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: "43%",
                top: "70.5%",
                width: "14%",
                height: `${(1.1 + open * 2.6).toFixed(2)}%`,
                borderRadius: "50%",
                background: "rgba(38, 14, 16, 0.55)",
                filter: "blur(2px)",
                opacity: 0.5 + open * 0.4,
              }}
            />
          )}

          {/* Sehr dezente HUD-Reaktion beim Verarbeiten. */}
          {activity === "thinking" && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                boxShadow: "inset 0 0 40px 6px oklch(0.7 0.14 250 / 0.28)",
                animation: "orb-face-think 2.6s ease-in-out infinite",
              }}
            />
          )}

          {/* Anspannung: leicht kühlere, straffere Anmutung. */}
          {anim.tension > 0.15 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `oklch(0.55 0.08 250 / ${(anim.tension * 0.1).toFixed(3)})`,
                mixBlendMode: "soft-light",
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes orb-face-breathe {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-0.35%) scale(1.004); }
        }
        @keyframes orb-face-think {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
