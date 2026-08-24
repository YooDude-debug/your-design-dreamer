import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

/**
 * Kleines ⓘ-Symbol, das den Erklärungstext erst auf Tippen als Popover zeigt.
 * Das Popover ist absolut positioniert und belegt daher keinen Layout-Platz.
 */
export function WorkAreaInfo({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        className={`grid h-5 w-5 place-items-center rounded-full border transition-colors ${
          open
            ? "border-brand/60 bg-brand/20 text-brand"
            : "border-white/20 bg-white/5 text-muted-foreground hover:text-foreground"
        }`}
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-6 z-50 w-56 rounded-lg border border-brand/40 bg-black p-2 text-[10px] leading-snug text-muted-foreground shadow-[0_0_24px_oklch(0.82_0.24_150/0.18)]"
        >
          {text}
        </div>
      )}
    </div>
  );
}
