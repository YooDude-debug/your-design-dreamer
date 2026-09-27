/**
 * ORB Knowledge Graph – Bühne (Experiment, nur Lesen).
 *
 * Datenquelle: getOrbKnowledgeGraph (nur SELECT), alle 4 s gelesen.
 * Hervorhebung NUR bei nachweisbarer Änderung gespeicherter ORB-Werte
 * (diffGraphs). Alles andere wird ausdrücklich als "nicht verfügbar" gezeigt.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { getOrbKnowledgeGraph, type KgGraph } from "@/lib/orb-knowledge-graph.functions";
import { diffGraphs, type KgActivationEvent } from "@/lib/orb-knowledge-graph/diff";
import { KnowledgeGraphEngine } from "@/lib/orb-knowledge-graph/graph-engine";

const POLL_MS = 4000;
const NA = "nicht verfügbar";

function pct(v: number | undefined | null) {
  return typeof v === "number" ? `${Math.round(v * 100)} %` : NA;
}
function time(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString() : NA;
}

export default function KnowledgeGraphStage() {
  const load = useServerFn(getOrbKnowledgeGraph);
  const q = useQuery({
    queryKey: ["orb-knowledge-graph"],
    queryFn: () => load(),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<KnowledgeGraphEngine | null>(null);
  const prevRef = useRef<KgGraph | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<KgActivationEvent[]>([]);
  const [eventIdx, setEventIdx] = useState(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new KnowledgeGraphEngine(hostRef.current, setSelected);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const graph = q.data;
  useEffect(() => {
    const engine = engineRef.current;
    if (!graph || !engine) return;
    const prev = prevRef.current;
    const structureChanged =
      !prev || prev.nodes.length !== graph.nodes.length || prev.edges.length !== graph.edges.length;
    if (structureChanged) {
      engine.setData(
        graph.nodes.map((n) => ({ id: n.id, type: n.type, importance: n.importance })),
        graph.edges.map((e) => ({
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          weight: e.weight,
        })),
      );
    }
    if (prev) {
      const ev = diffGraphs(prev, graph);
      if (ev) {
        engine.pulseNodes(ev.nodes.map((n) => n.id));
        engine.pulseEdges(ev.edges.map((e) => e.id));
        const members = graph.threads
          .filter((t) => ev.threads.some((x) => x.id === t.id))
          .flatMap((t) => t.nodeIds);
        engine.pulseThreadMembers(members);
        setEvents((list) => [ev, ...list].slice(0, 20));
        setEventIdx(0);
      }
    }
    prevRef.current = graph;
  }, [graph]);

  useEffect(() => engineRef.current?.select(selected), [selected]);

  const replay = (ev: KgActivationEvent) => {
    const engine = engineRef.current;
    if (!engine || !graph) return;
    engine.pulseNodes(ev.nodes.map((n) => n.id));
    engine.pulseEdges(ev.edges.map((e) => e.id));
    engine.pulseThreadMembers(
      graph.threads.filter((t) => ev.threads.some((x) => x.id === t.id)).flatMap((t) => t.nodeIds),
    );
  };

  const node = useMemo(() => graph?.nodes.find((n) => n.id === selected) ?? null, [graph, selected]);
  const nodeEdges = useMemo(
    () =>
      graph && selected
        ? graph.edges.filter((e) => e.sourceNodeId === selected || e.targetNodeId === selected)
        : [],
    [graph, selected],
  );
  const lastEvent = events[eventIdx] ?? null;
  const lastActivated = events.find((e) => e.nodes.length)?.nodes ?? [];
  const activeThread = lastEvent?.threads[0]
    ? graph?.threads.find((t) => t.id === lastEvent.threads[0]!.id)
    : null;

  return (
    <div className="relative h-[100svh] w-full">
      <div ref={hostRef} className="absolute inset-0" aria-label="ORB Wissensgraph 3D" />

      {q.isError && (
        <p className="absolute left-3 top-16 z-10 rounded-lg border border-destructive bg-surface/90 p-3 text-sm text-destructive">
          Daten konnten nicht gelesen werden.
        </p>
      )}

      {/* Telemetrie-Panel */}
      <aside className="absolute left-3 top-16 z-10 max-h-[70svh] w-72 overflow-y-auto rounded-xl border border-border/60 bg-surface/85 p-3 text-xs backdrop-blur-md">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Telemetrie
        </h2>
        <Legend />
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
          <Row k="Energy" v={pct(graph?.state?.energy)} src="orb_state" />
          <Row k="Curiosity" v={pct(graph?.state?.curiosity)} src="orb_state" />
          <Row k="Nodes / Kanten" v={graph ? `${graph.nodes.length} / ${graph.edges.length}` : NA} src="DB" />
          <Row k="Aktueller Thread" v={activeThread?.title ?? NA} src={activeThread ? "orb_threads" : undefined} />
          <Row
            k="Zuletzt aktivierte Nodes"
            v={lastActivated.length ? String(lastActivated.length) : NA}
            src={lastActivated.length ? "DB-Zeitstempel" : undefined}
          />
          <Row k="Letzte Entscheidung" v={graph?.lastOrbMessage?.decision ?? NA} src={graph?.lastOrbMessage ? "orb_messages" : undefined} />
          <Row k="Relevanz-/Score je Abruf" v={NA} />
          <Row k="Knowledge Gap" v={NA} />
          <Row k="Autonomy-Status" v={NA} />
          <Row k="Processing-ID" v={NA} />
          <Row k="Model-/Request-ID" v={NA} />
          <Row k="Gelesen" v={time(graph?.readAt)} />
        </dl>
        {lastActivated.length > 0 && (
          <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
            {lastActivated.map((n) => n.id.slice(0, 8)).join(" · ")}
          </p>
        )}
      </aside>

      {/* Debug: Verarbeitung nachvollziehen */}
      <aside className="absolute bottom-20 left-3 z-10 w-72 rounded-xl border border-border/60 bg-surface/85 p-3 text-xs backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Debug-Ablauf
          </h2>
          <span className="text-muted-foreground">{events.length} Ereignisse</span>
        </div>
        {lastEvent ? (
          <>
            <ol className="space-y-1">
              <Step label="Processing" value={`zwischen ${time(lastEvent.windowFrom)} und ${time(lastEvent.windowTo)}`} kind="derived" />
              <Step label="Retrieval" value={`${lastEvent.nodes.length} Nodes, ${lastEvent.edges.length} Kanten`} kind="stored" />
              <Step label="Memories" value={lastEvent.nodes.map((n) => n.id.slice(0, 8)).join(", ") || "–"} kind="stored" />
              <Step label="Scores" value={NA} kind="na" />
              <Step label="Knowledge Gap" value={NA} kind="na" />
              <Step label="Decision" value={lastEvent.lastOrbMessageChanged ? graph?.lastOrbMessage?.decision ?? NA : NA} kind={lastEvent.lastOrbMessageChanged ? "stored" : "na"} />
              <Step label="Output" value={lastEvent.lastOrbMessageChanged ? `Nachricht ${time(graph?.lastOrbMessage?.createdAt)}` : NA} kind={lastEvent.lastOrbMessageChanged ? "stored" : "na"} />
            </ol>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 hover:border-brand"
                onClick={() => replay(lastEvent)}
              >
                Erneut abspielen
              </button>
              <button
                type="button"
                disabled={eventIdx >= events.length - 1}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                onClick={() => setEventIdx((i) => i + 1)}
              >
                Älter
              </button>
              <button
                type="button"
                disabled={eventIdx === 0}
                className="rounded-md border border-border px-2 py-1 disabled:opacity-40"
                onClick={() => setEventIdx((i) => i - 1)}
              >
                Neuer
              </button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            Noch keine gespeicherte Aktivität beobachtet. Schreibe ORB im ORB-Kanal – Änderungen
            erscheinen hier innerhalb von ~4 s.
          </p>
        )}
      </aside>

      {/* Memory-Detail */}
      {node && (
        <aside className="absolute right-3 top-16 z-10 max-h-[75svh] w-80 overflow-y-auto rounded-xl border border-border/60 bg-surface/90 p-3 text-xs backdrop-blur-md">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Memory
            </h2>
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>
              Schliessen
            </button>
          </div>
          <p className="mb-2 whitespace-pre-wrap text-sm text-foreground">{node.content}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <Row k="ID" v={node.id} />
            <Row k="Typ" v={node.type} />
            <Row k="Thema" v={node.topic ?? NA} />
            <Row k="Kategorie" v={node.category ?? NA} />
            <Row k="Quelle" v={node.source} />
            <Row k="Importance" v={pct(node.importance)} />
            <Row k="Confidence" v={pct(node.confidence)} />
            <Row k="Relevanz/Score" v={NA} />
            <Row k="Lifecycle" v={node.lifecycle} />
            <Row k="Aktivierungen" v={String(node.activationCount)} />
            <Row k="Letzter Zugriff" v={new Date(node.lastAccessedAt).toLocaleString()} />
            <Row k="Erstellt" v={new Date(node.createdAt).toLocaleString()} />
            <Row
              k="Aktivierungsstatus"
              v={
                events.some((e) => e.nodes.some((n) => n.id === node.id))
                  ? "in dieser Sitzung gespeichert aktiviert"
                  : "in dieser Sitzung keine gespeicherte Aktivierung"
              }
            />
          </dl>
          <h3 className="mb-1 mt-3 font-bold">Verbindungen ({nodeEdges.length})</h3>
          <ul className="space-y-1">
            {nodeEdges.slice(0, 20).map((e) => {
              const other = e.sourceNodeId === node.id ? e.targetNodeId : e.sourceNodeId;
              const o = graph?.nodes.find((n) => n.id === other);
              return (
                <li key={e.id}>
                  <button type="button" className="text-left hover:text-brand" onClick={() => setSelected(other)}>
                    {e.sourceNodeId === node.id ? "→" : "←"} {o?.content.slice(0, 50) ?? other.slice(0, 8)}{" "}
                    <span className="text-muted-foreground">
                      W(t) {e.weight.toFixed(2)} · W₀ {e.storedWeight.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      )}
    </div>
  );
}

function Row({ k, v, src }: { k: string; v: string; src?: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={v === NA ? "text-muted-foreground/70 italic" : "break-all text-foreground"}>
        {v}
        {src && v !== NA && <span className="ml-1 text-[9px] text-muted-foreground">[{src}]</span>}
      </dd>
    </>
  );
}

function Step({ label, value, kind }: { label: string; value: string; kind: "stored" | "derived" | "na" }) {
  const tag = kind === "stored" ? "von ORB gespeichert" : kind === "derived" ? "abgeleitet" : "nicht angeschlossen";
  return (
    <li className="grid grid-cols-[6.5rem_1fr] gap-2">
      <span className="font-bold">{label}</span>
      <span className={kind === "na" ? "italic text-muted-foreground/70" : ""}>
        {value} <span className="text-[9px] text-muted-foreground">({tag})</span>
      </span>
    </li>
  );
}

function Legend() {
  return (
    <ul className="space-y-0.5 text-[10px] text-muted-foreground">
      <li>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand" /> Grün-Puls: von ORB
        gespeicherter Zugriff (Zeitstempel/Zähler geändert)
      </li>
      <li>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-cyan" /> Cyan: Mitglied
        eines von ORB aktivierten Threads (kein eigener Abruf belegt)
      </li>
      <li>Zeitauflösung: Lesetakt 4 s – kein Echtzeit-Stream.</li>
    </ul>
  );
}
