import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";

const LABELS = {
  de: { imprint: "Impressum", privacy: "Datenschutzerklärung", terms: "AGB" },
  en: { imprint: "Imprint", privacy: "Privacy Policy", terms: "Terms" },
  el: { imprint: "Νομικές πληροφορίες", privacy: "Πολιτική απορρήτου", terms: "Όροι" },
} as const;

export function SiteFooter() {
  const { lang, t } = useLang();
  const l = LABELS[lang as keyof typeof LABELS] ?? LABELS.en;

  return (
    <footer className="border-t border-border px-6 py-8 text-center">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
        <Link to="/impressum" className="text-muted-foreground hover:text-brand transition-colors">
          {l.imprint}
        </Link>
        <Link
          to="/datenschutz"
          className="text-muted-foreground hover:text-brand transition-colors"
        >
          {l.privacy}
        </Link>
        <Link to="/agb" className="text-muted-foreground hover:text-brand transition-colors">
          {l.terms}
        </Link>
      </nav>
      <p className="mt-4 text-xs text-muted-foreground">© 2025 Y-Dude. {t.rights}</p>
    </footer>
  );
}
