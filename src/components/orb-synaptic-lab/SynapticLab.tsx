/**
 * ORB Synaptic Lab – Oberfläche. Alle Simulationsdaten liegen nur im
 * React-Zustand dieser Seite; Reset/Verlassen verwirft sie vollständig.
 * Datenquelle: getOrbKnowledgeGraph (Admin, eigenes Konto, ein Bereich, nur SELECT).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";

import { useSession } from "@/lib/use-session";
import { getOrbKnowledgeGraph } from "@/lib/orb-knowledge-graph.functions";
import type { OrbDataScope } from "@/orb-core/scope-values";
import {
  DEFAULT_LAB_PARAMS,
  LAB_LIMITS,
  LAB_MODELS,
  WEAK_THRESHOLD,
  buildPool,
  clampParams,
  generateEvents,
  initModel,
  metricsOf,
  setCandidateStatus,
  stepModel,
  strengthAt,
  toLabSnapshot,
  type LabModelId,
  type LabParams,
  type LabSnapshot,
  type ModelState,
} from "@/orb-core/synaptic-lab/simulation";
import LongTermLab from "./LongTermLab";
import ValidationLab from "./ValidationLab";
import AdaptiveLab from "./AdaptiveLab";

const MAX_STEPS = 400;
const VIEW_NODES = 80;

const MODEL_LABEL: Record<LabModelId, string> = {
  A: "A · Unbegrenztes Wachstum",
  B: "B · Wachstum + Verfall",
  C: "C · Wachstum + Verfall + Verstärkung",
  D: "D · C + reversibles Pruning (dormant)",
};

export default function SynapticLab({ scope }: { scope: OrbDataScope }) {
  const fetchGraph = useServerFn(getOrbKnowledgeGraph);
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const graph = useQuery({
    queryKey: ["orb-synaptic-lab-source", userId, scope],
    queryFn: () => fetchGraph({ data: { scope } }),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    enabled: !!userId,
  });

  // Eingefrorener Snapshot: nur IDs, Gruppe, Kanten – keine Inhalte.
  const snapshot: LabSnapshot | null = useMemo(
    () => (graph.data ? toLabSnapshot(graph.data) : null),
    [graph.data],
  );

  const [params, setParams] = useState<LabParams>(DEFAULT_LAB_PARAMS);
  const [running, setRunning] = useState(false);
  const [tempo, setTempo] = useState(4);
  const [states, setStates] = useState<ModelState[]>(() => LAB_MODELS.map(initModel));
  const [selected, setSelected] = useState<string | null>(null);

  const { poolMap, events } = useMemo(() => {
    if (!snapshot) return { poolMap: new Map(), events: [] };
    const pool = buildPool(snapshot);
    return {
      poolMap: new Map(pool.map((e) => [e.key, e])),
      events: generateEvents(pool, params, MAX_STEPS),
    };
  }, [snapshot, params]);

  const reset = () => {
    setRunning(false);
    setSelected(null);
    setStates(LAB_MODELS.map(initModel));
  };
  // Parameteränderung ⇒ neuer, reproduzierbarer Lauf ab Schritt 0.
  useEffect(reset, [params, snapshot]);

  const step = () =>
    setStates((prev) => {
      const ev = events[prev[0]!.step];
      if (!ev) {
        setRunning(false);
        return prev;
      }
      return prev.map((s) => stepModel(s, ev, poolMap, params));
    });

  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => stepRef.current(), 1000 / tempo);
    return () => window.clearInterval(id);
  }, [running, tempo]);

  const mark = (key: string, status: "confirmed" | "rejected") =>
    setStates((prev) => prev.map((s) => setCandidateStatus(s, key, status)));

  if (!userId || graph.isLoading)
    return <p className="p-6 text-sm text-muted-foreground">Snapshot wird gelesen …</p>;
  if (graph.isError || !snapshot)
    return <p className="p-6 text-sm text-destructive">Snapshot konnte nicht gelesen werden.</p>;

  const cur = states[0]!.step;
  const viewNodes = [...snapshot.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, VIEW_NODES);
  const pos = new Map(
    viewNodes.map((n, i) => {
      const a = (i / Math.max(1, viewNodes.length)) * Math.PI * 2;
      return [n.id, { x: 50 + 42 * Math.cos(a), y: 50 + 42 * Math.sin(a) }];
    }),
  );
  const num = (k: keyof LabParams, v: string) =>
    setParams((p) => clampParams({ ...p, [k]: Number(v) }));

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 pt-16">
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Forschungsexperiment. Datenquelle: eingefrorener, nur gelesener Snapshot deines Bereichs „
        {scope}“ ({snapshot.nodes.length} Knoten, {snapshot.edges.length} Kanten). Alle Kandidaten
        und Aktivierungen sind <strong>simuliert</strong> – keine echten ORB-Gedanken oder Abrufe –
        und existieren nur in dieser Seite. Es wird nichts gespeichert; Reset oder Verlassen
        verwirft alles.
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3">
        <button
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? "Pause" : "Start"}
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Pause" : "Start"}
        </button>
        <button
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          onClick={step}
          disabled={running}
        >
          <StepForward className="h-4 w-4" /> Schritt
        </button>
        <button
          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          onClick={reset}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <span className="text-xs text-muted-foreground">
          Schritt {cur} / {MAX_STEPS}
        </span>
        <Field label={`Tempo ${tempo}/s`}>
          <input
            type="range"
            min={1}
            max={30}
            value={tempo}
            onChange={(e) => setTempo(Number(e.target.value))}
          />
        </Field>
        <Field label="Seed">
          <input
            className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            type="number"
            value={params.seed}
            onChange={(e) => num("seed", e.target.value)}
          />
        </Field>
        {(
          [
            ["growthRate", "Wachstum/Schritt", 1],
            ["decay", "Verfall λ", 0.01],
            ["reinforcement", "Verstärkung η", 0.05],
            ["activationRate", "Aktivierungen/Schritt", 1],
            ["pruneThreshold", "Pruning-Schwelle", 0.01],
            ["maxCandidates", "Max. Kandidaten", 10],
            ["dormantRetention", "Aufbewahrung D (Schritte)", 5],
          ] as const
        ).map(([k, label, stepV]) => (
          <Field key={k} label={label}>
            <input
              className="w-24 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              type="number"
              min={LAB_LIMITS[k][0]}
              max={LAB_LIMITS[k][1]}
              step={stepV}
              value={params[k]}
              onChange={(e) => num(k, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {states.map((s) => (
          <ModelPanel
            key={s.model}
            state={s}
            snapshot={snapshot}
            params={params}
            pos={pos}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      </div>

      <Legend />

      {selected && (
        <div className="rounded-xl border border-border bg-surface p-3 text-xs">
          <p className="mb-2 font-semibold">Kandidat (Hypothese, kein Nutzerfakt)</p>
          {states.map((s) => {
            const c = s.candidates.get(selected);
            return (
              <p key={s.model} className="text-muted-foreground">
                {s.model}:{" "}
                {c
                  ? `${c.relation} · ${c.origin} · Konfidenz ${c.confidence.toFixed(2)} · Stärke ${strengthAt(c, s.step, s.model, params.decay).toFixed(3)} · erstellt ${c.createdStep} · letzte Aktivierung ${c.lastActivatedStep} · ${c.activationCount}× · ${c.status} · ${c.lifecycle}`
                  : "nicht vorhanden"}
              </p>
            );
          })}
          <div className="mt-2 flex gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              onClick={() => mark(selected, "confirmed")}
            >
              Experimentell bestätigen
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              onClick={() => mark(selected, "rejected")}
            >
              Verwerfen
            </button>
          </div>
          <p className="mt-1 text-muted-foreground">
            Wirkt nur im Labor, nie auf ORB-Erinnerungen.
          </p>
        </div>
      )}

      <MetricsTable states={states} snapshot={snapshot} params={params} />

      <LongTermLab snapshot={snapshot} params={params} />

      <ValidationLab snapshot={snapshot} params={params} />
      <AdaptiveLab params={params} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function ModelPanel(props: {
  state: ModelState;
  snapshot: LabSnapshot;
  params: LabParams;
  pos: Map<string, { x: number; y: number }>;
  selected: string | null;
  onSelect: (k: string) => void;
}) {
  const { state, snapshot, params, pos } = props;
  return (
    <section className="rounded-xl border border-border bg-surface p-2">
      <h2 className="px-1 text-xs font-semibold">{MODEL_LABEL[state.model]}</h2>
      <svg
        viewBox="0 0 100 100"
        className="aspect-square w-full"
        role="img"
        aria-label={MODEL_LABEL[state.model]}
      >
        {snapshot.edges.map((e, i) => {
          const a = pos.get(e.source);
          const b = pos.get(e.target);
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className="stroke-muted-foreground"
              strokeWidth={0.25}
              strokeOpacity={0.5}
            />
          );
        })}
        {[...state.candidates.values()].map((c) => {
          const a = pos.get(c.source);
          const b = pos.get(c.target);
          // Expired: nur noch historische Statistik, nicht mehr im Graphen.
          if (!a || !b || c.lifecycle === "expired") return null;
          const s = strengthAt(c, state.step, state.model, params.decay);
          const removed = c.lifecycle === "removed";
          const dormant = c.lifecycle === "dormant";
          const restoredNow = c.restoredStep === state.step;
          const cls =
            c.status === "rejected" || removed
              ? "stroke-destructive"
              : dormant
                ? "stroke-muted-foreground"
                : c.lifecycle === "reactivated" || restoredNow
                  ? "stroke-accent-foreground"
                  : c.status === "confirmed"
                    ? "stroke-foreground"
                    : "stroke-primary";
          return (
            <line
              key={c.key}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={`${cls} cursor-pointer`}
              strokeDasharray={dormant ? "0.4 0.8" : c.status === "confirmed" ? undefined : "1 0.8"}
              strokeWidth={props.selected === c.key ? 1 : 0.15 + 0.6 * s}
              strokeOpacity={removed ? 0.12 : dormant ? 0.3 : s < WEAK_THRESHOLD ? 0.35 : 0.9}
              onClick={() => props.onSelect(c.key)}
            />
          );
        })}
        {[...pos.entries()].map(([id, p]) => (
          <circle key={id} cx={p.x} cy={p.y} r={0.9} className="fill-foreground" />
        ))}
      </svg>
    </section>
  );
}

function Legend() {
  return (
    <p className="text-[11px] text-muted-foreground">
      Graue durchgezogene Linien: Ausgangsdaten (produktiv, nur gelesen). Gestrichelt:
      experimentelle Hypothesen, Dicke = synaptische Stärke, blass = schwach. Hervorgehoben:
      reaktiviert. Rot/blass: experimentell entfernt oder verworfen. Durchgezogen hell: im Labor
      bestätigt. Darstellung zeigt bis zu {VIEW_NODES} Knoten; gerechnet wird mit allen.
    </p>
  );
}

function MetricsTable({
  states,
  snapshot,
  params,
}: {
  states: ModelState[];
  snapshot: LabSnapshot;
  params: LabParams;
}) {
  const m = states.map((s) => metricsOf(s, snapshot, params));
  const pct = (v: number | null) => (v === null ? "–" : `${(v * 100).toFixed(1)} %`);
  const rows: [string, (x: (typeof m)[number]) => string][] = [
    ["Knoten", (x) => String(x.nodes)],
    ["Verbindungen (Basis + aktive Kandidaten)", (x) => String(x.baseEdges + x.liveCandidates)],
    ["Neue Kandidaten im letzten Schritt", (x) => String(x.growthLastStep)],
    ["Anteil schwacher Verbindungen", (x) => pct(x.weakShare)],
    ["Anteil reaktivierter Verbindungen", (x) => pct(x.reactivatedShare)],
    ["Wiederauffindbarkeit (simulierte Abfragen)", (x) => pct(x.retrievability)],
    ["Unbestätigte Hypothesen", (x) => String(x.unconfirmed)],
    ["Verworfene Hypothesen", (x) => String(x.rejected)],
    ["Active (abrufbar, nicht schwach)", (x) => String(x.activeCount)],
    ["Weak (abrufbar, schwach)", (x) => String(x.weakCount)],
    ["davon Reactivated (in diesem Schritt)", (x) => String(x.reactivatedCount)],
    ["Dormant (ruhend, rekonstruierbar)", (x) => String(x.dormant)],
    ["Expired (Aufbewahrung abgelaufen)", (x) => String(x.expired)],
    ["Endgültig entfernt (B/C, ohne Dormant/Expired)", (x) => String(x.removed)],
    [
      "Nicht abrufbar gesamt (Entfernt + Dormant + Expired)",
      (x) => String(x.removed + x.dormant + x.expired),
    ],
    [
      "Speicher aktiv / ruhend / Endzustand",
      (x) =>
        `${(x.activeBytes / 1024).toFixed(1)} / ${(x.dormantBytes / 1024).toFixed(1)} / ${(x.tombstoneBytes / 1024).toFixed(1)} KB`,
    ],
    [
      "Gespeicherte Datensätze / ca. Speicher",
      (x) => `${x.storedRecords} / ${(x.approxBytes / 1024).toFixed(1)} KB`,
    ],
    ["Rechenoperationen (kumuliert)", (x) => String(x.ops)],
  ];
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="p-2">Messgrösse</th>
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
              {m.map((x, i) => (
                <td key={i} className="p-2 font-mono">
                  {f(x)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
