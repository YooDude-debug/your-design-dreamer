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

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppDataProvider>
        <ThemeSync />
        <SocialLayer>
          <Outlet />
        </SocialLayer>
        <CreatorUnlockHost />
      </AppDataProvider>
    </div>
  );
}
