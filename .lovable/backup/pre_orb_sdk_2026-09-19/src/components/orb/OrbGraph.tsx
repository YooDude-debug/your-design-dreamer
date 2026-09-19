/**
 * Kleine Darstellung des Gedächtnisnetzes (SVG, ohne Bibliothek).
 *
 * Knoten = Kreis, Richtung = Pfeil, Gewicht = Linienstärke,
 * schwache Verbindung = gestrichelt. Es wird nur ein übersichtlicher
 * Ausschnitt gezeigt (die stärksten Verbindungen).
 */

import { useMemo } from "react";

import type { OrbConnection, OrbNode } from "@/lib/orb.server";

type Props = {
  nodes: OrbNode[];
  connections: OrbConnection[];
  /** Höchstzahl dargestellter Verbindungen. */
  limit?: number;
};

const COLORS: Record<string, string> = {
  memory: "oklch(0.72 0.14 250)",
  fact: "oklch(0.75 0.12 200)",
  emotion: "oklch(0.72 0.17 20)",
  action: "oklch(0.75 0.15 150)",
  perception: "oklch(0.78 0.12 90)",
  decision: "oklch(0.8 0.15 65)",
  goal: "oklch(0.7 0.16 300)",
};

export function OrbGraph({ nodes, connections, limit = 12 }: Props) {
  const view = useMemo(() => {
    const top = connections
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
    const ids = new Set<string>();
    for (const c of top) {
      ids.add(c.sourceNodeId);
      ids.add(c.targetNodeId);
    }
    const used = nodes.filter((n) => ids.has(n.id)).slice(0, 14);
    const pos = new Map<string, { x: number; y: number }>();
    const r = 96;
    used.forEach((n, i) => {
      const a = (i / Math.max(1, used.length)) * Math.PI * 2 - Math.PI / 2;
      pos.set(n.id, { x: 130 + r * Math.cos(a), y: 115 + r * 0.82 * Math.sin(a) });
    });
    return {
      edges: top.filter((c) => pos.has(c.sourceNodeId) && pos.has(c.targetNodeId)),
      used,
      pos,
    };
  }, [nodes, connections, limit]);

  if (view.used.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
        Noch kein Netz vorhanden. Es entsteht aus bedeutenden Erfahrungen.
      </p>
    );
  }

  return (
    <svg viewBox="0 0 260 230" className="h-64 w-full" role="img" aria-label="Gedächtnisnetz">
      <defs>
        <marker
          id="orb-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>

      {view.edges.map((c) => {
        const a = view.pos.get(c.sourceNodeId)!;
        const b = view.pos.get(c.targetNodeId)!;
        return (
          <line
            key={c.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="text-muted-foreground"
            stroke="currentColor"
            strokeOpacity={0.35 + 0.6 * c.weight}
            strokeWidth={0.8 + 3.4 * c.weight}
            strokeDasharray={c.strong ? undefined : "4 3"}
            markerEnd="url(#orb-arrow)"
          />
        );
      })}

      {view.used.map((n) => {
        const p = view.pos.get(n.id)!;
        return (
          <g key={n.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r={7 + 6 * n.importance}
              fill={COLORS[n.type] ?? COLORS["memory"]}
              fillOpacity={0.85}
            />
            <title>{`${n.type}: ${n.content}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
