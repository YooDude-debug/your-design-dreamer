/**
 * Menüpunkt „Creator werden“ im eigenen Profilmenü.
 *
 * Der Punkt ist immer sichtbar, solange das Konto noch keine Creator-Rolle
 * besitzt. Unterhalb der Voraussetzung ist er ausgegraut und nicht anklickbar.
 * Die Voraussetzung und der Rollenwechsel werden ausschliesslich serverseitig
 * geprüft (`getCreatorEligibility` / `becomeCreator`); die Anzeige hier ist
 * nur eine Darstellung des Serverergebnisses.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { becomeCreator, getCreatorEligibility } from "@/lib/creator-eligibility.functions";
import { CREATOR_ELIGIBILITY_THRESHOLD } from "@/lib/creator-eligibility";

const TXT = {
  de: {
    label: "Creator werden",
    hint: `Ab ${CREATOR_ELIGIBILITY_THRESHOLD} Connections oder ${CREATOR_ELIGIBILITY_THRESHOLD} Followern verfügbar.`,
    progress: (c: number, f: number) => `${c} Connections · ${f} Follower`,
    success: "Creator-Status aktiviert. Die Creator-Funktionen stehen jetzt bereit.",
    notEligible: "Voraussetzung noch nicht erfüllt.",
    failed: "Der Creator-Status konnte nicht aktiviert werden.",
  },
  en: {
    label: "Become a creator",
    hint: `Available from ${CREATOR_ELIGIBILITY_THRESHOLD} connections or ${CREATOR_ELIGIBILITY_THRESHOLD} followers.`,
    progress: (c: number, f: number) => `${c} connections · ${f} followers`,
    success: "Creator status enabled. Creator features are available now.",
    notEligible: "Requirement not met yet.",
    failed: "Creator status could not be enabled.",
  },
  el: {
    label: "Γίνε creator",
    hint: `Διαθέσιμο από ${CREATOR_ELIGIBILITY_THRESHOLD} συνδέσεις ή ${CREATOR_ELIGIBILITY_THRESHOLD} ακόλουθους.`,
    progress: (c: number, f: number) => `${c} συνδέσεις · ${f} ακόλουθοι`,
    success: "Η ιδιότητα creator ενεργοποιήθηκε.",
    notEligible: "Η προϋπόθεση δεν πληρούται ακόμη.",
    failed: "Δεν ήταν δυνατή η ενεργοποίηση.",
  },
} as const;

export function BecomeCreatorMenuItem({
  lang,
  onBecameCreator,
}: {
  lang: keyof typeof TXT;
  onBecameCreator?: () => void;
}) {
  const txt = TXT[lang] ?? TXT.de;
  const load = useServerFn(getCreatorEligibility);
  const start = useServerFn(becomeCreator);
  const [pending, setPending] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["creator-eligibility"],
    queryFn: () => load(),
    staleTime: 60_000,
  });

  // Bereits Creator: der bestehende Creator-Bereich übernimmt.
  if (data?.isCreator) return null;

  const eligible = data?.eligible === true;

  const run = async () => {
    if (!eligible || pending) return;
    setPending(true);
    try {
      const result = await start({ data: undefined });
      if (result.ok) {
        toast.success(txt.success);
        onBecameCreator?.();
      } else if (result.error === "not_eligible") {
        toast.error(txt.notEligible);
      } else {
        toast.error(txt.failed);
      }
    } catch {
      toast.error(txt.failed);
    } finally {
      setPending(false);
      void refetch();
    }
  };

  return (
    <div className="mt-1 border-t border-border/60 pt-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={!eligible || pending}
        aria-disabled={!eligible || pending}
        data-testid="become-creator"
        data-eligible={eligible ? "true" : "false"}
        className={`group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
          eligible ? "hover:bg-brand/10" : "cursor-not-allowed opacity-50 hover:bg-transparent"
        }`}
      >
        {eligible ? (
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        ) : (
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{txt.label}</span>
          {!eligible && (
            <span className="block text-[11px] leading-snug text-muted-foreground">{txt.hint}</span>
          )}
          {data && (
            <span className="block text-[11px] leading-snug text-muted-foreground">
              {txt.progress(data.connections, data.followers)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
