/**
 * Schutz strukturierter Textbestandteile bei Übersetzungen.
 *
 * Hashtags (#tag), SlangTags ($tag / $$tag), @Mentions und URLs sind
 * eigenständige Inhalte und dürfen NIE übersetzt werden. Der KI-Prompt weist
 * das bereits an – hier kommt die deterministische Absicherung dazu:
 *
 *  - `maskProtectedTokens` ersetzt die Tokens vor dem KI-Aufruf durch
 *    neutrale Platzhalter,
 *  - `unmaskProtectedTokens` setzt exakt die Originale wieder ein,
 *  - `enforceProtectedTokens` ist das Sicherheitsnetz auf der Anzeigeseite:
 *    weicht die Übersetzung bei den Tokens ab, werden die Originale
 *    wiederhergestellt (bzw. das Original insgesamt gezeigt).
 */

/** Reihenfolge wichtig: längere Muster ($$, https) zuerst. */
const TOKEN_RE =
  /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\$\$[\p{L}\p{N}_-]+|\$[\p{L}\p{N}_-]+|#[\p{L}\p{N}_-]+|@[\p{L}\p{N}_.]+)/gu;

const PLACEHOLDER_RE = /\u27e6(\d+)\u27e7/g;

function placeholder(index: number) {
  return `\u27e6${index}\u27e7`;
}

/** Alle geschützten Tokens eines Textes in Reihenfolge. */
export function extractProtectedTokens(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

/** Ersetzt geschützte Tokens durch Platzhalter (für den KI-Aufruf). */
export function maskProtectedTokens(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(TOKEN_RE, (match) => {
    tokens.push(match);
    return placeholder(tokens.length - 1);
  });
  return { masked, tokens };
}

/** Setzt die Originale wieder ein; unbekannte Platzhalter werden entfernt. */
export function unmaskProtectedTokens(text: string, tokens: string[]): string {
  return text.replace(PLACEHOLDER_RE, (_all, idx: string) => tokens[Number(idx)] ?? "");
}

/**
 * Sicherheitsnetz für die Anzeige: die Tokens der Übersetzung müssen exakt
 * denen des Originals entsprechen. Weicht nur die Schreibweise ab, werden die
 * Originale zurückgeschrieben; passt die Anzahl nicht, bleibt das Original.
 */
export function enforceProtectedTokens(original: string, translated: string): string {
  if (!translated) return translated;
  const source = extractProtectedTokens(original);
  const target = extractProtectedTokens(translated);
  if (source.length === 0 && target.length === 0) return translated;
  if (source.length !== target.length) return original;
  if (source.every((tok, i) => tok === target[i])) return translated;
  let i = 0;
  return translated.replace(TOKEN_RE, () => source[i++] ?? "");
}
