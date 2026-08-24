import { memo } from "react";
import type { GlobeFilters, GlobeRange } from "@/lib/globe/types";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

const fieldCls =
  "control-field h-8 min-w-0 w-full rounded-full px-2 text-[10px] font-bold uppercase tracking-wider outline-none sm:h-9 sm:px-3 sm:text-xs";

export const GlobeFilterBar = memo(function GlobeFilterBar({
  year,
  activeYear,
  years,
  filters,
  languages,
  categories,
  countries,
  onChange,
  onYearChange,
}: {
  year: number;
  activeYear: number | null;
  years: number[];
  filters: GlobeFilters;
  languages: string[];
  categories: string[];
  countries: string[];
  onChange: (next: Partial<GlobeFilters>) => void;
  onYearChange: (year: number) => void;
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
    <div className="pointer-events-auto flex flex-col gap-1.5 sm:gap-2">
      {/* Jahr + Zeitraum */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
        <select
          aria-label={at.globeYearSelectAria}
          className={fieldCls}
          value={year}
          onChange={(e) => onYearChange(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y === activeYear ? `${y} · ${at.globeYearCurrent}` : String(y)}
            </option>
          ))}
        </select>

        <select
          aria-label={at.rangeAria}
          className={fieldCls}
          value={filters.range}
          onChange={(e) => onChange({ range: e.target.value as GlobeRange })}
        >
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sprache + Länder + Kategorien */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <select
          aria-label={at.languageAria}
          className={fieldCls}
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
          aria-label={at.countryAria}
          className={fieldCls}
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

        <select
          aria-label={at.categoryAria}
          className={fieldCls}
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
      </div>
    </div>
  );
});
