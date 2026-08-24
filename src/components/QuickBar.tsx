import { Link } from "@tanstack/react-router";
import { MessageSquare, ShoppingBag } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { useSocial } from "@/lib/social-context";
import { useSocialUI } from "@/lib/social-ui-context";

/**
 * Schnellzugriff-Leiste unter dem Profilblock.
 *
 * Nutzt ausschliesslich bestehende Navigation: der Messenger wird ueber den
 * vorhandenen Messenger-Overlay geoeffnet, Market ueber die vorhandene Route
 * `/market`. Der Zaehler kommt aus dem bestehenden Unread-Mechanismus.
 */
export function QuickBar() {
  const { t } = useLang();
  const { openMessenger } = useSocialUI();
  const { unreadMessages } = useSocial();

  const cell =
    "flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-brand";

  return (
    <section
      aria-label="Messenger & Market"
      className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-background"
    >
      <button type="button" onClick={() => openMessenger()} className={cell}>
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="truncate">{t.messages}</span>
        {!!unreadMessages && (
          <span className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground">
            {unreadMessages}
          </span>
        )}
      </button>

      <div aria-hidden className="my-2 w-px bg-border" />

      <Link
        to="/market"
        className={cell}
        activeProps={{ className: `${cell} text-brand` }}
      >
        <ShoppingBag className="h-4 w-4 shrink-0" />
        <span className="truncate">Market</span>
      </Link>
    </section>
  );
}
