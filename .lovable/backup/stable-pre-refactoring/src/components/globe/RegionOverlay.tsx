import { memo } from "react";
import { Flame, MapPin, TrendingUp, Users, X } from "lucide-react";
import type { GlobeRegion } from "@/lib/globe/types";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}K`;
  return String(n);
}

function heatColor(intensity: number): string {
  if (intensity < 0.4) return "text-brand";
  if (intensity < 0.7) return "text-yellow-400";
  return "text-red-400";
}

export const RegionOverlay = memo(function RegionOverlay({
  region,
  onClose,
}: {
  region: GlobeRegion;
  onClose: () => void;
}) {
  return (
    <div className="pointer-events-auto w-full animate-[fade-in_220ms_ease-out] rounded-3xl border border-border/60 bg-surface/85 p-4 shadow-2xl backdrop-blur-xl sm:w-80">
      <div className="flex items-start gap-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-brand/40 bg-brand/10">
          <MapPin className={`h-4 w-4 ${heatColor(region.intensity)}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black tracking-tight">{region.country}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {region.city ?? "—"} · {region.language} · {region.category}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="SlangTags" value={fmt(region.slangTags)} />
        <Stat label="Aktiv" value={fmt(region.activeUsers)} icon={<Users className="h-3 w-3" />} />
        <Stat
          label="Wachstum"
          value={`${region.growth > 0 ? "+" : ""}${region.growth}%`}
          icon={<TrendingUp className="h-3 w-3" />}
        />
      </div>

      <Section
        title="Trending"
        icon={<Flame className="h-3.5 w-3.5 text-brand" />}
        items={region.trending}
        suffix="growth"
      />
      <Section
        title="Beliebteste"
        icon={<TrendingUp className="h-3.5 w-3.5 text-brand" />}
        items={region.popular}
        suffix="plays"
      />

      <p className="mt-3 text-[10px] text-muted-foreground/70">Demo-Daten · lokal simuliert</p>
    </div>
  );
});

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background/50 px-2 py-2">
      <div className="flex items-center justify-center gap-1 text-sm font-bold text-foreground">
        {icon}
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  suffix,
}: {
  title: string;
  icon: React.ReactNode;
  items: GlobeRegion["trending"];
  suffix: "growth" | "plays";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h3>
      <ul className="mt-1.5 space-y-1">
        {items.map((t) => (
          <li key={t.name} className="flex items-center gap-2 text-xs">
            <span className="truncate text-foreground">
              <span className="text-brand">$</span>
              {t.name}
            </span>
            <span className="ml-auto shrink-0 text-muted-foreground">
              {suffix === "growth" ? `${t.growth > 0 ? "+" : ""}${t.growth}%` : fmt(t.plays)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
