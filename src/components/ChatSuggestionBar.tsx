/**
 * Y-Dude Suggestion-Bar: kompakte Vorschlagszeile direkt oberhalb des
 * Messenger-Composers – auf Android liegt sie damit unmittelbar ueber der
 * Systemtastatur (Gboard bleibt unveraendert). Reine UI-Ebene: sie zeigt
 * Vorschlaege aus `buildChatSuggestions` und meldet die Auswahl zurueck.
 */
import { useMemo } from "react";
import type { SlangTag } from "@/lib/types";
import type { Lang } from "@/lib/i18n-dict";
import { buildChatSuggestions, type ChatSuggestion } from "@/lib/chat-suggestions";

export function ChatSuggestionBar({
  draft,
  lang,
  tags,
  onPick,
}: {
  draft: string;
  lang: Lang;
  tags: SlangTag[];
  onPick: (suggestion: ChatSuggestion) => void;
}) {
  const items = useMemo(() => buildChatSuggestions({ draft, lang, tags }), [draft, lang, tags]);
  if (items.length === 0) return null;

  return (
    <div
      className="mb-1.5 -mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Y-Dude"
    >
      <div className="flex w-max items-center gap-1.5">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            // Fokus bleibt im Eingabefeld: die Tastatur darf nicht schliessen.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(s)}
            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              s.kind === "tag"
                ? "border-brand-cyan/50 bg-brand-cyan/10 text-brand-cyan hover:bg-brand-cyan/20"
                : "border-brand/40 bg-background/80 text-foreground hover:border-brand hover:bg-brand/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
