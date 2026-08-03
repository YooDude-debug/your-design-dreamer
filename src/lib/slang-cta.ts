import type { SlangTagCtaType } from "@/lib/types";

/** Beschriftung der Call-to-Action-Buttons. */
const CTA_LABEL: Record<SlangTagCtaType, string> = {
  website: "Webseite besuchen",
  offer: "Angebot ansehen",
  booking: "Jetzt buchen",
  info: "Mehr erfahren",
  route: "Route öffnen",
};

export function ctaLabel(type: SlangTagCtaType | null): string {
  return type ? CTA_LABEL[type] : CTA_LABEL.info;
}
