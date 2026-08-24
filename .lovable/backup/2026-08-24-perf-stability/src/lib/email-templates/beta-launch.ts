import { BetaLaunchEmail } from "./beta-launch-email";
import { BETA_LAUNCH_COPY, type Lang } from "./beta-launch-copy";
import type { TemplateEntry } from "./registry";

export const template = {
  component: BetaLaunchEmail,
  subject: (data: Record<string, unknown>) => {
    const candidate = data?.language as Lang | undefined;
    const lang: Lang = candidate && BETA_LAUNCH_COPY[candidate] ? candidate : "de";
    return {
      de: "Y-Dude Open Beta ist gestartet — jetzt Account erstellen",
      en: "Y-Dude open beta is live — create your account",
      el: "Το Y-Dude open beta ξεκίνησε — δημιούργησε λογαριασμό",
    }[lang];
  },
  displayName: "Open-Beta-Start",
  previewData: {
    registerUrl: "https://y-dude.com/auth?mode=register",
    language: "de",
  },
} satisfies TemplateEntry;
