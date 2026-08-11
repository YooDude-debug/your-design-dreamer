import { useEffect, useRef } from "react";
import globeImg from "@/assets/globe.png";

/**
 * Hero-Weltkugel: bestehendes Globus-Bild + Canvas-Ebene mit
 * rotierender Heatmap und orbitierenden SlangTag-Bubbles.
 *
 * Rein Canvas-basiert (ein RAF-Loop, keine React-Renders pro Frame),
 * respektiert `prefers-reduced-motion` und pausiert außerhalb des Viewports.
 */

/** Geometrie des Globus im Bild (aus Alpha-Analyse von globe.png). */
const IMG_CX = 0.505;
const IMG_CY = 0.48;
const IMG_R = 0.333;

type Hot = { lat: number; lng: number; heat: number; phase: number };
type Tag = {
  label: string;
  lat: number;
  lng: number;
  /** Orbit-Winkel, Geschwindigkeit, Radius-Modulation */
  a: number;
  speed: number;
  rBase: number;
  rAmp: number;
  rPhase: number;
  yScale: number;
  phase: number;
  life: number;
  seed: number;
};

const TAGS: Array<{ label: string; lat: number; lng: number }> = [
  { label: "moin moin", lat: 53.6, lng: 12.1 },
  { label: "yalla", lat: 30.0, lng: 31.2 },
  { label: "habibi", lat: 25.2, lng: 55.3 },
  { label: "qué onda?", lat: 19.4, lng: -99.1 },
  { label: "slay", lat: 40.7, lng: -74.0 },
  { label: "naisu", lat: 35.7, lng: 139.7 },
  { label: "suuuiii", lat: 38.7, lng: -9.1 },
  { label: "nikí", lat: 37.98, lng: 23.7 },
  { label: "wallah", lat: 41.0, lng: 28.9 },
  { label: "mashallah", lat: 33.5, lng: 36.3 },
  { label: "bro", lat: -33.9, lng: 151.2 },
  { label: "tranquilo", lat: -34.6, lng: -58.4 },
  { label: "cap", lat: 34.05, lng: -118.2 },
  { label: "sheesh", lat: 51.5, lng: -0.12 },
  { label: "bezz", lat: 48.85, lng: 2.35 },
  { label: "aiyo", lat: 1.35, lng: 103.8 },
];

const HOT_SPOTS: Array<[number, number, number]> = [
  [52.5, 13.4, 1],
  [53.6, 12.1, 0.6],
  [51.5, -0.12, 0.9],
  [48.85, 2.35, 0.7],
  [40.7, -74.0, 1],
  [34.05, -118.2, 0.8],
  [19.4, -99.1, 0.7],
  [-23.5, -46.6, 0.8],
  [-34.6, -58.4, 0.5],
  [37.98, 23.7, 0.6],
  [41.0, 28.9, 0.6],
  [30.0, 31.2, 0.7],
  [25.2, 55.3, 0.6],
  [35.7, 139.7, 0.9],
  [37.57, 126.98, 0.7],
  [1.35, 103.8, 0.5],
  [28.6, 77.2, 0.7],
  [-33.9, 151.2, 0.5],
  [6.5, 3.4, 0.6],
  [-26.2, 28.0, 0.5],
  [55.75, 37.6, 0.5],
  [39.9, 116.4, 0.8],
  [45.4, 9.19, 0.5],
  [59.33, 18.07, 0.4],
];

function rnd(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

export function HeroGlobe() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let r = 0;
    let visible = true;
    let raf = 0;

    const hots: Hot[] = HOT_SPOTS.map(([lat, lng, heat], i) => ({
      lat,
      lng,
      heat,
      phase: rnd(i + 1) * Math.PI * 2,
    }));

    const tags: Tag[] = TAGS.map((t, i) => ({
      ...t,
      a: (i / TAGS.length) * Math.PI * 2 + rnd(i + 7) * 0.6,
      speed: 0.035 + rnd(i + 3) * 0.03,
      rBase: 1.16 + rnd(i + 11) * 0.3,
      rAmp: 0.05 + rnd(i + 13) * 0.09,
      rPhase: rnd(i + 17) * Math.PI * 2,
      yScale: 0.42 + rnd(i + 19) * 0.3,
      phase: rnd(i + 23) * Math.PI * 2,
      life: rnd(i + 29),
      seed: i + 1,
    }));

    function measure() {
      const rect = wrap!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Bildgeometrie: Bild ist quadratisch, horizontal zentriert
      const img = wrap!.querySelector("img");
      const imgW = img?.offsetWidth || w;
      const top = img?.offsetTop ?? 0;
      cx = w / 2 + (IMG_CX - 0.5) * imgW;
      cy = top + IMG_CY * imgW;
      r = IMG_R * imgW;
    }


    function project(lat: number, lng: number, spin: number) {
      const la = (lat * Math.PI) / 180;
      const lo = (lng * Math.PI) / 180 + spin;
      const x = Math.cos(la) * Math.sin(lo);
      const y = Math.sin(la);
      const z = Math.cos(la) * Math.cos(lo);
      // leichte Achsneigung
      const tilt = -0.28;
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      return { x: cx + x * r, y: cy - y2 * r, z: z2 };
    }

    function drawHeat(t: number, spin: number) {
      for (const s of hots) {
        const p = project(s.lat, s.lng, spin);
        if (p.z <= 0.02) continue;
        const pulse = 0.55 + 0.45 * Math.sin(t * 1.1 + s.phase);
        const inten = s.heat * (0.45 + 0.55 * pulse) * Math.min(1, p.z * 1.6);
        const rad = r * (0.028 + 0.05 * inten);
        const hue = 150 - 80 * inten; // grün -> gelb
        const g = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
        g.addColorStop(0, `hsla(${hue}, 95%, 62%, ${0.5 * inten})`);
        g.addColorStop(0.45, `hsla(${hue}, 95%, 55%, ${0.18 * inten})`);
        g.addColorStop(1, "hsla(150, 95%, 55%, 0)");
        ctx!.fillStyle = g;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.fillStyle = `hsla(${hue}, 100%, 72%, ${0.55 * inten})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, Math.max(0.8, r * 0.008 * (0.6 + inten)), 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function waveform(x: number, y: number, t: number, seed: number, s: number, alpha: number) {
      const bars = 5;
      ctx!.fillStyle = `oklch(0.86 0.22 150 / ${alpha})`;
      for (let i = 0; i < bars; i++) {
        const hh =
          (0.35 + 0.65 * Math.abs(Math.sin(t * 2.4 + i * 0.8 + seed))) * 9 * s;
        ctx!.beginPath();
        const bw = 1.6 * s;
        const bx = x + i * (bw + 1.5 * s);
        ctx!.roundRect(bx, y - hh / 2, bw, hh, bw / 2);
        ctx!.fill();
      }
    }

    function drawTags(t: number, spin: number) {
      const fontSize = Math.max(9, Math.min(13, r * 0.075));
      for (const tag of tags) {
        // Orbit
        const ang = tag.a + t * tag.speed * Math.PI;
        const orbitR = r * (tag.rBase + tag.rAmp * Math.sin(t * 0.35 + tag.rPhase));
        const x = cx + Math.cos(ang) * orbitR;
        const y = cy + Math.sin(ang) * orbitR * tag.yScale;
        const depth = (Math.sin(ang) + 1) / 2; // vorne = groß
        const s = (0.78 + 0.32 * depth) * Math.min(1.15, Math.max(0.7, r / 150));
        // dezentes Ein-/Ausblenden
        const cycle = (t * 0.06 + tag.life) % 1;
        const fade = Math.min(1, Math.min(cycle, 1 - cycle) * 7);
        const alpha = (0.35 + 0.6 * depth) * fade;
        if (alpha <= 0.02) continue;

        ctx!.font = `600 ${fontSize * s}px ui-sans-serif, system-ui, sans-serif`;
        const tw = ctx!.measureText(tag.label).width;
        const padX = 9 * s;
        const wfW = 12 * s;
        const bw = tw + wfW + padX * 2.4;
        const bh = 22 * s;
        const bx = x - bw / 2;
        const by = y - bh / 2;

        // Verbindungslinie zur Region
        const p = project(tag.lat, tag.lng, spin);
        if (p.z > 0.15) {
          const lg = ctx!.createLinearGradient(p.x, p.y, x, y);
          lg.addColorStop(0, `oklch(0.86 0.22 150 / ${0.28 * alpha * p.z})`);
          lg.addColorStop(1, `oklch(0.86 0.22 150 / 0)`);
          ctx!.strokeStyle = lg;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(p.x, p.y);
          ctx!.quadraticCurveTo((p.x + x) / 2, (p.y + y) / 2 - r * 0.08, x, y);
          ctx!.stroke();
        }

        // Bubble
        ctx!.save();
        ctx!.shadowColor = `oklch(0.86 0.22 150 / ${0.35 * alpha})`;
        ctx!.shadowBlur = 14 * s;
        ctx!.fillStyle = `oklch(0.16 0.02 160 / ${0.72 * alpha})`;
        ctx!.beginPath();
        ctx!.roundRect(bx, by, bw, bh, bh / 2);
        ctx!.fill();
        ctx!.restore();

        ctx!.strokeStyle = `oklch(0.86 0.22 150 / ${0.45 * alpha})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.roundRect(bx, by, bw, bh, bh / 2);
        ctx!.stroke();

        ctx!.fillStyle = `oklch(0.86 0.22 150 / ${0.9 * alpha})`;
        ctx!.font = `700 ${fontSize * s}px ui-sans-serif, system-ui, sans-serif`;
        ctx!.textBaseline = "middle";
        ctx!.fillText("$", bx + padX * 0.7, y + 0.5);
        const labelX = bx + padX * 0.7 + ctx!.measureText("$").width + 3 * s;
        ctx!.fillStyle = `oklch(0.97 0.01 160 / ${0.92 * alpha})`;
        ctx!.font = `600 ${fontSize * s}px ui-sans-serif, system-ui, sans-serif`;
        ctx!.fillText(tag.label, labelX, y + 0.5);

        waveform(bx + bw - padX - wfW, y, t, tag.seed, s, 0.85 * alpha);
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      const t = now / 1000;
      const spin = t * 0.055;
      ctx!.clearRect(0, 0, w, h);
      drawHeat(t, spin);
      drawTags(t, spin);
    }

    measure();
    if (reduced) {
      ctx.clearRect(0, 0, w, h);
      drawHeat(0, 0);
      drawTags(0, 0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const ro = new ResizeObserver(() => {
      measure();
      if (reduced) {
        ctx.clearRect(0, 0, w, h);
        drawHeat(0, 0);
        drawTags(0, 0);
      }
    });
    ro.observe(wrap);

    const io = new IntersectionObserver((es) => {
      visible = es.some((e) => e.isIntersecting);
    });
    io.observe(wrap);

    const onVis = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative mx-auto -mt-6 h-[160px] w-full max-w-[1180px] overflow-hidden sm:-mt-8 sm:h-[260px] lg:h-[330px]"
    >
      <img
        src={globeImg}
        alt=""
        aria-hidden
        loading="eager"
        decoding="async"
        className="pointer-events-none absolute left-1/2 top-[-14%] w-[150%] max-w-none -translate-x-1/2 sm:w-[115%] lg:w-[100%]"
        onLoad={(e) => {
          const img = e.currentTarget;
          const wrap = wrapRef.current;
          if (!wrap) return;
          wrap.dataset["imgw"] = String(img.offsetWidth);
          wrap.dataset["imgtop"] = String(img.offsetTop);
        }}
      />
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0" />
    </div>
  );
}
