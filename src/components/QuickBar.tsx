import { Link } from "@tanstack/react-router";
import { MessageSquare, ShoppingBag, Bell, Users, Tv } from "lucide-react";
import type { ComponentType } from "react";

import { useLang } from "@/lib/lang-context";
import { useSocialOptional } from "@/lib/social-context";
import { useSocialUIOptional } from "@/lib/social-ui-context";

/**
 * Schnellzugriff-Leiste unter dem Profilblock.
 *
 * Icon-only Darstellung: Beschriftungen werden ausschließlich als
 * Accessibility-Namen (aria-label + sr-only) geführt; sichtbar bleiben
 * nur die Symbole samt Unread-Badges.
 *
 * Fehlt die Social-Hülle (z. B. während eines Hot-Reloads), bleiben die
 * Symbole sichtbar und wirkungslos – kein weisser Bildschirm.
 */
export function QuickBar() {
  const { t } = useLang();
  const ui = useSocialUIOptional();
  const social = useSocialOptional();
  const openMessenger = (id?: string) => ui?.openMessenger(id);
  const openConnections = () => ui?.openConnections();
  const openNotifications = () => ui?.openNotifications();
  const unreadMessages = social?.unreadMessages ?? 0;
  const unreadNotifications = social?.unreadNotifications ?? 0;
  const incoming = social?.incoming ?? [];

  const cell =
    "relative flex min-h-11 flex-1 items-center justify-center px-2 py-2 text-muted-foreground transition-colors hover:text-brand";

  const badge = (n: number) =>
    n > 0 ? (
      <span className="absolute right-1/2 top-1 translate-x-4 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground">
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
          <button
            type="button"
            onClick={b.onClick}
            className={cell}
            aria-label={b.label}
            title={b.label}
          >
            <b.Icon className="h-5 w-5 shrink-0" />
            <span className="sr-only">{b.label}</span>
            {badge(b.count)}
          </button>
        </div>
      ))}

      {divider}

      <Link
        to="/market"
        className={cell}
        activeProps={{ className: `${cell} text-brand` }}
        aria-label="Market"
        title="Market"
      >
        <ShoppingBag className="h-5 w-5 shrink-0" />
        <span className="sr-only">Market</span>
      </Link>

      {divider}

      <Link
        to="/channels"
        className={cell}
        activeProps={{ className: `${cell} text-brand` }}
        aria-label={t.myChannels}
        title={t.myChannels}
      >
        <Tv className="h-5 w-5 shrink-0" />
        <span className="sr-only">{t.myChannels}</span>
      </Link>
    </section>
  );
}
