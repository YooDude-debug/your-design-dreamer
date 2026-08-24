/**
 * „Passende Channels“ beim Einstellen eines Artikels.
 *
 * Grundlage ist ausschliesslich die bestehende Channel-Struktur (`channels`
 * ueber die vorhandene Volltextsuche). Der Verkaeufer entscheidet selbst;
 * es gibt keine automatische Massenverteilung – hoechstens
 * `MAX_ITEM_CHANNELS` Verknuepfungen.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Tv } from "lucide-react";
import { suggestMarketChannels } from "@/lib/market.functions";
import { MAX_ITEM_CHANNELS } from "@/lib/market-shared";
import { useLang } from "@/lib/lang-context";
import { marketTexts } from "@/lib/i18n-market";

export function MarketChannelSuggest({
  title,
  description,
  categoryName,
  value,
  onChange,
}: {
  title: string;
  description: string;
  categoryName: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { lang } = useLang();
  const m = marketTexts[lang];
  const suggest = useServerFn(suggestMarketChannels);
  const enabled = title.trim().length >= 3 && categoryName.length > 0;

  const { data = [], isFetching } = useQuery({
    queryKey: ["market-channel-suggest", title.trim(), categoryName],
    queryFn: () =>
      suggest({
        data: { title: title.trim(), description: description.slice(0, 400), categoryName },
      }),
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) return null;

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((c) => c !== id));
      return;
    }
    if (value.length >= MAX_ITEM_CHANNELS) return;
    onChange([...value, id]);
  };

  return (
    <section className="space-y-2">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Tv className="h-3.5 w-3.5" />
        {m.channelsLabel}
      </p>
      {isFetching && data.length === 0 ? (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {m.loading}
        </p>
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{m.noChannelSuggestions}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {data.map((c) => {
            const on = value.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  on
                    ? "border-brand/60 bg-brand/10 text-brand"
                    : "border-border text-muted-foreground hover:border-brand/50"
                }`}
              >
                {on ? <Check className="h-3.5 w-3.5" /> : <span>{c.icon ?? "#"}</span>}
                {c.name}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{m.channelsHint}</p>
    </section>
  );
}
