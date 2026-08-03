import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { SlangTagPopover } from "@/components/SlangTagInput";
import { slangTagTheme } from "@/lib/slangtag-ui";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { dismissKeyboard } from "@/lib/mobile-keyboard";
import { detectSlangTagKind } from "@/lib/slangtag-rules";
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
 *
 * `$$` schaltet den Editor live in den Unternehmermodus (Marken-Blau).
 */
export function SlangTagPicker({ region, onSelect, placeholder, disabled = false }: Props) {
  const { t } = useLang();
  const { canCreateBusinessTag } = useData();
  const [query, setQuery] = useState("");
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);


  const active = !disabled && query.trim().startsWith("$");
  // Ohne Berechtigung existiert der Brand-/Creator-Modus fuer den Nutzer nicht:
  // `$$` verhaelt sich dann wie ein normaler Community-SlangTag.
  const kind = canCreateBusinessTag ? detectSlangTagKind(query) : "community";
  const theme = slangTagTheme(kind);
  const cleanName = query
    .trim()
    .replace(/^\$\$?/, "")
    .replace(/\s+/g, "");

  return (
    <div className="relative" ref={setWrap}>
      {/* Sichtbarer Modus – der Nutzer erkennt jederzeit den aktiven Typ. */}
      {active && theme.business && (
        <div
          className={`mb-1.5 inline-flex items-center gap-1.5 rounded-full border ${theme.borderDashed} ${theme.bgSoft} px-2.5 py-1 text-[11px] font-bold ${theme.text}`}
        >
          <span aria-hidden>🔵</span> Unternehmer-SlangTag aktiv
        </div>
      )}

      <div
        className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2 ${
          disabled
            ? "border-border opacity-60"
            : active
              ? `${theme.business ? "border-brand-cyan" : "border-brand"} ${theme.glow}`
              : "border-border focus-within:border-brand"
        }`}
      >
        <Search className={`h-4 w-4 shrink-0 ${active ? theme.text : "text-brand"}`} />
        <input
          ref={inputRef}
          value={disabled ? "" : query}
          disabled={disabled}
          enterKeyHint="done"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Bestaetigen: Tastatur vollstaendig einklappen (blur des Feldes).
              e.preventDefault();
              dismissKeyboard(inputRef.current);
            }
          }}

          placeholder={disabled ? t.maxTagsReached : (placeholder ?? t.slangTagSearchPh)}
          className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />

        {active && (
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${theme.text}`}>
            {theme.business ? "Business" : t.slangTagLabel}
          </span>
        )}
      </div>

      {active && (
        <SlangTagPopover
          anchor={wrap}
          query={cleanName}
          region={region}
          kind={kind}
          onSelect={(tag) => {
            onSelect(tag);
            setQuery("");
            // Nach der Uebernahme bleibt die Tastatur geschlossen.
            dismissKeyboard(inputRef.current);
          }}


        />
      )}
    </div>
  );
}
