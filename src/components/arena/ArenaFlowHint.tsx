import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";

/** Einzeilige, dezente Prozess-Leiste: vom eigenen SlangTag bis zum Slang Globe. */
export function ArenaFlowHint() {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const steps = [
    at.arenaFlowStep1,
    at.arenaFlowStep2,
    at.arenaFlowStep3,
    at.arenaFlowStep4,
    at.arenaFlowStep5,
  ];
  return (
    <p className="mt-2 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap px-1 text-[10px] text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none]">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-brand/60">→</span>}
          <span>{step}</span>
        </span>
      ))}
    </p>
  );
}
