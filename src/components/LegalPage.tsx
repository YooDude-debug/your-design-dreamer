import { BackButton } from "@/components/ui/nav-buttons";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useLang } from "@/lib/lang-context";
import { LEGAL_UI_TEXTS } from "@/lib/legal/ui-texts";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

/** Schlichtes, seriöses Layout für Impressum, AGB, Datenschutz und Richtlinien. */
export function LegalPage({
  title,
  version,
  date,
  notice,
  intro,
  sections,
  footer,
}: {
  title: string;
  version?: string;
  date?: string;
  notice?: string;
  intro?: string;
  sections: LegalSection[];
  footer?: ReactNode;
}) {
  const { lang } = useLang();
  const u = LEGAL_UI_TEXTS[lang];
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-[760px] items-center px-4 py-4 sm:px-6">
          <BackButton to="/" label={u.backToHome} />
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {(version || date) && (
          <p className="mt-2 text-xs text-muted-foreground">
            {version && (
              <>
                {u.version} {version}
              </>
            )}
            {version && date && " · "}
            {date && (
              <>
                {u.status}: {date}
              </>
            )}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-5 text-muted-foreground">
            {notice}
          </p>
        )}
        {intro && <p className="mt-4 text-[15px] leading-7 text-muted-foreground">{intro}</p>}

        <div className="mt-8 space-y-8">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-base font-semibold sm:text-lg">{s.title}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 text-[15px] leading-7 text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-muted-foreground">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {footer && <div className="mt-8 text-[15px] leading-7 text-muted-foreground">{footer}</div>}

        <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <Link to="/impressum" className="text-muted-foreground hover:text-brand">
            {u.navImpressum}
          </Link>
          <Link to="/datenschutz" className="text-muted-foreground hover:text-brand">
            {u.navDatenschutz}
          </Link>
          <Link to="/agb" className="text-muted-foreground hover:text-brand">
            {u.navAgb}
          </Link>
          <Link to="/richtlinien" className="text-muted-foreground hover:text-brand">
            {u.navRichtlinien}
          </Link>
        </nav>
      </main>
    </div>
  );
}
