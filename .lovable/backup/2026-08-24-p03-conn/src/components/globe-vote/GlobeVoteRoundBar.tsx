/**
 * Globe Vote – dünne horizontale Timer-Leiste mit klickbarem Info-Popover.
 * Keine separate Info-Box; die Erklärung erscheint erst nach Tippen auf ⓘ.
 */

import { useEffect, useRef, useState } from "react";
import { Info, Timer } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useGlobeVoteRound } from "@/lib/globe/globe-vote-round";

const TEXTS = {
  de: {
    howTitle: "SO WIRD ABGESTIMMT",
    formula: "👍 ÷ (👍 + 👎) × 100 = positive Quote",
    examples: "👍 1 · 👎 0 → 100 % · 👍 2 · 👎 1 → 66,7 % · 👍 8 · 👎 2 → 80 %",
    note: "Höchste positive Quote gewinnt. Bei Gleichstand kommen alle Gleichplatzierten in den Globe.",
  },
  en: {
    howTitle: "HOW VOTING WORKS",
    formula: "👍 ÷ (👍 + 👎) × 100 = positive rate",
    examples: "👍 1 · 👎 0 → 100% · 👍 2 · 👎 1 → 66.7% · 👍 8 · 👎 2 → 80%",
    note: "Highest positive rate wins. On a tie, all tied SlangTags enter the Globe.",
  },
  el: {
    howTitle: "ΠΩΣ ΓΊΝΕΤΑΙ Η ΨΗΦΟΦΟΡΊΑ",
    formula: "👍 ÷ (👍 + 👎) × 100 = θετικό ποσοστό",
    examples: "👍 1 · 👎 0 → 100% · 👍 2 · 👎 1 → 66,7% · 👍 8 · 👎 2 → 80%",
    note: "Κερδίζει το υψηλότερο θετικό ποσοστό. Σε ισοπαλία μπαίνουν όλοι στον Globe.",
  },
} as const;

export function GlobeVoteRoundBar() {
  const { lang } = useLang();
  const t = TEXTS[lang] ?? TEXTS.de;
  const { countdown } = useGlobeVoteRound();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex h-8 items-center justify-between rounded-xl border border-border/80 bg-background/70 px-2.5 backdrop-blur-md">
        <span className="flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          <Timer className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="truncate">GLOBE-VOTE</span>
        </span>

        <span className="font-mono text-xs font-black tabular-nums leading-none text-brand">
          {countdown}
        </span>

        <button
          type="button"
          aria-label={t.howTitle}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="tap-safe grid h-6 w-6 shrink-0 place-items-center rounded-full border border-brand/50 text-brand transition-colors hover:bg-brand/10"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-brand/40 bg-background/95 p-2.5 shadow-lg backdrop-blur-md">
          <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-brand">
            <Info className="h-3 w-3" />
            {t.howTitle}
          </p>
          <p className="mt-1 text-[10px] font-bold leading-tight text-foreground">{t.formula}</p>
          <p className="mt-1 text-[9px] leading-tight text-muted-foreground">{t.examples}</p>
          <p className="mt-1 text-[9px] leading-tight text-muted-foreground">{t.note}</p>
        </div>
      )}
    </div>
  );
}
