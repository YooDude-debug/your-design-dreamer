/**
 * Rollentrennung (Anzeige) – Community / Creator / Unternehmer / Admin.
 *
 * Reine Darstellungshilfen. Die tatsächlichen Rollen stammen ausschliesslich
 * aus der bestehenden Rollenquelle `public.user_roles` (`has_role`); hier wird
 * nichts abgeleitet, ergänzt oder simuliert. Die SlangTag-Technologie ist
 * gemeinsam nutzbar, die Bezeichnungen bleiben aber getrennt:
 *
 * - nur `creator`            → „Creator“
 * - nur `business`           → „Unternehmer“
 * - `creator` + `business`   → beide Bezeichnungen (echte Mehrfachrolle)
 * - keine der beiden Rollen  → „Community“
 */

export type RoleFlags = { isCreator: boolean; isBusiness: boolean };

export type RoleScope = "community" | "creator" | "business" | "creator_business";

export function roleScope(flags: RoleFlags): RoleScope {
  if (flags.isCreator && flags.isBusiness) return "creator_business";
  if (flags.isCreator) return "creator";
  if (flags.isBusiness) return "business";
  return "community";
}

type Lang = "de" | "en" | "el";

const AREA = {
  de: {
    community: "Community",
    creator: "Creator",
    business: "Unternehmer",
    creator_business: "Creator / Unternehmer",
  },
  en: {
    community: "Community",
    creator: "Creator",
    business: "Business",
    creator_business: "Creator / Business",
  },
  el: {
    community: "Community",
    creator: "Creator",
    business: "Επιχείρηση",
    creator_business: "Creator / Επιχείρηση",
  },
} as const;

const TAGS = {
  de: {
    community: "SlangTags",
    creator: "Creator-SlangTags",
    business: "Unternehmer-SlangTags",
    creator_business: "Creator- / Unternehmer-SlangTags",
  },
  en: {
    community: "SlangTags",
    creator: "Creator SlangTags",
    business: "Business SlangTags",
    creator_business: "Creator / business SlangTags",
  },
  el: {
    community: "SlangTags",
    creator: "SlangTags creator",
    business: "SlangTags επιχείρησης",
    creator_business: "SlangTags creator / επιχείρησης",
  },
} as const;

const DROPS = {
  de: {
    community: "Drops",
    creator: "Creator Drops",
    business: "Unternehmer Drops",
    creator_business: "Creator- / Unternehmer-Drops",
  },
  en: {
    community: "Drops",
    creator: "Creator drops",
    business: "Business drops",
    creator_business: "Creator / business drops",
  },
  el: {
    community: "Drops",
    creator: "Drops creator",
    business: "Drops επιχείρησης",
    creator_business: "Drops creator / επιχείρησης",
  },
} as const;

function pick<T extends Record<Lang, Record<RoleScope, string>>>(
  table: T,
  flags: RoleFlags,
  lang: Lang = "de",
): string {
  const row = table[lang] ?? table.de;
  return row[roleScope(flags)];
}

/** Bereichsbezeichnung („Creator“, „Unternehmer“, …). */
export function roleAreaLabel(flags: RoleFlags, lang: Lang = "de"): string {
  return pick(AREA, flags, lang);
}

/** SlangTag-Bezeichnung passend zur echten Rolle. */
export function roleSlangTagLabel(flags: RoleFlags, lang: Lang = "de"): string {
  return pick(TAGS, flags, lang);
}

/** Drop-Bezeichnung passend zur echten Rolle. */
export function roleDropLabel(flags: RoleFlags, lang: Lang = "de"): string {
  return pick(DROPS, flags, lang);
}

/** Creator-only Funktionen (z. B. Creator-Abo) – nur mit echter Creator-Rolle. */
export function allowsCreatorOnly(flags: RoleFlags): boolean {
  return flags.isCreator;
}

/** Business-only Funktionen (z. B. Business Campaigns) – nur mit `business`. */
export function allowsBusinessOnly(flags: RoleFlags): boolean {
  return flags.isBusiness;
}
