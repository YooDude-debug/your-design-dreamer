import { memo } from "react";
import type { GlobeFilters, GlobeRange } from "@/lib/globe/types";

const RANGES: { id: GlobeRange; label: string }[] = [
  { id: "today", label: "Heute" },
  { id: "7d", label: "7 Tage" },
  { id: "30d", label: "30 Tage" },
  { id: "all", label: "Gesamt" },
];

const selectCls =
  "h-9 min-w-0 rounded-full border border-border/70 bg-background/70 px-3 text-xs text-foreground outline-none backdrop-blur focus:border-brand";

export const GlobeFilterBar = memo(function GlobeFilterBar({
  filters,
  languages,
  categories,
  countries,
  onChange,
}: {
  filters: GlobeFilters;
  languages: string[];
  categories: string[];
  countries: string[];
  onChange: (next: Partial<GlobeFilters>) => void;
}) {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-surface/60 p-2 backdrop-blur-md">
      <div className="flex rounded-full border border-border/70 bg-background/60 p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange({ range: r.id })}
            aria-pressed={filters.range === r.id}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              filters.range === r.id
                ? "bg-brand/20 text-brand"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <select
        aria-label="Sprache"
        className={selectCls}
        value={filters.language}
        onChange={(e) => onChange({ language: e.target.value })}
      >
        <option value="all">Alle Sprachen</option>
        {languages.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      <select
        aria-label="Kategorie"
        className={selectCls}
        value={filters.category}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        <option value="all">Alle Kategorien</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label="Land"
        className={selectCls}
        value={filters.country}
        onChange={(e) => onChange({ country: e.target.value })}
      >
        <option value="all">Alle Länder</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
});
