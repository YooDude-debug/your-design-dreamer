import { CloseButton } from "@/components/ui/nav-buttons";
import { memo, useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { countdownParts, type SlangCountdown } from "@/lib/globe/slang-year";

/**
 * Kompakte Timer-/Info-Zeile des Slang Globe.
 *
 * Zeigt standardmäßig nur die verbleibenden Tage an. Ein Tippen auf den
 * Timer wechselt zur genauen Countdown-Anzeige (Tage, Stunden, Minuten,
 * Sekunden). Das Info-Popover bleibt unverändert über das Info-Symbol
 * erreichbar.
 */
export const GlobeYearBar = memo(function GlobeYearBar({
  year,
  activeYear,
  countdown,
}: {
  year: number;
  activeYear: number | null;
  countdown: SlangCountdown;
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
    <div ref={boxRef} className="pointer-events-auto relative flex items-center gap-1.5">
      {/* Live-Anzeige: dauerhaft vollständig sichtbar, kein Antippen nötig. */}
      <div
        role="timer"
        aria-live="off"
        aria-label={at.globeCountdownAria}
        className="control-bar flex h-8 min-w-0 flex-1 items-center justify-center rounded-full px-3 backdrop-blur-md"
      >
        <span className="truncate text-xs font-black tabular-nums text-brand">
          {isArchive
            ? at.globeYearArchived
            : `⏳ ${at.globeCountdown(cd.days, cd.hours, cd.minutes, cd.seconds)}`}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setInfo((v) => !v)}
        aria-label={at.globeYearInfoAria}
        aria-expanded={info}
        className="control-chip grid h-8 w-8 shrink-0 place-items-center rounded-full"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {info && (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-brand/40 bg-surface/95 p-3 text-xs leading-relaxed text-muted-foreground shadow-glow backdrop-blur-md">
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <p className="text-sm font-black text-foreground">{at.globeYearInfoTitle}</p>
            <CloseButton onClick={() => setInfo(false)} label={at.regionCloseAria} />
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
