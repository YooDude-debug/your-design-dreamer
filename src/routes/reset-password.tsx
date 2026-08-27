import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearDeviceMediaCache } from "@/lib/media";
import { useLang } from "@/lib/lang-context";
import { authTexts } from "@/lib/i18n-auth";

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
  const { lang } = useLang();
  const t = authTexts[lang].resetPassword;
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
      toast.error(t.tooShort);
      return;
    }
    if (password !== password2) {
      toast.error(t.mismatch);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      toast.error(t.failToast);
      return;
    }
    // Einmal-Session beenden: Der Nutzer meldet sich regulär neu an.
    clearDeviceMediaCache();
    await supabase.auth.signOut();
    setLoading(false);
    setDone(true);
    toast.success(t.successToast);
    setTimeout(() => void navigate({ to: "/auth", replace: true }), 2500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
          <div className="flex items-center justify-end">
            <BackButton to="/auth" label={t.backToLogin} className="shrink-0" />
          </div>

          <h1 className="mt-6 text-2xl font-black tracking-tight">
            {t.headingPrefix} <span className="text-gradient-green">{t.headingSuffix}</span>
          </h1>

          {!ready && <p className="mt-3 text-xs text-muted-foreground">{t.checkingLink}</p>}

          {ready && !valid && !done && (
            <div className="mt-4 space-y-3">
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t.invalidLinkMsg}
              </p>
              <Link
                to="/auth"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                {t.requestNewLink}
              </Link>
            </div>
          )}

          {done && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.doneMsg}</p>
          )}

          {ready && valid && !done && (
            <>
              <p className="mt-1 text-xs text-muted-foreground">{t.subtitle}</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.newPasswordPl}
                  className={inputClass}
                />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder={t.repeatPasswordPl}
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  {loading ? "…" : t.submit}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
