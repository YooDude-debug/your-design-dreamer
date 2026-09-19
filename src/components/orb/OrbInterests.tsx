/**
 * Interessenmodell des ORB.
 *
 * Die Werte entstehen ausschliesslich aus Erfahrungen (keine festen Vorgaben).
 * Die Herkunft wird sichtbar unterschieden: selbst gesagt, beobachtet,
 * abgeleitet – eine Beobachtung wiegt weniger als eine eigene Aussage.
 */

import type { OrbInterest } from "@/lib/orb.server";

const SOURCE_LABEL: Record<string, string> = {
  user_stated: "selbst gesagt",
  observed: "beobachtet",
  inferred: "abgeleitet",
};

export function OrbInterests({ interests }: { interests: OrbInterest[] }) {
  return (
    <section className="rounded-xl border border-border bg-background p-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Interessen
      </h2>
      {interests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Interessen. Sie entstehen aus deinen Erfahrungen.
        </p>
      ) : (
        <ul className="space-y-2">
          {interests.map((i) => (
            <li key={i.id}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{i.topic}</span>
                <span className="font-mono text-muted-foreground">
                  {i.weight.toFixed(2)} · Sicherheit {i.confidence.toFixed(2)} ·{" "}
                  {SOURCE_LABEL[i.source] ?? i.source}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.round(i.weight * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
