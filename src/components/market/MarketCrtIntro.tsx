import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Disc3, Headphones, Radio, Shirt, Watch } from "lucide-react";

import { marketIntroGate } from "@/lib/market-intro";

const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function MarketCrtIntro({ isLoading }: { isLoading: boolean }) {
  const initiallyLoading = useRef(isLoading);
  const [visible, setVisible] = useState(true);
  const [opened, setOpened] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useBrowserLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const firstVisit = marketIntroGate.claim(window.sessionStorage);
    if (reduceMotion || !firstVisit) setVisible(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const duration = initiallyLoading.current ? 760 : 440;
    const timer = window.setTimeout(() => setOpened(true), duration);
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible || !opened || isLoading) return;
    setLeaving(true);
    const timer = window.setTimeout(() => setVisible(false), 180);
    return () => window.clearTimeout(timer);
  }, [isLoading, opened, visible]);

  if (!visible) return null;

  return (
    <div
      data-market-crt-intro
      aria-hidden="true"
      className={`market-crt-intro absolute inset-0 z-50 min-h-[calc(100svh-1.5rem)] overflow-hidden bg-background ${
        initiallyLoading.current ? "market-crt-intro--full" : "market-crt-intro--fast"
      } ${leaving ? "market-crt-intro--leaving" : ""}`}
    >
      <div className="market-crt-beam" />
      <div className="market-crt-picture">
        <div className="market-crt-scene mx-auto flex h-full w-full max-w-3xl flex-col justify-center px-6 sm:px-10">
          <div className="market-crt-title mb-6 text-center text-xs font-bold uppercase tracking-[0.28em] text-brand sm:text-sm">
            Y-Dude Market
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
            <MarketObject icon={Disc3} label="Vinyl" tilt="-rotate-3" />
            <MarketObject icon={Headphones} label="Audio" tilt="rotate-2" />
            <MarketObject icon={Radio} label="Tech" tilt="-rotate-1" />
            <MarketObject icon={BookOpen} label="Books" tilt="rotate-3" />
            <MarketObject icon={Shirt} label="Style" tilt="-rotate-2" />
            <MarketObject icon={Watch} label="Finds" tilt="rotate-1" />
          </div>
          <div className="market-crt-shelf mt-5 h-px w-full bg-brand/50" />
        </div>
      </div>
      <div className="market-crt-scanlines" />
      <div className="market-crt-vignette" />
      <style>{`
        .market-crt-intro {
          opacity: 1;
          contain: paint;
          transition: opacity 180ms ease-out;
        }
        .market-crt-intro--leaving { opacity: 0; pointer-events: none; }
        .market-crt-beam {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0;
          height: 2px;
          translate: -50% -50%;
          border-radius: 999px;
          background: var(--foreground);
          box-shadow: 0 0 10px var(--foreground), 0 0 28px var(--brand-glow);
          animation: market-crt-beam-full 760ms cubic-bezier(.22,.78,.2,1) both;
        }
        .market-crt-picture {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: var(--surface);
          clip-path: inset(50% 0 50% 0);
          animation: market-crt-open-full 760ms cubic-bezier(.22,.78,.2,1) both;
        }
        .market-crt-scene {
          background:
            radial-gradient(circle at 50% 48%, color-mix(in oklch, var(--brand) 13%, transparent), transparent 58%),
            linear-gradient(145deg, var(--surface-2), var(--background));
          filter: saturate(.9) contrast(1.08);
          animation: market-crt-settle 760ms ease-out both;
        }
        .market-crt-object {
          box-shadow: 0 12px 30px color-mix(in oklch, var(--background) 78%, transparent), inset 0 0 0 1px var(--border);
        }
        .market-crt-scanlines {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .2;
          background: repeating-linear-gradient(to bottom, transparent 0 3px, color-mix(in oklch, var(--foreground) 12%, transparent) 4px);
          animation: market-crt-flicker 180ms steps(2, end) 4;
        }
        .market-crt-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          box-shadow: inset 0 0 90px 24px var(--background);
        }
        .market-crt-intro--fast .market-crt-beam { animation-name: market-crt-beam-fast; animation-duration: 440ms; }
        .market-crt-intro--fast .market-crt-picture { animation-name: market-crt-open-fast; animation-duration: 440ms; }
        .market-crt-intro--fast .market-crt-scene { animation-duration: 440ms; }
        @keyframes market-crt-beam-full {
          0%, 12% { width: 0; opacity: 0; }
          22% { width: 10px; opacity: 1; }
          48% { width: 86%; opacity: 1; }
          66%, 100% { width: 100%; opacity: 0; }
        }
        @keyframes market-crt-open-full {
          0%, 46% { clip-path: inset(50% 0 50% 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes market-crt-beam-fast {
          0% { width: 0; opacity: 0; }
          20% { width: 12px; opacity: 1; }
          58% { width: 90%; opacity: 1; }
          100% { width: 100%; opacity: 0; }
        }
        @keyframes market-crt-open-fast {
          0%, 48% { clip-path: inset(50% 0 50% 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        @keyframes market-crt-settle {
          0%, 48% { opacity: 0; transform: scale(1.025); filter: brightness(2) saturate(0); }
          72% { opacity: 1; filter: brightness(1.18) saturate(.7); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes market-crt-flicker {
          0%, 100% { opacity: .12; }
          50% { opacity: .24; }
        }
      `}</style>
    </div>
  );
}

function MarketObject({
  icon: Icon,
  label,
  tilt,
}: {
  icon: typeof Disc3;
  label: string;
  tilt: string;
}) {
  return (
    <div
      className={`market-crt-object ${tilt} flex aspect-square flex-col items-center justify-center gap-2 rounded-lg bg-card/90 text-muted-foreground`}
    >
      <Icon className="h-8 w-8 text-brand sm:h-10 sm:w-10" strokeWidth={1.5} />
      <span className="text-[10px] font-semibold uppercase sm:text-xs">{label}</span>
    </div>
  );
}
