import { NewsletterConfirmEmail } from "./newsletter-confirm-email";
import { COPY, type Lang } from "./newsletter-confirm-copy";
import type { TemplateEntry } from "./registry";

export const template = {
  component: NewsletterConfirmEmail,
  subject: (data: Record<string, unknown>) => {
    const candidate = data?.language as Lang | undefined;
    const lang: Lang = candidate && COPY[candidate] ? candidate : "de";
    return {
      de: "Bitte bestätige deine E-Mail-Adresse – Y-Dude",
      en: "Please confirm your email address – Y-Dude",
      el: "Επιβεβαίωσε το email σου – Y-Dude",
    }[lang];
  },
  displayName: "Newsletter Double-Opt-in",
  previewData: {
    confirmUrl: "https://y-dude.com/newsletter/confirm?token=demo-token",
    language: "de",
  },
} satisfies TemplateEntry;
