/**
 * Dezenter PWA-Installationshinweis für die Landingpage.
 *
 * Nutzt den nativen Chrome/Android-Prompt (`beforeinstallprompt`). Auf iOS
 * gibt es diesen Prompt nicht – dort wird stattdessen der kurze
 * "Teilen → Zum Home-Bildschirm"-Hinweis eingeblendet. Läuft die App bereits
 * installiert (standalone), wird nichts angezeigt.
 */

import { Download, Share } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { usePwaInstall } from "@/lib/use-pwa-install";

const TEXTS = {
  de: {
    install: "App installieren",
    ios: "Installieren: Teilen-Symbol → „Zum Home-Bildschirm“",
  },
  en: {
    install: "Install app",
    ios: "Install: share icon → “Add to Home Screen”",
  },
  el: {
    install: "Εγκατάσταση εφαρμογής",
    ios: "Εγκατάσταση: κοινοποίηση → «Προσθήκη στην αρχική οθόνη»",
  },
} as const;

export function InstallAppButton() {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.en;
  const { canPrompt, installed, device, promptInstall } = usePwaInstall();

  if (installed) return null;

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={() => {
          void promptInstall();
        }}
        className="inline-flex items-center gap-2 rounded-full border border-brand/60 px-4 py-1.5 text-xs font-semibold text-brand transition-all hover:bg-brand/10 hover:shadow-glow-subtle active:shadow-glow-active sm:text-sm"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {t.install}
      </button>
    );
  }

  if (device === "ios") {
    return (
      <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
        <Share className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
        {t.ios}
      </p>
    );
  }

  return null;
}
