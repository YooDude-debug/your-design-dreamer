import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, AudioLines, Globe, Lock, Mic, Shield, TrendingUp, Users } from "lucide-react";
import { HeroGlobe } from "@/components/HeroGlobe";
import ydudeLogo from "@/assets/ydude-wordmark-lockup.png";
import ydudeLogoInline from "@/assets/ydude-lockup-inline.png";
import { useLang } from "@/lib/lang-context";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { SlangChallenge } from "@/components/landing/SlangChallenge";
import { useRedirectWhenSignedIn } from "@/lib/use-session";
import { authTexts } from "@/lib/i18n-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Y-Dude — Speak Local. Connect Global." },
      {
        name: "description",
        content:
          "Y-Dude: Entdecke Slang, fühl den Vibe. Kurze Audio-SlangTags verbinden lokale Stimmen mit der Welt.",
      },
      { property: "og:title", content: "Y-Dude — Speak Local. Connect Global." },
      {
        property: "og:description",
        content: "Entdecke Slang. Fühl den Vibe. Kurze Sounds, große Wirkung.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const CARD_ICONS = [AudioLines, Mic, Globe, TrendingUp];
const TRUST_ICONS = [Shield, Lock, Users, Globe];

function Landing() {
  const { lang } = useLang();
  const c = authTexts[lang].landing;
  // Landingpage ist nur für nicht angemeldete Besucher.
  useRedirectWhenSignedIn("/dev");

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
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

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground lg:flex">
          <a href="#features" className="transition-colors hover:text-brand">
            {c.navFeatures}
          </a>
          <a href="#features" className="transition-colors hover:text-brand">
            {c.navCommunity}
          </a>
          <a href="#trust" className="transition-colors hover:text-brand">
            {c.navAbout}
          </a>
          <a href="#trust" className="transition-colors hover:text-brand">
            {c.navContact}
          </a>
        </nav>

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

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-6 text-center sm:px-6 sm:pt-10">
        <div className="mx-auto max-w-[1180px]">
          <h1 className="flex justify-center">
            <img
              src={ydudeLogo}
              alt="Y-Dude — Speak Local. Connect Global."
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="w-full max-w-[560px] drop-shadow-[0_0_28px_oklch(0.82_0.24_150/0.16)] sm:max-w-[720px]"
            />
          </h1>

          <p className="mx-auto mt-8 max-w-[620px] text-lg leading-relaxed sm:mt-10 sm:text-2xl">
            {c.lead1}
            <br className="hidden sm:block" />
            <span className="sm:mt-2 sm:inline-block">
              {c.lead2a} <span className="text-brand">{c.lead2b}</span>
            </span>
          </p>

          <div className="mt-9 flex flex-col items-center gap-5 sm:mt-11">
            <Link
              to="/auth"
              search={{ mode: "register" }}
              className="group inline-flex w-full max-w-[500px] items-center gap-4 rounded-full bg-gradient-brand px-4 py-3 text-primary-foreground shadow-[0_0_28px_oklch(0.82_0.24_150/0.25)_0_0_10px_oklch(0.78_0.16_210/0.20)] transition-transform hover:scale-[1.02] sm:px-6 sm:py-4"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background/85 sm:h-14 sm:w-14">
                <AudioLines className="h-5 w-5 text-brand sm:h-7 sm:w-7" />
              </span>
              <span className="min-w-0 flex-1 text-center">
                <span className="block truncate text-lg font-bold sm:text-2xl">{c.cta}</span>
                <span className="block truncate text-xs opacity-80 sm:text-sm">{c.ctaSub}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1 sm:h-6 sm:w-6" />
            </Link>

            <p className="inline-flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <Lock className="h-4 w-4 shrink-0 text-brand" />
              <span>
                <span className="text-brand">{c.hintA}</span> {c.hintB}
              </span>
            </p>
          </div>
        </div>

      </section>

      {/* The Slang Challenge – Einstieg für neue Besucher (mobil sofort sichtbar) */}
      <SlangChallenge />

      {/* Globe */}
      <HeroGlobe />



      {/* Karten */}
      <section id="features" className="px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="text-center text-2xl font-bold sm:text-4xl">
            {c.whyA} <span className="text-brand">{c.whyB}</span>
          </h2>
          <div className="mx-auto mt-3 h-[3px] w-14 rounded-full bg-gradient-brand" />

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.cards.map((card, i) => {
              const Icon = CARD_ICONS[i];
              return (
                <article
                  key={card.title}
                  className="flex h-full flex-col items-center rounded-2xl border border-border bg-surface/40 px-6 py-8 text-center shadow-[0_12px_22px_-16px_oklch(0.82_0.24_150/0.16)] transition-colors hover:border-brand/40"
                >
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-brand/50">
                    <Icon className="h-6 w-6 text-brand" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{card.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{card.desc}</p>
                </article>
              );
            })}
          </div>

          {/* Trust-Leiste */}
          <div
            id="trust"
            className="mt-6 grid grid-cols-1 gap-y-6 rounded-2xl border border-border bg-surface/40 px-6 py-6 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-4 lg:divide-x lg:divide-border"
          >
            {c.trust.map((item, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <div key={item.title} className="flex min-w-0 items-start gap-3 lg:px-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/50">
                    <Icon className="h-4 w-4 text-brand" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
