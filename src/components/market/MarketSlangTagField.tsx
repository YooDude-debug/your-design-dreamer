/**
 * SlangTags an einem Market-Artikel auswaehlen bzw. aufnehmen.
 *
 * Es wird ausschliesslich die bestehende SlangTag-Infrastruktur benutzt:
 * `TagComboField` (Suche + Aufnahme) und `SlangTagChip` (Anzeige/Wiedergabe).
 * Market bringt keine eigene Audio- oder Player-Logik mit.
 */

import { CloseButton } from "@/components/ui/nav-buttons";
import { Mic, X } from "lucide-react";
import { TagComboField } from "@/components/TagComboField";
import { SlangTagChip } from "@/components/SlangTagChip";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { marketTexts } from "@/lib/i18n-market";
import { MAX_ITEM_SLANG_TAGS } from "@/lib/market-shared";

export function MarketSlangTagField({
  tagIds,
  onChange,
}: {
  tagIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const { getTag } = useData();
  const full = tagIds.length >= MAX_ITEM_SLANG_TAGS;

  return (
    <section className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Mic className="h-3.5 w-3.5" />
        {m.slangTagsLabel}
      </p>
      <TagComboField
        region=""
        tagsDisabled={full}
        hashtags={[]}
        onAddHashtag={() => {}}
        onRemoveHashtag={() => {}}
        onSelectTag={(tag) => {
          if (full || tagIds.includes(tag.id)) return;
          onChange([...tagIds, tag.id]);
        }}
      >
        {tagIds.map((id) => {
          const tag = getTag(id);
          if (!tag) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1">
              <SlangTagChip tag={tag} variant="compact" showRegion={false} showStats={false} />
              <CloseButton onClick={() => onChange(tagIds.filter((t) => t !== id))} label={m.cancel} />
            </span>
          );
        })}
      </TagComboField>
      <p className="text-[11px] text-muted-foreground">{m.slangTagLimit}</p>
    </section>
  );
}

/** Reine Anzeige der Artikel-SlangTags (Detailseite). */
export function MarketSlangTagList({ tagIds }: { tagIds: string[] }) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const { getTag } = useData();
  const tags = tagIds.map((id) => getTag(id)).filter(Boolean);
  if (tags.length === 0) return null;
  return (
    <section className="space-y-2 border-t border-border/50 pt-3">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Mic className="h-3.5 w-3.5" />
        {m.slangTagsLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <SlangTagChip key={tag!.id} tag={tag!} variant="compact" showStats={false} />
        ))}
      </div>
    </section>
  );
}
