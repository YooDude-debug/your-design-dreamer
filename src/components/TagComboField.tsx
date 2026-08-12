import { useRef, useState, type ReactNode } from "react";
import { Hash, Search } from "lucide-react";
import { SlangTagPopover } from "@/components/SlangTagInput";
import { slangTagTheme } from "@/lib/slangtag-ui";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { dismissKeyboard } from "@/lib/mobile-keyboard";
import { detectSlangTagKind, sanitizeSlangTagName } from "@/lib/slangtag-rules";
import { HASHTAG_COLOR } from "@/lib/tag-colors";
import { isUserEdit, looksLikeCredential, noAutofillProps } from "@/lib/no-autofill";
import type { SlangTag } from "@/lib/types";

type Props = {
  region: string;
  /** SlangTag ausgewählt bzw. neu aufgenommen. */
  onSelectTag: (tag: SlangTag) => void;
  /** SlangTag-Limit erreicht: nur noch Hashtags möglich. */
  tagsDisabled?: boolean;
  hashtags: string[];
  onAddHashtag: (name: string) => void;
  onRemoveHashtag: (name: string) => void;
  /** Chips der gewählten SlangTags – erscheinen in derselben Chip-Zeile. */
  children?: ReactNode;
};

/**
 * Ein gemeinsames, intelligentes Eingabefeld für Hashtags und SlangTags.
 * Das erste Zeichen entscheidet: `#` → Hashtag, `$`/`$$` → SlangTag.
 * Die bestehende SlangTag-Logik (Suche, Aufnahme, Platzierung) bleibt
 * unverändert – nur die Eingabe ist vereinheitlicht.
 */
export function TagComboField({
  region,
  onSelectTag,
  tagsDisabled = false,
  hashtags,
  onAddHashtag,
  onRemoveHashtag,
  children,
}: Props) {
  const { t } = useLang();
  const { canCreateBusinessTag } = useData();
  const [query, setQuery] = useState("");
  /** Manuell geschlossenes Fenster: dieser Ausdruck oeffnet sich nicht erneut. */
  const [dismissed, setDismissed] = useState<string | null>(null);
  /**
   * Anker des Popups ist ausschliesslich die Eingabezeile. Chips oder Hinweise
   * unter dem Feld veraendern damit die Popup-Position nicht mehr.
   */
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isHashtag = query.trimStart().startsWith("#");
  const cleanName = sanitizeSlangTagName(query);
  const hashtagName = query.trim().replace(/^#+/, "");

  // SlangTag-Modus: alles, was kein `#` ist (mit oder ohne `$`).
  const slangActive =
    !isHashtag &&
    !tagsDisabled &&
    cleanName.length > 0 &&
    !looksLikeCredential(query) &&
    dismissed !== query;
  const kind = canCreateBusinessTag ? detectSlangTagKind(query) : "community";
  const theme = slangTagTheme(kind);
  const hashtagActive = isHashtag && hashtagName.length > 0;

  const commitHashtag = () => {
    if (!hashtagName) return;
    onAddHashtag(hashtagName);
    setQuery("");
  };

  return (
    <div className="relative">
      {/* Sichtbarer Modus – der Nutzer erkennt jederzeit den aktiven Typ. */}
      {slangActive && theme.business && (
        <div
          className={`pointer-events-none absolute bottom-full left-0 mb-1.5 inline-flex items-center gap-1.5 rounded-full border ${theme.borderDashed} ${theme.bgSoft} px-2.5 py-1 text-[11px] font-bold ${theme.text}`}
        >
          <span aria-hidden>🔵</span> Unternehmer-SlangTag aktiv
        </div>
      )}

      <div
        ref={setRow}
        data-slangtag-input=""
        className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2"
        style={
          hashtagActive
            ? { borderColor: HASHTAG_COLOR }
            : slangActive
              ? undefined
              : { borderColor: "var(--border)" }
        }
      >
        {hashtagActive ? (
          <Hash className="h-4 w-4 shrink-0" style={{ color: HASHTAG_COLOR }} />
        ) : (
          <Search className={`h-4 w-4 shrink-0 ${slangActive ? theme.text : "text-brand"}`} />
        )}
        <input
          ref={inputRef}
          value={query}
          enterKeyHint="done"
          {...noAutofillProps}
          onChange={(e) => {
            // Autofill/Passwortmanager dürfen dieses Feld nicht befüllen und
            // damit auch nicht das SlangTag-Fenster öffnen.
            if (!isUserEdit(e) || looksLikeCredential(e.target.value)) return;
            setDismissed(null);
            setQuery(e.target.value);
          }}
          onKeyDown={(e) => {
            if (isHashtag && (e.key === "Enter" || e.key === " " || e.key === ",")) {
              e.preventDefault();
              commitHashtag();
              if (e.key === "Enter") dismissKeyboard(inputRef.current);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              dismissKeyboard(inputRef.current);
            }
          }}
          placeholder={t.tagComboPh}
          className="w-full bg-transparent text-sm outline-none"
        />

        {hashtagActive && (
          <span
            className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: HASHTAG_COLOR }}
          >
            Hashtag
          </span>
        )}
        {slangActive && (
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${theme.text}`}>
            {theme.business ? "Business" : t.slangTagLabel}
          </span>
        )}
      </div>

      {slangActive && (
        <SlangTagPopover
          anchor={row}
          query={cleanName}
          region={region}
          kind={kind}
          onSelect={(tag) => {
            onSelectTag(tag);
            setQuery("");
            setDismissed(null);
            dismissKeyboard(inputRef.current);
          }}
          onClose={() => {
            setDismissed(query);
            dismissKeyboard(inputRef.current);
          }}
        />
      )}

      {(hashtags.length > 0 || children) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hashtags.map((h) => (
            <button
              key={`h-${h}`}
              type="button"
              onClick={() => onRemoveHashtag(h)}
              style={{
                color: HASHTAG_COLOR,
                backgroundColor: "color-mix(in oklab, var(--hashtag) 15%, transparent)",
              }}
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            >
              #{h} ✕
            </button>
          ))}
          {children}
        </div>
      )}
    </div>
  );
}
