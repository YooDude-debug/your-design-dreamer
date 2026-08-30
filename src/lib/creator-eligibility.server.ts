/**
 * Creator-Eligibility – serverseitige Ermittlung aus den bestehenden
 * autoritativen Tabellen. Wird ausschliesslich von Serverfunktionen benutzt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { CREATOR_ELIGIBILITY_THRESHOLD, isCreatorEligible } from "@/lib/creator-eligibility";
import type { CreatorEligibility } from "@/lib/creator-eligibility";

/**
 * Zählt Connections (Status `accepted`) und Follower des angemeldeten Kontos
 * und liest den echten Rollenstatus über die bestehende Funktion `has_role`.
 */
export async function readCreatorEligibility(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CreatorEligibility> {
  const [conn, foll, creator, business] = await Promise.all([
    supabase
      .from("connections")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase.rpc("has_role", { _user_id: userId, _role: "creator" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "business" }),
  ]);

  const connections = conn.count ?? 0;
  const followers = foll.count ?? 0;
  return {
    connections,
    followers,
    threshold: CREATOR_ELIGIBILITY_THRESHOLD,
    eligible: isCreatorEligible(connections, followers),
    isCreator: creator.data === true,
    isBusiness: business.data === true,
  };
}
