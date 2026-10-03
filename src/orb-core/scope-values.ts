/**
 * ORB Scope – feste Bereichswerte (browsersicher, ohne Serverabhängigkeiten).
 * Der Server prüft den Bereich zusätzlich; die Route ist kein Rechtemerkmal.
 */

import { z } from "zod";

/** Chat-Bereiche, die aus der Route kommen dürfen. */
export const ORB_CHAT_SCOPES = ["normal", "orb_core", "y_dude"] as const;
export type OrbChatScope = (typeof ORB_CHAT_SCOPES)[number];

/** Alle gespeicherten Bereiche; `unassigned` nur für Altdaten und Feed. */
export type OrbDataScope = OrbChatScope | "unassigned";

/** Alle Bereiche für reine Lese-Ansichten (Knowledge Globe); ohne Voreinstellung. */
export const ORB_DATA_SCOPES = [...ORB_CHAT_SCOPES, "unassigned"] as const;
export const orbDataScopeSchema = z.enum(ORB_DATA_SCOPES);
export function isOrbDataScope(value: unknown): value is OrbDataScope {
  return typeof value === "string" && (ORB_DATA_SCOPES as readonly string[]).includes(value);
}

/** Feed-Beobachtung bleibt ohne Bereichszuordnung. */
export const ORB_FEED_SCOPE: OrbDataScope = "unassigned";

/** ORB-Dev arbeitet immer im Bereich ORB Core – niemals vom Browser bestimmt. */
export const ORB_DEV_SCOPE: OrbChatScope = "orb_core";

/** Zod: Pflichtfeld, keine Voreinstellung, `unassigned` ausgeschlossen. */
export const orbChatScopeSchema = z.enum(ORB_CHAT_SCOPES);

export function isOrbChatScope(value: unknown): value is OrbChatScope {
  return typeof value === "string" && (ORB_CHAT_SCOPES as readonly string[]).includes(value);
}

/** Anzeige-Namen der Bereiche (nur Darstellung). */
export const ORB_SCOPE_LABEL: Record<OrbChatScope, string> = {
  normal: "Normal",
  orb_core: "ORB Core",
  y_dude: "Y-Dude",
};
