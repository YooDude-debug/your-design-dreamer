/**
 * SEC-01: A storage path in the shared `media` bucket belongs to a user only
 * when its first segment is that user's id (`<userId>/<folder>/<file>`).
 * Privileged signed links may only be created for paths owned by an allowed
 * owner; anything else (foreign, malformed, traversal) is refused.
 */
export function isPathOwnedBy(path: unknown, ownerIds: ReadonlyArray<string | null | undefined>): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 1024) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("//")) return false;
  const segments = path.split("/");
  if (segments.length < 2) return false;
  if (segments.some((s) => s === "" || s === "." || s === "..")) return false;
  const owner = segments[0];
  return ownerIds.some((id) => typeof id === "string" && id.length > 0 && id === owner);
}
