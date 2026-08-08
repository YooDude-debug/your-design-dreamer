/**
 * Server Function: Werbeplan fuer den normalen Feed.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getFeedAdPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { seen?: string[] } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    const { buildFeedAdPlan } = await import("./ad-plan.server");
    return buildFeedAdPlan(context.supabase, context.userId, (data.seen ?? []).slice(0, 30));
  });
