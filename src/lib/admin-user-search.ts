/**
 * SEC-02: Builds the admin user-search OR filter so the search text is always
 * a literal value and can never add operators or conditions to the query.
 * - LIKE wildcards (\ % _) in the text are escaped → matched literally.
 * - The value is wrapped in double quotes (with " and \ escaped), so commas,
 *   dots, parentheses and colons stay part of the search text.
 */
export const ADMIN_USER_SEARCH_MAX = 100;

export function normalizeAdminSearch(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Control characters are never part of a name or e-mail address.
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, ADMIN_USER_SEARCH_MAX);
}

function quoteLiteral(term: string): string {
  const like = term.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = like.replace(/[\\"]/g, (c) => `\\${c}`);
  return `"%${quoted}%"`;
}

/** Returns the `.or()` filter, or null when there is nothing to search for. */
export function buildAdminUserSearchFilter(raw: unknown): string | null {
  const term = normalizeAdminSearch(raw);
  if (!term) return null;
  const v = quoteLiteral(term);
  return `username.ilike.${v},display_name.ilike.${v}`;
}
