/**
 * Serverseitige Rollenprüfung (Community / Creator / Unternehmer / Admin).
 *
 * Einzige Quelle bleibt die bestehende Rollenlogik `public.user_roles` über
 * `has_role`. Es werden keine Tabellen, Policies oder Grants verändert und
 * keine Rollen abgeleitet: Ein Unternehmer ist kein Creator, ein Creator kein
 * Unternehmer. Die UI entscheidet nie über die Berechtigung.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRoleName = "creator" | "business" | "admin";

export async function hasAppRole(
  db: SupabaseClient,
  userId: string,
  role: AppRoleName,
): Promise<boolean> {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
  return data === true;
}

/** Echte Rollenflags des angemeldeten Kontos. */
export async function readRoleFlags(
  db: SupabaseClient,
  userId: string,
): Promise<{ isCreator: boolean; isBusiness: boolean }> {
  const [creator, business] = await Promise.all([
    hasAppRole(db, userId, "creator"),
    hasAppRole(db, userId, "business"),
  ]);
  return { isCreator: creator, isBusiness: business };
}

/** Creator-only Aktion: ohne echte Creator-Rolle abgelehnt. */
export async function requireCreatorRole(db: SupabaseClient, userId: string): Promise<void> {
  if (!(await hasAppRole(db, userId, "creator"))) throw new Error("creator_role_required");
}

/** Business-only Aktion: ohne echte Unternehmerrolle abgelehnt. */
export async function requireBusinessRole(db: SupabaseClient, userId: string): Promise<void> {
  if (!(await hasAppRole(db, userId, "business"))) throw new Error("business_role_required");
}
