/**
 * Gespeicherte Market-Suchen mit Benachrichtigungsschalter (Phase 3).
 * Trefferbenachrichtigungen entstehen serverseitig beim Einstellen neuer
 * Artikel – hier wird nur verwaltet, was der Nutzer gespeichert hat.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BellOff, BellRing, Loader2, Search, Trash2 } from "lucide-react";

import {
  deleteMarketSavedSearch,
  listMarketSavedSearches,
  updateMarketSavedSearch,
} from "@/lib/market.functions";
import { marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";

export function SavedSearchList({ lang }: { lang: Lang }) {
  const m = marketTexts[lang];
  const queryClient = useQueryClient();
  const list = useServerFn(listMarketSavedSearches);
  const update = useServerFn(updateMarketSavedSearch);
  const remove = useServerFn(deleteMarketSavedSearch);

  const { data: searches = [], isLoading } = useQuery({
    queryKey: ["market-saved-searches"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["market-saved-searches"] });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {m.loading}
      </p>
    );
  }

  if (searches.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{m.noSavedSearches}</p>;
  }

  return (
    <ul className="space-y-2">
      {searches.map((s) => (
        <li
          key={s.id}
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-3"
        >
          <Search className="h-4 w-4 shrink-0 text-brand" />
          <Link
            to="/market"
            className="min-w-0 flex-1 truncate text-sm text-foreground hover:text-brand"
            title={s.label}
          >
            {s.label}
          </Link>
          <button
            onClick={async () => {
              await update({ data: { id: s.id, notify: !s.notify } });
              await refresh();
            }}
            aria-label={s.notify ? m.notifyOff : m.notifyOn}
            title={s.notify ? m.notifyOn : m.notifyOff}
            className={`grid h-8 w-8 place-items-center rounded-full border transition-colors ${
              s.notify
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/50"
            }`}
          >
            {s.notify ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <button
            onClick={async () => {
              await remove({ data: { id: s.id } });
              await refresh();
            }}
            aria-label={m.deleteSearch}
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
