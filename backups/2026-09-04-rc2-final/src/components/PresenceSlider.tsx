import { useEffect, useRef, useState } from "react";
import { Circle, MinusCircle, Moon } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import type { PresenceStatus } from "@/lib/types";

const STEPS = [
  { value: "online", icon: Circle },
  { value: "busy", icon: MinusCircle },
  { value: "offline", icon: Moon },
] as const satisfies readonly { value: PresenceStatus; icon: typeof Circle }[];

const LABELS: Record<"de" | "en" | "el", Record<PresenceStatus, string>> = {
  de: { online: "Online", busy: "Beschäftigt", offline: "Offline" },
  en: { online: "Online", busy: "Busy", offline: "Offline" },
  el: { online: "Συνδεδεμένος", busy: "Απασχολημένος", offline: "Αποσυνδεδεμένος" },
};

const TITLE: Record<"de" | "en" | "el", string> = {
  de: "Online-Status",
  en: "Online status",
  el: "Κατάσταση σύνδεσης",
};

/** Farben: Online neon-grün (Marken-Akzent), Beschäftigt/Offline dezent. */
const COLOR: Record<PresenceStatus, { dot: string; text: string }> = {
  online: { dot: "bg-brand shadow-[0_0_6px_var(--brand)]", text: "text-brand" },
  busy: { dot: "bg-amber-400/70", text: "text-amber-300/80" },
  offline: { dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
};

/**
 * Sehr kompakter 3-Stufen-Schieberegler für den selbst gewählten Online-Status.
 * Der Status wird ausschliesslich durch den Nutzer gesetzt.
 */
export function PresenceSlider({
  value,
  onChange,
}: {
  value: PresenceStatus;
  onChange: (v: PresenceStatus) => void;
}) {
  const { lang } = useLang();
  const [pending, setPending] = useState<PresenceStatus | null>(null);
  const active = pending ?? value;
  const index = STEPS.findIndex((s) => s.value === active);
  const color = COLOR[active];

  // Rückstell-Timer wird gemerkt und beim Verlassen verworfen, damit nach dem
  // Ausblenden kein Zustand mehr gesetzt wird.
  const resetRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (resetRef.current) window.clearTimeout(resetRef.current);
    },
    [],
  );

  const pick = (v: PresenceStatus) => {
    if (v === active) return;
    setPending(v);
    onChange(v);
    if (resetRef.current) window.clearTimeout(resetRef.current);
    resetRef.current = window.setTimeout(() => setPending(null), 600);
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 align-middle" title={TITLE[lang]}>
      <span
        role="radiogroup"
        aria-label={TITLE[lang]}
        className="relative inline-flex h-5 w-[3.25rem] shrink-0 items-center justify-between rounded-full border border-border bg-black/60 px-0.5"
      >
        {/* Schiebeknopf */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0.5 h-4 w-4 rounded-full border border-border/80 bg-surface transition-transform duration-200 ease-out"
          style={{ left: 2, transform: `translateX(${index * 16}px)` }}
        >
          <span
            className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${color.dot}`}
          />
        </span>
        {STEPS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active === s.value}
            aria-label={LABELS[lang][s.value]}
            onClick={() => pick(s.value)}
            className="relative z-10 grid h-4 w-4 shrink-0 place-items-center rounded-full"
          >
            <s.icon
              className={`h-2 w-2 transition-colors ${
                active === s.value ? color.text : "text-muted-foreground/40"
              }`}
            />
          </button>
        ))}
      </span>
      {/* Reservierter Platz: breitestes Label bestimmt die feste Layoutbreite */}
      <span className="relative grid shrink-0 place-items-start">
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap text-xs">
          {LABELS[lang].online}
        </span>
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap text-xs">
          {LABELS[lang].busy}
        </span>
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap text-xs">
          {LABELS[lang].offline}
        </span>
        <span className={`col-start-1 row-start-1 whitespace-nowrap text-xs ${color.text}`}>
          {LABELS[lang][active]}
        </span>
      </span>
    </span>
  );
}
