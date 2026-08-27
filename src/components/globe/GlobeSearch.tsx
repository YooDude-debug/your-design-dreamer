import { CloseButton } from "@/components/ui/nav-buttons";
import { memo, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { searchRegions } from "@/lib/globe/demo-data";
import type { GlobeRegion } from "@/lib/globe/types";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

export const GlobeSearch = memo(function GlobeSearch({
  regions,
  onSelect,
}: {
  regions: GlobeRegion[];
  onSelect: (region: GlobeRegion) => void;
}) {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRegions(query, regions), [query, regions]);

  return (
    <div className="pointer-events-auto relative w-full">
      <div className="control-field flex items-center gap-2 rounded-full px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={at.searchPlaceholderGlobe}
          className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <CloseButton onClick={() => setQuery("")} label={at.clearSearchAria} size="sm" className="shrink-0" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="control-bar absolute left-0 right-0 top-12 z-10 overflow-hidden rounded-2xl">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(r);
                  setQuery("");
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-brand/10"
              >
                <span className="font-semibold">{r.city ?? r.country}</span>
                <span className="text-xs text-muted-foreground">{r.country}</span>
                <span className="ml-auto text-[11px] text-brand">${r.popular[0]?.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
