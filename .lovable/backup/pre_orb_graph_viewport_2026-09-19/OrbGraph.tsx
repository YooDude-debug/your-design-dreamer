/**
 * Interaktive Spiderweb-Darstellung des bestehenden ORB-Gedächtnisnetzes.
 *
 * Die radiale Anordnung ist ausschließlich Präsentation: vorhandene Importance
 * bestimmt die Zone, eine stabile ID-Reihenfolge den Winkel. Alle sichtbaren
 * Werte stammen unverändert aus dem SDK-Snapshot. Es werden keine Memory-,
 * Relevance- oder Decay-Werte im Browser berechnet.
 */

import { useId, useMemo, useState } from "react";
import { CalendarClock, Network, Orbit, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrbConnection, OrbNode } from "@/orb-sdk";

type Props = {
  nodes: OrbNode[];
  connections: OrbConnection[];
  /** Höchstzahl dargestellter Verbindungen. */
  limit?: number;
};

type Point = { x: number; y: number; ring: number };

const WIDTH = 640;
const HEIGHT = 430;
const CENTER = { x: WIDTH / 2, y: 205 };
const RINGS = [56, 108, 164];
const SPOKES = 12;
const NODE_LIMIT = 40;

const NODE_STYLES: Record<OrbNode["type"], string> = {
  memory: "fill-brand stroke-brand-glow",
  fact: "fill-brand-cyan stroke-brand-cyan",
  emotion: "fill-muted-foreground stroke-foreground",
  action: "fill-brand-glow stroke-brand-glow",
  perception: "fill-muted-foreground stroke-foreground",
  decision: "fill-primary stroke-primary",
  goal: "fill-brand-cyan stroke-brand-cyan",
};

const TYPE_LABELS: Record<OrbNode["type"], string> = {
  memory: "Erinnerung",
  fact: "Fakt",
  emotion: "Emotion",
  action: "Handlung",
  perception: "Wahrnehmung",
  decision: "Entscheidung",
  goal: "Ziel",
};

const SOURCE_LABELS: Record<string, string> = {
  user_stated: "Vom Nutzer genannt",
  observed: "Beobachtet",
  inferred: "Abgeleitet",
  learned: "Lernerfahrung",
};

function timestamp(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortLabel(node: OrbNode) {
  if (node.topic) return node.topic;
  const text = node.content.trim();
  return text.length > 24 ? `${text.slice(0, 23)}…` : text;
}

function ringForImportance(importance: number) {
  if (importance >= 0.67) return 0;
  if (importance >= 0.34) return 1;
  return 2;
}

function buildPositions(nodes: OrbNode[]) {
  const ordered = [...nodes].sort(
    (a, b) => b.importance - a.importance || a.id.localeCompare(b.id),
  );
  const grouped = [0, 1, 2].map((ring) =>
    ordered.filter((node) => ringForImportance(node.importance) === ring),
  );
  const positions = new Map<string, Point>();

  grouped.forEach((group, ring) => {
    group.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / Math.max(1, group.length)) * Math.PI * 2;
      const baseRadius = RINGS[ring] ?? RINGS[2];
      const offset = group.length > 8 && index % 2 === 1 ? 10 : 0;
      positions.set(node.id, {
        x: CENTER.x + (baseRadius + offset) * Math.cos(angle),
        y: CENTER.y + (baseRadius + offset) * Math.sin(angle),
        ring,
      });
    });
  });
  return positions;
}

function connectedNodeIds(nodeId: string, connections: OrbConnection[]) {
  const ids = new Set<string>([nodeId]);
  for (const connection of connections) {
    if (connection.sourceNodeId === nodeId) ids.add(connection.targetNodeId);
    if (connection.targetNodeId === nodeId) ids.add(connection.sourceNodeId);
  }
  return ids;
}

export function OrbGraph({ nodes, connections, limit = 40 }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markerId = `orb-arrow-${useId().replaceAll(":", "")}`;
  const view = useMemo(() => {
    const used = nodes.slice(0, NODE_LIMIT);
    const ids = new Set(used.map((node) => node.id));
    const edges = connections
      .filter((connection) => ids.has(connection.sourceNodeId) && ids.has(connection.targetNodeId))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
    return { used, edges, positions: buildPositions(used) };
  }, [connections, limit, nodes]);

  const selected = view.used.find((node) => node.id === selectedId) ?? null;
  const relatedIds = useMemo(
    () => (selected ? connectedNodeIds(selected.id, view.edges) : new Set<string>()),
    [selected, view.edges],
  );
  const selectedConnections = selected
    ? view.edges.filter(
        (connection) =>
          connection.sourceNodeId === selected.id || connection.targetNodeId === selected.id,
      )
    : [];
  const nodeById = useMemo(() => new Map(view.used.map((node) => [node.id, node])), [view.used]);

  if (view.used.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        Noch kein Netz vorhanden. Es entsteht aus bedeutenden Erfahrungen.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="orb-spiderweb-graph">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">
            Gedächtnisnetz
          </p>
          <h4 className="text-sm font-semibold text-foreground">Spiderweb</h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand" /> innen: höhere Importance
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full border border-muted-foreground" /> außen:
            niedrigere Importance
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-border bg-background">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block h-auto min-h-72 w-full touch-manipulation sm:min-h-96"
          role="img"
          aria-label="Interaktives Spiderweb-Gedächtnisnetz"
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="11"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-brand" />
            </marker>
            <radialGradient id={`${markerId}-core`}>
              <stop offset="0" className="text-brand" stopColor="currentColor" stopOpacity="0.18" />
              <stop offset="1" className="text-brand" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle
            cx={CENTER.x}
            cy={CENTER.y}
            r="88"
            fill={`url(#${markerId}-core)`}
            aria-hidden="true"
          />

          {RINGS.map((radius, index) => (
            <circle
              key={radius}
              cx={CENTER.x}
              cy={CENTER.y}
              r={radius}
              fill="none"
              className="stroke-border"
              strokeWidth={index === 0 ? 1.2 : 0.8}
              strokeOpacity={0.72 - index * 0.14}
            />
          ))}
          {Array.from({ length: SPOKES }, (_, index) => {
            const angle = (index / SPOKES) * Math.PI * 2;
            return (
              <line
                key={index}
                x1={CENTER.x + RINGS[0] * Math.cos(angle)}
                y1={CENTER.y + RINGS[0] * Math.sin(angle)}
                x2={CENTER.x + RINGS[2] * Math.cos(angle)}
                y2={CENTER.y + RINGS[2] * Math.sin(angle)}
                className="stroke-border"
                strokeWidth="0.7"
                strokeOpacity="0.42"
              />
            );
          })}

          {view.edges.map((connection) => {
            const source = view.positions.get(connection.sourceNodeId);
            const target = view.positions.get(connection.targetNodeId);
            if (!source || !target) return null;
            const selectedEdge = Boolean(
              selected &&
              (connection.sourceNodeId === selected.id || connection.targetNodeId === selected.id),
            );
            const muted = Boolean(selected && !selectedEdge);
            const decayRatio =
              connection.storedWeight > 0
                ? Math.min(1, connection.weight / connection.storedWeight)
                : 1;
            return (
              <line
                key={connection.id}
                data-testid="orb-memory-connection"
                data-weight={connection.weight}
                data-stored-weight={connection.storedWeight}
                data-decay-ratio={decayRatio.toFixed(3)}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={cn(selectedEdge ? "stroke-brand" : "stroke-muted-foreground")}
                strokeOpacity={muted ? 0.08 : selectedEdge ? 0.92 : 0.2 + 0.55 * decayRatio}
                strokeWidth={0.7 + 3.8 * connection.weight}
                strokeDasharray={connection.strong ? undefined : "4 4"}
                markerEnd={`url(#${markerId})`}
              >
                <title>{`Gerichtet · Gewicht ${connection.weight.toFixed(3)} · Ausgang ${connection.storedWeight.toFixed(3)} · Decay-Rate ${connection.decayRate.toFixed(3)}`}</title>
              </line>
            );
          })}

          {view.used.map((node, index) => {
            const point = view.positions.get(node.id);
            if (!point) return null;
            const isSelected = node.id === selectedId;
            const isRelated = selected ? relatedIds.has(node.id) : false;
            const muted = Boolean(selected && !isRelated);
            const showLabel = isSelected || node.importance >= 0.67 || index < 8;
            const radius = 5 + node.importance * 6;
            return (
              <g
                key={node.id}
                data-testid="orb-memory-node"
                data-node-id={node.id}
                data-importance={node.importance}
                data-ring={point.ring}
                role="button"
                tabIndex={0}
                aria-label={`${TYPE_LABELS[node.type]} auswählen: ${node.content}`}
                aria-pressed={isSelected}
                className={cn(
                  "cursor-pointer outline-none transition-opacity duration-200 focus-visible:[&_circle]:stroke-foreground",
                  muted && "opacity-20",
                )}
                onClick={() => setSelectedId(isSelected ? null : node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(isSelected ? null : node.id);
                  }
                }}
              >
                {isSelected && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius + 7}
                    className="fill-brand/10 stroke-brand"
                    strokeWidth="1.5"
                  />
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={radius}
                  className={cn(
                    NODE_STYLES[node.type],
                    isRelated && selected && "stroke-foreground",
                  )}
                  fillOpacity={0.38 + node.confidence * 0.55}
                  strokeWidth={isSelected ? 2.5 : isRelated ? 1.8 : 1}
                />
                {showLabel && (
                  <text
                    x={point.x}
                    y={point.y + radius + 13}
                    textAnchor="middle"
                    className="pointer-events-none fill-foreground text-[10px] font-medium"
                  >
                    {shortLabel(node)}
                  </text>
                )}
                <title>{`${TYPE_LABELS[node.type]} · Importance ${node.importance.toFixed(2)} · Confidence ${node.confidence.toFixed(2)} · ${node.content}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        Die Ringe gruppieren vorhandene Importance nur visuell. Pfeile zeigen die gespeicherte
        Richtung; Linienstärke zeigt das aktuelle Gewicht, verblassende Linien dessen vorhandenen
        Verfall gegenüber dem Ausgangsgewicht.
      </p>

      {selected && (
        <section
          aria-live="polite"
          aria-labelledby="orb-memory-detail-title"
          className="rounded-lg border border-brand/35 bg-surface-2/60 p-3"
          data-testid="orb-memory-detail"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
              <Orbit className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                {TYPE_LABELS[selected.type]}
              </p>
              <h5
                id="orb-memory-detail-title"
                className="mt-1 text-sm font-semibold text-foreground"
              >
                {selected.content}
              </h5>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setSelectedId(null)}
              aria-label="Detailansicht schließen"
              title="Schließen"
            >
              <X aria-hidden="true" />
            </Button>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-y border-border py-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Importance</dt>
              <dd className="font-mono font-semibold">{selected.importance.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Confidence</dt>
              <dd className="font-mono font-semibold">{selected.confidence.toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Aktivierungen</dt>
              <dd className="font-mono font-semibold">{selected.activationCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quelle</dt>
              <dd className="font-semibold">{SOURCE_LABELS[selected.source] ?? selected.source}</dd>
            </div>
            {selected.topic && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Thema</dt>
                <dd className="font-semibold">{selected.topic}</dd>
              </div>
            )}
            <div className="col-span-2 flex items-start gap-1.5">
              <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div>
                <dt className="text-muted-foreground">Zuletzt genutzt</dt>
                <dd>{timestamp(selected.lastAccessedAt)}</dd>
              </div>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Erstellt</dt>
              <dd>{timestamp(selected.createdAt)}</dd>
            </div>
          </dl>

          <div className="mt-3">
            <div className="mb-2 flex items-center gap-2">
              <Network className="size-3.5 text-brand" aria-hidden="true" />
              <h6 className="text-xs font-semibold">Direkte Verbindungen</h6>
              <span className="font-mono text-[10px] text-muted-foreground">
                {selectedConnections.length}
              </span>
            </div>
            {selectedConnections.length > 0 ? (
              <ul className="space-y-1.5">
                {selectedConnections.map((connection) => {
                  const outgoing = connection.sourceNodeId === selected.id;
                  const otherId = outgoing ? connection.targetNodeId : connection.sourceNodeId;
                  const other = nodeById.get(otherId);
                  return (
                    <li
                      key={connection.id}
                      className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-border bg-background p-2 text-[11px]"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto min-w-0 justify-start whitespace-normal p-0 text-left hover:bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onClick={() => other && setSelectedId(other.id)}
                        disabled={!other}
                      >
                        <span className="block truncate font-semibold text-foreground">
                          {outgoing ? "→" : "←"} {other ? shortLabel(other) : "Nicht im Ausschnitt"}
                        </span>
                        <span className="text-muted-foreground">
                          {outgoing ? "ausgehend" : "eingehend"} ·{" "}
                          {connection.strong ? "stark" : "schwach"}
                        </span>
                      </Button>
                      <span className="text-right font-mono text-muted-foreground">
                        W(t) {connection.weight.toFixed(3)}
                        <br />
                        W₀ {connection.storedWeight.toFixed(3)} · λ{" "}
                        {connection.decayRate.toFixed(3)}
                        <br />I {connection.importance.toFixed(2)} · A {connection.activationCount}
                        <br />
                        {timestamp(connection.lastActivatedAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Keine direkte Verbindung im Ausschnitt.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
