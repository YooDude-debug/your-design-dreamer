/**
 * P9 Langzeittest – Oberfläche. SIMULATION, nur Arbeitsspeicher dieser Seite.
 * Kein Schreibweg, keine Speicherung, keine Tab-Signale.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";

import {
  LAB_MODELS,
  WEAK_THRESHOLD,
  type LabParams,
  type LabSnapshot,
} from "@/orb-core/synaptic-lab/simulation";
import {
  DEFAULT_LT_PARAMS,
  LT_LIMITS,
  clampLtParams,
  runLongTerm,
  type LongTermParams,
  type LtPhase,
} from "@/orb-core/synaptic-lab/longterm";

const PHASE_LABEL: Record<LtPhase, string> = {
  build: "1 · Aufbau",
  rest: "2 · Ruhephase (keine Aktivierungen)",
  recall: "3 · Gezielte Reaktivierung",
};
const btn =
  "inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50";

export default function LongTermLab({
  snapshot,
  params,
}: {
  snapshot: LabSnapshot;
  params: LabParams;
}) {
  const [lt, setLt] = useState<LongTermParams>(DEFAULT_LT_PARAMS);
  const run = useMemo(() => runLongTerm(snapshot, params, lt), [snapshot, params, lt]);
  const total = run.plan.events.length;
  const [cursor, setCursor] = useState(0); // Anzahl ausgeführter Schritte
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRunning(false);
    setCursor(0);
  }, [run]);

  const step = () => setCursor((c) => (c >= total ? c : c + 1));
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => stepRef.current(), 250);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (cursor >= total) setRunning(false);
  }, [cursor, total]);

  const phase: LtPhase | null = cursor > 0 ? run.plan.events[cursor - 1]!.phase : null;
  const activeNow = new Set(cursor > 0 ? run.plan.events[cursor - 1]!.activate : []);
  const restEnd = lt.buildSteps + lt.restSteps;
  const done = cursor >= total;
  const num = (k: keyof LongTermParams, v: string) =>
    setLt((p) => clampLtParams({ ...p, [k]: Number(v) }));

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface p-3"
      aria-label="Langzeittest"
    >
      <h2 className="text-sm font-semibold">
        Langzeittest: Ruhephase & Reaktivierung <span className="text-destructive">SIMULATION</span>
      </h2>
      <p className="text-[11px] text-muted-foreground">
        Alle Ereignisse sind simuliert, gleich für A/B/C und nur aus Seed + Parametern abgeleitet.
        {` ${run.plan.tracked.length}`} beobachtete Hypothesen, {run.plan.controls.length} nie
        erzeugte Kontrollpaare.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <button className={btn} onClick={() => setRunning((r) => !r)} disabled={done}>
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Pause" : "Start"}
        </button>
        <button className={btn} onClick={step} disabled={running || done}>
          <StepForward className="h-4 w-4" /> Schritt
        </button>
        <button
          className={btn}
          onClick={() => {
            setRunning(false);
            setCursor(0);
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <span className="text-xs text-muted-foreground">
          Schritt {cursor} / {total} · {phase ? PHASE_LABEL[phase] : "nicht gestartet"}
        </span>
        {(
          [
            ["buildSteps", "Aufbau-Schritte"],
            ["restSteps", "Ruhe-Schritte"],
            ["recallSteps", "Abruf-Schritte"],
            ["trackedCount", "Beobachtet"],
            ["recoveryStrength", "Zielstärke"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {label}
            <input
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              type="number"
              step={k === "recoveryStrength" ? 0.05 : 1}
              min={LT_LIMITS[k][0]}
              max={LT_LIMITS[k][1]}
              value={lt[k]}
              onChange={(e) => num(k, e.target.value)}
            />
          </label>
        ))}
      </div>

      {/* Zeitleiste der drei Phasen */}
      <div
        className="relative flex h-5 w-full overflow-hidden rounded-md text-[10px]"
        aria-label="Phasen"
      >
        {(
          [
            ["build", lt.buildSteps, "bg-primary/30"],
            ["rest", lt.restSteps, "bg-muted"],
            ["recall", lt.recallSteps, "bg-accent"],
          ] as const
        ).map(([ph, n, cls]) =>
          n > 0 ? (
            <div
              key={ph}
              className={`${cls} flex items-center justify-center truncate px-1`}
              style={{ width: `${(n / total) * 100}%` }}
            >
              {PHASE_LABEL[ph]}
            </div>
          ) : null,
        )}
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${(cursor / total) * 100}%` }}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {run.traces.map((t) => (
          <div key={t.model} className="rounded-lg border border-border p-2">
            <p className="mb-1 text-xs font-semibold">Modell {t.model}</p>
            <svg
              viewBox={`0 0 ${total} 100`}
              preserveAspectRatio="none"
              className="h-24 w-full"
              role="img"
              aria-label={`Stärkeverlauf Modell ${t.model}`}
            >
              <rect
                x={lt.buildSteps}
                y={0}
                width={lt.restSteps}
                height={100}
                className="fill-muted"
              />
              <line
                x1={0}
                x2={total}
                y1={100 - WEAK_THRESHOLD * 100}
                y2={100 - WEAK_THRESHOLD * 100}
                className="stroke-muted-foreground"
                strokeDasharray="2 2"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
              {run.plan.tracked.map((key, i) => {
                const pts: string[] = [];
                for (let s = 0; s < cursor; s++) {
                  const x = t.samples[s]![i]!;
                  if (x.present) pts.push(`${s + 1},${100 - x.strength! * 100}`);
                }
                return (
                  <polyline
                    key={key}
                    points={pts.join(" ")}
                    fill="none"
                    className="stroke-primary"
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
            <div className="mt-1 flex flex-wrap gap-1">
              {run.plan.tracked.map((key, i) => {
                const x = cursor > 0 ? t.samples[cursor - 1]![i]! : null;
                const lit = activeNow.has(key) && x?.present && phase === "recall";
                return (
                  <span
                    key={key}
                    title={
                      x
                        ? x.present
                          ? `${x.lifecycle} · ${x.strength!.toFixed(3)}`
                          : "entfernt – nicht abrufbar"
                        : "noch nicht erzeugt"
                    }
                    className={`h-3 w-3 rounded-full border border-border ${
                      !x || !x.strength
                        ? x && !x.present
                          ? "bg-destructive/40"
                          : "bg-background"
                        : lit
                          ? "bg-primary ring-2 ring-primary"
                          : x.strength < WEAK_THRESHOLD
                            ? "bg-primary/30"
                            : "bg-primary/80"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Grau hinterlegt: Ruhephase. Gestrichelt: Schwelle „schwach“. Punkte = beobachtete
        Hypothesen; leuchtend = in diesem Schritt abgerufen und vorhanden; rot = experimentell
        entfernt.
      </p>

      <LtTable run={run} cursor={cursor} restEnd={restEnd} buildEnd={lt.buildSteps} done={done} />
    </section>
  );
}

function LtTable(props: {
  run: ReturnType<typeof runLongTerm>;
  cursor: number;
  buildEnd: number;
  restEnd: number;
  done: boolean;
}) {
  const { run, cursor, buildEnd, restEnd, done } = props;
  const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)} %`);
  // Werte erst anzeigen, wenn der Lauf die jeweilige Phase erreicht hat.
  const gate = (ok: boolean, s: string) => (ok ? s : "…");
  type M = (typeof run.metrics)[number];
  const rows: [string, (m: M) => string][] = [
    [
      "Wiederauffindbarkeit vor Ruhe",
      (m) => gate(cursor >= buildEnd, pct(m.retrievabilityBeforeRest)),
    ],
    [
      "Wiederauffindbarkeit nach Ruhe",
      (m) => gate(cursor >= restEnd, pct(m.retrievabilityAfterRest)),
    ],
    ["Wiederauffindbarkeit nach Abruf", (m) => gate(done, pct(m.retrievabilityEnd))],
    ["Überlebende Verbindungen (nach Ruhe)", (m) => gate(cursor >= restEnd, pct(m.survivalShare))],
    [
      "Vorhanden, aber schwach (nach Ruhe)",
      (m) => gate(cursor >= restEnd, `${pct(m.weakShareAfterRest)} (${m.weakPresentAfterRest})`),
    ],
    [
      "Tatsächlich reaktiviert / Quote",
      (m) => gate(done, `${m.reactivated} / ${pct(m.reactivationRate)}`),
    ],
    [
      "Ø Abruf-Schritte bis Zielstärke",
      (m) =>
        gate(
          done,
          m.meanStepsToRecovery === null
            ? "nie erreicht"
            : `${m.meanStepsToRecovery.toFixed(1)} (${m.recovered}×)`,
        ),
    ],
    ["Endgültig nicht mehr abrufbar", (m) => gate(done, String(m.lost))],
    ["Falsche Reaktivierungen", (m) => gate(done, String(m.falseReactivations))],
    ["Neu erzeugte Hypothesen", (m) => gate(done, String(m.hypothesesCreated))],
    [
      "ca. Speicher / Rechenoperationen",
      (m) => gate(done, `${(m.approxBytes / 1024).toFixed(1)} KB / ${m.ops}`),
    ],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="p-2">Messgrösse (SIMULATION)</th>
            {LAB_MODELS.map((k) => (
              <th key={k} className="p-2">
                Modell {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label} className="border-t border-border">
              <td className="p-2 text-muted-foreground">{label}</td>
              {run.metrics.map((m, i) => (
                <td key={i} className="p-2 font-mono">
                  {f(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
