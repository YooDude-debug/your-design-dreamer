/**
 * Creator-Eligibility – gemeinsame, reine Regel (Client und Server).
 *
 * Die Regel entscheidet ausschliesslich, ob die Option „Creator werden“
 * angeboten werden darf. Sie vergibt keine Rechte. Die tatsächliche
 * Berechtigung für Creator-Funktionen bleibt unverändert an den bestehenden
 * Rollenmechanismus (`public.user_roles` + `has_role`) gebunden.
 */

/** Mindestwert für Connections bzw. Follower (ODER-Verknüpfung). */
export const CREATOR_ELIGIBILITY_THRESHOLD = 10;

export type CreatorEligibility = {
  /** Bestätigte Connections (Status `accepted`). */
  connections: number;
  /** Follower (`follows.following_id = ich`). */
  followers: number;
  /** Erforderlicher Mindestwert. */
  threshold: number;
  /** Voraussetzung erfüllt (Connections ODER Follower). */
  eligible: boolean;
  /** Echte Rolle `creator` aus `user_roles`. */
  isCreator: boolean;
  /** Echte Rolle `business` aus `user_roles`. */
  isBusiness: boolean;
};

/** Reine Regel: mindestens 10 Connections ODER mindestens 10 Follower. */
export function isCreatorEligible(connections: number, followers: number): boolean {
  return connections >= CREATOR_ELIGIBILITY_THRESHOLD || followers >= CREATOR_ELIGIBILITY_THRESHOLD;
}
