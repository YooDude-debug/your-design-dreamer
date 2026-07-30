import { useState } from "react";
import { Search } from "lucide-react";
import { SlangTagSuggest } from "@/components/SlangTagInput";
import { useLang } from "@/lib/i18n";
import type { SlangTag } from "@/lib/types";

type Props = {
  region: string;
  onSelect: (tag: SlangTag) => void;
  placeholder?: string;
};

/**
 * SlangTag-Eingabe über "$" für den Composer. Nutzt exakt dieselbe Suche und
 * Aufnahme-Logik wie alle anderen Textfelder der Plattform.
 */
export function SlangTagPicker({ region, onSelect, placeholder }: Props) {
  const { t } = useLang();
  const [query, setQuery] = useState("");

  const active = query.trim().startsWith("$");
  const cleanName = query.trim().replace(/^\$/, "").replace(/\s+/g, "");

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2 ${
          active ? "border-brand shadow-glow" : "border-border focus-within:border-brand"
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-brand" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? t.slangTagSearchPh}
          className="w-full bg-transparent text-sm outline-none"
        />
        {active && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-brand">{t.slangTagLabel}</span>
        )}
      </div>

      {active && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1">
          <SlangTagSuggest
            query={cleanName}
            region={region}
            onSelect={(tag) => {
              onSelect(tag);
              setQuery("");
            }}
          />
        </div>
      )}
    </div>
  );
}
