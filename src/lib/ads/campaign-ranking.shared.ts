/**
 * Relevanzsignale für Business-Kampagnen (rein rechnerisch, ohne DB/UI).
 *
 * Grundsatz: Die Signale sind GEWICHTE, keine Filter. Eine Kampagne ohne
 * passendes Signal bleibt ausspielbar (Grundgewicht 1) – eine passende
 * Kampagne wird nur wahrscheinlicher. Damit bleibt die bestehende
 * Feed-Architektur (Werbekernel entscheidet WO, Quelle liefert WAS)
 * unverändert; es entsteht keine zweite Feed-Engine.
 */

export type CampaignCandidate = {
  id: string;
  ownerId: string | null;
  /** Zielregion der Kampagne ("" = überall). */
  region: string;
  hashtags: string[];
  slangTagId: string | null;
};

/** Bereits vorhandene Nutzersignale (aus bestehenden Tabellen). */
export type ViewerSignals = {
  /** Region/Ort des Nutzers (frei formuliert). */
  region: string;
  /** Gefolgte/verwendete Hashtags (ohne „#“, klein). */
  hashtags: string[];
  /** SlangTags, die der Nutzer besitzt, gespielt oder verwendet hat. */
  slangTagIds: string[];
  /** Konten, denen der Nutzer folgt. */
  followingIds: string[];
  /** Bestätigte Verbindungen/Freunde. */
  connectionIds: string[];
};

export const EMPTY_VIEWER_SIGNALS: ViewerSignals = {
  region: "",
  hashtags: [],
  slangTagIds: [],
  followingIds: [],
  connectionIds: [],
};

/** Gewichte der einzelnen Signale (additiv auf das Grundgewicht 1). */
export const CAMPAIGN_SIGNAL_WEIGHTS = {
  region: 2,
  hashtag: 1.5,
  slangTag: 2.5,
  following: 3,
  connection: 1.5,
} as const;

/** Grobe Regionsähnlichkeit: gemeinsames Wort (Stadt oder Land) genügt. */
export function regionMatches(a: string, b: string): boolean {
  const norm = (v: string) =>
    v
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 3);
  const left = norm(a);
  const right = new Set(norm(b));
  return left.some((w) => right.has(w));
}

/**
 * Relevanzgewicht einer Kampagne für diesen Nutzer.
 * Immer > 0 – es gibt keine harte Ausschlusslogik.
 */
export function scoreCampaign(
  campaign: CampaignCandidate,
  viewer: ViewerSignals,
  seen: string[] = [],
): number {
  let score = 1;
  const w = CAMPAIGN_SIGNAL_WEIGHTS;

  if (campaign.region && viewer.region && regionMatches(campaign.region, viewer.region)) {
    score += w.region;
  }
  const viewerTags = new Set(viewer.hashtags.map((t) => t.toLowerCase()));
  for (const tag of campaign.hashtags) {
    if (viewerTags.has(tag.toLowerCase())) score += w.hashtag;
  }
  if (campaign.slangTagId && viewer.slangTagIds.includes(campaign.slangTagId)) {
    score += w.slangTag;
  }
  if (campaign.ownerId && viewer.followingIds.includes(campaign.ownerId)) {
    score += w.following;
  }
  if (campaign.ownerId && viewer.connectionIds.includes(campaign.ownerId)) {
    score += w.connection;
  }
  // Bereits gesehene Kampagnen treten zurück, verschwinden aber nicht.
  if (seen.includes(campaign.id)) score = Math.max(0.3, score * 0.3);
  return score;
}

/** Gewichtete Auswahl (ohne harte Filter). `random` nur für Tests. */
export function pickCampaign(
  candidates: CampaignCandidate[],
  viewer: ViewerSignals,
  seen: string[] = [],
  random: () => number = Math.random,
): CampaignCandidate | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => scoreCampaign(c, viewer, seen));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < candidates.length; i += 1) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
