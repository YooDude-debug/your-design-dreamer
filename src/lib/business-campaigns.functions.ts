/**
 * Business-Kampagnen V1 – Server Functions.
 *
 * Jede Funktion prüft serverseitig Rolle, Abo, Limit und Eigentum. Das
 * Frontend darf keine dieser Entscheidungen treffen.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CAMPAIGN_STATUSES,
  isCampaignCta,
  isCampaignEventKind,
  isUuid,
  validateCampaignWindow,
  type BusinessCampaignOverview,
  type CampaignInput,
  type CampaignStatus,
} from "./business-campaigns.shared";

function currentEnvironment(): string {
  // Bestehende Umgebungslogik (Staging/Production strikt getrennt).
  // Lazy import ist hier nicht möglich (synchroner Aufruf), daher direkt.
  return process.env["APP_ENV"] ?? "staging";
}

async function resolveEnvironment(): Promise<string> {
  const { appEnvironment } = await import("./environment.server");
  try {
    return appEnvironment(getRequest());
  } catch {
    return currentEnvironment();
  }
}

export const getMyCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BusinessCampaignOverview> => {
    const { loadCampaignOverview } = await import("./business-campaigns.server");
    return loadCampaignOverview(context.supabase, context.userId, await resolveEnvironment());
  });

export const saveMyCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CampaignInput) => {
    if (!data || typeof data.name !== "string") throw new Error("invalid_input");
    const status = CAMPAIGN_STATUSES.includes(data.status) ? data.status : "draft";
    const startsAt = typeof data.startsAt === "number" ? data.startsAt : null;
    const endsAt = typeof data.endsAt === "number" ? data.endsAt : null;
    // F6: Asset-Referenzen müssen echte UUIDs sein; alles andere wird abgelehnt.
    const assetId = (v: unknown): string | null => {
      if (v === null || v === undefined || v === "") return null;
      if (!isUuid(v)) throw new Error("invalid_input");
      return v;
    };
    if (data.cta !== null && data.cta !== undefined && !isCampaignCta(data.cta)) {
      throw new Error("invalid_input");
    }
    // F5: Zeitfenster wird serverseitig geprüft (UTC-Millisekunden).
    const windowError = validateCampaignWindow(startsAt, endsAt);
    if (windowError) throw new Error(windowError);
    return {
      id: typeof data.id === "string" ? data.id : undefined,
      name: data.name,
      caption: typeof data.caption === "string" ? data.caption : "",
      status,
      region: typeof data.region === "string" ? data.region : "",
      hashtags: Array.isArray(data.hashtags) ? data.hashtags.slice(0, 8).map(String) : [],
      slangTagId: assetId(data.slangTagId),
      slangTagDropId: assetId(data.slangTagDropId),
      cta: isCampaignCta(data.cta) ? data.cta : null,
      startsAt,
      endsAt,
    } satisfies CampaignInput;
  })
  .handler(async ({ data, context }) => {
    const { saveCampaign } = await import("./business-campaigns.server");
    const { campaignErrorFrom } = await import("./business-campaigns.shared");
    const result = await saveCampaign(
      context.supabase,
      context.userId,
      await resolveEnvironment(),
      data,
    );
    if ("error" in result) return { error: campaignErrorFrom(result.error) };
    return result;
  });

export const setMyCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: CampaignStatus }) => {
    if (!data || typeof data.id !== "string" || !CAMPAIGN_STATUSES.includes(data.status)) {
      throw new Error("invalid_input");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { setCampaignStatus } = await import("./business-campaigns.server");
    const { campaignErrorFrom } = await import("./business-campaigns.shared");
    const result = await setCampaignStatus(context.supabase, context.userId, data.id, data.status);
    if ("error" in result) return { error: campaignErrorFrom(result.error) };
    return result;
  });

/**
 * Kampagnen-Messung (F1): Der Client meldet nur, WELCHE Kampagne er gesehen
 * bzw. geklickt hat. Ereignisart und Kampagnen-ID werden hier formal und in
 * der Datenbank fachlich geprüft (Status, Umgebung, Zeitfenster, Eigentümer,
 * Wiederholung). Zählerstände sind für den Client niemals setzbar.
 */
export const trackCampaignEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; kind: "impression" | "click" }) => {
    if (!data || !isUuid(data.id) || !isCampaignEventKind(data.kind)) {
      throw new Error("invalid_input");
    }
    return { id: data.id, kind: data.kind } as const;
  })
  .handler(async ({ data, context }) => {
    const { recordCampaignEvent } = await import("./business-campaigns-metrics.server");
    const counted = await recordCampaignEvent(
      data.id,
      data.kind,
      context.userId,
      await resolveEnvironment(),
    );
    return { ok: true, counted };
  });
