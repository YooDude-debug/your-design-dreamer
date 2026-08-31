/**
 * Business-Kampagnen V1 – serverseitige Logik.
 *
 * Es wird ausschliesslich bestehende Infrastruktur verwendet:
 * - Rolle:   `user_roles` über `has_role`
 * - Abo:     bestehende `subscriptions` über `business_plan_tier`
 * - Werbung: bestehende Tabelle `ad_campaigns`
 * - SlangTags: bestehende `slang_tags` (Eigentum über `owner_id`)
 *
 * Das Kampagnenlimit wird zusätzlich in der Datenbank durchgesetzt
 * (Trigger `enforce_business_campaign_limit_trg`), damit auch direkte
 * API-Aufrufe es nicht umgehen können.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingTier } from "./billing-plans";
import {
  campaignLimitFor,
  isCampaignCta,
  normalizeHashtags,
  validateCampaignWindow,
  type BusinessCampaign,
  type BusinessCampaignOverview,
  type CampaignInput,
  type CampaignStatus,
} from "./business-campaigns.shared";

type Row = {
  id: string;
  name: string;
  caption: string | null;
  status: CampaignStatus;
  region: string | null;
  hashtags: string[] | null;
  slang_tag_id: string | null;
  slang_tag_drop_id: string | null;
  cta: string | null;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
};

const ms = (v: string | null) => (v ? new Date(v).getTime() : null);
const iso = (v: number | null) => (v ? new Date(v).toISOString() : null);

export async function businessTier(
  db: SupabaseClient,
  userId: string,
  environment: string,
): Promise<BillingTier> {
  const { data } = await db.rpc("business_plan_tier", {
    _user_id: userId,
    _environment: environment,
  });
  const tier = (data as string | null) ?? "free";
  return tier === "business" || tier === "business_pro" ? tier : "free";
}

export async function isBusinessAccount(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "business" });
  return Boolean(data);
}

function toCampaign(row: Row, tagNames: Map<string, string>): BusinessCampaign {
  return {
    id: row.id,
    name: row.name,
    caption: row.caption ?? "",
    status: row.status,
    region: row.region ?? "",
    hashtags: row.hashtags ?? [],
    slangTagId: row.slang_tag_id,
    slangTagName: row.slang_tag_id ? (tagNames.get(row.slang_tag_id) ?? null) : null,
    slangTagDropId: row.slang_tag_drop_id,
    cta: isCampaignCta(row.cta) ? row.cta : null,
    startsAt: ms(row.starts_at),
    endsAt: ms(row.ends_at),
    impressions: row.impressions,
    clicks: row.clicks,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function loadCampaignOverview(
  db: SupabaseClient,
  userId: string,
  environment: string,
): Promise<BusinessCampaignOverview> {
  const [isBusiness, tier] = await Promise.all([
    isBusinessAccount(db, userId),
    businessTier(db, userId, environment),
  ]);

  const [campaigns, tags, drops] = await Promise.all([
    db
      .from("ad_campaigns")
      .select(
        "id,name,caption,status,region,hashtags,slang_tag_id,slang_tag_drop_id,cta,starts_at,ends_at,impressions,clicks,created_at",
      )
      .eq("owner_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("slang_tags")
      .select("id,name")
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    // Bestehende Drop-Tabelle (Schlüssel = SlangTag-ID), nur lesend.
    db.from("slang_tag_drops").select("tag_id").eq("creator_id", userId).limit(100),
  ]);

  const dropTagIds = new Set(((drops.data ?? []) as { tag_id: string }[]).map((d) => d.tag_id));

  const slangTags = ((tags.data ?? []) as { id: string; name: string }[]).map((t) => ({
    id: t.id,
    name: t.name,
    hasDrop: dropTagIds.has(t.id),
  }));
  const tagNames = new Map(slangTags.map((t) => [t.id, t.name]));
  const rows = (campaigns.data ?? []) as Row[];
  const list = rows.map((r) => toCampaign(r, tagNames));
  const activeCount = list.filter((c) => c.status === "active").length;
  const limit = campaignLimitFor(tier);

  return {
    isBusiness,
    tier,
    limit,
    activeCount,
    canCreate: isBusiness && limit > 0 && activeCount < limit,
    campaigns: list,
    slangTags,
  };
}

/** Kampagne anlegen oder ändern. Alle Prüfungen laufen serverseitig. */
export async function saveCampaign(
  db: SupabaseClient,
  userId: string,
  environment: string,
  input: CampaignInput,
): Promise<{ id: string } | { error: string }> {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) return { error: "invalid_input" };
  // F5: Zeitfenster serverseitig prüfen (zusätzlich zur DB-Bedingung
  // `ad_campaigns_time_window_chk`).
  const windowError = validateCampaignWindow(input.startsAt, input.endsAt);
  if (windowError) return { error: windowError };
  if (!(await isBusinessAccount(db, userId))) return { error: "business_role_required" };

  const tier = await businessTier(db, userId, environment);
  if (campaignLimitFor(tier) === 0) return { error: "business_subscription_required" };

  // Eigentum des Werbemittels prüfen (zusätzlich zum DB-Trigger).
  if (input.slangTagId) {
    const { data: tag } = await db
      .from("slang_tags")
      .select("id")
      .eq("id", input.slangTagId)
      .eq("owner_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!tag) return { error: "slang_tag_not_owned" };
  }

  // F6: Drops gehoeren immer dem SlangTag-Eigentuemer; beides wird geprueft.
  if (input.slangTagDropId) {
    const [{ data: drop }, { data: dropTag }] = await Promise.all([
      db
        .from("slang_tag_drops")
        .select("tag_id")
        .eq("tag_id", input.slangTagDropId)
        .eq("creator_id", userId)
        .maybeSingle(),
      db
        .from("slang_tags")
        .select("id")
        .eq("id", input.slangTagDropId)
        .eq("owner_id", userId)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
    if (!drop || !dropTag) return { error: "slang_tag_drop_not_owned" };
  }

  const row = {
    name,
    caption: input.caption.trim().slice(0, 500),
    status: input.status,
    region: input.region.trim().slice(0, 120),
    hashtags: normalizeHashtags(input.hashtags),
    slang_tag_id: input.slangTagId,
    slang_tag_drop_id: input.slangTagDropId,
    cta: input.cta,
    starts_at: iso(input.startsAt),
    ends_at: iso(input.endsAt),
    environment,
    kind: "campaign" as const,
  };

  if (input.id) {
    // Fremde Kampagnen sind über RLS und diese Bedingung ausgeschlossen.
    const { data, error } = await db
      .from("ad_campaigns")
      .update(row)
      .eq("id", input.id)
      .eq("owner_id", userId)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "not_found" };
    return { id: data.id as string };
  }

  const { data, error } = await db
    .from("ad_campaigns")
    .insert({ ...row, owner_id: userId })
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "failed" };
  return { id: data.id as string };
}

export async function setCampaignStatus(
  db: SupabaseClient,
  userId: string,
  id: string,
  status: CampaignStatus,
): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await db
    .from("ad_campaigns")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", userId)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "not_found" };
  return { ok: true };
}
