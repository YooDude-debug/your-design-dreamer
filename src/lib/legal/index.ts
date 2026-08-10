export type { LegalDoc, LegalDocSection } from "./types";
export { LEGAL_DATE, LEGAL_NOTICE, REVIEW_LAWYER, REVIEW_TECH } from "./types";

import { PRIVACY_DOC } from "./privacy";
import { PRIVACY_DOC_EN } from "./privacy.en";
import { PRIVACY_DOC_EL } from "./privacy.el";
import { TERMS_DOC } from "./terms";
import { TERMS_DOC_EN } from "./terms.en";
import { TERMS_DOC_EL } from "./terms.el";
import { GUIDELINES_DOC } from "./guidelines";
import { GUIDELINES_DOC_EN } from "./guidelines.en";
import { GUIDELINES_DOC_EL } from "./guidelines.el";
import type { Lang } from "@/lib/i18n-dict";
import type { LegalDoc } from "./types";

export { PRIVACY_DOC, PRIVACY_DOC_EN, PRIVACY_DOC_EL };
export { TERMS_DOC, TERMS_DOC_EN, TERMS_DOC_EL };
export { GUIDELINES_DOC, GUIDELINES_DOC_EN, GUIDELINES_DOC_EL };

/** Sprachabhängige Zuordnung der Dokumente – Deutsch bleibt die rechtlich verbindliche Referenz. */
export const PRIVACY_DOCS: Record<Lang, LegalDoc> = {
  de: PRIVACY_DOC,
  en: PRIVACY_DOC_EN,
  el: PRIVACY_DOC_EL,
};

export const TERMS_DOCS: Record<Lang, LegalDoc> = {
  de: TERMS_DOC,
  en: TERMS_DOC_EN,
  el: TERMS_DOC_EL,
};

export const GUIDELINES_DOCS: Record<Lang, LegalDoc> = {
  de: GUIDELINES_DOC,
  en: GUIDELINES_DOC_EN,
  el: GUIDELINES_DOC_EL,
};

export const LEGAL_DOCS: LegalDoc[] = [PRIVACY_DOC, TERMS_DOC, GUIDELINES_DOC];
