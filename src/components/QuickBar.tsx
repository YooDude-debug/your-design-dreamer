import { Link } from "@tanstack/react-router";
import { MessageSquare, ShoppingBag, Bell, Users, Tv } from "lucide-react";
import type { ComponentType } from "react";

import { useLang } from "@/lib/lang-context";
import { useSocial } from "@/lib/social-context";
import { useSocialUI } from "@/lib/social-ui-context";

/**
 * Schnellzugriff-Leiste unter dem Profilblock.
 *
 * Sie ersetzt die frühere permanente Kopfleiste: alle Funktionen sind die
 * bestehenden (Messenger-Overlay, Market-Route, Notifications- und
 * Connections-Panel, Channels-Route). Zähler kommen aus dem bestehenden
 * Unread-Mechanismus.
 */
export function QuickBar() {
  const { t } = useLang();
  const { openMessenger, openConnections, openNotifications } = useSocialUI();
  const { unreadMessages, unreadNotifications, incoming } = useSocial();

  const cell =
    "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-brand sm:flex-row sm:gap-2 sm:text-sm";

  const badge = (n: number) =>
    n > 0 ? (
      <span className="absolute right-1/2 top-0.5 translate-x-4 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground sm:static sm:translate-x-0">
        {n}
      </span>
    ) : null;

  const buttons: {
    key: string;
    Icon: ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
    count: number;
  }[] = [
    {
      key: "messages",
      Icon: MessageSquare,
      label: t.messages,
      onClick: () => openMessenger(),
      count: unreadMessages,
    },
    {
      key: "notifications",
      Icon: Bell,
      label: t.notifications,
      onClick: openNotifications,
      count: unreadNotifications,
    },
    {
      key: "connections",
      Icon: Users,
      label: t.connections,
      onClick: openConnections,
      count: incoming.length,
    },
  ];

  const divider = <div aria-hidden className="my-2 w-px shrink-0 bg-border" />;

  return (
    <section
      aria-label="Schnellzugriff"
      className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-background"
    >
      {buttons.map((b, i) => (
        <div key={b.key} className="contents">
          {i > 0 && divider}
          <button type="button" onClick={b.onClick} className={cell}>
            <b.Icon className="h-4 w-4 shrink-0" />
            <span className="max-w-full truncate">{b.label}</span>
            {badge(b.count)}
          </button>
        </div>
      ))}

      {divider}

      <Link to="/market" className={cell} activeProps={{ className: `${cell} text-brand` }}>
        <ShoppingBag className="h-4 w-4 shrink-0" />
        <span className="max-w-full truncate">Market</span>
      </Link>

      {divider}

      <Link to="/channels" className={cell} activeProps={{ className: `${cell} text-brand` }}>
        <Tv className="h-4 w-4 shrink-0" />
        <span className="max-w-full truncate">{t.myChannels}</span>
      </Link>
    </section>
  );
}
