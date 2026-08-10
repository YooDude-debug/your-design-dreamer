import { memo } from "react";
import type { GlobeFilters, GlobeRange } from "@/lib/globe/types";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";



const selectCls =
  "control-field h-9 min-w-0 rounded-full px-3 text-xs outline-none";

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
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const RANGES: { id: GlobeRange; label: string }[] = [
    { id: "today", label: at.rangeToday },
    { id: "7d", label: at.range7d },
    { id: "30d", label: at.range30d },
    { id: "all", label: at.rangeAll },
  ];
  return (
    <div className="control-bar pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl p-2">
      <div className="control-track flex rounded-full p-0.5">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange({ range: r.id })}
            aria-pressed={filters.range === r.id}
            className={`control-chip rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
              filters.range === r.id ? "control-chip-active" : ""
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <select
        aria-label={at.languageAria}
        className={selectCls}
        value={filters.language}
        onChange={(e) => onChange({ language: e.target.value })}
      >
        <option value="all">{at.allLanguages}</option>
        {languages.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      <select
        aria-label={at.categoryAria}
        className={selectCls}
        value={filters.category}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        <option value="all">{at.allCategories}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        aria-label={at.countryAria}
        className={selectCls}
        value={filters.country}
        onChange={(e) => onChange({ country: e.target.value })}
      >
        <option value="all">{at.allCountries}</option>
        {countries.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
});
