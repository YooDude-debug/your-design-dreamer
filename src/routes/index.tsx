import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import ydudeLogo from "@/assets/ydude-wordmark-lockup.png";
import ydudeMark from "@/assets/ydude-mark.png";
import { useLang } from "@/lib/lang-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SlangTagTester } from "@/components/landing/SlangTagTester";
import { InstallAppButton } from "@/components/landing/InstallAppButton";

import { useRedirectWhenSignedIn } from "@/lib/use-session";
import { authTexts } from "@/lib/i18n-auth";

/** Kurzbeschreibung für Suchmaschinen und KI-Systeme. */
const SEO_DESCRIPTION =
  "Y-Dude connects people through local slang. Share SlangTags, discover regional language and connect with people around the world.";

/** Erklärende Abschnitte für Besucher, Suchmaschinen und KI-Systeme. */
const ABOUT = {
  de: {
    h2: "Was ist Y-Dude?",
    p: "Y-Dude ist eine soziale Plattform rund um regionale Sprache und Slang. Nutzer verbinden kurze Audio-SlangTags mit Bildern oder Inhalten, entdecken regionale Sprache und verbinden sich international.",
    h3a: "SlangTag – Slang als Sound",
    pa: "Ein SlangTag ist eine kurze Sprachaufnahme (1–5 Sekunden), die auf einem Bild platziert wird – wie ein Hashtag, nur zum Hören. Jeder SlangTag hat eine Region, eine Bedeutung und Beispiele.",
    h3b: "Speak Local. Connect Global.",
    pb: "Hör, wie Menschen wirklich sprechen: von Rostock bis Thessaloniki, von Berlin bis Tokio. Y-Dude gibt es auf Deutsch, Englisch und Griechisch.",
  },
  en: {
    h2: "What is Y-Dude?",
    p: "Y-Dude is a social platform for regional language and slang. People connect short audio SlangTags with images or content, discover regional language and connect internationally.",
    h3a: "SlangTag – slang as sound",
    pa: "A SlangTag is a short voice recording (1–5 seconds) placed on an image – like a hashtag, but for listening. Every SlangTag carries a region, a meaning and examples.",
    h3b: "Speak Local. Connect Global.",
    pb: "Hear how people really speak: from Rostock to Thessaloniki, from Berlin to Tokyo. Y-Dude is available in English, German and Greek.",
  },
  el: {
    h2: "Τι είναι το Y-Dude;",
    p: "Το Y-Dude είναι μια κοινωνική πλατφόρμα για την τοπική γλώσσα και την αργκό. Οι χρήστες συνδέουν σύντομα ηχητικά SlangTags με εικόνες ή περιεχόμενο και συνδέονται διεθνώς.",
    h3a: "SlangTag – αργκό σε ήχο",
    pa: "Ένα SlangTag είναι μια σύντομη ηχογράφηση (1–5 δευτερόλεπτα) πάνω σε μια εικόνα – σαν hashtag, αλλά για ακρόαση. Κάθε SlangTag έχει περιοχή, σημασία και παραδείγματα.",
    h3b: "Speak Local. Connect Global.",
    pb: "Άκου πώς μιλούν πραγματικά οι άνθρωποι: από το Ρόστοκ έως τη Θεσσαλονίκη, από το Βερολίνο έως το Τόκιο. Διαθέσιμο στα ελληνικά, γερμανικά και αγγλικά.",
  },
} as const;

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
      { property: "og:image", content: "https://y-dude.com/og-logo.png" },
      { property: "og:image:width", content: "1535" },
      { property: "og:image:height", content: "1024" },
      {
        property: "og:image:alt",
        content: "Y-Dude logo",
      },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Y-Dude – Speak Local. Connect Global." },
      { name: "twitter:description", content: SEO_DESCRIPTION },
      { name: "twitter:image", content: "https://y-dude.com/og-logo.png" },
      {
        name: "twitter:image:alt",
        content: "Y-Dude logo",
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
            {
              "@type": "FAQPage",
              "@id": "https://y-dude.com/#faq",
              mainEntity: [
                {
                  "@type": "Question",
                  name: ABOUT.en.h2,
                  acceptedAnswer: { "@type": "Answer", text: ABOUT.en.p },
                },
                {
                  "@type": "Question",
                  name: ABOUT.en.h3a,
                  acceptedAnswer: { "@type": "Answer", text: ABOUT.en.pa },
                },
                {
                  "@type": "Question",
                  name: ABOUT.en.h3b,
                  acceptedAnswer: { "@type": "Answer", text: ABOUT.en.pb },
                },
              ],
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
  const about = ABOUT[lang as keyof typeof ABOUT] ?? ABOUT.en;
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
            <h1 className="flex flex-col items-center justify-center">
              <img
                src={ydudeLogo}
                alt="Y-Dude"
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full max-w-[220px] drop-shadow-[0_0_16px_oklch(0.82_0.24_150/0.04)] sm:max-w-[250px] lg:max-w-[280px]"
              />
              <span className="sr-only">Y-Dude – Speak Local. Connect Global.</span>
            </h1>

            <p className="mx-auto mt-2 max-w-[420px] text-sm leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
              {c.lead2a} <span className="text-brand">{c.lead2b}</span>
            </p>
          </div>
        </section>

        {/* Zentrales, kompaktes interaktives Element */}
        <SlangTagTester tagId={slangtag} />

        {/* Dezenter Abschluss-CTA + PWA-Installation */}
        <section className="px-4 pb-2 pt-2 text-center sm:px-6 sm:pb-4 lg:pb-6">
          <p className="mx-auto max-w-[420px] text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {c.hintA} <span className="text-brand">{c.hintB}</span>
          </p>
          <div className="mt-3 flex justify-center">
            <InstallAppButton />
          </div>
        </section>

        {/* Erklärender Inhalt für Suchmaschinen, KI-Systeme und Screenreader –
            bewusst ohne Layout-Einfluss, damit die One-Screen-Optik bleibt. */}
        <section className="sr-only" aria-label={about.h2}>
          <h2>{about.h2}</h2>
          <p>{about.p}</p>
          <h3>{about.h3a}</h3>
          <p>{about.pa}</p>
          <h3>{about.h3b}</h3>
          <p>{about.pb}</p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
