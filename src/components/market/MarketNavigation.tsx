import { Link } from "@tanstack/react-router";
import { Bookmark, PackageOpen, Plus, ShoppingBag } from "lucide-react";

import type { Lang } from "@/lib/i18n-dict";
import { marketTexts } from "@/lib/i18n-market";

export function MarketNavigation({ lang }: { lang: Lang }) {
  const m = marketTexts[lang];
  const actionBase =
    "flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition-[border-color,background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 active:translate-y-px";

  return (
    <nav aria-label={m.marketNavigation} className="mb-4 space-y-2.5">
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-2">
        <Link
          to="/market"
          aria-current="page"
          className={`${actionBase} border-brand/60 bg-brand text-primary-foreground shadow-glow-subtle`}
        >
          <ShoppingBag className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{m.buyItems}</span>
        </Link>
        <Link
          to="/market/new"
          className={`${actionBase} border-border bg-card/70 text-foreground hover:border-brand/50 hover:bg-brand/10 hover:text-brand`}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{m.sellItems}</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/market/mine"
          className={`${actionBase} border-border/80 bg-background/70 text-muted-foreground hover:border-brand/50 hover:text-brand`}
        >
          <PackageOpen className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{m.myItems}</span>
        </Link>
        <Link
          to="/market/mine"
          search={{ tab: "favorites" }}
          className={`${actionBase} border-border/80 bg-background/70 text-muted-foreground hover:border-brand/50 hover:text-brand`}
        >
          <Bookmark className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{m.savedItems}</span>
        </Link>
      </div>
    </nav>
  );
}
