import { CloseButton } from "@/components/ui/nav-buttons";
import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Flame, MapPin, TrendingUp, Users, X } from "lucide-react";
import type { GlobeRegion } from "@/lib/globe/types";
import { useLang } from "@/lib/lang-context";
import { arenaTexts, type ArenaDict } from "@/lib/i18n-arena";
import { profileLang, tagMeaning } from "@/lib/globe/tag-meanings";
import { useData } from "@/lib/data-context";

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
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const { me } = useData();
  /** Profilsprache hat Vorrang vor der Oberflächensprache. */
  const meaningLang = profileLang(me?.language, lang);
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
        <CloseButton onClick={onClose} label={at.regionCloseAria} className="shrink-0" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label={at.statSlangTagsLabel} value={fmt(region.slangTags)} />
        <Stat
          label={at.statActiveLabel}
          value={fmt(region.activeUsers)}
          icon={<Users className="h-3 w-3" />}
        />
        <Stat
          label={at.statGrowthLabel}
          value={`${region.growth > 0 ? "+" : ""}${region.growth}%`}
          icon={<TrendingUp className="h-3 w-3" />}
        />
      </div>

      <Section
        title={at.sectionTrending}
        icon={<Flame className="h-3.5 w-3.5 text-brand" />}
        items={region.trending}
        suffix="growth"
        country={region.country}
        lang={meaningLang}
        at={at}
      />
      <Section
        title={at.sectionPopular}
        icon={<TrendingUp className="h-3.5 w-3.5 text-brand" />}
        items={region.popular}
        suffix="plays"
        country={region.country}
        lang={meaningLang}
        at={at}
      />

      <p className="mt-3 text-[10px] text-muted-foreground/70">{at.demoDataNote}</p>
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
  country,
  lang,
  at,
}: {
  title: string;
  icon: React.ReactNode;
  items: GlobeRegion["trending"];
  suffix: "growth" | "plays";
  country: string;
  lang: Parameters<typeof tagMeaning>[1];
  at: ArenaDict;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </h3>
      <ul className="mt-1.5 space-y-1">
        {items.map((t) => {
          const meaning = tagMeaning(t.name, lang);
          return (
            <li key={t.name}>
              <Link
                to="/slangtag/$name"
                params={{ name: t.name }}
                title={at.openInArena}
                className="group flex items-start gap-2 rounded-xl px-1 py-1 text-xs transition-colors hover:bg-background/60"
              >
                <span className="min-w-0 flex-1">
                  {/* Originalbegriff bleibt immer sichtbar */}
                  <span className="block truncate text-foreground">
                    <span className="text-brand">$</span>
                    {t.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {meaning ? `${meaning} · ${country}` : `${at.noMeaningYet} · ${country}`}
                  </span>
                </span>
                <span className="mt-0.5 flex shrink-0 items-center gap-1 text-muted-foreground">
                  {suffix === "growth" ? `${t.growth > 0 ? "+" : ""}${t.growth}%` : fmt(t.plays)}
                  <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
