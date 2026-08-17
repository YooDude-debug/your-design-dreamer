import { isBusinessSlangTag } from "@/lib/slangtag-rules";
import type { SlangTag, SlangTagKind } from "@/lib/types";

/** Hinweis, wenn ein Konto keine Unternehmer-SlangTags anlegen darf. */
export const BUSINESS_DENIED =
  "Unternehmer-SlangTags können nur von verifizierten Unternehmer- oder Creator-Konten erstellt werden.";

/** Zeichen, die in einem SlangTag-Namen erlaubt sind: Buchstaben und Zahlen. */
const NAME_CLASS = "[\\p{L}\\p{N}\\p{M}]";
/** Erkennt Community- (`$`) und Creator-Tokens (`$$`). */
export const TOKEN_AT_CURSOR = new RegExp(`\\$\\$?(${NAME_CLASS}*)$`, "u");
export const TOKEN_GLOBAL = new RegExp(`(\\$\\$?${NAME_CLASS}+)`, "gu");

/** Findet alle in einem Text erwähnten SlangTag-IDs. */
export function extractTagIds(
  text: string,
  getTag: (idOrName: string) => SlangTag | undefined,
): string[] {
  const ids = new Set<string>();
  for (const part of text.split(TOKEN_GLOBAL)) {
    if (!part.startsWith("$")) continue;
    const tag = getTag(part.replace(/^\$\$?/, ""));
    if (tag) ids.add(tag.id);
  }
  return [...ids];
}

/**
 * IDs für das Speichern: erkannte SlangTags im Text plus die im Feld frisch
 * eingefügten SlangTags (diese sind ggf. noch nicht im geladenen Bestand und
 * würden sonst beim Kommentar verloren gehen).
 */
export function collectTagIds(
  text: string,
  getTag: (idOrName: string) => SlangTag | undefined,
  inserted: SlangTag[] = [],
): string[] {
  const ids = new Set(extractTagIds(text, getTag));
  const lower = text.toLowerCase();
  for (const tag of inserted) {
    if (lower.includes(`$${tag.name.toLowerCase()}`)) ids.add(tag.id);
  }
  return [...ids];
}

/**
 * Farbschema je SlangTag-Typ: Community bleibt grün (`brand`),
 * Unternehmer-/Creator-SlangTags wechseln vollständig in Marken-Blau
 * (`brand-cyan`). Wird für Rahmen, Glow, Buttons, Icons und Fokus genutzt.
 */
export function slangTagTheme(kind: SlangTagKind | null | undefined) {
  const business = isBusinessSlangTag(kind);
  return {
    business,
    text: business ? "text-brand-cyan" : "text-brand",
    border: business ? "border-brand-cyan/30" : "border-brand/30",
    borderStrong: business ? "border-brand-cyan/60" : "border-brand/60",
    borderDashed: business ? "border-brand-cyan/40" : "border-brand/40",
    bgSoft: business ? "bg-brand-cyan/5" : "bg-brand/5",
    hover: business ? "hover:bg-brand-cyan/10" : "hover:bg-brand/10",
    glow: business ? "shadow-[0_0_20px_oklch(0.78_0.16_210/0.35)]" : "shadow-glow",
    solid: business ? "bg-brand-cyan text-background" : "bg-gradient-brand text-primary-foreground",
    /** Reine CSS-Farbe (Wellenform, Canvas, Inline-Styles). */
    accent: business ? "var(--brand-cyan)" : "var(--brand)",
    /** Chip-Glow der Glas-Darstellung. */
    chipGlow: business
      ? "shadow-[0_0_18px_oklch(0.78_0.16_210/0.28)]"
      : "shadow-[0_0_18px_oklch(0.82_0.24_150/0.22)]",
    /** Dezenter Glow unter einer Wellenform. */
    waveGlow: business
      ? "drop-shadow-[0_0_8px_oklch(0.78_0.16_210/0.08)]"
      : "drop-shadow-[0_0_8px_oklch(0.82_0.24_150/0.08)]",
    hoverText: business ? "group-hover:text-brand-cyan" : "group-hover:text-brand",
    /** Runder Play-Knopf: aktiv / inaktiv (identisch in Box, Arena, Chip). */
    playActive: business
      ? "border-brand-cyan bg-brand-cyan/25 text-brand-cyan shadow-[0_0_10px_oklch(0.78_0.16_210/0.4)]"
      : "border-brand bg-brand/25 text-brand shadow-glow",
    playIdle: business
      ? "border-brand-cyan/60 bg-black/40 text-brand-cyan"
      : "border-brand/60 bg-black/40 text-brand",
  };
}
