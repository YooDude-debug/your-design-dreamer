/**
 * Staging-Testbereich des ORB Core – klar gekennzeichnet und eingeklappt.
 *
 * Zeigt ausschliesslich Werte des eigenen ORB: Zustand, aktive Erinnerungen,
 * Wichtigkeit, Gewicht, Vergessensrate, Aktivierungszähler, letzte
 * Aktivierung, Ziele, Entscheidungen und die Kennzahlen des Netzes.
 */

import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";

import { STRONG_THRESHOLD, W_MIN } from "@/orb-sdk";
import { CURIOSITY_ASK_THRESHOLD } from "@/orb-sdk";
import type { OrbCuriosityInsight, OrbSnapshot } from "@/orb-sdk";

/**
 * Letzter eigener Fragen-Versuch, so wie ihn der Server bereits zurückgibt.
 * Reine Anzeige im Testbereich – keinerlei Einfluss auf Entscheidungen.
 */
export type OrbAutonomyAttempt = {
  at: string;
  asked: boolean;
  action: string;
  reason: string;
  topic: string | null;
  kind: string | null;
  score: number;
};

type Props = {
  snapshot: OrbSnapshot;
  lastDecision: { decision: string; reason: string; importance: number } | null;
  lastAutonomyAttempt?: OrbAutonomyAttempt | null;
  curiosity: OrbCuriosityInsight | null;
  curiosityLoading?: boolean;
  onInspectCuriosity: () => void;
};

const STATE_LABEL: Record<string, string> = {
  curiosity: "Neugier",
  joy: "Freude",
  fear: "Angst",
  trust: "Vertrauen",
  uncertainty: "Unsicherheit",
  energy: "Energie",
};

function ts(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrbDevPanel({
  snapshot,
  lastDecision,
  curiosity,
  curiosityLoading,
  onInspectCuriosity,
}: Props) {
  const [open, setOpen] = useState(false);
  const m = snapshot.metrics;

  return (
    <section className="rounded-xl border border-dashed border-border bg-muted/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"
        aria-expanded={open}
      >
        <FlaskConical className="h-4 w-4" />
        Testbereich (Experiment)
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 text-xs">
          <div>
            <h3 className="mb-2 font-bold">Innenzustand</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(snapshot.state).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-background p-2">
                  <div className="text-muted-foreground">{STATE_LABEL[k] ?? k}</div>
                  <div className="font-mono font-bold">{v.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Knoten", m.nodeCount],
              ["Verbindungen", m.connectionCount],
              ["Reaktivierungen", m.reactivationCount],
              ["Decay-Vorgänge", m.decayComputations],
              ["stark / schwach", `${m.strongConnections} / ${m.weakConnections}`],
              ["Risse (Lernereignisse)", snapshot.cracks],
              ["Interessen", snapshot.interests.length],
              [
                "Vorschläge angenommen / abgelehnt",
                `${m.suggestionsAccepted} / ${m.suggestionsRejected}`,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-lg border border-border bg-background p-2"
              >
                <div className="text-muted-foreground">{label}</div>
                <div className="font-mono font-bold">{value}</div>
              </div>
            ))}
          </div>

          {snapshot.perf && (
            <div>
              <h3 className="mb-1 font-bold">Messwerte der letzten Interaktion</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  ["Abruf", `${snapshot.perf.retrievalMs} ms`],
                  ["Relevanz", `${snapshot.perf.relevanceMs} ms`],
                  ["Sprachschicht", `${snapshot.perf.aiMs} ms`],
                  ["gesamt", `${snapshot.perf.totalMs} ms`],
                  [
                    "geladen (Knoten / Verb.)",
                    `${snapshot.perf.nodesLoaded} / ${snapshot.perf.connectionsLoaded}`,
                  ],
                  ["DB-Abfragen", snapshot.perf.dbQueries],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-border bg-background p-2"
                  >
                    <div className="text-muted-foreground">{label}</div>
                    <div className="font-mono font-bold">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-1 font-bold">Offene Gedankenfäden</h3>
            <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
              {(snapshot.threads ?? []).slice(0, 8).map((t) => (
                <li key={t.id}>
                  <span className="font-bold text-foreground">{t.title}</span> · {t.status} ·
                  Neugier {t.curiosity.toFixed(2)} · Wichtigkeit {t.importance.toFixed(2)} ·
                  Relevanz {t.relevance.toFixed(2)} · A {t.activationCount}
                  {t.unknown.length > 0 && <> · offen: {t.unknown.slice(0, 2).join(" / ")}</>}
                </li>
              ))}
              {(snapshot.threads ?? []).length === 0 && <li>keine Gedankenfäden</li>}
            </ul>
            {snapshot.style && (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                Stil:{" "}
                {snapshot.style.established
                  ? `${snapshot.style.tone} · Ø ${Math.round(snapshot.style.avgLength)} Zeichen · Antwortlänge ${snapshot.style.preferredReplyLength}${snapshot.style.emoji ? " · Emojis" : ""}${snapshot.style.technical ? " · technisch" : ""}`
                  : `noch kein Muster (${snapshot.style.messages} Nachrichten)`}
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-1 font-bold">Interessen (Herkunft und Sicherheit)</h3>
            <ul className="space-y-1 font-mono text-[11px]">
              {snapshot.interests.slice(0, 10).map((i) => (
                <li key={i.id} className="text-muted-foreground">
                  <span className="font-bold text-foreground">{i.topic}</span> · W{" "}
                  {i.weight.toFixed(2)} · C {i.confidence.toFixed(2)} · {i.source} · A{" "}
                  {i.activationCount}
                </li>
              ))}
              {snapshot.interests.length === 0 && (
                <li className="text-muted-foreground">keine Interessen</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 font-bold">Stärkste / schwächste Erinnerungen</h3>
            <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
              {[...snapshot.nodes]
                .sort((a, b) => b.importance - a.importance)
                .slice(0, 3)
                .map((n) => (
                  <li key={`s-${n.id}`}>
                    ↑ {n.importance.toFixed(2)} · {n.content.slice(0, 60)}
                  </li>
                ))}
              {[...snapshot.nodes]
                .sort((a, b) => a.importance - b.importance)
                .slice(0, 3)
                .map((n) => (
                  <li key={`w-${n.id}`}>
                    ↓ {n.importance.toFixed(2)} · {n.content.slice(0, 60)}
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-1 font-bold">Ziele</h3>
            <p className="font-mono text-muted-foreground">{snapshot.goals.join(", ")}</p>
          </div>

          <div>
            <h3 className="mb-1 font-bold">Letzte Entscheidung</h3>
            {lastDecision ? (
              <p className="text-muted-foreground">
                <span className="font-mono font-bold text-foreground">{lastDecision.decision}</span>{" "}
                – {lastDecision.reason} (Importance {lastDecision.importance.toFixed(2)})
              </p>
            ) : (
              <p className="text-muted-foreground">noch keine</p>
            )}
          </div>

          <div data-testid="orb-curiosity-core">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="font-bold">Curiosity Core</h3>
              <button
                onClick={onInspectCuriosity}
                disabled={curiosityLoading}
                className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold disabled:opacity-40"
              >
                {curiosityLoading ? "prüfe …" : "Neugier prüfen"}
              </button>
            </div>
            {curiosity ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">{curiosity.action}</span> –{" "}
                  {curiosity.reason}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Neugier {curiosity.curiosity.toFixed(2)} ({curiosity.band}) · Energie{" "}
                  {curiosity.energy.toFixed(2)} · Wert {curiosity.score.toFixed(3)} · Schwelle{" "}
                  {CURIOSITY_ASK_THRESHOLD} · letzte eigene Frage vor{" "}
                  {Math.round(curiosity.cooldownMs / 1000)} s
                </p>
                <div>
                  <div className="font-semibold">Offene Wissenslücken</div>
                  <ul className="space-y-1 font-mono text-[11px] text-muted-foreground">
                    {curiosity.gaps.map((g) => (
                      <li key={`${g.nodeId}-${g.kind}`}>
                        {g.score.toFixed(3)} · {g.kind} · {g.topic} · R {g.relevance.toFixed(2)} · N{" "}
                        {g.novelty.toFixed(2)} · K {g.conversationalFit.toFixed(2)} ·{" "}
                        {g.memory.slice(0, 48)}
                      </li>
                    ))}
                    {curiosity.gaps.length === 0 && <li>keine offene Wissenslücke</li>}
                  </ul>
                </div>
                <p className="text-muted-foreground">
                  Letzte eigene Frage:{" "}
                  {curiosity.lastQuestion
                    ? `„${curiosity.lastQuestion.question}“ (${curiosity.lastQuestion.answered ? "beantwortet" : "offen"}) – ${curiosity.lastQuestion.reason}`
                    : "noch keine"}
                </p>
                <p className="text-[11px] text-muted-foreground">Wirkbereich: {curiosity.scope}</p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                noch nicht geprüft – die Prüfung erfolgt nur auf Knopfdruck, nicht im Takt.
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-1 font-bold">
              Verbindungen (W_min {W_MIN}, stark ab {STRONG_THRESHOLD})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-2">W(t)</th>
                    <th className="py-1 pr-2">W₀</th>
                    <th className="py-1 pr-2">I</th>
                    <th className="py-1 pr-2">λ</th>
                    <th className="py-1 pr-2">Aktivierungen</th>
                    <th className="py-1 pr-2">letzte Aktivierung</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.connections.slice(0, 12).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-1 pr-2 font-bold">{c.weight.toFixed(3)}</td>
                      <td className="py-1 pr-2">{c.storedWeight.toFixed(3)}</td>
                      <td className="py-1 pr-2">{c.importance.toFixed(2)}</td>
                      <td className="py-1 pr-2">{c.decayRate.toFixed(3)}</td>
                      <td className="py-1 pr-2">{c.activationCount}</td>
                      <td className="py-1 pr-2">{ts(c.lastActivatedAt)}</td>
                    </tr>
                  ))}
                  {snapshot.connections.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-2 text-muted-foreground">
                        keine Verbindungen
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="mb-1 font-bold">Aktive Erinnerungen</h3>
            <ul className="space-y-1">
              {snapshot.nodes.slice(0, 10).map((n) => (
                <li key={n.id} className="rounded-lg border border-border bg-background p-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {n.type} · I {n.importance.toFixed(2)} · A {n.activationCount} ·{" "}
                    {ts(n.lastAccessedAt)}
                  </span>
                  <div className="mt-0.5 line-clamp-2">{n.content}</div>
                </li>
              ))}
              {snapshot.nodes.length === 0 && (
                <li className="text-muted-foreground">keine Erinnerungen</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
