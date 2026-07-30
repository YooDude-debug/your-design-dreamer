import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ydudeLogo from "@/assets/ydude-logo.png";

type AuthSearch = { denied?: boolean };

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    denied: search.denied === true || search.denied === "true",
  }),
  head: () => ({
    meta: [
      { title: "Admin Login — Y-Dude" },
      { name: "description", content: "Geschützter Zugang zum internen Entwicklerbereich von Y-Dude." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Login — Y-Dude" },
      { property: "og:description", content: "Geschützter Zugang zum internen Bereich von Y-Dude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.");
      return;
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("Kein Admin-Zugang für diesen Account.");
      return;
    }
    setLoading(false);
    navigate({ to: "/dev", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-surface/40 p-6">
          <div className="flex items-center justify-between">
            <img src={ydudeLogo} alt="Y-Dude" className="h-9 w-auto" />
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand">
              <ArrowLeft className="h-3.5 w-3.5" /> Startseite
            </Link>
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight">
            Admin <span className="text-gradient-green">Login</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Zugang ausschließlich für Administratoren des internen Entwicklerbereichs.
          </p>

          {denied && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Kein Admin-Zugang für diesen Account.
            </p>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail"
              className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              className="w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {loading ? "…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
