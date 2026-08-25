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
      { title: "Y-Dude – Speak Local. Connect Global." },
      { name: "description", content: SEO_DESCRIPTION },
      { property: "og:title", content: "Y-Dude – Speak Local. Connect Global." },
      { property: "og:description", content: SEO_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://y-dude.com/" },
      { property: "og:site_name", content: "Y-Dude" },
      { property: "og:image", content: "https://y-dude.com/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Y-Dude logo with the claim Speak Local. Connect Global.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Y-Dude – Speak Local. Connect Global." },
      { name: "twitter:description", content: SEO_DESCRIPTION },
      { name: "twitter:image", content: "https://y-dude.com/og-image.jpg" },
      {
        name: "twitter:image:alt",
        content: "Y-Dude logo with the claim Speak Local. Connect Global.",
      },
    ],
    links: [{ rel: "canonical", href: "https://y-dude.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://y-dude.com/#organization",
              name: "Y-Dude",
              url: "https://y-dude.com/",
              slogan: "Speak Local. Connect Global.",
              logo: "https://y-dude.com/icon-512.png",
            },
            {
              "@type": "WebSite",
              "@id": "https://y-dude.com/#website",
              name: "Y-Dude",
              url: "https://y-dude.com/",
              description: SEO_DESCRIPTION,
              inLanguage: ["en", "de", "el"],
              publisher: { "@id": "https://y-dude.com/#organization" },
            },
            {
              "@type": "WebApplication",
              name: "Y-Dude",
              url: "https://y-dude.com/",
              applicationCategory: "SocialNetworkingApplication",
              operatingSystem: "Web",
              description: SEO_DESCRIPTION,
              publisher: { "@id": "https://y-dude.com/#organization" },
            },
          ],
        }),
      },
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
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Navigation – bewusst minimal: Marke, Sprache, Login/Register */}
      <header className="mx-auto flex w-full max-w-[1180px] shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:py-4">
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
            <Link to="/auth" search={{ mode: "register" }} className={navBtnClass}>
              {c.register}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center sm:justify-start lg:justify-center">
        {/* Hero – nur Marke und ein Satz */}
        <section className="px-4 pt-2 text-center sm:px-6 sm:pt-4">
          <div className="mx-auto max-w-[820px]">
            <h1 className="flex justify-center">
              <img
                src={ydudeLogo}
                alt="Y-Dude — Speak Local. Connect Global."
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full max-w-[220px] drop-shadow-[0_0_16px_oklch(0.82_0.24_150/0.04)] sm:max-w-[250px] lg:max-w-[280px]"
              />
            </h1>

            <p className="mx-auto mt-2 max-w-[420px] text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
              {c.lead2a} <span className="text-brand">{c.lead2b}</span>
            </p>
          </div>
        </section>

        {/* Zentrales, kompaktes interaktives Element */}
        <SlangTagTester tagId={slangtag} />

        {/* Dezenter Abschluss-CTA */}
        <section className="px-4 pb-2 pt-2 text-center sm:px-6 sm:pb-4 lg:pb-6">
          <p className="mx-auto max-w-[420px] text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {c.hintA} <span className="text-brand">{c.hintB}</span>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
