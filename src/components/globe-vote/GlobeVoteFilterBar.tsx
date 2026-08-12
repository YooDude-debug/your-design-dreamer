import { useState } from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

export type GlobeVoteFilters = {
  q: string;
  country: string;
  region: string;
  city: string;
  language: string;
};

export const EMPTY_GLOBE_FILTERS: GlobeVoteFilters = {
  q: "",
  country: "",
  region: "",
  city: "",
  language: "",
};

function Select({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="min-w-0 block">
      <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="control-field tap-safe mt-1 w-full truncate rounded-xl px-2.5 py-2 text-xs outline-none"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Suche + kompaktes Untermenü „Sprache & Region“.
 * Land · Region · Stadt · Sprache sind voneinander abhängig: die Optionen
 * kommen bereits kaskadiert aus der Section, damit keine leeren Treffer
 * auswählbar sind.
 */
export function GlobeVoteFilterBar({
  filters,
  options,
  onChange,
  onReset,
}: {
  filters: GlobeVoteFilters;
  options: { countries: string[]; regions: string[]; cities: string[]; languages: string[] };
  onChange: (patch: Partial<GlobeVoteFilters>) => void;
  onReset?: () => void;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const activeCount = [filters.country, filters.region, filters.city, filters.language].filter(
    Boolean,
  ).length;
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <div className="space-y-2">
      <label className="control-field flex items-center gap-2 rounded-xl px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={at.searchTagPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={at.filterGroupToggleAria}
          className="tap-safe flex w-full items-center gap-2 px-2.5 py-2 text-left"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {at.filterGroupTitle}
          </span>
          {activeCount > 0 && (
            <span className="shrink-0 rounded-full border border-brand/50 px-1.5 text-[10px] font-black text-brand">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="border-t border-border/60 p-2.5">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Select
                label={at.countryLabel}
                allLabel={at.allCountriesShort}
                value={filters.country}
                options={options.countries}
                onChange={(country) => onChange({ country, region: "", city: "" })}
              />
              <Select
                label={at.regionLabel}
                allLabel={at.allRegions}
                value={filters.region}
                options={options.regions}
                onChange={(region) => onChange({ region, city: "" })}
              />
              <Select
                label={at.cityLabel}
                allLabel={at.allCities}
                value={filters.city}
                options={options.cities}
                onChange={(city) => onChange({ city })}
              />
              <Select
                label={at.languageLabel}
                allLabel={at.allLanguagesShort}
                value={filters.language}
                options={options.languages}
                onChange={(language) => onChange({ language })}
              />
            </div>
            {activeCount > 0 && onReset && (
              <button
                type="button"
                onClick={onReset}
                className="tap-safe mt-2 rounded-full border border-border px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:border-brand/50 hover:text-brand"
              >
                {at.filterResetBtn}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
