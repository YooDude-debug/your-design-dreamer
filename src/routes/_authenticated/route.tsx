import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppDataProvider } from "@/lib/data";
import { ThemeSync } from "@/components/ThemeSync";
import { SocialLayer } from "@/components/SocialLayer";
import { CreatorUnlockHost } from "@/components/CreatorUnlockDialog";

/**
 * Wird nach dem ersten Client-Render gesetzt. Vorher darf nicht sofort
 * umgeleitet werden, weil sonst ein anderer Seitenbaum gerendert würde als im
 * Server-HTML enthalten ist (React-Hydration-Warnung #418).
 */
let hydrated = false;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Zuerst die persistierte Session prüfen: sie überlebt Refresh und
    // Zurück-Navigation und wird bei Bedarf automatisch erneuert. Ein
    // fehlgeschlagener Netzwerk-Call darf niemals zum Logout führen.
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    // Beim ersten Seitenaufruf übernimmt der Layout-Baum das Umleiten (nach der
    // Hydration, siehe unten). Danach – bei Navigation innerhalb der App – wird
    // wie bisher direkt umgeleitet, bevor überhaupt etwas geladen wird.
    if (!session && hydrated) throw redirect({ to: "/auth", replace: true });
    return { user: session?.user ?? null };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();

  useEffect(() => {
    hydrated = true;
  }, []);

  // Ohne Sitzung wird nichts aus dem geschützten Bereich gerendert; die
  // Umleitung erfolgt unmittelbar nach der Hydration.
  useEffect(() => {
    if (!user) void navigate({ to: "/auth", replace: true });
  }, [user, navigate]);

  if (!user) return null;

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
