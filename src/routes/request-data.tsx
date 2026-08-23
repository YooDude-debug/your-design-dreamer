import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Download } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { gdprTexts } from "@/lib/i18n-gdpr-public";
import {
  GdprDataList,
  GdprPublicPage,
  gdprInputClass,
  gdprLabelClass,
} from "@/components/GdprPublicPage";
import { publicRequestDataExport } from "@/lib/gdpr-public.functions";

const TITLE = "Meine Y-Dude-Daten anfordern — Y-Dude";
const DESC =
  "Fordere eine Kopie deiner bei Y-Dude gespeicherten personenbezogenen Daten an. Nach sicherer Identitätsprüfung erhältst du einen persönlichen Download-Link.";

export const Route = createFileRoute("/request-data")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://y-dude.com/request-data" },
      { property: "og:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
    ],
  }),
  component: RequestDataPage,
});

function RequestDataPage() {
  const { lang } = useLang();
  const t = gdprTexts[lang];
  const run = useServerFn(publicRequestDataExport);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; filename: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await run({ data: { identifier, password } });
      if (res.ok) {
        setResult({ url: res.url, filename: res.filename });
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
    <GdprPublicPage title={t.data.title} lead={t.data.lead} t={t}>
      {result ? (
        <div className="rounded-2xl border border-brand/40 bg-card/60 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-5 w-5 text-brand" aria-hidden />
            {t.data.doneTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.data.doneText}</p>
          <a
            href={result.url}
            download={result.filename}
            rel="noopener"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-background"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t.data.download}
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <GdprDataList title={t.data.listTitle} items={t.data.list} />

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className={gdprLabelClass} htmlFor="req-id">
                {t.identifierLabel}
              </label>
              <input
                id="req-id"
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
              <label className={gdprLabelClass} htmlFor="req-pw">
                {t.passwordLabel}
              </label>
              <input
                id="req-pw"
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

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              {busy ? t.submitting : t.data.submit}
            </button>
          </form>
        </div>
      )}
    </GdprPublicPage>
  );
}
