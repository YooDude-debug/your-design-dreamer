/**
 * Vorschläge des ORB (Level 2).
 *
 * Der ORB liest und bewertet nur; er handelt nie selbst. Jede Entscheidung des
 * Benutzers wird als Lernerfahrung zurückgegeben. Die Begründung ist nur für
 * den Benutzer sichtbar.
 */

import { Link } from "@tanstack/react-router";
import { Eye, Loader2, Radar, ThumbsDown } from "lucide-react";

import type { OrbSuggestion } from "@/orb-sdk";

type Props = {
  suggestions: OrbSuggestion[];
  observing: boolean;
  deciding: boolean;
  onObserve: () => void;
  onDecide: (id: string, accepted: boolean) => void;
};

export function OrbSuggestions({ suggestions, observing, deciding, onObserve, onDecide }: Props) {
  const open = suggestions.filter((s) => s.status === "pending" || s.status === "shown");

  return (
    <section className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Vorschläge
        </h2>
        <button
          onClick={onObserve}
          disabled={observing}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
        >
          {observing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          Feed beobachten
        </button>
      </div>

      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Vorschläge. Der ORB liest öffentlich zugängliche Beiträge und vergleicht sie
          mit deinen Interessen – er likt, kommentiert und schreibt nichts.
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((s) => (
            <li key={s.id} className="rounded-lg border border-border p-2">
              <p className="text-sm font-semibold">{s.title ?? "Beitrag"}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.reason}</p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  to="/p/$postId"
                  params={{ postId: s.postId }}
                  onClick={() => onDecide(s.id, true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  <Eye className="h-4 w-4" /> Anzeigen
                </Link>
                <button
                  onClick={() => onDecide(s.id, false)}
                  disabled={deciding}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                >
                  <ThumbsDown className="h-4 w-4" /> Kein Interesse
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
