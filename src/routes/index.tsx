import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import globe from "@/assets/globe.png";
import ydudeLogo from "@/assets/ydude-logo.png";
import { LanguageProvider, useLang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotifyForm } from "@/components/NotifyForm";
import { SiteFooter } from "@/components/SiteFooter";

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
      { property: "og:description", content: "Entdecke Slang. Fühl den Vibe. Kurze Sounds, große Wirkung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingWrapper,
});

function LandingWrapper() {
  return (
    <LanguageProvider>
      <Landing />
    </LanguageProvider>
  );
}

function Landing() {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1000px] px-4 py-6 lg:py-8">
        <div className="rounded-2xl border border-border bg-surface/40 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-5 md:px-6 py-5">
            <img src={ydudeLogo} alt="Y-Dude" className="h-10 md:h-12 w-auto" />
            <LanguageSwitcher />
          </header>

          {/* Hero */}
          <section className="relative px-5 md:px-6 pt-6 pb-12 text-center overflow-hidden">
            <img
              src={globe}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -left-24 top-16 h-[420px] w-[420px] opacity-60 blur-[0.3px]"
            />
            <h1 className="relative text-6xl md:text-7xl font-black tracking-tight leading-none">
              <span className="text-foreground">Y-</span>
              <span className="text-gradient-green drop-shadow-[0_0_30px_oklch(0.82_0.24_150/0.5)]">Dude</span>
            </h1>
            <p className="relative mt-5 text-xl md:text-2xl font-medium">
              {t.tagline_speak} <span className="text-gradient-green">{t.tagline_local}</span> {t.tagline_connect}{" "}
              <span className="text-gradient-cyan">{t.tagline_global}</span>
            </p>
            <p className="relative mt-8 text-lg text-muted-foreground leading-relaxed">
              {t.discover}
              <br />
              {t.feel}
            </p>
            <div className="relative mt-10 flex justify-center">
              <a
                href="#notify"
                className="group relative inline-flex items-center gap-3 rounded-full bg-gradient-brand px-10 py-4 text-lg font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
              >
                {t.enter}
                <ChevronRight className="h-5 w-5" />
              </a>
            </div>
          </section>

          <div className="divider-glow mx-6" />

          {/* Notify Me */}
          <section id="notify" className="px-5 md:px-6 py-10">
            <NotifyForm />
          </section>

          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
