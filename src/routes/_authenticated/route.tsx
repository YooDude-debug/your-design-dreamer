import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut, Bell, Users, MessageSquare, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppDataProvider } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SocialLayer, useSocialUI } from "@/components/SocialLayer";
import { useSocial } from "@/lib/social";
import { CreatorUnlockHost } from "@/components/CreatorUnlockDialog";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Zuerst die persistierte Session prüfen: sie überlebt Refresh und
    // Zurück-Navigation und wird bei Bedarf automatisch erneuert. Ein
    // fehlgeschlagener Netzwerk-Call darf niemals zum Logout führen.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw redirect({ to: "/auth", replace: true });
    return { user: session.user };
  },
  component: AdminLayout,
});

function Header() {
  const navigate = useNavigate();
  const { t } = useLang();
  const { openMessenger, openConnections, openNotifications } = useSocialUI();
  const { unreadNotifications, incoming } = useSocial();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const scrollToDiscover = () => {
    document.getElementById("discover")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const items = [
    {
      Icon: Bell,
      label: t.notifications,
      onClick: openNotifications,
      badge: unreadNotifications,
    },
    {
      Icon: Users,
      label: t.connections,
      onClick: openConnections,
      badge: incoming.length,
    },
    {
      Icon: MessageSquare,
      label: t.messages,
      onClick: () => openMessenger(),
      badge: 0,
    },
    {
      Icon: Compass,
      label: t.discoverSlangTags,
      onClick: scrollToDiscover,
      badge: 0,
    },
  ];

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <LanguageSwitcher />
        <span className="truncate text-[10px] font-bold uppercase tracking-widest text-brand">
          {t.internalArea}
        </span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {items.map(({ Icon, label, onClick, badge }) => (
          <button
            key={label}
            onClick={onClick}
            aria-label={label}
            title={label}
            className="relative grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand sm:h-9 sm:w-9"
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {!!badge && (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground">
                {badge}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={signOut}
          className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand sm:ml-2 sm:px-3"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t.logout}</span>
        </button>
      </div>
    </header>
  );
}

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppDataProvider>
        <SocialLayer>
          <Header />
          <Outlet />
        </SocialLayer>
        <CreatorUnlockHost />
      </AppDataProvider>
    </div>
  );
}
