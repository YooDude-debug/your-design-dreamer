import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { AppDataProvider } from "@/lib/data";
import { ThemeSync } from "@/components/ThemeSync";
import { SocialLayer } from "@/components/SocialLayer";
import { CreatorUnlockHost } from "@/components/CreatorUnlockDialog";

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
  const { unreadNotifications, unreadMessages, incoming } = useSocial();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  // Slang Globe & Slang Arena auf Mobile: immersive Ansicht ohne globale Leiste.
  // Navigation läuft dort weiterhin über die bestehenden Wischgesten.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideOnMobile = pathname.startsWith("/globe") || pathname.startsWith("/arena");

  const doSignOut = async () => {
    setLogoutConfirmOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
      badge: unreadMessages,
    },

  ];

  return (
    <>
      <header
        data-app-header
        className={`sticky top-0 z-[60] items-center justify-between gap-2 border-b sm:gap-4 border-border/50 bg-background/90 px-3 py-2 backdrop-blur sm:px-4 ${
          hideOnMobile ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="flex min-w-0 items-center">
          <LanguageSwitcher />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {items.map(({ Icon, label, onClick, badge }) => (
            <button
              key={label}
              onClick={onClick}
              aria-label={label}
              title={label}
              className="relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand sm:h-10 sm:w-10"
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {!!badge && (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground">
                  {badge}
                </span>
              )}
            </button>
          ))}

          {/* Channels: zentrale Channel-Verwaltung (nur eingeloggt, dieser
              Layout-Bereich ist bereits abgesichert). Optik identisch zu den
              runden Icons daneben. */}
          <Link
            to="/channels"
            aria-label={t.myChannels}
            title={t.myChannels}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand sm:h-10 sm:w-10"
            activeProps={{ className: "border-brand/60 text-brand" }}
          >
            <Tv className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>

          {/* Y-Dude Market: lokal kaufen und verkaufen. Optik identisch zu den
              runden Icons daneben. */}
          <Link
            to="/market"
            aria-label="Y-Dude Market"
            title="Y-Dude Market"
            className="relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand sm:h-10 sm:w-10"
            activeProps={{ className: "border-brand/60 text-brand" }}
          >
            <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>

          {/* Nur Desktop: Slang Globe & Slang Arena. Auf Tablet/Smartphone
              bleibt die bestehende Wischgesten-Navigation die einzige Route. */}
          {[
            { to: "/globe" as const, Icon: Globe2, label: "Slang Globe" },
            { to: "/arena" as const, Icon: Swords, label: "Slang Arena" },
          ].map(({ to, Icon, label }) => (
            <Link
              key={to}
              to={to}
              aria-label={label}
              title={label}
              className="hidden h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand lg:grid"
              activeProps={{ className: "border-brand/60 text-brand" }}
            >
              <Icon className="h-4 w-4" />
            </Link>
          ))}

          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="ml-1 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand active:scale-[0.98] sm:ml-2"
          >
            <LogOut className="h-4 w-4" />
            <span>{t.logout}</span>
          </button>
        </div>
      </header>
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Abmelden?"
        message="Möchtest du dich wirklich von Y-Dude abmelden?"
        confirmLabel="Abmelden"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={doSignOut}
      />
    </>
  );
}

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppDataProvider>
        <ThemeSync />
        <SocialLayer>
          <Header />
          <Outlet />
        </SocialLayer>
        <CreatorUnlockHost />
      </AppDataProvider>
    </div>
  );
}
