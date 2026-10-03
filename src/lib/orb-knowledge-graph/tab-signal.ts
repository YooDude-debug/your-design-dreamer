/**
 * Tab-Signale des Knowledge Globe (BroadcastChannel) – an Nutzer und Bereich gebunden.
 *
 * BroadcastChannel erreicht alle Tabs desselben Origins, unabhängig vom Konto.
 * Deshalb trägt jede Nachricht nur die Nutzer-ID und den Bereich als Hülle um
 * die bestehende Nutzlast (IDs bzw. kompakte Cognitive-Ansicht, keine
 * Chat-Inhalte). Empfänger verarbeiten nur Nachrichten des aktuell
 * angemeldeten Nutzers im aktuell angezeigten Bereich.
 */

import type { OrbDataScope } from "@/orb-core/scope-values";

export type OrbTabSignal = {
  kind: "orb.tab-signal";
  userId: string;
  scope: OrbDataScope;
  payload: unknown;
};

export function wrapTabSignal(userId: string, scope: OrbDataScope, payload: unknown): OrbTabSignal {
  return { kind: "orb.tab-signal", userId, scope, payload };
}

/** Liefert die Nutzlast nur bei passendem Nutzer und Bereich, sonst null. */
export function openTabSignal(
  data: unknown,
  userId: string | null | undefined,
  scope: OrbDataScope,
): unknown {
  if (!userId || !data || typeof data !== "object") return null;
  const s = data as Record<string, unknown>;
  if (s.kind !== "orb.tab-signal") return null;
  if (s.userId !== userId || s.scope !== scope) return null;
  return s.payload ?? null;
}

/** Query-Key des Knowledge Globe – nutzer- und bereichsgebunden. */
export function knowledgeGraphQueryKey(userId: string | null | undefined, scope: OrbDataScope) {
  return ["orb-knowledge-graph", userId ?? "signed-out", scope] as const;
}
