import { Search } from "lucide-react";

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
        className="tap-safe mt-1 w-full truncate rounded-xl border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-brand"
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
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="SlangTag suchen …"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Select
          label="Land"
          allLabel="Alle Länder"
          value={filters.country}
          options={options.countries}
          onChange={(country) => onChange({ country })}
        />
        <Select
          label="Region"
          allLabel="Alle Regionen"
          value={filters.region}
          options={options.regions}
          onChange={(region) => onChange({ region })}
        />
        <Select
          label="Stadt"
          allLabel="Alle Städte"
          value={filters.city}
          options={options.cities}
          onChange={(city) => onChange({ city })}
        />
        <Select
          label="Sprache"
          allLabel="Alle Sprachen"
          value={filters.language}
          options={options.languages}
          onChange={(language) => onChange({ language })}
        />
      </div>
    </div>
  );
}
