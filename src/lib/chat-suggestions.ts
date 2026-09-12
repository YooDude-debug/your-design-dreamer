/**
 * Intelligente Chat-Vorschlaege fuer die Y-Dude Suggestion-Bar im Messenger.
 *
 * Reine Textlogik ohne Netzwerk oder Speicherung: aus dem aktuell getippten
 * Entwurf werden passende Fortsetzungen, Schnellantworten und bereits
 * vorhandene SlangTags abgeleitet. Es wird ausschliesslich *ergaenzt* –
 * der eingegebene Text bleibt erhalten.
 */
import type { Lang } from "@/lib/i18n-dict";
import type { SlangTag } from "@/lib/types";

export type ChatSuggestion = {
  id: string;
  /** Anzeigetext in der Pille (kann Emoji enthalten). */
  label: string;
  /** Text, der an den Entwurf angehaengt wird. */
  insert: string;
  kind: "text" | "tag";
};

type Rule = { test: RegExp; items: string[] };

const RULES: Record<Lang, Rule[]> = {
  de: [
    { test: /\bdas war (gerade|echt)?\s*$/i, items: ["😂 richtig lustig", "🔥 richtig geil", "Ja, komplett", "😅 dachte ich auch"] },
    { test: /\bwas machst du\s*$/i, items: ["gerade?", "heute Abend?", "später?"] },
    { test: /\bdas sieht\s*$/i, items: ["🔥 richtig gut aus", "😍 mega aus", "gut aus"] },
    { test: /\bbin gleich\s*$/i, items: ["da", "zurück", "fertig"] },
    { test: /\bich bin\s*$/i, items: ["gleich da", "unterwegs", "😴 müde"] },
    { test: /\bhast du\s*$/i, items: ["Zeit?", "das gesehen?", "Lust?"] },
    { test: /\bwann\s*$/i, items: ["passt es dir?", "bist du da?", "sehen wir uns?"] },
    { test: /\bwo\s*$/i, items: ["bist du?", "treffen wir uns?"] },
    { test: /\bdanke\s*$/i, items: ["dir! 🙏", "sehr", "😄"] },
    { test: /\b(ja|nein)\s*$/i, items: ["klar", "auf jeden Fall", "leider nicht"] },
    { test: /\balles\s*$/i, items: ["gut bei dir?", "klar 👍"] },
    { test: /\bgute\s*$/i, items: ["Nacht 🌙", "Idee 👌"] },
  ],
  en: [
    { test: /\bthat was\s*$/i, items: ["😂 really funny", "🔥 so good", "wild", "😅 same"] },
    { test: /\bwhat are you\s*$/i, items: ["doing?", "up to tonight?", "doing later?"] },
    { test: /\bthat looks\s*$/i, items: ["🔥 really good", "😍 amazing", "great"] },
    { test: /\bi'?ll be\s*$/i, items: ["there", "right back", "done soon"] },
    { test: /\bdo you\s*$/i, items: ["have time?", "want to?", "see this?"] },
    { test: /\bwhen\s*$/i, items: ["works for you?", "are you free?"] },
    { test: /\bthanks\s*$/i, items: ["a lot 🙏", "😄"] },
    { test: /\b(yes|no)\s*$/i, items: ["for sure", "absolutely", "sadly not"] },
  ],
  el: [
    { test: /\bαυτό ήταν\s*$/i, items: ["😂 πολύ αστείο", "🔥 τέλειο", "Ναι, εντελώς"] },
    { test: /\bτι κάνεις\s*$/i, items: ["τώρα;", "το βράδυ;", "μετά;"] },
    { test: /\bέρχομαι\s*$/i, items: ["αμέσως", "σε λίγο"] },
    { test: /\bευχαριστώ\s*$/i, items: ["πολύ 🙏", "😄"] },
  ],
};

const QUICK: Record<Lang, string[]> = {
  de: ["Hey 👋", "Alles gut?", "😂", "🔥", "Bin gleich da", "Melde mich später", "👍", "Passt!"],
  en: ["Hey 👋", "How are you?", "😂", "🔥", "On my way", "Talk later", "👍", "Sounds good!"],
  el: ["Γεια 👋", "Τι κάνεις;", "😂", "🔥", "Έρχομαι", "Μιλάμε μετά", "👍", "Τέλεια!"],
};

/** Stichwoerter im Entwurf → passende SlangTag-Namen (bestehende Tags). */
const TAG_HINTS: { test: RegExp; names: string[]; emoji: string }[] = [
  { test: /\b(geil|krass|hammer|fire|awesome|τέλειο)\b/i, names: ["geil", "fire", "krass", "hammer"], emoji: "🔥" },
  { test: /\b(lustig|lol|witzig|funny|αστείο)\b/i, names: ["lol", "lustig", "haha", "funny"], emoji: "😂" },
  { test: /\b(liebe|love|schatz|αγάπη)\b/i, names: ["love", "liebe", "herz"], emoji: "❤️" },
  { test: /\b(müde|tired|schlafen)\b/i, names: ["müde", "tired"], emoji: "😴" },
  { test: /\b(egal|whatever)\b/i, names: ["egal", "whatever"], emoji: "🤷" },
];

/** Bis zu `max` SlangTags, die zum Entwurf passen – nur vorhandene Tags. */
function tagSuggestions(draft: string, tags: SlangTag[], max: number): ChatSuggestion[] {
  if (!draft.trim() || tags.length === 0) return [];
  const out: ChatSuggestion[] = [];
  const seen = new Set<string>();
  const push = (tag: SlangTag, emoji: string) => {
    if (seen.has(tag.id) || out.length >= max) return;
    seen.add(tag.id);
    out.push({ id: `tag:${tag.id}`, label: `${emoji} $${tag.name}`, insert: `$${tag.name}`, kind: "tag" });
  };

  for (const hint of TAG_HINTS) {
    if (!hint.test.test(draft)) continue;
    for (const name of hint.names) {
      const tag = tags.find((tg) => tg.name.toLowerCase() === name.toLowerCase());
      if (tag) push(tag, hint.emoji);
    }
  }

  // Fallback: letztes getipptes Wort trifft Tagname oder Bedeutung.
  const word = draft.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
  if (word.length >= 3) {
    for (const tag of tags) {
      const hay = `${tag.name} ${tag.meaning}`.toLowerCase();
      if (hay.includes(word)) push(tag, "💬");
    }
  }
  return out;
}

/** Vorschlaege fuer den aktuellen Entwurf (Fortsetzungen, Quick-Replies, SlangTags). */
export function buildChatSuggestions(opts: {
  draft: string;
  lang: Lang;
  tags?: SlangTag[];
  limit?: number;
}): ChatSuggestion[] {
  const { draft, lang, tags = [], limit = 8 } = opts;
  const trimmedEmpty = draft.trim().length === 0;
  const out: ChatSuggestion[] = [];
  const seen = new Set<string>();
  const add = (s: ChatSuggestion) => {
    const key = s.insert.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  if (trimmedEmpty) {
    QUICK[lang].forEach((label, i) => add({ id: `quick:${i}`, label, insert: label, kind: "text" }));
    return out.slice(0, limit);
  }

  const tail = draft.slice(-80);
  for (const rule of RULES[lang]) {
    if (!rule.test.test(tail)) continue;
    rule.items.forEach((label, i) =>
      add({ id: `rule:${rule.test.source}:${i}`, label, insert: label, kind: "text" }),
    );
  }

  for (const tag of tagSuggestions(draft, tags, 3)) add(tag);

  if (out.length === 0) {
    // Immer etwas Sinnvolles anbieten, ohne den Text zu ersetzen.
    QUICK[lang].slice(2, 6).forEach((label, i) =>
      add({ id: `fill:${i}`, label, insert: label, kind: "text" }),
    );
  }
  return out.slice(0, limit);
}

/** Haengt einen Vorschlag an den Entwurf an – der bestehende Text bleibt erhalten. */
export function applyChatSuggestion(draft: string, suggestion: ChatSuggestion): string {
  if (!draft) return suggestion.insert;
  const gap = /\s$/.test(draft) ? "" : " ";
  return `${draft}${gap}${suggestion.insert}`;
}
