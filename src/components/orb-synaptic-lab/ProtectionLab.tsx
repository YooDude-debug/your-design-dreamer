/**
 * P13 Gedächtnissicherung F / G / H – Oberfläche. SIMULATION auf synthetischem Laborgraph.
 * Keine ORB-Daten, kein Schreibweg, keine Speicherung. Berechnung nur auf Klick.
 */
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";

import type { LabParams } from "@/orb-core/synaptic-lab/simulation";
import {
  ADAPTIVE_SEED_COUNT,
  DEFAULT_ADAPTIVE_PARAMS,
  IMPORTANT_THRESHOLD,
  clampAdaptiveParams,
  type AdaptiveMetrics,
} from "@/orb-core/synaptic-lab/adaptive";
import {
  DEFAULT_PROTECTION_CAP,
  PROTECTION_MODELS,
  PROTECTION_PROFILES,
  PROTECTION_REST_STEPS,
  protectionRetention,
  runBudgetComparison,
  runProtectionValidation,
} from "@/orb-core/synaptic-lab/protection";

const pct = (v: number) => `${(v * 100).toFixed(1)} %`;
const avg = (ms: AdaptiveMetrics[], f: (m: AdaptiveMetrics) => number) =>
  ms.reduce((a, m) => a + f(m), 0) / ms.length;
const sum = (ms: AdaptiveMetrics[], f: (m: AdaptiveMetrics) => number) =>
  ms.reduce((a, m) => a + f(m), 0);

export default function ProtectionLab({ params }: { params: LabParams }) {
  const [minR, setMinR] = useState(DEFAULT_ADAPTIVE_PARAMS.minRetention);
  const [maxR, setMaxR] = useState(DEFAULT_ADAPTIVE_PARAMS.maxRetention);
  const [cap, setCap] = useState(DEFAULT_PROTECTION_CAP);
  const [rest, setRest] = useState(80);
  const [requested, setRequested] = useState<string | null>(null);
  const a = useMemo(
    () =>
      clampAdaptiveParams({ ...DEFAULT_ADAPTIVE_PARAMS, minRetention: minR, maxRetention: maxR }),
    [minR, maxR],
  );
  const capC = Math.max(0, Math.min(400, Math.round(cap) || 0));
  const key = JSON.stringify([params, a, capC]);
  const result = useMemo(
    () =>
      requested === key
        ? {
            val: runProtectionValidation(params, a, capC),
            budget: runBudgetComparison(params, a, capC),
          }
        : null,
    [requested, key, params, a, capC],
  );
  const num = (label: string, v: number, set: (n: number) => void) => (
    <label className="flex flex-col text-[11px]">
      {label}
      <input
        type="number"
        aria-label={label}
        className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
        value={v}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-3"
      aria-label="P13 Gedächtnissicherung"
    >
      <h2 className="text-sm font-semibold">
        P13 – Gedächtnissicherung F / G / H <span className="text-destructive">SIMULATION</span>
      </h2>
      <p className="text-[11px] text-muted-foreground">
        Nur synthetischer Laborgraph, keine ORB-Memories. F: Baseline (Relevanz + Wichtigkeit +
        gemessene Nutzung). G: Frist aus max(F-Score, Wichtigkeit). H: F-Frist + begrenzter Bonus
        (bis {capC} Schritte) nur ab Wichtigkeit {IMPORTANT_THRESHOLD}, nie über die Höchstfrist.
        Ruhe {PROTECTION_REST_STEPS.join(" / ")}, {ADAPTIVE_SEED_COUNT} Seeds, identische
        Ereignisse.
      </p>
      <div className="flex flex-wrap gap-3">
        {num("Mindestfrist (P13)", minR, setMinR)}
        {num("Höchstfrist (P13)", maxR, setMaxR)}
        {num("Schutz-Deckel H", cap, setCap)}
      </div>
      <button
        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        onClick={() => setRequested(key)}
      >
        <ShieldCheck className="h-4 w-4" /> Gedächtnissicherung berechnen
      </button>

      {result && (
        <>
          <h3 className="text-xs font-semibold">Ergebnisse je Ruhephase (SIMULATION)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Ruhe</th>
                  <th className="p-2">Modell</th>
                  <th className="p-2">Wiederauffindb. Ende Ø</th>
                  <th className="p-2">Rekonstr. Σ</th>
                  <th className="p-2">Reaktiv. Σ</th>
                  <th className="p-2">Dormant Spitze Ø</th>
                  <th className="p-2">Expired Σ</th>
                  <th className="p-2">Wichtige verloren Σ</th>
                  <th className="p-2">Unwichtige verloren Σ</th>
                  <th className="p-2">Ø Frist</th>
                  <th className="p-2">Nutzung / gepl. Recall Σ</th>
                </tr>
              </thead>
              <tbody>
                {result.val.flatMap((r) =>
                  PROTECTION_MODELS.map((m, mi) => {
                    const ms = r.seeds.map((s) => s.metrics[mi]!);
                    const pp = (f: "reuse" | "plannedRecalls") =>
                      sum(ms, (x) => Object.values(x.perProfile).reduce((y, v) => y + v[f], 0));
                    return (
                      <tr key={`${r.restSteps}-${m}`} className="border-t border-border">
                        <td className="p-2">{mi === 0 ? r.restSteps : ""}</td>
                        <td className="p-2 font-semibold">{m}</td>
                        <td className="p-2 font-mono">
                          {pct(avg(ms, (x) => x.retrievabilityEnd))}
                        </td>
                        <td className="p-2 font-mono">{sum(ms, (x) => x.restored)}</td>
                        <td className="p-2 font-mono">{sum(ms, (x) => x.reactivated)}</td>
                        <td className="p-2 font-mono">
                          {avg(ms, (x) => x.dormantPeak).toFixed(1)}
                        </td>
                        <td className="p-2 font-mono">{sum(ms, (x) => x.expired)}</td>
                        <td className="p-2 font-mono">{sum(ms, (x) => x.importantLost)}</td>
                        <td className="p-2 font-mono">{sum(ms, (x) => x.unimportantLost)}</td>
                        <td className="p-2 font-mono">
                          {avg(ms, (x) => x.avgRetention).toFixed(1)}
                        </td>
                        <td className="p-2 font-mono">
                          {pp("reuse")} / {pp("plannedRecalls")}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-semibold">Speicherverbrauch (SIMULATION)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Ruhe</th>
                  <th className="p-2">Modell</th>
                  <th className="p-2">Ruhend Spitze / aktiv Ende Ø</th>
                  <th className="p-2">Speicher × Zeit Ø (Verb.·Schritte)</th>
                </tr>
              </thead>
              <tbody>
                {result.val.flatMap((r) =>
                  PROTECTION_MODELS.map((m, mi) => {
                    const ms = r.seeds.map((s) => s.metrics[mi]!);
                    return (
                      <tr key={`${r.restSteps}-${m}`} className="border-t border-border">
                        <td className="p-2">{mi === 0 ? r.restSteps : ""}</td>
                        <td className="p-2 font-semibold">{m}</td>
                        <td className="p-2 font-mono">
                          {(avg(ms, (x) => x.dormantPeakBytes) / 1024).toFixed(1)} /{" "}
                          {(avg(ms, (x) => x.activeEndBytes) / 1024).toFixed(1)} KB
                        </td>
                        <td className="p-2 font-mono">
                          {avg(ms, (x) => x.dormantStepSum).toFixed(0)}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-semibold">
            Gleiches Speicherbudget (Budget = Speicher × Zeit von F, SIMULATION)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Ruhe</th>
                  <th className="p-2">Modell</th>
                  <th className="p-2">Höchstfrist im Budget</th>
                  <th className="p-2">Verbrauch / Budget</th>
                  <th className="p-2">Wichtige abrufbar Σ</th>
                  <th className="p-2">Unwichtige verloren Σ</th>
                </tr>
              </thead>
              <tbody>
                {result.budget.flatMap((r) =>
                  r.models.map((m, mi) => (
                    <tr key={`${r.restSteps}-${m.model}`} className="border-t border-border">
                      <td className="p-2">{mi === 0 ? r.restSteps : ""}</td>
                      <td className="p-2 font-semibold">{m.model}</td>
                      <td className="p-2 font-mono">{m.maxRetention}</td>
                      <td className={`p-2 font-mono ${m.withinBudget ? "" : "text-destructive"}`}>
                        {m.used.toFixed(0)} / {r.budget.toFixed(0)}
                        {m.withinBudget ? "" : " (über Budget)"}
                      </td>
                      <td className="p-2 font-mono">
                        {m.importantRetrievable}/{m.important}
                      </td>
                      <td className="p-2 font-mono">{m.unimportantLost}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold">Schutzentscheidungen je Profil – Ruhe</h3>
            <select
              aria-label="Ruhephase für Schutzentscheidungen"
              className="rounded border border-border bg-background px-2 py-0.5 text-xs"
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
            >
              {result.val.map((r) => (
                <option key={r.restSteps} value={r.restSteps}>
                  {r.restSteps}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5">Profil</th>
                  <th className="p-1.5">Relevanz</th>
                  <th className="p-1.5">Wichtigkeit</th>
                  <th className="p-1.5">Tatsächl. Nutzung je Verb.</th>
                  {PROTECTION_MODELS.map((m) => (
                    <th key={m} className="p-1.5">
                      {m}: Frist (+Schutz) · abrufbar / expired
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROTECTION_PROFILES.map((pr) => {
                  const r = result.val.find((x) => x.restSteps === rest) ?? result.val[0]!;
                  const s0 = r.seeds[0]!.metrics[0]!.perProfile[pr.id];
                  const reuse = s0 && s0.n ? s0.reuse / s0.n : 0;
                  const attr = {
                    relevance: pr.relevance,
                    importance: pr.importance,
                    reuse,
                    profile: pr.id,
                  };
                  return (
                    <tr key={pr.id} className="border-t border-border">
                      <td className="p-1.5">{pr.label}</td>
                      <td className="p-1.5 font-mono">{pr.relevance}</td>
                      <td className="p-1.5 font-mono">{pr.importance}</td>
                      <td className="p-1.5 font-mono">{reuse}</td>
                      {PROTECTION_MODELS.map((m, mi) => {
                        const d = protectionRetention(m, attr, a, params, capC);
                        const tot = (f: "retrievable" | "expired" | "n") =>
                          r.seeds.reduce(
                            (x, s) => x + (s.metrics[mi]!.perProfile[pr.id]?.[f] ?? 0),
                            0,
                          );
                        return (
                          <td key={m} className="p-1.5 font-mono">
                            {d.retention} (+{d.extension}) · {tot("retrievable")}/{tot("n")} /{" "}
                            {tot("expired")}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Endzustand = abrufbar am Ende des Recalls (Σ über Seeds) bzw. expired. Wichtigkeit zählt
            nie als Erfolg; geplanter Recall fließt in keine Frist ein; expired ist endgültig. Ein
            Vorteil, der nur unter höherer Frist oder mehr Speicher entsteht, zeigt sich in der
            Budget-Tabelle.
          </p>
        </>
      )}
    </section>
  );
}
