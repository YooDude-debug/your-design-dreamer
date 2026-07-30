import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";

const LABELS = {
  de: { imprint: "Impressum", privacy: "Datenschutzerklärung", admin: "Admin" },
  en: { imprint: "Imprint", privacy: "Privacy Policy", admin: "Admin" },
  el: { imprint: "Νομικές πληροφορίες", privacy: "Πολιτική απορρήτου", admin: "Admin" },
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
        <Link to="/datenschutz" className="text-muted-foreground hover:text-brand transition-colors">
          {l.privacy}
        </Link>
        <Link to="/auth" className="text-muted-foreground/60 hover:text-brand transition-colors">
          {l.admin}
        </Link>
      </nav>
      <p className="mt-4 text-xs text-muted-foreground">© 2025 Y-Dude. {t.rights}</p>
    </footer>
  );
}
