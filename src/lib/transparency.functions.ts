import { createServerFn } from "@tanstack/react-start";

/** Aggregierte, personenfreie Transparenzzahlen (DSA Art. 15/24). */
export type TransparencyStats = {
  /** ISO-Zeitpunkt der Erhebung. */
  generatedAt: string;
  /** Betrachteter Zeitraum in Tagen. */
  windowDays: number;
  reports: number;
  actions: number;
  automatedActions: number;
  removals: number;
  hides: number;
  warnings: number;
  bans: number;
  appeals: number;
  appealsGranted: number;
};

const WINDOW_DAYS = 180;

export const getTransparencyStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<TransparencyStats> => {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
    const empty: TransparencyStats = {
      generatedAt: new Date().toISOString(),
      windowDays: WINDOW_DAYS,
      reports: 0,
      actions: 0,
      automatedActions: 0,
      removals: 0,
      hides: 0,
      warnings: 0,
      bans: 0,
      appeals: 0,
      appealsGranted: 0,
    };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const count = async (
        table: "reports" | "moderation_actions" | "moderation_appeals",
        apply?: (q: any) => any,
      ): Promise<number> => {
        let q = supabaseAdmin
          .from(table)
          .select("id", { count: "exact", head: true })
          .gte("created_at", since);
        if (apply) q = apply(q);
        const { count: c, error } = await q;
        if (error) return 0;
        return c ?? 0;
      };

      const [
        reports,
        actions,
        automatedActions,
        removals,
        hides,
        warnings,
        bans,
        appeals,
        appealsGranted,
      ] = await Promise.all([
        count("reports"),
        count("moderation_actions"),
        count("moderation_actions", (q) => q.eq("automated", true)),
        count("moderation_actions", (q) =>
          q.in("action_kind", ["content_removed", "market_item_removed"]),
        ),
        count("moderation_actions", (q) =>
          q.in("action_kind", ["content_hidden", "slang_tag_hidden"]),
        ),
        count("moderation_actions", (q) => q.eq("action_kind", "user_warned")),
        count("moderation_actions", (q) => q.eq("action_kind", "user_banned")),
        count("moderation_appeals"),
        count("moderation_appeals", (q) => q.eq("status", "overturned")),
      ]);

      return {
        ...empty,
        reports,
        actions,
        automatedActions,
        removals,
        hides,
        warnings,
        bans,
        appeals,
        appealsGranted,
      };
    } catch (err) {
      console.error("[transparency] stats failed", err);
      return empty;
    }
  },
);
