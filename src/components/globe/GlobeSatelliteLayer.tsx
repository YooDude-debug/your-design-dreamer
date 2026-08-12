import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { GlobeEngine } from "@/lib/globe/globe-engine";
import type { GlobeRegion } from "@/lib/globe/types";
import {
  buildCandidates,
  FACE_IN,
  FACE_OUT,
  MAX_SATELLITES,
  type SatelliteCandidate,
} from "@/lib/globe/satellites";

/**
 * Slang Globe – SlangTag-Satellitenlayer.
 *
 * Overlay über der bestehenden 3D-Bühne: jeder SlangTag hängt an seinem
 * geografischen Ursprung (Ankerpunkt auf der Kugel), schwebt als Bubble
 * außerhalb der Oberfläche und ist über einen dünnen Neon-Strahl verbunden.
 *
 * Performance: React rendert nur, wenn sich die Auswahl ändert (~1x/Sekunde).
 * Positionen werden pro Frame imperativ über `engine.project()` gesetzt –
 * keine State-Updates im Animationsloop.
 */

type Active = {
  cand: SatelliteCandidate;
  /** 0 → 1 Einblendung, beim Verlassen zurück auf 0. */
  fade: number;
  leaving: boolean;
};

export function GlobeSatelliteLayer({
  engine,
  regions,
}: {
  engine: GlobeEngine | null;
  regions: GlobeRegion[];
}) {
  const candidates = useMemo(() => buildCandidates(regions), [regions]);
  const activeRef = useRef<Map<string, Active>>(new Map());
  const [visibleList, setVisibleList] = useState<SatelliteCandidate[]>([]);
  const nodes = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const lines = useRef<Map<string, SVGLineElement | null>>(new Map());
  const dots = useRef<Map<string, SVGCircleElement | null>>(new Map());
  const hostRef = useRef<HTMLDivElement | null>(null);

  // Filterwechsel: Auswahl neu aufbauen.
  useEffect(() => {
    activeRef.current.clear();
    setVisibleList([]);
  }, [candidates]);

  useEffect(() => {
    if (!engine) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    let raf = 0;
    let last = performance.now();
    let clock = 0;
    let sinceTick = 0;

    let lastKey = "";
    const publish = () => {
      const list = [...activeRef.current.values()].map((a) => a.cand);
      const key = list.map((c) => c.id).join("|");
      if (key === lastKey) return;
      lastKey = key;
      setVisibleList(list);
    };

    const tick = () => {
      const active = activeRef.current;
      // Rückseite → sauber ausblenden.
      for (const [id, a] of active) {
        const f = engine.project(a.cand.lat, a.cand.lng).facing;
        if (f < FACE_OUT) a.leaving = true;
        if (a.leaving && a.fade <= 0.001) active.delete(id);
      }
      // Neue Region im Sichtfeld → höchstens ein neuer Tag pro Takt (versetzt).
      const room = MAX_SATELLITES - [...active.values()].filter((a) => !a.leaving).length;
      if (room > 0) {
        let best: SatelliteCandidate | null = null;
        let bestScore = -Infinity;
        for (const c of candidates) {
          if (active.has(c.id)) continue;
          const f = engine.project(c.lat, c.lng).facing;
          if (f < FACE_IN) continue;
          const s = c.score * (0.5 + f);
          if (s > bestScore) {
            bestScore = s;
            best = c;
          }
        }
        if (best) active.set(best.id, { cand: best, fade: 0, leaving: false });
      }
      publish();
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!engine.isVisible) return;
      clock += dt;
      sinceTick += dt;
      if (sinceTick > 0.85) {
        sinceTick = 0;
        tick();
      }

      const host = hostRef.current;
      const w = host?.clientWidth ?? 0;
      const scale = Math.min(1.15, Math.max(0.72, 4.6 / Math.max(2.4, engine.cameraDistance)));

      for (const [id, a] of activeRef.current) {
        const el = nodes.current.get(id);
        const line = lines.current.get(id);
        const dot = dots.current.get(id);
        const target = a.leaving ? 0 : 1;
        a.fade += (target - a.fade) * (1 - Math.exp(-dt * (a.leaving ? 5 : 2.6)));

        const anchor = engine.project(a.cand.lat, a.cand.lng, 1.005);
        // Sanfte Satellitenbewegung: leichte Höhen-/Bahnschwankung.
        const bob = reduced ? 0 : Math.sin(clock * 0.6 + a.cand.phase) * 0.05;
        const drift = reduced ? 0 : Math.cos(clock * 0.45 + a.cand.phase) * 2.6;
        const orbit = engine.project(
          a.cand.lat + drift * 0.35,
          a.cand.lng + drift,
          a.cand.orbit + bob,
        );
        const vis = a.fade * Math.max(0, Math.min(1, (anchor.facing - FACE_OUT) * 4));

        if (el) {
          el.style.opacity = String(vis);
          el.style.transform = `translate3d(${orbit.x}px, ${orbit.y}px, 0) translate(-50%, -50%) scale(${scale})`;
          el.style.visibility = vis < 0.02 || !w ? "hidden" : "visible";
        }
        if (line) {
          line.setAttribute("x1", String(anchor.x));
          line.setAttribute("y1", String(anchor.y));
          line.setAttribute("x2", String(orbit.x));
          line.setAttribute("y2", String(orbit.y));
          const pulse = reduced ? 0.5 : 0.42 + 0.28 * Math.sin(clock * 2.1 + a.cand.phase);
          line.setAttribute("opacity", String(vis * pulse));
        }
        if (dot) {
          dot.setAttribute("cx", String(anchor.x));
          dot.setAttribute("cy", String(anchor.y));
          dot.setAttribute("opacity", String(vis * 0.9));
        }
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [engine, candidates]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
        {visibleList.map((c) => (
          <g key={c.id}>
            <line
              ref={(el) => {
                lines.current.set(c.id, el);
              }}
              stroke="oklch(0.82 0.19 158)"
              strokeWidth={1}
              opacity={0}
            />
            <circle
              ref={(el) => {
                dots.current.set(c.id, el);
              }}
              r={2.6}
              fill="oklch(0.86 0.2 158)"
              opacity={0}
            />
          </g>
        ))}
      </svg>

      {visibleList.map((c) => (
        <div
          key={c.id}
          ref={(el) => {
            nodes.current.set(c.id, el);
          }}
          className="absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0 }}
        >
          <Link
            to="/slangtag/$name"
            params={{ name: c.tag }}
            className="pointer-events-auto inline-flex max-w-[10rem] items-center gap-1.5 rounded-full border border-brand/45 bg-black/55 px-2 py-1 shadow-[0_0_14px_oklch(0.82_0.19_158/0.28)] backdrop-blur-md"
          >
            <MiniWave />
            <span className="truncate text-[11px] font-black leading-none tracking-tight text-brand">
              ${c.tag}
            </span>
            <span className="max-w-[4.5rem] truncate text-[8px] uppercase leading-none tracking-wider text-muted-foreground">
              {c.country}
            </span>
          </Link>
        </div>
      ))}
    </div>
  );
}

/** Kleines Audio-/Waveform-Icon (rein CSS/SVG, keine Extra-Assets). */
function MiniWave() {
  return (
    <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true" className="shrink-0">
      {[1, 4, 7, 10].map((x, i) => (
        <rect
          key={x}
          x={x - 1}
          y={4 - i * 0.6}
          width="1.4"
          height={2 + (i % 3) * 2.4}
          rx="0.7"
          fill="oklch(0.86 0.2 158)"
          opacity={0.85 - i * 0.12}
        />
      ))}
    </svg>
  );
}
