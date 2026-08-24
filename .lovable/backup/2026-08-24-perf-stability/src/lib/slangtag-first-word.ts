import { sanitizeSlangTagName, SLANGTAG_MAX_LENGTH } from "@/lib/slangtag-rules";

/**
 * Leitet einen SlangTag-Namen aus einem Speech-to-Text-Transkript ab.
 *
 * Regeln (siehe Produktvorgabe):
 * - immer das erste tatsächlich erkannte Wort verwenden
 * - Satz- und Sonderzeichen am Wortanfang/-ende entfernen
 * - Originalsprache erhalten (keine Übersetzung, keine Transliteration)
 * - kein gültiges Wort → leerer String (kein Zufallsname)
 */
export function firstWordFromTranscript(transcript: string | null | undefined): string {
  if (!transcript) return "";
  for (const rawToken of transcript.trim().split(/\s+/)) {
    // Führende/abschließende Satzzeichen, Anführungszeichen, Emojis etc. weg.
    const trimmed = rawToken.replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}'’-]+$/u, "");
    if (!trimmed) continue;
    const clean = sanitizeSlangTagName(trimmed).slice(0, SLANGTAG_MAX_LENGTH);
    if (clean) return clean;
  }
  return "";
}
