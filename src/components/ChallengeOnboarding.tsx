import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

import { useLang } from "@/lib/lang-context";
import { challengeTexts } from "@/lib/i18n-challenge";
import {
  clearChallengeOnboarding,
  hasChallengeOnboarding,
  trackChallenge,
} from "@/lib/challenge-tracking";

/** Event, auf das der Composer hört, um sich zu öffnen. */
export const OPEN_COMPOSER_EVENT = "y-dude:open-composer";

/**
 * Erster Schritt nach der Registrierung: ein einzelner, ablenkungsfreier
 * Aufruf, den ersten SlangTag zu erstellen. Wird nur angezeigt, wenn der
 * Besucher über die Slang Challenge gekommen ist.
 */
export function ChallengeOnboarding() {
  const { lang } = useLang();
  const c = challengeTexts[lang];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(hasChallengeOnboarding());
  }, []);

  if (!visible) return null;

  const close = () => {
    clearChallengeOnboarding();
    setVisible(false);
  };

  const start = () => {
    trackChallenge("first_slangtag_started");
    clearChallengeOnboarding();
    setVisible(false);
    window.dispatchEvent(new CustomEvent(OPEN_COMPOSER_EVENT));
    document.querySelector("#composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-brand/40 bg-black px-4 py-4 shadow-[0_0_30px_-14px_oklch(0.82_0.24_150/0.35)]">
      <CloseButton onClick={close} label={c.onboardSkip} className="absolute right-2 top-2" />
      <p className="inline-flex items-center gap-1.5 text-sm font-black text-brand">
        <Flame className="h-4 w-4" /> {c.onboardTitle}
      </p>
      <p className="mt-1.5 pr-8 text-sm font-semibold leading-snug">{c.onboardSub}</p>
      <button
        type="button"
        onClick={start}
        className="mt-3 w-full rounded-full bg-gradient-brand px-5 py-2.5 text-sm font-black text-primary-foreground transition-transform hover:scale-[1.01]"
      >
        {c.onboardCta}
      </button>
    </section>
  );
}
