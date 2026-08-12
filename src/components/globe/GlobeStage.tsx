import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Pause, Play } from "lucide-react";
import { GlobeEngine } from "@/lib/globe/globe-engine";
import { demoDataSource } from "@/lib/globe/demo-data";
import type { GlobeFilters, GlobeRegion } from "@/lib/globe/types";
import type { SatelliteCandidate } from "@/lib/globe/satellites";
import { GlobeFilterBar } from "./GlobeFilterBar";
import { GlobeSearch } from "./GlobeSearch";
import { RegionOverlay } from "./RegionOverlay";
import { GlobeSatelliteLayer } from "./GlobeSatelliteLayer";
import { GlobeTagCard } from "./GlobeTagCard";
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
  const [filters, setFilters] = useState<GlobeFilters>({
    range: "7d",
    language: "all",
    category: "all",
    country: "all",
  });

  const regions = useMemo(() => demoDataSource.regions(filters), [filters]);
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
    const engine = new GlobeEngine(host, { onPick: (r) => setSelected(r) });
    engineRef.current = engine;
    setEngine(engine);
    const ro = new ResizeObserver(() => engine.resize());
    ro.observe(host);
    return () => {
      ro.disconnect();
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
  }, []);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,oklch(0.24_0.06_165/0.55),transparent_65%)]">
      <div ref={hostRef} className="absolute inset-0" aria-label={at.worldGlobeAria} />

      {/* SlangTag-Satelliten (geografisch verankert, rotieren mit der Globe) */}
      <GlobeSatelliteLayer engine={engine} regions={regions} />

      {/* Kopfzeile */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-brand/40 bg-surface/60 px-3 py-2 backdrop-blur-md">
            <Globe2 className="h-4 w-4 text-brand" />
            <span className="text-sm font-black tracking-tight">Slang Globe</span>
          </div>
          <GlobeSearch regions={regions} onSelect={flyTo} />
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
        <GlobeFilterBar
          filters={filters}
          languages={languages}
          categories={categories}
          countries={countries}
          onChange={onFilterChange}
        />
      </div>

      {/* Legende */}
      <div className="pointer-events-none absolute bottom-0 left-0 flex flex-col gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/60 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-md">
          <Dot className="bg-brand" label={at.legendLow} />
          <Dot className="bg-yellow-400" label={at.legendMedium} />
          <Dot className="bg-red-400" label={at.legendHigh} />
        </div>
        <p className="max-w-xs text-[10px] text-muted-foreground/70">
          {at.globeGestureHint}
        </p>
      </div>

      {/* Region-Overlay */}
      {selected && (
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
