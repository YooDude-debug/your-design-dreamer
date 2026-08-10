import { Search } from "lucide-react";
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

/** Suche + kombinierbare Filter (Land · Region · Stadt · Sprache). */
export function GlobeVoteFilterBar({
  filters,
  options,
  onChange,
}: {
  filters: GlobeVoteFilters;
  options: { countries: string[]; regions: string[]; cities: string[]; languages: string[] };
  onChange: (patch: Partial<GlobeVoteFilters>) => void;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Select
          label={at.countryLabel}
          allLabel={at.allCountriesShort}
          value={filters.country}
          options={options.countries}
          onChange={(country) => onChange({ country })}
        />
        <Select
          label={at.regionLabel}
          allLabel={at.allRegions}
          value={filters.region}
          options={options.regions}
          onChange={(region) => onChange({ region })}
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
    </div>
  );
}
