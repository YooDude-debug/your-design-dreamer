/**
 * Gemeinsame Username-Hilfen (client- und serverseitig nutzbar).
 *
 * WICHTIG: Hier stehen bewusst KEINE Sperrlisten. Verbotene und reservierte
 * Usernames werden ausschliesslich zentral in der Datenbank verwaltet
 * (Tabelle `reserved_usernames`) und serverseitig geprueft.
 */

/** Bestehende Username-Regel: 3–24 Zeichen, Buchstaben, Zahlen, _ . - */
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

/** Normalisierung analog zur Datenbank: trim + NFKC + lowercase. */
export function normalizeUsername(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export type UsernameStatus = "invalid" | "reserved" | "taken" | "available";

/** Nutzertexte – ohne interne Begruendung oder Kategorie. */
export const USERNAME_STATUS_TEXT: Record<UsernameStatus, string> = {
  invalid: "Username entspricht nicht den erlaubten Regeln",
  reserved: "Dieser Username kann nicht verwendet werden",
  taken: "Username ist bereits vergeben",
  available: "Username ist verfügbar",
};

/**
 * Vorschlagskandidaten nah am Wunschnamen. Die Verfuegbarkeit wird
 * ausschliesslich serverseitig geprueft.
 */
export function suggestionCandidates(
  desired: string,
  opts: { firstName?: string; lastName?: string; year?: number } = {},
): string[] {
  const base = normalizeUsername(desired).replace(/[^a-z0-9_.-]/g, "").replace(/[_.-]+$/, "");
  if (base.length < 2) return [];
  const year = opts.year ?? new Date().getFullYear();
  const initials = [opts.firstName?.[0], opts.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  const raw = [
    `${base}${(year % 100).toString().padStart(2, "0")}`,
    initials ? `${base}_${initials}` : "",
    `${base}${year}`,
    `${base}_de`,
    `${base}_${Math.floor(Math.random() * 90 + 10)}`,
    `${base}_official_no`,
    `real_${base}`,
    `${base}_yd`,
    `${base}${Math.floor(Math.random() * 900 + 100)}`,
    `${base}_x`,
  ].filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of raw) {
    const v = c.slice(0, 24).replace(/[_.-]+$/, "");
    if (v === base || seen.has(v) || !USERNAME_RE.test(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
