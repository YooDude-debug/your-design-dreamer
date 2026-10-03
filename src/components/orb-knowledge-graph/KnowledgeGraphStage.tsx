/**
 * ORB Knowledge Graph – Bühne (Experiment, nur Lesen).
 *
 * Datenquelle: getOrbKnowledgeGraph (nur SELECT), alle 4 s gelesen.
 * Hervorhebung NUR bei nachweisbarer Änderung gespeicherter ORB-Werte
 * (diffGraphs). Alles andere wird ausdrücklich als "nicht verfügbar" gezeigt.
 */

import { OrbMemoryImages } from "@/components/orb-knowledge-graph/OrbMemoryImages";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { getOrbKnowledgeGraph, type KgGraph } from "@/lib/orb-knowledge-graph.functions";
import { diffGraphs, type KgActivationEvent } from "@/lib/orb-knowledge-graph/diff";
import { KnowledgeGraphEngine } from "@/lib/orb-knowledge-graph/graph-engine";
import { searchGraph, MAX_PATH_NODES, type KgSearchResult } from "@/lib/orb-knowledge-graph/search";
import { countLabel } from "@/lib/orb-knowledge-graph/counts";
import {
  COGNITIVE_CHANNEL,
  COGNITIVE_LAYERS,
  COVERAGE_KEYS,
  isCognitiveView,
  layerHasData,
  type CognitiveLayerId,
  type CognitiveView,
} from "@/lib/orb-knowledge-graph/cognitive-layers";
import {
  RETRIEVAL_CHANNEL,
  createRetrievalPulseGate,
  isRetrievalEvent,
  type OrbRetrievalEvent,
} from "@/orb-sdk";
import { useSession } from "@/lib/use-session";
import { knowledgeGraphQueryKey, openTabSignal } from "@/lib/orb-knowledge-graph/tab-signal";
import type { OrbDataScope } from "@/orb-core/scope-values";

const POLL_MS = 4000;
const NA = "nicht verfügbar";

function pct(v: number | undefined | null) {
  return typeof v === "number" ? `${Math.round(v * 100)} %` : NA;
}
function time(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString() : NA;
}

export default function KnowledgeGraphStage({ scope }: { scope: OrbDataScope }) {
  const load = useServerFn(getOrbKnowledgeGraph);
  // Nutzer- und bereichsgebunden: kein Wiederverwenden fremder Cache-Einträge.
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const graphKey = knowledgeGraphQueryKey(userId, scope);
  const q = useQuery({
    queryKey: graphKey,
    queryFn: () => load({ data: { scope } }),
    enabled: !!userId,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<KnowledgeGraphEngine | null>(null);
  const prevRef = useRef<KgGraph | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [events, setEvents] = useState<KgActivationEvent[]>([]);
  const [eventIdx, setEventIdx] = useState(0);
  const [mode, setMode] = useState<"LIVE" | "SEARCH">("LIVE");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [liveInSearch, setLiveInSearch] = useState<{ nodes: string[]; edges: string[] }>({
    nodes: [],
    edges: [],
  });

  const [open, setOpen] = useState<PanelId | null>(null);
  const toggle = (id: PanelId) => setOpen((cur) => (cur === id ? null : id));
  // Klick auf eine Memory im Graph öffnet nur den Memory-Reiter.
  useEffect(() => {
    if (selected) setOpen("memory");
  }, [selected]);

  const [cognitive, setCognitive] = useState<CognitiveView | null>(null);
  const [layerOn, setLayerOn] = useState<Set<CognitiveLayerId>>(
    () => new Set(COGNITIVE_LAYERS.map((l) => l.id)),
  );
  const [layerFocus, setLayerFocus] = useState<CognitiveLayerId | null>(null);

  // Vorhandene Cognitive Observation aus dem Rundenergebnis (ORB-Kanal-Seite,
  // BroadcastChannel). Kein Polling, keine DB, kein Modellaufruf.
  // Nur Signale des aktuell angemeldeten Nutzers im angezeigten Bereich.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(COGNITIVE_CHANNEL);
    ch.onmessage = (msg: MessageEvent) => {
      const view = openTabSignal(msg.data, userIdRef.current, scope);
      if (isCognitiveView(view)) setCognitive(view);
    };
    return () => ch.close();
  }, [scope]);
  const cognitiveRef = useRef(cognitive);
  cognitiveRef.current = cognitive;
  const layerOnRef = useRef(layerOn);
  layerOnRef.current = layerOn;
  const layerFocusRef = useRef(layerFocus);
  layerFocusRef.current = layerFocus;
  useEffect(() => engineRef.current?.setCognitive(cognitive), [cognitive]);
  useEffect(() => engineRef.current?.setLayers(layerOn, layerFocus), [layerOn, layerFocus]);

  const [lastRetrieval, setLastRetrieval] = useState<OrbRetrievalEvent | null>(null);

  // Echtes Retrieval-Event (processInput → recalled) über BroadcastChannel der
  // ORB-Kanal-Seite. Unbekannte/ungültige oder fremde Nachrichten werden ignoriert.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(RETRIEVAL_CHANNEL);
    const gate = createRetrievalPulseGate();
    ch.onmessage = (msg: MessageEvent) => {
      const ev = openTabSignal(msg.data, userIdRef.current, scope);
      if (!isRetrievalEvent(ev)) return;
      setLastRetrieval(ev);
      if (gate(Date.now())) engineRef.current?.pulseRetrieval(ev.memory_ids, ev.model_visible_ids);
    };
    return () => ch.close();
  }, [scope]);

  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new KnowledgeGraphEngine(hostRef.current, setSelected);
    engineRef.current = engine;
    // Neu erzeugte Engine: aktuellen Ebenen-/Cognitive-Zustand einmal anwenden
    // (die Effekte oben liefen vor der Erzeugung ins Leere).
    engine.setLayers(layerOnRef.current, layerFocusRef.current);
    engine.setCognitive(cognitiveRef.current);
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
        const sr = searchRef.current;
        if (sr) {
          const ns = new Set(sr.nodeIds);
          const es = new Set(sr.edgeIds);
          const hitN = ev.nodes.map((n) => n.id).filter((id) => ns.has(id));
          const hitE = ev.edges.map((e) => e.id).filter((id) => es.has(id));
          if (hitN.length || hitE.length) setLiveInSearch({ nodes: hitN, edges: hitE });
        }
        setEvents((list) => [ev, ...list].slice(0, 20));
        setEventIdx(0);
      }
    }
    prevRef.current = graph;
  }, [graph]);

  useEffect(() => engineRef.current?.select(selected), [selected]);

  // Suche: rein im Browser über die bereits gelesenen Daten (kein neuer Abruf).
  const search = useMemo<KgSearchResult | null>(
    () => (graph && query ? searchGraph(graph, query) : null),
    // Nur bei neuer Suche oder Strukturänderung neu berechnen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, graph?.nodes.length, graph?.edges.length],
  );
  const searchRef = useRef<KgSearchResult | null>(null);
  searchRef.current = search;

  const lastSearchKeyRef = useRef<string | null>(null);
  const playSearch = (r: KgSearchResult | null, reframe = true) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!r || mode !== "SEARCH") {
      engine.setFocus(null, null);
      return;
    }
    engine.setFocus(r.nodeIds, r.edgeIds, { reframe });
    if (reframe)
      engine.playPath(
        r.steps.map((s) => (s.kind === "hit" ? { node: s.nodeId } : { edge: s.edgeId, to: s.to })),
      );
  };
  useEffect(() => {
    // Neuberechnung nur wegen neuer Memories/Verbindungen: Highlight
    // aktualisieren, Kamera nicht zurücksetzen. Neue Suche/Modus: ausrichten.
    const key = `${mode}\u0000${query}`;
    const reframe = lastSearchKeyRef.current !== key;
    lastSearchKeyRef.current = key;
    playSearch(search, reframe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mode]);

  const submit = () => {
    const v = input.trim();
    setQuery(v);
    setLiveInSearch({ nodes: [], edges: [] });
    setMode(v ? "SEARCH" : "LIVE");
  };

  const replay = (ev: KgActivationEvent) => {
    const engine = engineRef.current;
    if (!engine || !graph) return;
    engine.pulseNodes(ev.nodes.map((n) => n.id));
    engine.pulseEdges(ev.edges.map((e) => e.id));
    engine.pulseThreadMembers(
      graph.threads.filter((t) => ev.threads.some((x) => x.id === t.id)).flatMap((t) => t.nodeIds),
    );
  };

  const node = useMemo(
    () => graph?.nodes.find((n) => n.id === selected) ?? null,
    [graph, selected],
  );
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

      {/* Memory-Suche */}
      <div className="absolute left-1/2 top-14 z-20 flex w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 items-center gap-2 rounded-xl border border-border/60 bg-surface/90 p-2 text-xs backdrop-blur-md">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="🔎 Memory suchen …"
            aria-label="Memory suchen"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-brand"
          />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1 hover:border-brand"
          >
            Suche
          </button>
        </form>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border" role="group">
          {(["SEARCH", "LIVE"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={m === "SEARCH" && !search}
              onClick={() => setMode(m)}
              className={`px-1.5 py-1 text-[10px] font-bold disabled:opacity-40 sm:px-2 sm:text-xs ${mode === m ? "bg-brand/20 text-foreground" : "text-muted-foreground"}`}
            >
              <span className={m === "LIVE" ? "text-brand" : "text-hashtag"}>●</span> {m}
            </button>
          ))}
        </div>
      </div>

      {/* Reiter: standardmässig ist kein Panel geöffnet */}
      <nav
        aria-label="Informations-Reiter"
        className="absolute left-1/2 top-[6.75rem] z-20 flex w-[min(34rem,calc(100%-1.5rem))] -translate-x-1/2 gap-1 overflow-x-auto text-[11px]"
      >
        {TABS.map((t) => {
          const disabled = (t.id === "memory" && !node) || (t.id === "search" && !search);
          return (
            <button
              key={t.id}
              type="button"
              disabled={disabled}
              aria-pressed={open === t.id}
              onClick={() => toggle(t.id)}
              className={`shrink-0 rounded-full border px-3 py-1 font-bold backdrop-blur-md transition-colors disabled:opacity-40 ${open === t.id ? "border-brand bg-brand/20 text-foreground" : "border-border/60 bg-surface/80 text-muted-foreground hover:border-brand"}`}
            >
              {t.label}
              {t.id === "search" && search ? ` (${search.hits.length})` : ""}
              {t.id === "debug" && events.length ? ` (${events.length})` : ""}
            </button>
          );
        })}
      </nav>
      {graph && (
        <p className="pointer-events-none absolute left-1/2 top-[8.75rem] z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-md">
          🧠 {countLabel(graph.nodesTotal, graph.nodes.length)}
        </p>
      )}

      {search && open === "search" && (
        <Panel onClose={() => setOpen(null)}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Suche „{search.query}“
            </h2>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-0.5 hover:border-brand"
              onClick={() => playSearch(search)}
            >
              Pfad abspielen
            </button>
          </div>
          <p className="mb-2 text-muted-foreground">
            {search.hits.length} Treffer (Textvergleich, abgeleitet) · {search.nodeIds.length} von{" "}
            {graph?.nodesTotal ?? "?"} Memories im Suchpfad (höchstens {MAX_PATH_NODES}) ·{" "}
            {search.edgeIds.length} gespeicherte Verbindungen
            {search.truncated ? " · gekürzt" : ""}
          </p>
          <p className="mb-2 italic text-muted-foreground/80">
            Für einen tatsächlichen Retrieval-Pfad sind diese Daten derzeit nicht verfügbar. Gezeigt
            werden Texttreffer und die von ORB gespeicherten Verbindungen (bis {2} Schritte).
            Räumliche Nähe im Bild bedeutet keine Verbindung.
          </p>
          {liveInSearch.nodes.length + liveInSearch.edges.length > 0 && (
            <p className="mb-2 rounded-md border border-brand/50 p-1.5 text-foreground">
              Live: {liveInSearch.nodes.length} Memories, {liveInSearch.edges.length} Verbindungen
              dieser Suche von ORB gespeichert verändert.
            </p>
          )}
          {search.hits.length === 0 ? (
            <p className="text-muted-foreground">Keine passende Memory gefunden.</p>
          ) : (
            <ol className="space-y-1">
              {search.steps.slice(0, 60).map((st, i) => {
                const id = st.kind === "hit" ? st.nodeId : st.to;
                const n = graph?.nodes.find((x) => x.id === id);
                return (
                  <li key={i} className={st.kind === "edge" ? "pl-3" : ""}>
                    <button
                      type="button"
                      className="text-left hover:text-brand"
                      onClick={() => setSelected(id)}
                    >
                      {st.kind === "hit" ? (
                        <span className="text-hashtag">◆ Treffer </span>
                      ) : (
                        <span className="text-muted-foreground">
                          ↳ Verbindung #{st.edgeId.slice(0, 6)} (Stufe {st.depth}) →{" "}
                        </span>
                      )}
                      {n?.content.slice(0, 48) ?? id.slice(0, 8)}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      )}

      {open === "layers" && (
        <Panel onClose={() => setOpen(null)}>
          <LayersPanel
            view={cognitive}
            on={layerOn}
            focus={layerFocus}
            onToggle={(id) =>
              setLayerOn((cur) => {
                const next = new Set(cur);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onAll={() => {
              setLayerFocus(null);
              setLayerOn(new Set(COGNITIVE_LAYERS.map((l) => l.id)));
            }}
            onFocus={(id) => setLayerFocus((cur) => (cur === id ? null : id))}
          />
        </Panel>
      )}

      {open === "state" && (
        <Panel onClose={() => setOpen(null)}>
          <PanelTitle>Zustand</PanelTitle>
          <Legend />
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <Row k="Energy" v={pct(graph?.state?.energy)} src="orb_state" />
            <Row k="Curiosity" v={pct(graph?.state?.curiosity)} src="orb_state" />
            <Row
              k="🧠 Memories"
              v={graph ? countLabel(graph.nodesTotal, graph.nodes.length) : NA}
              src="DB-Count"
            />
            <Row
              k="🔗 Verbindungen"
              v={graph ? countLabel(graph.edgesTotal, graph.edges.length) : NA}
              src="DB-Count"
            />
            <Row
              k="Letzte Entscheidung"
              v={graph?.lastOrbMessage?.decision ?? NA}
              src={graph?.lastOrbMessage ? "orb_messages" : undefined}
            />
            <Row k="Gelesen" v={time(graph?.readAt)} />
          </dl>
        </Panel>
      )}

      {open === "threads" && (
        <Panel onClose={() => setOpen(null)}>
          <PanelTitle>Threads</PanelTitle>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <Row
              k="Aktueller Thread"
              v={activeThread?.title ?? NA}
              src={activeThread ? "orb_threads" : undefined}
            />
          </dl>
          <ul className="mt-2 space-y-1">
            {(graph?.threads ?? []).map((t) => (
              <li key={t.id} className="text-foreground">
                {t.title}{" "}
                <span className="text-muted-foreground">({t.nodeIds.length} Memories)</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {open === "telemetry" && (
        <Panel onClose={() => setOpen(null)}>
          <PanelTitle>Telemetrie</PanelTitle>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
            <Row
              k="Zuletzt aktivierte Nodes"
              v={lastActivated.length ? String(lastActivated.length) : NA}
              src={lastActivated.length ? "DB-Zeitstempel" : undefined}
            />
            <Row
              k="Memory-Retrieval"
              v={
                lastRetrieval
                  ? `${lastRetrieval.memory_ids.length} abgerufen · ${time(lastRetrieval.at)}`
                  : NA
              }
              src={lastRetrieval ? "tatsächlich erkanntes Retrieval" : undefined}
            />
            <Row
              k="Relevanz-/Score je Abruf"
              v={lastRetrieval ? lastRetrieval.score.map((x) => x.toFixed(2)).join(" · ") : NA}
              src={lastRetrieval ? "processInput" : undefined}
            />
            <Row k="Knowledge Gap" v={NA} />
            <Row k="Autonomy-Status" v={NA} />
            <Row
              k="Processing-ID"
              v={lastRetrieval?.event_id ?? NA}
              src={lastRetrieval ? "obs.eventId" : undefined}
            />
            <Row k="Model-/Request-ID" v={NA} />
          </dl>
          {lastActivated.length > 0 && (
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
              {lastActivated.map((n) => n.id.slice(0, 8)).join(" · ")}
            </p>
          )}
        </Panel>
      )}

      {/* Debug: Verarbeitung nachvollziehen */}
      {open === "debug" && (
        <Panel onClose={() => setOpen(null)}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Debug-Ablauf
            </h2>
            <span className="text-muted-foreground">{events.length} Ereignisse</span>
          </div>
          {lastEvent ? (
            <>
              <ol className="space-y-1">
                <Step
                  label="Processing"
                  value={`zwischen ${time(lastEvent.windowFrom)} und ${time(lastEvent.windowTo)}`}
                  kind="derived"
                />
                <Step
                  label="Retrieval"
                  value={`${lastEvent.nodes.length} Nodes, ${lastEvent.edges.length} Kanten`}
                  kind="stored"
                />
                <Step
                  label="Memories"
                  value={lastEvent.nodes.map((n) => n.id.slice(0, 8)).join(", ") || "–"}
                  kind="stored"
                />
                <Step label="Scores" value={NA} kind="na" />
                <Step label="Knowledge Gap" value={NA} kind="na" />
                <Step
                  label="Decision"
                  value={
                    lastEvent.lastOrbMessageChanged ? (graph?.lastOrbMessage?.decision ?? NA) : NA
                  }
                  kind={lastEvent.lastOrbMessageChanged ? "stored" : "na"}
                />
                <Step
                  label="Output"
                  value={
                    lastEvent.lastOrbMessageChanged
                      ? `Nachricht ${time(graph?.lastOrbMessage?.createdAt)}`
                      : NA
                  }
                  kind={lastEvent.lastOrbMessageChanged ? "stored" : "na"}
                />
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
        </Panel>
      )}

      {/* Memory-Detail */}
      {node && open === "memory" && (
        <Panel onClose={() => setOpen(null)}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Memory
            </h2>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(null)}
            >
              Schliessen
            </button>
          </div>
          {graph && (
            <p className="mb-2 text-[11px] text-muted-foreground">
              🧠 {countLabel(graph.nodesTotal, graph.nodes.length)}
            </p>
          )}
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
            <Row
              k="Suchstatus"
              v={
                search?.hits.some((h) => h.id === node.id)
                  ? `Suchtreffer (${search.hits.find((h) => h.id === node.id)!.fields.join(", ")}; abgeleitet)`
                  : search?.nodeIds.includes(node.id)
                    ? "über gespeicherte Verbindung erreicht (abgeleitet)"
                    : NA
              }
            />
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
          <OrbMemoryImages key={node.id} memoryId={node.id} />
          <h3 className="mb-1 mt-3 font-bold">Verbindungen ({nodeEdges.length})</h3>
          <ul className="space-y-1">
            {nodeEdges.slice(0, 20).map((e) => {
              const other = e.sourceNodeId === node.id ? e.targetNodeId : e.sourceNodeId;
              const o = graph?.nodes.find((n) => n.id === other);
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="text-left hover:text-brand"
                    onClick={() => setSelected(other)}
                  >
                    {e.sourceNodeId === node.id ? "→" : "←"}{" "}
                    {o?.content.slice(0, 50) ?? other.slice(0, 8)}{" "}
                    <span className="text-muted-foreground">
                      W(t) {e.weight.toFixed(2)} · W₀ {e.storedWeight.toFixed(2)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}

type PanelId = "layers" | "state" | "memory" | "threads" | "telemetry" | "debug" | "search";
const TABS: { id: PanelId; label: string }[] = [
  { id: "layers", label: "Ebenen" },
  { id: "state", label: "Zustand" },
  { id: "memory", label: "Memory" },
  { id: "threads", label: "Threads" },
  { id: "telemetry", label: "Telemetrie" },
  { id: "debug", label: "Debug" },
  { id: "search", label: "Suchpfad" },
];

/** Einziges Informations-Panel: mobil kompakte Karte unten, Desktop links. */
function Panel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <aside className="absolute inset-x-2 bottom-2 z-20 max-h-[42svh] overflow-y-auto rounded-xl border border-border/60 bg-surface/90 p-3 text-xs backdrop-blur-md sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-40 sm:max-h-[calc(100svh-11rem)] sm:w-80">
      <button
        type="button"
        onClick={onClose}
        aria-label="Panel schliessen"
        className="float-right ml-2 rounded-md border border-border px-1.5 leading-5 text-muted-foreground hover:border-brand hover:text-foreground"
      >
        ✕
      </button>
      {children}
    </aside>
  );
}

function PanelTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
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

function Step({
  label,
  value,
  kind,
}: {
  label: string;
  value: string;
  kind: "stored" | "derived" | "na";
}) {
  const tag =
    kind === "stored"
      ? "von ORB gespeichert"
      : kind === "derived"
        ? "abgeleitet"
        : "nicht angeschlossen";
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
      <li>
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-hashtag" /> Gelb: Suchpfad
        (Texttreffer + gespeicherte Kanten, abgeleitet – kein Retrieval)
      </li>
      <li>Zeitauflösung: Lesetakt 4 s – kein Echtzeit-Stream.</li>
    </ul>
  );
}

const val = (v: number | null) => (v === null ? "unknown" : `${Math.round(v * 100)} %`);

/** Ebenen-Steuerung; zeigt nur vorhandene Daten, null bleibt unknown. */
function LayersPanel({
  view,
  on,
  focus,
  onToggle,
  onAll,
  onFocus,
}: {
  view: CognitiveView | null;
  on: Set<CognitiveLayerId>;
  focus: CognitiveLayerId | null;
  onToggle: (id: CognitiveLayerId) => void;
  onAll: () => void;
  onFocus: (id: CognitiveLayerId) => void;
}) {
  return (
    <div data-testid="cognitive-layers-panel">
      <div className="mb-2 flex items-center justify-between">
        <PanelTitle>Ebenen</PanelTitle>
        <button
          type="button"
          onClick={onAll}
          className="rounded-md border border-border px-2 py-0.5 hover:border-brand"
        >
          Alle
        </button>
      </div>
      <p className="mb-2 text-muted-foreground">
        {view
          ? `Letzte Beobachtung: ${view.path === "chat" ? "Chat-Antwort" : "eigene Frage (Knowledge Gap)"} · ${new Date(view.receivedAt).toLocaleTimeString()}`
          : "Noch keine Beobachtung. Schreibe ORB im ORB-Kanal (gleicher Browser)."}
      </p>
      <ul className="space-y-1">
        {COGNITIVE_LAYERS.map((l, i) => {
          const has = layerHasData(view, l.id);
          return (
            <li key={l.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={on.has(l.id)}
                disabled={focus !== null}
                onChange={() => onToggle(l.id)}
                aria-label={`${l.label} anzeigen`}
              />
              <button
                type="button"
                onClick={() => onFocus(l.id)}
                className={`flex-1 text-left hover:text-brand ${focus === l.id ? "font-bold text-foreground" : ""}`}
              >
                {i} · {l.label}
              </button>
              <span className={has ? "text-foreground" : "text-muted-foreground/70"}>
                {has ? "Daten" : "leer"}
              </span>
            </li>
          );
        })}
      </ul>
      {view && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 border-t border-border/60 pt-2">
          <Row
            k="Candidates"
            v={`${view.candidates.length}${view.truncated ? " (gekürzt)" : ""}`}
            src="cognitive"
          />
          <Row k="Competitions" v={String(view.competitions.length)} src="maximumOverlap" />
          <Row
            k="Focus"
            v={view.snapshot.currentFocus ? view.snapshot.currentFocus.kind : "unknown"}
          />
          <Row k="Attention Availability" v={val(view.snapshot.attentionAvailability)} />
          <Row
            k="Strategien verfügbar"
            v={`${view.strategies.filter((s) => s.available).length} / ${view.strategies.length} (keine Auswahl)`}
          />
          {COVERAGE_KEYS.map((k) => (
            <Row key={k} k={k} v={val(view.coverage[k])} src="Datenabdeckung" />
          ))}
          <Row k="Action Plans" v={String(view.actionPlans.length)} />
          <Row k="Outcome" v="null" />
          <Row k="Adaptation" v="null" />
        </dl>
      )}
      <p className="mt-2 italic text-muted-foreground/80">
        Weiss = vorhanden, grau = nicht vorhanden/unknown. Zeigt beobachtbare Architekturdaten –
        keine Gedanken, keine Bewertung.
      </p>
    </div>
  );
}
