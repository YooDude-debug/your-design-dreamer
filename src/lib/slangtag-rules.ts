/**
 * Einheitliche SlangTag-Regeln (Schreibweise, Länge, Eindeutigkeit, Typen).
 *
 * Bewusst UI-frei und modular, damit spätere Freischaltmethoden
 * (Challenge, Event, Premium, Creator Drops) hier ergänzt werden können,
 * ohne bestehende Komponenten anzufassen.
 */

import type { SlangTag, SlangTagKind } from "@/lib/types";

export const SLANGTAG_MIN_LENGTH = 2;
export const SLANGTAG_MAX_LENGTH = 32;

/** Alles, was niemals in einem SlangTag stehen darf. */
const FORBIDDEN_CHARS = /[\s\u200b-\u200f\u2028\u2029$#@/\\<>,;:!?"'`^%&*()[\]{}|~+=]/u;
const WHITESPACE = /[\s\u200b-\u200f\u2028\u2029]+/gu;

export type SlangTagNameError = "empty" | "space" | "short" | "long" | "chars" | "duplicate";

export type SlangTagNameCheck = {
  ok: boolean;
  /** Bereinigter Wert (ohne führende $ / $$ und ohne Leerzeichen). */
  value: string;
  error?: SlangTagNameError;
};

/** Entfernt Präfix und alle Leerzeichen – für Live-Eingabe. */
export function sanitizeSlangTagName(raw: string): string {
  return raw
    .replace(/^\$\$?/, "")
    .replace(WHITESPACE, "")
    .slice(0, SLANGTAG_MAX_LENGTH);
}

/** Prüft einen Rohwert. `hadSpace` wird als eigener Fehler gemeldet. */
export function checkSlangTagName(raw: string, existing: SlangTag[] = []): SlangTagNameCheck {
  const stripped = raw.replace(/^\$\$?/, "");
  const hadSpace = WHITESPACE.test(stripped);
  WHITESPACE.lastIndex = 0;
  const value = sanitizeSlangTagName(raw);

  if (!value) return { ok: false, value, error: hadSpace ? "space" : "empty" };
  if (hadSpace) return { ok: false, value, error: "space" };
  if (value.length < SLANGTAG_MIN_LENGTH) return { ok: false, value, error: "short" };
  if (value.length > SLANGTAG_MAX_LENGTH) return { ok: false, value, error: "long" };
  if (FORBIDDEN_CHARS.test(value)) return { ok: false, value, error: "chars" };
  if (existing.some((t) => t.name.toLowerCase() === value.toLowerCase()))
    return { ok: false, value, error: "duplicate" };

  return { ok: true, value };
}

/** Kennzeichnung: Community `$`, Creator/Unternehmen `$$`. */
export function slangTagPrefix(kind: SlangTagKind): "$" | "$$" {
  return kind === "creator" ? "$$" : "$";
}

/**
 * Leitet aus der Roh-Eingabe den SlangTag-Typ ab: `$$Name` bedeutet
 * Unternehmer-/Creator-SlangTag, alles andere Community. Wird für die
 * Live-Umschaltung des Editors verwendet.
 */
export function detectSlangTagKind(raw: string): SlangTagKind {
  return raw.trimStart().startsWith("$$") ? "creator" : "community";
}


/** Vollständige Anzeige, z. B. `$Digga` oder `$$Y-Dude`. */
export function slangTagLabel(tag: Pick<SlangTag, "kind" | "name">): string {
  return `${slangTagPrefix(tag.kind)}${tag.name}`;
}
