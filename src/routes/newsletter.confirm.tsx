import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { confirmNewsletter } from "@/lib/newsletter.functions";
import { useLang } from "@/lib/lang-context";
import { SiteFooter } from "@/components/SiteFooter";
import { authTexts } from "@/lib/i18n-auth";

export const Route = createFileRoute("/newsletter/confirm")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({
    meta: [
      { title: "E-Mail bestätigen — Y-Dude" },
      {
        name: "description",
        content: "Bestätige deine E-Mail-Adresse für Y-Dude Launch-Benachrichtigungen.",
      },
      { property: "og:title", content: "E-Mail bestätigen — Y-Dude" },
      { property: "og:description", content: "Double-Opt-in Bestätigung für Y-Dude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { token } = Route.useSearch();
  const { lang } = useLang();
  const c = authTexts[lang].newsletterConfirm;
  const confirm = useServerFn(confirmNewsletter);
  const [state, setState] = useState<
    "loading" | "verified" | "already_verified" | "expired" | "invalid"
  >("loading");

  useEffect(() => {
    let alive = true;
    if (!token) {
      setState("invalid");
      return;
    }
    confirm({ data: { token } })
      .then((r) => alive && setState(r.status))
      .catch(() => alive && setState("invalid"));
    return () => {
      alive = false;
    };
  }, [token, confirm]);

  const view = {
    loading: { Icon: Clock, text: c.loading, tone: "text-muted-foreground" },
    verified: { Icon: CheckCircle2, text: c.verified, tone: "text-brand" },
    already_verified: { Icon: CheckCircle2, text: c.already, tone: "text-brand-cyan" },
    expired: { Icon: Clock, text: c.expired, tone: "text-muted-foreground" },
    invalid: { Icon: XCircle, text: c.invalid, tone: "text-destructive" },
  }[state];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[720px] px-4 py-16">
        <div className="rounded-2xl border border-border bg-background p-10 text-center">
          <view.Icon className={`mx-auto h-10 w-10 ${view.tone}`} />
          <h1 className="mt-4 text-xl font-bold">{view.text}</h1>
          <Link
            to="/"
            className="mt-8 inline-flex rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            {c.home}
          </Link>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
