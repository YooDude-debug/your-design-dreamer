/**
 * P12 Adaptive Aufbewahrung – Oberfläche. SIMULATION auf synthetischem Laborgraph.
 * Keine ORB-Daten, kein Schreibweg, keine Speicherung. Berechnung nur auf Klick.
 */
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";

import type { LabParams } from "@/orb-core/synaptic-lab/simulation";
import {
  ADAPTIVE_MODELS,
  ADAPTIVE_REST_STEPS,
  ADAPTIVE_SEED_COUNT,
  DEFAULT_ADAPTIVE_PARAMS,
  PROFILES,
  clampAdaptiveParams,
  runAdaptiveValidation,
  type AdaptiveMetrics,
  type AdaptiveParams,
} from "@/orb-core/synaptic-lab/adaptive";

const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)} %`);
const avg = (ms: AdaptiveMetrics[], f: (m: AdaptiveMetrics) => number) =>
  ms.reduce((a, m) => a + f(m), 0) / ms.length;

const FIELDS: [keyof AdaptiveParams, string, number][] = [
  ["minRetention", "Mindestfrist", 1],
  ["maxRetention", "Höchstfrist", 1],
  ["weightRelevance", "Gewicht Relevanz (F)", 0.05],
  ["weightImportance", "Gewicht Wichtigkeit (F)", 0.05],
  ["weightReuse", "Gewicht Wiederverwendung (F)", 0.05],
];

export default function AdaptiveLab({ params }: { params: LabParams }) {
  const [a, setA] = useState<AdaptiveParams>(DEFAULT_ADAPTIVE_PARAMS);
  const [requested, setRequested] = useState<string | null>(null);
  const [reuseRest, setReuseRest] = useState<number>(80);
  const key = JSON.stringify([params, a]);
  const result = useMemo(
    () => (requested === key ? runAdaptiveValidation(params, clampAdaptiveParams(a)) : null),
    [requested, key, params, a],
  );

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-3"
      aria-label="Adaptive Aufbewahrung"
    >
      <h2 className="text-sm font-semibold">
        Adaptive Aufbewahrung D / E / F <span className="text-destructive">SIMULATION</span>
      </h2>
      <p className="text-[11px] text-muted-foreground">
        Nur synthetischer Laborgraph (40 Punkte), keine ORB-Memories. D: feste Frist (
        {params.dormantRetention}). E: Relevanz + Wichtigkeit. F: zusätzlich gemessene
        Wiederverwendung (nur Nutzungsphase, nicht Recall). Ruhe {ADAPTIVE_REST_STEPS.join(" / ")},{" "}
        {ADAPTIVE_SEED_COUNT} Seeds, identische Ereignisse je Seed.
      </p>
      <div className="flex flex-wrap gap-3">
        {FIELDS.map(([k, label, step]) => (
          <label key={k} className="flex flex-col text-[11px]">
            {label}
            <input
              type="number"
              step={step}
              aria-label={label}
              className="w-28 rounded border border-border bg-background px-2 py-1 text-xs"
              value={a[k]}
              onChange={(e) => setA({ ...a, [k]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <button
        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        onClick={() => setRequested(key)}
      >
        <FlaskConical className="h-4 w-4" /> Adaptive Validierung berechnen
      </button>

      {result && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Ruhe</th>
                  <th className="p-2">Modell</th>
                  <th className="p-2">Wiederauffindb. nach Ruhe / Ende Ø</th>
                  <th className="p-2">Zielstärke erreicht Ø</th>
                  <th className="p-2">Wichtige verloren Σ</th>
                  <th className="p-2">Expired Σ</th>
                  <th className="p-2">Rekonstruktionsrate</th>
                  <th className="p-2">Falsche Rekonstr.</th>
                  <th className="p-2">Dormant Spitze / Ende Ø</th>
                  <th className="p-2">Speicher ruhend Spitze / aktiv Ø</th>
                </tr>
              </thead>
              <tbody>
                {result.flatMap((r) =>
                  ADAPTIVE_MODELS.map((model, mi) => {
                    const ms = r.seeds.map((s) => s.metrics[mi]!);
                    const rest = ms.reduce((x, m) => x + m.restored, 0);
                    const dorm = ms.reduce((x, m) => x + m.dormantEverTracked, 0);
                    return (
                      <tr key={`${r.restSteps}-${model}`} className="border-t border-border">
                        <td className="p-2">{mi === 0 ? r.restSteps : ""}</td>
                        <td className="p-2 font-semibold">{model}</td>
                        <td className="p-2 font-mono">
                          {pct(avg(ms, (m) => m.retrievabilityAfterRest))} /{" "}
                          {pct(avg(ms, (m) => m.retrievabilityEnd))}
                        </td>
                        <td className="p-2 font-mono">
                          {avg(ms, (m) => m.targetReached).toFixed(1)} / {ms[0]!.tracked}
                        </td>
                        <td className="p-2 font-mono">
                          {ms.reduce((x, m) => x + m.importantLost, 0)}
                        </td>
                        <td className="p-2 font-mono">{ms.reduce((x, m) => x + m.expired, 0)}</td>
                        <td className="p-2 font-mono">{pct(dorm ? rest / dorm : null)}</td>
                        <td className="p-2 font-mono">
                          {ms.reduce((x, m) => x + m.falseReconstructions, 0)}
                        </td>
                        <td className="p-2 font-mono">
                          {avg(ms, (m) => m.dormantPeak).toFixed(1)} /{" "}
                          {avg(ms, (m) => m.dormantEnd).toFixed(1)}
                        </td>
                        <td className="p-2 font-mono">
                          {(avg(ms, (m) => m.dormantPeakBytes) / 1024).toFixed(1)} /{" "}
                          {(avg(ms, (m) => m.activeEndBytes) / 1024).toFixed(1)} KB
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
          <h3 className="text-xs font-semibold">
            Wiederauffindbar am Ende je Profil (D / E / F, Σ über Seeds)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5">Profil</th>
                  <th className="p-1.5">Frist D / E / F</th>
                  {result.map((r) => (
                    <th key={r.restSteps} className="p-1.5">
                      Ruhe {r.restSteps}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROFILES.map((pr) => (
                  <tr key={pr.id} className="border-t border-border">
                    <td className="p-1.5">{pr.label}</td>
                    <td className="p-1.5 font-mono">
                      {result[0]!.seeds[0]!.metrics.map(
                        (m) => m.perProfile[pr.id]?.retention ?? "–",
                      ).join(" / ")}
                    </td>
                    {result.map((r) => (
                      <td key={r.restSteps} className="p-1.5 font-mono">
                        {ADAPTIVE_MODELS.map((_, mi) => {
                          const v = r.seeds.reduce(
                            (x, s) => x + (s.metrics[mi]!.perProfile[pr.id]?.retrievable ?? 0),
                            0,
                          );
                          const n = r.seeds.reduce(
                            (x, s) => x + (s.metrics[mi]!.perProfile[pr.id]?.n ?? 0),
                            0,
                          );
                          return `${v}/${n}`;
                        }).join(" · ")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-semibold">
              Wiederverwendung je Profil (Σ über Seeds) – Ruhe
            </h3>
            <select
              aria-label="Ruhephase für Wiederverwendung"
              className="rounded border border-border bg-background px-2 py-0.5 text-xs"
              value={reuseRest}
              onChange={(e) => setReuseRest(Number(e.target.value))}
            >
              {result.map((r) => (
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
                  <th className="p-1.5">Tatsächliche Nutzung (Nutzungsphase)</th>
                  <th className="p-1.5">Geplanter Recall (separat)</th>
                  {ADAPTIVE_MODELS.map((m) => (
                    <th key={m} className="p-1.5">
                      {m}: Frist · dormant / rekonstr. / expired
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROFILES.map((pr) => {
                  const r = result.find((x) => x.restSteps === reuseRest) ?? result[0]!;
                  const sum = (
                    mi: number,
                    f: "reuse" | "plannedRecalls" | "dormant" | "restored" | "expired",
                  ) =>
                    r.seeds.reduce((x, s) => x + (s.metrics[mi]!.perProfile[pr.id]?.[f] ?? 0), 0);
                  return (
                    <tr key={pr.id} className="border-t border-border">
                      <td className="p-1.5">{pr.label}</td>
                      <td className="p-1.5 font-mono">{sum(0, "reuse")}</td>
                      <td className="p-1.5 font-mono">{sum(0, "plannedRecalls")}</td>
                      {ADAPTIVE_MODELS.map((m, mi) => (
                        <td key={m} className="p-1.5 font-mono">
                          {r.seeds[0]!.metrics[mi]!.perProfile[pr.id]?.retention ?? "–"} ·{" "}
                          {sum(mi, "dormant")} / {sum(mi, "restored")} / {sum(mi, "expired")}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Nutzung und geplanter Recall sind für D/E/F identisch (gleiche Ereignisfolge). Nur F
            verwendet die Nutzung für die Frist; geplanter Recall zählt nie als Wiederverwendung.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Gemessen wird nur der Zustand nach dem Recall; Wichtigkeit zählt nie als Erfolg.
            Rekonstruktion aus „dormant“ ist keine Reaktivierung; expired ist nicht
            wiederherstellbar.
          </p>
        </>
      )}
    </section>
  );
}
