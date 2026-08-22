import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { gdprTexts } from "@/lib/i18n-gdpr-public";
import {
  GdprDataList,
  GdprPublicPage,
  gdprInputClass,
  gdprLabelClass,
} from "@/components/GdprPublicPage";
import { publicDeleteAccount } from "@/lib/gdpr-public.functions";

const TITLE = "Y-Dude-Konto löschen — Y-Dude";
const DESC =
  "Beantrage die Löschung deines Y-Dude-Kontos. Nach sicherer Identitätsprüfung werden Konto, Profil, Inhalte und Medien endgültig gelöscht.";

export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://y-dude.com/delete-account" },
      { property: "og:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { lang } = useLang();
  const t = gdprTexts[lang];
  const run = useServerFn(publicDeleteAccount);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await run({ data: { identifier, password, confirm: true } });
      if (res.ok) {
        setDone(true);
        setPassword("");
      } else {
        setError(res.reason === "RATE_LIMIT" ? t.rateLimit : t.invalid);
      }
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GdprPublicPage title={t.del.title} lead={t.del.lead} t={t}>
      {done ? (
        <div className="rounded-2xl border border-brand/40 bg-card/60 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden />
            {t.del.doneTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.del.doneText}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <GdprDataList title={t.del.listTitle} items={t.del.list} />

          <p className="flex gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs leading-relaxed">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <span>{t.del.irreversible}</span>
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className={gdprLabelClass} htmlFor="del-id">
                {t.identifierLabel}
              </label>
              <input
                id="del-id"
                name="identifier"
                autoComplete="username"
                required
                maxLength={200}
                className={gdprInputClass}
                placeholder={t.identifierPlaceholder}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className={gdprLabelClass} htmlFor="del-pw">
                {t.passwordLabel}
              </label>
              <input
                id="del-pw"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                className={gdprInputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t.passwordHint}</p>
              <Link
                to="/"
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                {t.forgot}
              </Link>
            </div>

            <label className="flex items-start gap-2 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>{t.del.confirm}</span>
            </label>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !confirmed}
              className="w-full rounded-full bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {busy ? t.submitting : t.del.submit}
            </button>
          </form>
        </div>
      )}
    </GdprPublicPage>
  );
}
