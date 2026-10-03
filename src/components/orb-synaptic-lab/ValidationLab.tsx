/**
 * P10 Robustheitsvalidierung – Oberfläche. SIMULATION, nur Arbeitsspeicher.
 * Kein Schreibweg, keine Speicherung, keine Tab-Signale. Berechnung nur auf Klick.
 */
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";

import { LAB_MODELS, type LabParams, type LabSnapshot } from "@/orb-core/synaptic-lab/simulation";
import { DEFAULT_LT_PARAMS } from "@/orb-core/synaptic-lab/longterm";
import {
  VALIDATION_REST_STEPS,
  VALIDATION_SEED_COUNT,
  runValidation,
  seedList,
} from "@/orb-core/synaptic-lab/validation";

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "–" : `${(v * 100).toFixed(1)} %`;

export default function ValidationLab({
  snapshot,
  params,
}: {
  snapshot: LabSnapshot;
  params: LabParams;
}) {
  const [requested, setRequested] = useState<string | null>(null);
  const key = JSON.stringify(params);
  const result = useMemo(
    () => (requested === key ? runValidation(snapshot, params, DEFAULT_LT_PARAMS) : null),
    [requested, key, snapshot, params],
  );
  const seeds = seedList(params.seed);

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-3"
      aria-label="Robustheitsvalidierung"
    >
      <h2 className="text-sm font-semibold">
        Robustheitsvalidierung: Ruhephasen × Seeds{" "}
        <span className="text-destructive">SIMULATION</span>
      </h2>
      <p className="text-[11px] text-muted-foreground">
        Ruhephasen {VALIDATION_REST_STEPS.join(" / ")} Schritte, {VALIDATION_SEED_COUNT} Seeds (
        {seeds[0]}–{seeds[seeds.length - 1]}). Je Seed identische Ereignisfolge für A/B/C. Werte
        werden erst nach Klick berechnet.
      </p>
      <button
        className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        onClick={() => setRequested(key)}
      >
        <FlaskConical className="h-4 w-4" /> Validierung berechnen
      </button>

      {result && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Ruhe</th>
                  <th className="p-2">Modell</th>
                  <th className="p-2">Wiederauffindb. Ø</th>
                  <th className="p-2">Min / Max</th>
                  <th className="p-2">Std.-Abw.</th>
                  <th className="p-2">Reaktiv.-Quote</th>
                  <th className="p-2">Zielstärke gehalten / wiederhergestellt / nicht</th>
                  <th className="p-2">Verloren</th>
                  <th className="p-2">Falsche Reaktiv.</th>
                  <th className="p-2">Kontrollen entstanden</th>
                </tr>
              </thead>
              <tbody>
                {result.flatMap((r) =>
                  r.aggregate.map((a, i) => (
                    <tr key={`${r.restSteps}-${a.model}`} className="border-t border-border">
                      <td className="p-2">{i === 0 ? r.restSteps : ""}</td>
                      <td className="p-2 font-semibold">{a.model}</td>
                      <td className="p-2 font-mono">{pct(a.retrievability?.mean)}</td>
                      <td className="p-2 font-mono">
                        {pct(a.retrievability?.min)} / {pct(a.retrievability?.max)}
                      </td>
                      <td className="p-2 font-mono">{pct(a.retrievability?.std)}</td>
                      <td className="p-2 font-mono">{pct(a.reactivationRate)}</td>
                      <td className="p-2 font-mono">
                        {a.targetHeld} / {a.recovered} / {a.targetNotReached}
                      </td>
                      <td className="p-2 font-mono">{a.lost}</td>
                      <td className="p-2 font-mono">{a.falseReactivations}</td>
                      <td className="p-2 font-mono">{a.controlsPresent}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <h3 className="text-xs font-semibold">
            Wiederauffindbarkeit nach Abruf je Seed (A / B / C)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-1.5">Seed</th>
                  {result.map((r) => (
                    <th key={r.restSteps} className="p-1.5">
                      Ruhe {r.restSteps}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seeds.map((seed, si) => (
                  <tr key={seed} className="border-t border-border">
                    <td className="p-1.5 font-mono">{seed}</td>
                    {result.map((r) => {
                      const ms = r.seeds[si]!.metrics;
                      const worse = r.cWorseSeeds.includes(seed);
                      return (
                        <td
                          key={r.restSteps}
                          className={`p-1.5 font-mono ${worse ? "bg-destructive/15 text-destructive" : ""}`}
                          title={worse ? "C schneidet hier schlechter ab als A oder B" : undefined}
                        >
                          {ms.map((m) => pct(m.retrievabilityEnd)).join(" / ")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Rot markiert: C hat bei diesem Seed eine geringere Wiederauffindbarkeit als A oder B (
            {result.map((r) => `Ruhe ${r.restSteps}: ${r.cWorseSeeds.length}×`).join(", ")}).
            „Gehalten“ zählt nicht als Wiederherstellung. Kontrollpaare werden nie als Reaktivierung
            gezählt. Modelle: {LAB_MODELS.join(", ")}.
          </p>
        </>
      )}
    </section>
  );
}
