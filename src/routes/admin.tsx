import { createFileRoute, Outlet, redirect, useNavigate, Link } from "@tanstack/react-router";
import { LogOut, ShieldAlert, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearDeviceMediaCache } from "@/lib/media";

/**
 * Standalone admin cockpit. Fully separated from the regular platform UI:
 * its own layout, its own chrome, admin-only access.
 */
export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (isAdmin !== true) throw redirect({ to: "/dev" });

    return { user: data.user };
  },
  component: AdminCockpitLayout,
});

function AdminCockpitLayout() {
  const navigate = useNavigate();

  const signOut = async () => {
    clearDeviceMediaCache();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-brand/25 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/admin" className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-brand">
              <ShieldAlert className="h-4 w-4 text-primary-foreground" />
            </span>
            <span className="truncate text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
              Y-Dude Admin-Cockpit
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="/dev"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Plattform</span>
            </a>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
