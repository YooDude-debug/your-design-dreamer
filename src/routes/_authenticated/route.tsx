import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ydudeLogo from "@/assets/ydude-logo.png";
import { AppDataProvider } from "@/lib/data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth", search: { denied: true } });
    }
    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <img src={ydudeLogo} alt="Y-Dude" className="h-7 w-auto" />
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">Interner Bereich</span>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-brand hover:border-brand/50 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> Logout
        </button>
      </div>
      <AppDataProvider>
        <Outlet />
      </AppDataProvider>
    </div>
  );
}
