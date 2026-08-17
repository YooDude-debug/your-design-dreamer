import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, UserPlus } from "lucide-react";
import ydudeLogo from "@/assets/ydude-wordmark-lockup.png";
import ydudeLogoInline from "@/assets/ydude-lockup-inline.png";
import { useLang } from "@/lib/lang-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SlangTagTester } from "@/components/landing/SlangTagTester";
import { useRedirectWhenSignedIn } from "@/lib/use-session";
import { authTexts } from "@/lib/i18n-auth";

const navBtnClass =
  "inline-flex items-center gap-2 rounded-full border border-brand/60 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 sm:px-5";

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
      {/* Navigation – bewusst minimal: Marke, Sprache, Login */}
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <Link to="/" className="flex min-w-0 shrink-0 items-center">
          <img
            src={ydudeLogoInline}
            alt="Y-Dude"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="h-8 w-auto sm:h-9"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full border border-brand/60 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 sm:px-5"
          >
            {c.login}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Hero – nur Marke und ein Satz */}
      <section className="px-4 pt-10 text-center sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-[820px]">
          <h1 className="flex justify-center">
            <img
              src={ydudeLogo}
              alt="Y-Dude — Speak Local. Connect Global."
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full max-w-[460px] drop-shadow-[0_0_28px_oklch(0.82_0.24_150/0.16)] sm:max-w-[600px]"
            />
          </h1>

          <p className="mx-auto mt-8 max-w-[520px] text-base leading-relaxed text-muted-foreground sm:mt-10 sm:text-xl">
            {c.lead2a} <span className="text-brand">{c.lead2b}</span>
          </p>
        </div>
      </section>

      {/* Zentrales interaktives Element */}
      <SlangTagTester tagId={slangtag} />

      {/* Einstieg */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto flex max-w-[620px] flex-col items-center">
          <Link
            to="/auth"
            search={{ mode: "register" }}
            className="group inline-flex w-full max-w-[440px] items-center gap-4 rounded-full bg-gradient-brand px-4 py-3 text-primary-foreground shadow-[0_0_28px_oklch(0.82_0.24_150/0.25)] transition-transform hover:scale-[1.02] sm:px-6 sm:py-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background/85 sm:h-12 sm:w-12">
              <AudioLines className="h-5 w-5 text-brand sm:h-6 sm:w-6" />
            </span>
            <span className="min-w-0 flex-1 text-center">
              <span className="block truncate text-lg font-bold sm:text-xl">{c.cta}</span>
              <span className="block truncate text-xs opacity-80 sm:text-sm">{c.ctaSub}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

