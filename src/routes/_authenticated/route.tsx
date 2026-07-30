import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppDataProvider } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SocialLayer } from "@/components/SocialLayer";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    return { user: data.user };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { t } = useLang();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">{t.internalArea}</span>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-brand hover:border-brand/50 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" /> {t.logout}
        </button>
      </div>
      <AppDataProvider>
        <SocialLayer>
          <Outlet />
        </SocialLayer>
      </AppDataProvider>
    </div>
  );
}
