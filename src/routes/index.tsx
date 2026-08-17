import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import ydudeLogo from "@/assets/ydude-wordmark-lockup.png";
import ydudeMark from "@/assets/ydude-mark.png";
import { useLang } from "@/lib/lang-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SlangTagTester } from "@/components/landing/SlangTagTester";
import { useRedirectWhenSignedIn } from "@/lib/use-session";
import { authTexts } from "@/lib/i18n-auth";

const navBtnClass =
  "inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-brand/60 px-3 py-2 text-sm font-semibold text-brand transition-all hover:bg-brand/10 hover:shadow-glow-subtle active:shadow-glow-active sm:px-5";

type LandingSearch = { slangtag?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): LandingSearch =>
    typeof search.slangtag === "string" && search.slangtag.trim()
      ? { slangtag: search.slangtag.trim() }
      : {},
  head: () => ({
    meta: [
      { title: "Y-Dude — Speak Local. Connect Global." },
      {
        name: "description",
        content:
          "Y-Dude: Hör echten Slang als kurzen Audio-SlangTag. Direkt auf der Startseite aufnehmen oder gescannten SlangTag abspielen.",
      },
      { property: "og:title", content: "Y-Dude — Speak Local. Connect Global." },
      {
        property: "og:description",
        content: "Ein SlangTag ist Slang als Sound. Probier es direkt aus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { lang } = useLang();
  const c = authTexts[lang].landing;
  const { slangtag } = Route.useSearch();
  // Landingpage ist nur für nicht angemeldete Besucher.
  useRedirectWhenSignedIn("/dev");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation – bewusst minimal: Marke, Sprache, Login/Register */}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex min-w-0 shrink-0 items-center">
          <img
            src={ydudeMark}
            alt="Y-Dude"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <div className="flex items-center gap-2">
            <Link to="/auth" className={navBtnClass}>
              {c.login}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              search={{ mode: "register" }}
              className={navBtnClass}
            >
              {c.register}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero – nur Marke und ein Satz */}
      <section className="px-4 pt-8 text-center sm:px-6 sm:pt-12">
        <div className="mx-auto max-w-[820px]">
          <h1 className="flex justify-center">
            <img
              src={ydudeLogo}
              alt="Y-Dude — Speak Local. Connect Global."
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full max-w-[360px] drop-shadow-[0_0_16px_oklch(0.82_0.24_150/0.04)] sm:max-w-[460px]"
            />
          </h1>

          <p className="mx-auto mt-5 max-w-[420px] text-sm leading-relaxed text-muted-foreground sm:mt-7 sm:text-base">
            {c.lead2a} <span className="text-brand">{c.lead2b}</span>
          </p>
        </div>
      </section>

      {/* Zentrales, kompaktes interaktives Element */}
      <SlangTagTester tagId={slangtag} />

      {/* Dezenter Abschluss-CTA */}
      <section className="px-4 pb-14 pt-2 text-center sm:px-6 sm:pb-18">
        <p className="mx-auto max-w-[420px] text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {c.hintA} <span className="text-brand">{c.hintB}</span>
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}

