/**
 * Dezenter PWA-Installationshinweis für die Landingpage.
 *
 * Nutzt den nativen Chrome/Android/Desktop-Prompt (`beforeinstallprompt`),
 * wenn er verfügbar ist. Auf iOS wird ein kurzer Hinweis zum manuellen
 * Hinzufügen angezeigt. Läuft die App bereits installiert (standalone),
 * wird nichts angezeigt.
 */

import { Download, Share } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { usePwaInstall } from "@/lib/use-pwa-install";

const TEXTS = {
  de: {
    hint: "Y-Dude auch als App nutzen",
    ios: "Zum Startbildschirm hinzufügen",
    install: "App installieren",
  },
  en: {
    hint: "Use Y-Dude as an app",
    ios: "Add to Home Screen",
    install: "Install app",
  },
  el: {
    hint: "Χρήση Y-Dude ως εφαρμογή",
    ios: "Προσθήκη στην αρχική οθόνη",
    install: "Εγκατάσταση εφαρμογής",
  },
} as const;

export function InstallAppButton() {
  const { lang } = useLang();
  const t = TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.en;
  const { canPrompt, installed, device, promptInstall } = usePwaInstall();

  if (installed) return null;

  const isIos = device === "ios";
  const label = isIos ? `${t.hint} · ${t.ios}` : t.hint;
  const Icon = isIos ? Share : Download;

  const inner = (
    <span className="inline-flex items-center gap-1.5 text-[10px] leading-snug text-muted-foreground sm:text-xs">
      <Icon className="h-3 w-3 shrink-0 text-brand" aria-hidden="true" />
      {label}
    </span>
  );

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={() => {
          void promptInstall();
        }}
        className="group inline-flex items-center transition-colors hover:text-brand"
        aria-label={t.install}
      >
        {inner}
      </button>
    );
  }

  return <span className="inline-flex items-center">{inner}</span>;
}
