/** Einzeilige, dezente Prozess-Leiste: vom eigenen SlangTag bis zum Slang Globe. */
export function ArenaFlowHint() {
  const steps = [
    "Eigener SlangTag",
    "Manager: für Globe einreichen",
    "Globe Vote / Arena",
    "Voting",
    "Slang Globe",
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
