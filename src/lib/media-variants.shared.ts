/**
 * Konstanten und Pfadprüfung des Varianten-Backstops.
 *
 * Liegt außerhalb von `media-variants.functions.ts`, weil Dateien mit
 * `createServerFn` beim Build aufgeteilt werden und Laufzeit-Geschwister im
 * Modulkopf dabei entfernt werden.
 */

export const MAX_VARIANT_ATTEMPTS = 3;

export function isOwnedPath(path: string, userId: string) {
  return path.startsWith(`${userId}/`) && !path.includes("..");
}
