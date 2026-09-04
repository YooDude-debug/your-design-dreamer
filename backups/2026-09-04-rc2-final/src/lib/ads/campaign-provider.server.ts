/**
 * Werbequelle `internal`: Business-Kampagnen aus `ad_campaigns`.
 *
 * Der bestehende Werbekernel entscheidet weiterhin allein WO ein Werbeplatz
 * liegt (Abstände, Werbepause, Master-Schalter, Frequency/Diversity). Diese
 * Quelle liefert nur den Inhalt für einen angefragten Platz und nutzt dabei
 * die vorhandenen Relevanzsignale (Region, Hashtags, SlangTag-Nutzung,
 * Following, Connections) als Gewichte – niemals als harten Filter.
 *
 * Serverseitig gilt zusätzlich immer: nur `status = 'active'` innerhalb des
 * gültigen Zeitfensters wird ausgespielt.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdProvider } from "./provider.shared";
import type { CampaignAdView } from "../ad-catalog.shared";
import {
  EMPTY_VIEWER_SIGNALS,
  pickCampaign,
  type CampaignCandidate,
  type ViewerSignals,
} from "./campaign-ranking.shared";

type CampaignRow = {
  id: string;
  name: string;
  caption: string;
  region: string;
  hashtags: string[] | null;
  owner_id: string | null;
  slang_tag_id: string | null;
  slang_tag_drop_id: string | null;
  cta: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

export type CampaignInventory = {
  candidates: CampaignCandidate[];
  views: Map<string, CampaignAdView>;
};

const EMPTY_INVENTORY: CampaignInventory = { candidates: [], views: new Map() };

/** Nutzersignale aus bestehenden Tabellen (read-only, keine neuen Strukturen). */
export async function loadViewerSignals(
  db: SupabaseClient,
  userId: string,
): Promise<ViewerSignals> {
  const [profile, hashtags, library, plays, follows, connections] = await Promise.all([
    db.from("profiles").select("location").eq("id", userId).maybeSingle(),
    db.from("hashtag_follows").select("hashtags(tag)").eq("user_id", userId).limit(50),
    db.from("slang_tag_library").select("tag_id").eq("user_id", userId).limit(100),
    db.from("slang_tag_plays").select("tag_id").eq("user_id", userId).limit(100),
    db.from("follows").select("following_id").eq("follower_id", userId).limit(200),
    db
      .from("connections")
      .select("requester_id,addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .limit(200),
  ]);

  const tags = new Set<string>();
  for (const row of (hashtags.data ?? []) as { hashtags?: { tag?: string } | null }[]) {
    const tag = row.hashtags?.tag;
    if (tag) tags.add(tag.replace(/^#+/, "").toLowerCase());
  }

  const slangTagIds = new Set<string>();
  for (const row of (library.data ?? []) as { tag_id: string }[]) slangTagIds.add(row.tag_id);
  for (const row of (plays.data ?? []) as { tag_id: string }[]) slangTagIds.add(row.tag_id);

  const connectionIds = new Set<string>();
  for (const row of (connections.data ?? []) as {
    requester_id: string;
    addressee_id: string;
  }[]) {
    connectionIds.add(row.requester_id === userId ? row.addressee_id : row.requester_id);
  }

  return {
    region: profile.data?.location ?? "",
    hashtags: [...tags],
    slangTagIds: [...slangTagIds],
    followingIds: ((follows.data ?? []) as { following_id: string }[]).map((r) => r.following_id),
    connectionIds: [...connectionIds],
  };
}

/**
 * Aktive Kampagnen der Umgebung laden (privilegiert, nach Authentifizierung).
 * Es werden ausschliesslich Werbeinhalte gelesen – keine Abrechnungsdaten.
 */
export async function loadCampaignInventory(environment: string): Promise<CampaignInventory> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select(
      "id,name,caption,region,hashtags,owner_id,slang_tag_id,slang_tag_drop_id,cta,starts_at,ends_at",
    )
    .eq("status", "active")
    .eq("environment", environment)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .limit(50);
  if (error || !data || data.length === 0) return EMPTY_INVENTORY;

  const rows = data as CampaignRow[];
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v))];
  const tagIds = [
    ...new Set(
      rows.flatMap((r) => [r.slang_tag_id, r.slang_tag_drop_id]).filter((v): v is string => !!v),
    ),
  ];
  const dropIds = [
    ...new Set(rows.map((r) => r.slang_tag_drop_id).filter((v): v is string => !!v)),
  ];

  const [profiles, tags, drops] = await Promise.all([
    ownerIds.length
      ? supabaseAdmin
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", ownerIds)
      : Promise.resolve({ data: [] as never[] }),
    tagIds.length
      ? supabaseAdmin
          .from("slang_tags")
          .select("id,name,duration,audio_url,cta_url")
          .in("id", tagIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as never[] }),
    // F6: bestehende Drop-Zeilen (Schlüssel = SlangTag-ID), rein lesend.
    dropIds.length
      ? supabaseAdmin
          .from("slang_tag_drops")
          .select("tag_id,active,max_claims,claims_count,starts_at,ends_at")
          .in("tag_id", dropIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  type DropRow = {
    tag_id: string;
    active: boolean;
    max_claims: number | null;
    claims_count: number;
    starts_at: string | null;
    ends_at: string | null;
  };
  const dropByTag = new Map(((drops.data ?? []) as DropRow[]).map((d) => [d.tag_id, d]));

  const profileById = new Map(
    (
      (profiles.data ?? []) as {
        id: string;
        display_name: string;
        username: string | null;
        avatar_url: string | null;
      }[]
    ).map((p) => [p.id, p]),
  );
  const tagById = new Map(
    (
      (tags.data ?? []) as {
        id: string;
        name: string;
        duration: string | null;
        audio_url: string | null;
        cta_url: string | null;
      }[]
    ).map((t) => [t.id, t]),
  );

  // Probeanhören: kurzlebige signierte URLs aus dem privaten `media`-Bucket.
  const paths = [...tagById.values()].map((t) => t.audio_url).filter((p): p is string => !!p);
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabaseAdmin.storage
      .from("media")
      .createSignedUrls(paths, 60 * 10);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const candidates: CampaignCandidate[] = [];
  const views = new Map<string, CampaignAdView>();
  for (const row of rows) {
    // Wenn ein Drop beworben wird, ist dessen SlangTag das Werbemittel.
    const assetTagId = row.slang_tag_drop_id ?? row.slang_tag_id;
    const tag = assetTagId ? tagById.get(assetTagId) : undefined;
    const drop = row.slang_tag_drop_id ? dropByTag.get(row.slang_tag_drop_id) : undefined;
    const dropWindowOpen =
      !!drop &&
      drop.active &&
      (!drop.starts_at || new Date(drop.starts_at).getTime() <= Date.now()) &&
      (!drop.ends_at || new Date(drop.ends_at).getTime() >= Date.now());
    const profile = row.owner_id ? profileById.get(row.owner_id) : undefined;
    candidates.push({
      id: row.id,
      ownerId: row.owner_id,
      region: row.region ?? "",
      hashtags: row.hashtags ?? [],
      slangTagId: assetTagId,
    });
    views.set(row.id, {
      id: row.id,
      name: row.name,
      caption: row.caption ?? "",
      company: profile?.display_name ?? row.name,
      companyLogo: profile?.avatar_url ?? null,
      companyUsername: profile?.username ?? null,
      region: row.region ?? "",
      hashtags: row.hashtags ?? [],
      slangTagName: tag?.name ?? null,
      slangTagPreviewUrl: tag?.audio_url ? (signed.get(tag.audio_url) ?? null) : null,
      slangTagDuration: tag?.duration ?? null,
      ctaUrl: tag?.cta_url ?? null,
      cta: row.cta === "listen" || row.cta === "slangtag" || row.cta === "profile" ? row.cta : null,
      isDrop: dropWindowOpen,
      dropRemaining:
        drop && drop.max_claims != null ? Math.max(0, drop.max_claims - drop.claims_count) : null,
      dropEndsAt: drop?.ends_at ? new Date(drop.ends_at).getTime() : null,
    });
  }
  return { candidates, views };
}

/**
 * Quelle für den Kernel. `used` verhindert, dass dieselbe Kampagne mehrfach im
 * selben Plan erscheint (bestehende Diversity-Regel des Kernels bleibt gültig).
 */
export function createCampaignProvider(
  inventory: CampaignInventory,
  viewer: ViewerSignals = EMPTY_VIEWER_SIGNALS,
  seen: string[] = [],
): AdProvider {
  const used = new Set<string>();
  return {
    source: "internal",
    label: "Y-Dude Business-Kampagnen",
    available: () => inventory.candidates.length > 0,
    fill: (request) => {
      const pool = inventory.candidates.filter((c) => !used.has(c.id));
      const picked = pickCampaign(pool, viewer, seen);
      if (!picked) return null;
      used.add(picked.id);
      return {
        afterIndex: request.afterIndex,
        kind: "image",
        adId: picked.id,
        source: "internal",
      };
    },
  };
}
