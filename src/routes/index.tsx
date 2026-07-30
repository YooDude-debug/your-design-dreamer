import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, LogIn } from "lucide-react";
import globe from "@/assets/globe.png";
import ydudeLogo from "@/assets/ydude-wordmark.png";
import { useLang } from "@/lib/i18n";
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
  component: Landing,
});

const LOGIN_LABELS = { de: "Login", en: "Login", el: "Σύνδεση" } as const;

function Landing() {
  const { t, lang } = useLang();


  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1000px] px-4 py-6 lg:py-8">
        <div className="rounded-2xl border border-border bg-surface/40 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between gap-3 px-5 md:px-6 py-5">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
            >
              <LogIn className="h-4 w-4" />
              {LOGIN_LABELS[lang as keyof typeof LOGIN_LABELS] ?? LOGIN_LABELS.en}
            </Link>
            <LanguageSwitcher />
          </header>

          {/* Hero */}
          <section className="relative px-5 md:px-6 pt-2 pb-12 text-center overflow-hidden">
            <img
              src={globe}
              alt=""
              aria-hidden
              className="pointer-events-none absolute -left-28 top-40 h-[380px] w-[380px] md:h-[460px] md:w-[460px] opacity-60 blur-[0.3px]"
            />
            <h1 className="relative flex justify-center">
              <img
                src={ydudeLogo}
                alt="Y-Dude — Speak Local. Connect Global."
                className="w-full max-w-[640px] h-auto drop-shadow-[0_0_45px_oklch(0.82_0.24_150/0.35)]"
              />
            </h1>
            <p className="relative mt-6 text-2xl md:text-4xl font-bold leading-tight">
              {t.tagline_speak} <span className="text-gradient-green">{t.tagline_local}</span>
              <br className="hidden sm:block" /> {t.tagline_connect}{" "}
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
                className="group relative inline-flex items-center gap-3 rounded-full bg-gradient-brand px-10 py-4 text-lg font-semibold text-primary-foreground shadow-glow-strong transition-transform hover:scale-[1.03]"
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
