import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import ydudeLogo from "@/assets/ydude-logo.png";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

/** Gemeinsames Layout für Impressum, AGB und Datenschutzerklärung. */
export function LegalPage({
  title,
  intro,
  sections,
  footer,
}: {
  title: string;
  intro?: string;
  sections: LegalSection[];
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[820px] px-3 py-6 sm:px-4 sm:py-8">
        <div className="rounded-2xl border border-border bg-surface/40 p-5 sm:p-6 md:p-10">
          <div className="flex items-center justify-between gap-3">
            <img
              src={ydudeLogo}
              alt="Y-Dude"
              loading="eager"
              decoding="async"
              className="h-8 w-auto sm:h-10"
            />
            <Link
              to="/"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-brand sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Zurück
            </Link>
          </div>

          <h1 className="mt-7 text-2xl font-black tracking-tight sm:text-3xl">
            <span className="text-gradient-green">{title}</span>
          </h1>
          {intro && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{intro}</p>}

          <div className="mt-7 space-y-7 text-sm leading-relaxed text-muted-foreground">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
                {s.paragraphs?.map((p) => (
                  <p key={p} className="mt-2">
                    {p}
                  </p>
                ))}
                {s.bullets && (
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {s.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {footer}

          <nav className="mt-9 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-xs">
            <Link to="/impressum" className="text-muted-foreground hover:text-brand">
              Impressum
            </Link>
            <Link to="/datenschutz" className="text-muted-foreground hover:text-brand">
              Datenschutzerklärung
            </Link>
            <Link to="/agb" className="text-muted-foreground hover:text-brand">
              AGB
            </Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
