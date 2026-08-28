/**
 * Beitrags-Caption: Titel und Beschreibung sauber trennen.
 *
 * Ursache des Doppel-Bugs: Beim Erstellen wird der Titel aus den ersten 40
 * Zeichen der Beschreibung abgeleitet, wenn kein SlangTag vorhanden ist.
 * Dadurch stand derselbe Text zweimal im Beitrag – oben als Titel (ohne
 * Hashtag-Farbe) und darunter als Beschreibung (mit Hashtag-Farbe).
 *
 * `isRedundantTitle` erkennt genau diesen Fall, damit die Anzeige nur eine
 * Caption rendert. Die farbige Hashtag-Darstellung bleibt unverändert, weil
 * sie aus der Beschreibung kommt.
 */

const normalize = (value: string) =>
  value
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[…]+$/u, "")
    .replace(/\.{3,}$/u, "")
    .trim()
    .toLocaleLowerCase();

export function isRedundantTitle(
  title: string | null | undefined,
  description: string | null | undefined,
): boolean {
  const t = normalize(title ?? "");
  const d = normalize(description ?? "");
  if (!t || !d) return false;
  // Titel ist identisch oder nur ein abgeschnittener Anfang der Beschreibung.
  return d === t || d.startsWith(t);
}
