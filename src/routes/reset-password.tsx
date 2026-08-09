import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Neues Passwort setzen — Y-Dude" },
      {
        name: "description",
        content: "Setze ein neues Passwort für deinen Y-Dude Account.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Neues Passwort setzen — Y-Dude" },
      {
        property: "og:description",
        content: "Setze ein neues Passwort für deinen Y-Dude Account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

const inputClass =
  "w-full rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-brand";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Der Recovery-Link erzeugt eine kurzlebige Einmal-Session. Erst wenn diese
  // vorliegt, darf das Formular ein neues Passwort setzen.
  useEffect(() => {
    let active = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setValid(Boolean(data.session));
      setReady(true);
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setValid(true);
        setReady(true);
      }
    });
    void check();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Das Passwort muss mindestens 8 Zeichen haben.");
      return;
    }
    if (password !== password2) {
      toast.error("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast.error(
        "Das Passwort konnte nicht geändert werden. Der Link ist möglicherweise abgelaufen oder wurde bereits verwendet.",
      );
      return;
    }
    // Einmal-Session beenden: Der Nutzer meldet sich regulär neu an.
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
    toast.success("Passwort geändert. Du kannst dich jetzt anmelden.");
    setTimeout(() => void navigate({ to: "/auth", replace: true }), 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="flex items-center justify-end">
            <Link
              to="/auth"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Zum Login
            </Link>
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight">
            Neues <span className="text-gradient-green">Passwort</span>
          </h1>

          {!ready && <p className="mt-3 text-xs text-muted-foreground">Link wird geprüft …</p>}

          {ready && !valid && !done && (
            <div className="mt-4 space-y-3">
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Dieser Link ist ungültig, abgelaufen oder wurde schon verwendet. Fordere einfach
                einen neuen Link an.
              </p>
              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Neuen Link anfordern
              </Link>
            </div>
          )}

          {done && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Dein Passwort wurde geändert. Du wirst zum Login weitergeleitet …
            </p>
          )}

          {ready && valid && !done && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                Wähle ein neues Passwort mit mindestens 8 Zeichen.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Neues Passwort"
                  className={inputClass}
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {loading ? "…" : "Passwort speichern"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
