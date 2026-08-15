/**
 * Globe Vote – 7-Tage-Timer der laufenden Runde plus kompaktes Info-Kästchen
 * zur Berechnung der positiven Quote. Nur Globe Vote, keine anderen Bereiche.
 */

import { Info, Timer } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useGlobeVoteRound } from "@/lib/globe/globe-vote-round";

const TEXTS = {
  de: {
    round: "Globe-Vote-Runde",
    ends: "Endet in",
    entries: "Einreichungen",
    howTitle: "So wird abgestimmt",
    formula: "👍 ÷ (👍 + 👎) × 100 = positive Quote",
    examples: "👍 1 · 👎 0 → 100 % · 👍 2 · 👎 1 → 66,7 % · 👍 8 · 👎 2 → 80 %",
    note: "Die höchste positive Quote gewinnt. Bei Gleichstand kommen alle Gleichplatzierten in den Globe.",
  },
  en: {
    round: "Globe vote round",
    ends: "Ends in",
    entries: "submissions",
    howTitle: "How voting works",
    formula: "👍 ÷ (👍 + 👎) × 100 = positive rate",
    examples: "👍 1 · 👎 0 → 100% · 👍 2 · 👎 1 → 66.7% · 👍 8 · 👎 2 → 80%",
    note: "The highest positive rate wins. On a tie, all tied SlangTags enter the Globe.",
  },
  el: {
    round: "Γύρος Globe Vote",
    ends: "Λήγει σε",
    entries: "υποβολές",
    howTitle: "Πώς γίνεται η ψηφοφορία",
    formula: "👍 ÷ (👍 + 👎) × 100 = θετικό ποσοστό",
    examples: "👍 1 · 👎 0 → 100% · 👍 2 · 👎 1 → 66,7% · 👍 8 · 👎 2 → 80%",
    note: "Κερδίζει το υψηλότερο θετικό ποσοστό. Σε ισοπαλία μπαίνουν όλοι στον Globe.",
  },
} as const;

export function GlobeVoteRoundBar() {
  const { lang } = useLang();
  const t = TEXTS[lang] ?? TEXTS.de;
  const { round, countdown } = useGlobeVoteRound();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 sm:min-w-[190px]">
        <Timer className="h-4 w-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t.round}
            {round ? ` #${round.roundNo}` : ""}
          </p>
          <p className="font-mono text-sm font-black tabular-nums text-brand">{countdown}</p>
          {round ? (
            <p className="text-[10px] text-muted-foreground">
              {round.entries} {t.entries}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-brand/40 bg-brand/5 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand">
          <Info className="h-3.5 w-3.5" /> {t.howTitle}
        </p>
        <p className="mt-1 text-[11px] font-bold">{t.formula}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{t.examples}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{t.note}</p>
      </div>
    </div>
  );
}
