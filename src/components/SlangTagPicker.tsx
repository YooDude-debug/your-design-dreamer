import { useState } from "react";
import { Search } from "lucide-react";
import { SlangTagPopover } from "@/components/SlangTagInput";
import { useLang } from "@/lib/i18n";
import type { SlangTag } from "@/lib/types";

type Props = {
  region: string;
  onSelect: (tag: SlangTag) => void;
  placeholder?: string;
  /** Sperrt die Eingabe, z. B. wenn das SlangTag-Limit erreicht ist. */
  disabled?: boolean;
};

/**
 * SlangTag-Eingabe über "$" für den Composer. Nutzt exakt dieselbe Suche und
 * Aufnahme-Logik wie alle anderen Textfelder der Plattform – das Popup wird
 * als globales Portal gerendert und kann nie abgeschnitten werden.
 */
export function SlangTagPicker({ region, onSelect, placeholder, disabled = false }: Props) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);

  const active = !disabled && query.trim().startsWith("$");
  const cleanName = query.trim().replace(/^\$\$?/, "").replace(/\s+/g, "");

  return (
    <div className="relative" ref={setWrap}>
      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2 ${
          disabled ? "border-border opacity-60" : active ? "border-brand shadow-glow" : "border-border focus-within:border-brand"
        }`}
      >
        <Search className="h-4 w-4 shrink-0 text-brand" />
        <input
          value={disabled ? "" : query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={disabled ? t.maxTagsReached : placeholder ?? t.slangTagSearchPh}
          className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
        {active && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-brand">{t.slangTagLabel}</span>
        )}
      </div>


      {active && (
        <SlangTagPopover
          anchor={wrap}
          query={cleanName}
          region={region}
          onSelect={(tag) => {
            onSelect(tag);
            setQuery("");
          }}
        />
      )}
    </div>
  );
}

