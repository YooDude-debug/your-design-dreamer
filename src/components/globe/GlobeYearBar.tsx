import { memo, useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { countdownParts, type SlangCountdown } from "@/lib/globe/slang-year";

/**
 * Jahresleiste des Slang Globe: Jahrgang-Hinweis, Live-Countdown bis zum
 * Jahresende, Info-Popover und Jahresarchiv-Auswahl.
 *
 * Rein zusätzliche UI – Globe, Rotation, Filter und SlangTag-Darstellung
 * bleiben unverändert.
 */
export const GlobeYearBar = memo(function GlobeYearBar({
  year,
  activeYear,
  years,
  countdown,
  onYearChange,
}: {
  year: number;
  activeYear: number | null;
  years: number[];
  countdown: SlangCountdown;
  onYearChange: (year: number) => void;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [info, setInfo] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const cd = countdown ?? countdownParts(0);
  const isArchive = activeYear !== null && year !== activeYear;
  const nextYear = (activeYear ?? year) + 1;

  useEffect(() => {
    if (!info) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setInfo(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInfo(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [info]);

  return (
    <div ref={boxRef} className="pointer-events-auto relative flex flex-wrap items-center gap-1.5">
      <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-brand/40 bg-surface/60 px-3 py-1.5 backdrop-blur-md">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {at.globeYearDocumenting(year)}
          </p>
          <p className="truncate text-xs font-black tabular-nums text-brand">
            {isArchive
              ? at.globeYearArchived
              : `⏳ ${at.globeCountdown(cd.days, cd.hours, cd.minutes, cd.seconds)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInfo((v) => !v)}
          aria-label={at.globeYearInfoAria}
          aria-expanded={info}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground hover:border-brand/60 hover:text-brand"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <select
        aria-label={at.globeYearSelectAria}
        className="control-field h-8 rounded-full px-2 text-[10px] font-bold uppercase tracking-wider outline-none"
        value={year}
        onChange={(e) => onYearChange(Number(e.target.value))}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y === activeYear ? `${y} · ${at.globeYearCurrent}` : String(y)}
          </option>
        ))}
      </select>

      {info && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-brand/40 bg-surface/95 p-3 text-xs leading-relaxed text-muted-foreground shadow-glow backdrop-blur-md">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-sm font-black text-foreground">{at.globeYearInfoTitle}</p>
            <button
              type="button"
              onClick={() => setInfo(false)}
              aria-label={at.regionCloseAria}
              className="text-muted-foreground hover:text-brand"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="space-y-1.5">
            <li>{at.globeYearInfoEnd}</li>
            <li>{at.globeYearInfoMidnight}</li>
            <li className="font-bold text-brand">🌍 Slang Globe {nextYear}</li>
            <li>{at.globeYearInfoNew(nextYear)}</li>
            <li>{at.globeYearInfoArchive}</li>
          </ul>
        </div>
      )}
    </div>
  );
});
