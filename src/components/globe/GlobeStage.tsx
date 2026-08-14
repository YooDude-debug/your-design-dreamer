import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { GlobeEngine, type GlobeDetail } from "@/lib/globe/globe-engine";
import { demoDataSource } from "@/lib/globe/demo-data";
import type { GlobeFilters, GlobeRegion } from "@/lib/globe/types";
import type { SatelliteCandidate } from "@/lib/globe/satellites";
import { GlobeFilterBar } from "./GlobeFilterBar";
import { GlobeSearch } from "./GlobeSearch";
import { RegionOverlay } from "./RegionOverlay";
import { GlobeSatelliteLayer } from "./GlobeSatelliteLayer";
import { GlobeTagCard } from "./GlobeTagCard";
import { GlobeYearBar } from "./GlobeYearBar";
import { currentSlangYear, useSlangYearClock } from "@/lib/globe/slang-year";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

/**
 * Slang Globe – Bühne.
 *
 * Die 3D-Engine läuft imperativ (kein State pro Frame). React verwaltet nur
 * Filter, Auswahl und Overlay.
 */
export default function GlobeStage() {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GlobeEngine | null>(null);
  const [selected, setSelected] = useState<GlobeRegion | null>(null);
  const [tagPick, setTagPick] = useState<SatelliteCandidate | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [engine, setEngine] = useState<GlobeEngine | null>(null);
  const { activeYear, countdown, years } = useSlangYearClock();
  const [filters, setFilters] = useState<GlobeFilters>({
    range: "7d",
    year: currentSlangYear(),
    language: "all",
    category: "all",
    country: "all",
  });

  /**
   * Automatischer Jahreswechsel: erreicht der Countdown 0:00, wechselt der
   * Globe von selbst auf das neue Kalenderjahr – solange nicht bewusst ein
   * Archivjahr betrachtet wird (dieses bleibt unverändert).
   */
  const [followCurrent, setFollowCurrent] = useState(true);
  useEffect(() => {
    if (activeYear === null || !followCurrent) return;
    setFilters((f) => (f.year === activeYear ? f : { ...f, year: activeYear }));
  }, [activeYear, followCurrent]);

  /**
   * Detailstufe kommt aus der Engine (Kameradistanz) und wechselt nur beim
   * Überschreiten einer Schwelle – nicht pro Zoom-Event und nicht pro Frame.
   */
  const [detail, setDetail] = useState<GlobeDetail>("world");
  const [dataError, setDataError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  /** Letzter gültiger Datenstand: verhindert einen leeren Globe beim Nachladen. */
  const lastGood = useRef<GlobeRegion[]>([]);

  const regions = useMemo(() => {
    try {
      const list = demoDataSource.regions(filters, detail);
      lastGood.current = list;
      setDataError(false);
      return list;
    } catch {
      // Fallback auf den Cache-Stand statt leerer Kugel + sichtbarer Retry.
      setDataError(true);
      return lastGood.current;
    }
  }, [filters, detail, reloadKey]);
  const languages = useMemo(() => demoDataSource.languages(), []);
  const categories = useMemo(() => demoDataSource.categories(), []);
  const countries = useMemo(() => demoDataSource.countries(), []);
  const tagRegion = useMemo(
    () => (tagPick ? (regions.find((r) => r.id === tagPick.regionId) ?? null) : null),
    [tagPick, regions],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new GlobeEngine(host, {
      onPick: (r) => setSelected(r),
      onDetailChange: (d) => setDetail(d),
    });
    engineRef.current = engine;
    setEngine(engine);
    setDetail(engine.detailLevel);
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(host);
    // Mobile: Orientation-Wechsel und Adressleiste ändern die Höhe teils ohne
    // Layout-Reflow des Hosts – deshalb zusätzlich global neu messen.
    // (Die Engine ignoriert unveränderte Größen, doppelte Aufrufe kosten nichts.)
    const onViewport = () => engine.resize();
    window.addEventListener("orientationchange", onViewport);
    window.visualViewport?.addEventListener("resize", onViewport);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", onViewport);
      window.visualViewport?.removeEventListener("resize", onViewport);
      engine.dispose();
      engineRef.current = null;
      setEngine(null);
    };
  }, []);


  useEffect(() => {
    engineRef.current?.setRegions(regions);
  }, [regions]);

  useEffect(() => {
    engineRef.current?.setAutoRotate(autoRotate);
  }, [autoRotate]);

  useEffect(() => {
    engineRef.current?.setSelected(selected?.id ?? null);
  }, [selected]);

  const flyTo = useCallback((region: GlobeRegion) => {
    setSelected(region);
    engineRef.current?.flyTo(region.lat, region.lng);
  }, []);

  const onFilterChange = useCallback((next: Partial<GlobeFilters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setSelected(null);
    setTagPick(null);
  }, []);

  /** Tippen auf einen SlangTag-Satelliten: auswählen, abspielen, Info zeigen. */
  const onTagTap = useCallback(
    (cand: SatelliteCandidate) => {
      setTagPick(cand);
      const region = regions.find((r) => r.id === cand.regionId) ?? null;
      if (region) {
        setSelected(null);
        engineRef.current?.setSelected(region.id);
      }
    },
    [regions],
  );

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,oklch(0.24_0.06_165/0.55),transparent_65%)]">
      <div ref={hostRef} className="absolute inset-0" aria-label={at.worldGlobeAria} />

      {/* SlangTag-Satelliten (geografisch verankert, rotieren mit der Globe) */}
      <GlobeSatelliteLayer engine={engine} regions={regions} onTagTap={onTagTap} />

      {/* Kopfzeile: ganz oben die Suche, darunter Timer/Info, dann Filter. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1.5 p-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-2 sm:p-3">
        <GlobeSearch regions={regions} onSelect={flyTo} />
        <GlobeYearBar
          year={filters.year}
          activeYear={activeYear}
          countdown={countdown}
        />
        <GlobeFilterBar
          year={filters.year}
          activeYear={activeYear}
          years={years.length ? years : [filters.year]}
          filters={filters}
          languages={languages}
          categories={categories}
          countries={countries}
          onChange={onFilterChange}
          onYearChange={(year) => {
            setFollowCurrent(activeYear === null || year >= activeYear);
            onFilterChange({ year });
          }}
        />
      </div>

      {/* Legende + Rotation (Desktop) */}
      <div className="pointer-events-none absolute bottom-0 left-0 hidden flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex sm:p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-md">
            <Dot className="bg-brand" label={at.legendLow} />
            <Dot className="bg-yellow-400" label={at.legendMedium} />
            <Dot className="bg-red-400" label={at.legendHigh} />
          </div>
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            aria-pressed={autoRotate}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/60 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md hover:text-brand"
          >
            {autoRotate ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {at.rotationBtn}
          </button>
        </div>
        <p className="max-w-xs text-[10px] text-muted-foreground/70">{at.globeGestureHint}</p>
      </div>

      {/* SlangTag-Karte (Wiedergabe + kompakte Info) */}
      {tagPick && (
        <div className="absolute inset-x-0 bottom-0 flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-y-0 sm:left-auto sm:items-end sm:p-4">
          <GlobeTagCard cand={tagPick} region={tagRegion} onClose={() => setTagPick(null)} />
        </div>
      )}

      {/* Region-Overlay */}
      {selected && !tagPick && (
        <div className="absolute inset-x-0 bottom-0 flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-y-0 sm:left-auto sm:items-center sm:p-4">
          <RegionOverlay region={selected} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}

function Dot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
