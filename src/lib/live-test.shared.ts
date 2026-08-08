/**
 * Browser-sichere Typen für den Live-Testmodus (Werbekernel + Bot-Aktivität).
 *
 * Der Testmodus ist bewusst von der Produktionslogik getrennt: er schreibt
 * keine Kampagnen-, Abrechnungs- oder echten SlangTag-Zahlen.
 */

export type LiveTestSettings = {
  /** Hauptschalter des Testbot-Systems (bestehend). */
  botsEnabled: boolean;
  /** Live-Test aktiv? Steuert Bot-Posts und die Feed-Werbekarte. */
  liveTest: boolean;
  /** Posting-Intervall der Bots in Minuten (1 oder 3). */
  postIntervalMinutes: number;
  /** Anzahl Feed-Interaktionen bis zur nächsten Werbekarte (15 oder 25). */
  adFrequency: number;
  lastRunAt: string | null;
};

export const LIVE_TEST_INTERVALS = [1, 3] as const;
export const LIVE_TEST_AD_FREQUENCIES = [15, 25] as const;

/** Ereignisarten der Testmessung – ausschließlich in `ad_test_events`. */
export const AD_TEST_KINDS = [
  "ad_scheduled",
  "ad_impression",
  "ad_click",
  "ad_slangtag_play",
  "ad_skip",
  "feed_impression",
  "feed_step",
] as const;

export type AdTestKind = (typeof AD_TEST_KINDS)[number];

export type LiveTestMetrics = {
  settings: LiveTestSettings;
  feed: {
    impressions: number;
    steps: number;
    newPosts24h: number;
    botPosts: number;
    repeatedTags: number;
  };
  ads: {
    scheduled: number;
    impressions: number;
    clicks: number;
    slangPlays: number;
    skips: number;
    avgInteractions: number;
    avgPosition: number;
  };
  slang: {
    plays: number;
    uses: number;
    likes: number;
    shares: number;
    newTags24h: number;
  };
  bots: {
    total: number;
    active: number;
    posts: { username: string; posts: number; lastActivityAt: string | null }[];
    nextRunAt: string | null;
  };
};
