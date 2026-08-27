/**
 * Hilfsfunktionen der Like-Liste.
 *
 * Liegt außerhalb von `post-likes.functions.ts`, weil Dateien mit
 * `createServerFn` beim Build aufgeteilt werden und Laufzeit-Geschwister im
 * Modulkopf dabei entfernt werden.
 */

/** Ma***** – erste zwei Zeichen bleiben sichtbar, kurze Namen ohne Sterne. */
export function maskName(name: string): string {
  const head = name.slice(0, 2);
  const stars = Math.max(0, name.length - 3);
  return head + "*".repeat(stars);
}
