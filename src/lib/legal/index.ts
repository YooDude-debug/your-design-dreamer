export { PRIVACY_DOC } from "./privacy";
export { TERMS_DOC } from "./terms";
export { GUIDELINES_DOC } from "./guidelines";
export type { LegalDoc, LegalDocSection } from "./types";
export { LEGAL_DATE, LEGAL_NOTICE, REVIEW_LAWYER, REVIEW_TECH } from "./types";

import { PRIVACY_DOC } from "./privacy";
import { TERMS_DOC } from "./terms";
import { GUIDELINES_DOC } from "./guidelines";
import type { LegalDoc } from "./types";

export const LEGAL_DOCS: LegalDoc[] = [PRIVACY_DOC, TERMS_DOC, GUIDELINES_DOC];
