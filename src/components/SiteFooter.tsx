import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";

const LABELS = {
  de: {
    imprint: "Impressum",
    privacy: "Datenschutzerklärung",
    terms: "AGB",
    guidelines: "Community-Richtlinien",
    transparencyReport: "Transparenzbericht",
  },
  en: {
    imprint: "Imprint",
    privacy: "Privacy Policy",
    terms: "Terms",
    guidelines: "Community Guidelines",
    transparencyReport: "Transparency report",
  },
  el: {
    imprint: "Νομικές πληροφορίες",
    privacy: "Πολιτική απορρήτου",
    terms: "Όροι",
    guidelines: "Κανόνες κοινότητας",
    transparencyReport: "Έκθεση διαφάνειας",
  },
} as const;

export function SiteFooter() {
  const { lang, t } = useLang();
  const l = LABELS[lang as keyof typeof LABELS] ?? LABELS.en;

  return (
    <footer className="shrink-0 border-t border-border px-6 py-5 text-center sm:py-6 lg:py-4">
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
        <Link
          to="/richtlinien"
          className="text-muted-foreground hover:text-brand transition-colors"
        >
          {l.guidelines}
        </Link>
        <Link
          to="/transparenz"
          className="text-muted-foreground hover:text-brand transition-colors"
        >
          {l.transparencyReport}
        </Link>
      </nav>
      <p className="mt-3 text-xs text-muted-foreground sm:mt-4 lg:mt-3">
        © 2026 Y-Dude. {t.rights}
      </p>
    </footer>
  );
}
