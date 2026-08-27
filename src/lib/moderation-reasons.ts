/**
 * Strukturierte Moderationsgründe und Maßnahmenarten (DSA Art. 17).
 *
 * Browser-sicher: wird sowohl im Admin-Cockpit (Auswahl) als auch in der
 * Nutzeransicht (verständliche Erklärung) verwendet. Die Codes entsprechen
 * dem Y-Dude-Regelwerk (Community-Richtlinien und AGB) und den unzulässigen
 * Angeboten im Market.
 *
 * Grundsatz: Der Nutzer erfährt die Kategorie und die getroffene Maßnahme,
 * aber keine internen Erkennungs- oder Sicherheitsdetails.
 */

export const MODERATION_REASON_CODES = [
  "rule_violation",
  "illegal_content",
  "spam",
  "fraud",
  "harassment",
  "prohibited_market_item",
  "other",
] as const;

export type ModerationReasonCode = (typeof MODERATION_REASON_CODES)[number];

export const MODERATION_ACTION_KINDS = [
  "content_removed",
  "content_hidden",
  "slang_tag_hidden",
  "market_item_removed",
  "user_warned",
  "user_banned",
  "no_action",
] as const;

export type ModerationActionKind = (typeof MODERATION_ACTION_KINDS)[number];

export type Lang = "de" | "en" | "el";

type Text3 = Record<Lang, string>;

export const REASON_LABELS: Record<ModerationReasonCode, Text3> = {
  rule_violation: {
    de: "Verstoß gegen die Community-Richtlinien",
    en: "Breach of the community guidelines",
    el: "Παράβαση των κανόνων της κοινότητας",
  },
  illegal_content: {
    de: "Rechtswidriger Inhalt",
    en: "Illegal content",
    el: "Παράνομο περιεχόμενο",
  },
  spam: {
    de: "Spam oder Massenwerbung",
    en: "Spam or bulk advertising",
    el: "Ανεπιθύμητο περιεχόμενο",
  },
  fraud: { de: "Betrug oder Täuschung", en: "Fraud or deception", el: "Απάτη ή εξαπάτηση" },
  harassment: {
    de: "Belästigung oder Angriff auf Personen",
    en: "Harassment or attacks on people",
    el: "Παρενόχληση ή επίθεση σε πρόσωπα",
  },
  prohibited_market_item: {
    de: "Unzulässiges Angebot im Y-Dude Market",
    en: "Prohibited listing in Y-Dude Market",
    el: "Μη επιτρεπτή αγγελία στο Y-Dude Market",
  },
  other: { de: "Sonstiger Verstoß", en: "Other breach", el: "Άλλη παράβαση" },
};

export const ACTION_LABELS: Record<ModerationActionKind, Text3> = {
  content_removed: {
    de: "Inhalt entfernt",
    en: "Content removed",
    el: "Το περιεχόμενο αφαιρέθηκε",
  },
  content_hidden: {
    de: "Inhalt nicht mehr öffentlich sichtbar",
    en: "Content no longer publicly visible",
    el: "Το περιεχόμενο δεν είναι πλέον δημόσια ορατό",
  },
  slang_tag_hidden: {
    de: "SlangTag ausgeblendet",
    en: "SlangTag hidden",
    el: "Το SlangTag αποκρύφθηκε",
  },
  market_item_removed: {
    de: "Angebot im Market entfernt",
    en: "Market listing removed",
    el: "Η αγγελία αφαιρέθηκε",
  },
  user_warned: { de: "Verwarnung", en: "Warning", el: "Προειδοποίηση" },
  user_banned: { de: "Konto gesperrt", en: "Account suspended", el: "Ο λογαριασμός ανεστάλη" },
  no_action: {
    de: "Keine Maßnahme – Meldung geprüft",
    en: "No action – report reviewed",
    el: "Καμία ενέργεια – η αναφορά εξετάστηκε",
  },
};

export const APPEAL_STATUS_LABELS: Record<string, Text3> = {
  submitted: { de: "Eingegangen", en: "Submitted", el: "Υποβλήθηκε" },
  in_review: { de: "In Prüfung", en: "In review", el: "Σε εξέταση" },
  upheld: {
    de: "Entscheidung bestätigt",
    en: "Decision upheld",
    el: "Η απόφαση επιβεβαιώθηκε",
  },
  overturned: {
    de: "Entscheidung aufgehoben",
    en: "Decision overturned",
    el: "Η απόφαση ανατράπηκε",
  },
  rejected: {
    de: "Einspruch abgelehnt",
    en: "Appeal rejected",
    el: "Η προσφυγή απορρίφθηκε",
  },
};

/** Frist, innerhalb derer Einspruch eingelegt werden kann. */
export const APPEAL_WINDOW_DAYS = 180;

export function reasonLabel(code: string, lang: Lang = "de"): string {
  const entry = REASON_LABELS[code as ModerationReasonCode];
  return entry ? entry[lang] : REASON_LABELS.other[lang];
}

export function actionLabel(kind: string, lang: Lang = "de"): string {
  const entry = ACTION_LABELS[kind as ModerationActionKind];
  return entry ? entry[lang] : kind;
}

export function appealStatusLabel(status: string, lang: Lang = "de"): string {
  return APPEAL_STATUS_LABELS[status]?.[lang] ?? status;
}

/**
 * Verständliche Standardbegründung für den betroffenen Nutzer.
 * Enthält bewusst keine internen Erkennungsdetails.
 */
export function defaultPublicReason(
  kind: ModerationActionKind,
  code: ModerationReasonCode,
  lang: Lang = "de",
): string {
  const action = actionLabel(kind, lang);
  const reason = reasonLabel(code, lang);
  if (lang === "en") {
    return `${action}. Reason: ${reason}. You can appeal this decision within ${APPEAL_WINDOW_DAYS} days.`;
  }
  if (lang === "el") {
    return `${action}. Αιτία: ${reason}. Μπορείτε να υποβάλετε προσφυγή εντός ${APPEAL_WINDOW_DAYS} ημερών.`;
  }
  return `${action}. Grund: ${reason}. Du kannst dieser Entscheidung innerhalb von ${APPEAL_WINDOW_DAYS} Tagen widersprechen.`;
}
