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
    howTitle: "SO WIRD ABGESTIMMT",
    formula: "👍 ÷ (👍 + 👎) × 100 = positive Quote",
    examples: "👍 1 · 👎 0 → 100 % · 👍 2 · 👎 1 → 66,7 % · 👍 8 · 👎 2 → 80 %",
    note: "Höchste positive Quote gewinnt. Bei Gleichstand kommen alle Gleichplatzierten in den Globe.",
  },
  en: {
    round: "Globe vote round",
    ends: "Ends in",
    entries: "submissions",
    howTitle: "HOW VOTING WORKS",
    formula: "👍 ÷ (👍 + 👎) × 100 = positive rate",
    examples: "👍 1 · 👎 0 → 100% · 👍 2 · 👎 1 → 66.7% · 👍 8 · 👎 2 → 80%",
    note: "Highest positive rate wins. On a tie, all tied SlangTags enter the Globe.",
  },
  el: {
    round: "Γύρος Globe Vote",
    ends: "Λήγει σε",
    entries: "υποβολές",
    howTitle: "ΠΩΣ ΓΊΝΕΤΑΙ Η ΨΗΦΟΦΟΡΊΑ",
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
    <div className="flex items-stretch gap-2 rounded-2xl border border-border/80 bg-black/60 p-2 backdrop-blur-md">
      {/* Timer – 50 % der aktuellen Basisbreite */}
      <div className="flex w-[95px] shrink-0 flex-col justify-center gap-0.5 rounded-xl border border-border/60 bg-background/70 px-2.5 py-2 sm:w-[110px]">
        <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <Timer className="h-3 w-3 shrink-0 text-brand" />
          {t.round}
          {round ? ` #${round.roundNo}` : ""}
        </p>
        <p className="font-mono text-xs font-black tabular-nums leading-none text-brand">{countdown}</p>
        {round ? (
          <p className="text-[9px] leading-tight text-muted-foreground">
            {round.entries} {t.entries}
          </p>
        ) : null}
      </div>

      {/* Info-Kästchen */}
      <div className="flex min-w-0 flex-1 flex-col justify-center rounded-xl border border-brand/40 bg-brand/5 px-2.5 py-2">
        <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-brand">
          <Info className="h-3 w-3" /> {t.howTitle}
        </p>
        <p className="mt-0.5 text-[10px] font-bold leading-tight">{t.formula}</p>
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{t.examples}</p>
        <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{t.note}</p>
      </div>
    </div>
  );
}

