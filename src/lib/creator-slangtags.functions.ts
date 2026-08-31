import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creator SlangTags – serverseitige Sicht auf die SlangTags eines Creators.
 *
 * Es werden ausschliesslich bestehende Strukturen genutzt:
 * - `slang_tags` (inkl. `unlock_type`, `follow_required`, `owner_id`)
 * - `follows` bzw. `is_following`
 * - `has_slang_tag_grant` (bestehende Freigabe-Logik)
 * - privater `media`-Bucket mit kurzlebigen signierten URLs
 *
 * Die Einstufung nutzt den vorhandenen Enum `slang_tag_unlock_type`:
 *   open → kostenlos, follow → für Follower, premium → für Abonnenten.
 *
 * WICHTIG: Ein creator-bezogenes Abonnement existiert in der bestehenden
 * Subscription-/Stripe-Architektur nicht (`subscriptions` hat keinen
 * Creator-Bezug). `premium`-SlangTags bleiben deshalb serverseitig gesperrt
 * (ausser für Besitzer/Grants). Siehe docs/CREATOR_SLANGTAGS_AUDIT_2026-08-30.md.
 */

/**
 * Zugriffsstufen eines Creator-SlangTags (eindeutig unterscheidbar):
 * - `free`       → kostenlos, keine zusätzliche Berechtigung
 * - `follower`   → bestehendes Follow erforderlich
 * - `subscriber` → aktives Creator-Abo erforderlich
 * - `exclusive`  → bestehende Exclusive-Drop-Logik (Claim, 3-Monats-Reifung)
 *
 * Für `kind='creator'` ($$-SlangTags) hält der DB-Trigger
 * `enforce_slang_tag_kind` die Konsistenz `follow_required = (unlock_type =
 * 'follow')` aufrecht. Damit sind alle vier Stufen inkl. `free`
 * (`unlock_type='open'`, `follow_required=false`) abbildbar.

 */
export type CreatorTagTier = "free" | "follower" | "subscriber" | "exclusive";

export type CreatorSlangTagView = {
  id: string;
  name: string;
  description: string;
  duration: string;
  kind: string;
  tier: CreatorTagTier;
  /** Vollständig nutzbar (serverseitig geprüft). */
  unlocked: boolean;
  /** Dauerhaft in der persönlichen Bibliothek – nicht mehr entziehbar. */
  inLibrary: boolean;
  /** Exclusive SlangDrop (nur für aktive Abonnenten). */
  isDrop: boolean;
  /** Verbleibende Exemplare eines limitierten Drops (null = unlimitiert). */
  dropRemaining: number | null;
  /** Ende des Drop-Zeitfensters (ms) bzw. null. */
  dropEndsAt: number | null;
  /** Drop übernommen, 3-Monats-Frist läuft noch. */
  dropPending: boolean;
  /** Zeitpunkt, ab dem der Drop dauerhaft wird (ms). */
  permanentAfter: number | null;
  /** Kann jetzt dauerhaft übernommen werden. */
  claimable: boolean;
  /** Kurzlebige signierte URL – ausschliesslich zum Probeanhören. */
  previewUrl: string | null;
  mine: boolean;
};

export type CreatorSlangTagList = {
  creatorId: string;
  isCreatorProfile: boolean;
  following: boolean;
  /** Aktives Creator-Abo des Betrachters. */
  subscribed: boolean;
  /** Creator-Abo buchbar (Preis hinterlegt und aktiv). */
  subscriptionAvailable: boolean;
  /** Monatlicher Abopreis des Creators in Cent. */
  priceCents: number | null;
  currency: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  tags: CreatorSlangTagView[];
};

type Row = {
  id: string;
  name: string;
  description: string | null;
  meaning: string | null;
  duration: string | null;
  kind: string | null;
  unlock_type: string | null;
  follow_required: boolean | null;
  owner_id: string;
  creator_id: string;
  audio_url: string | null;
};

function tierOf(row: Row): CreatorTagTier {
  if (row.unlock_type === "premium") return "subscriber";
  if (row.unlock_type === "follow" || row.follow_required) return "follower";
  return "free";
}

export const listCreatorSlangTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { creatorId: string; environment?: "sandbox" | "live" }) => ({
    creatorId: String(input.creatorId),
    environment: input.environment === "live" ? ("live" as const) : ("sandbox" as const),
  }))
  .handler(async ({ data, context }): Promise<CreatorSlangTagList> => {
    const { supabase, userId } = context;
    const creatorId = data.creatorId;
    const mineProfile = creatorId === userId;

    const [creatorRole, businessRole, followRes] = await Promise.all([
      supabase.rpc("has_role", { _user_id: creatorId, _role: "creator" }),
      supabase.rpc("has_role", { _user_id: creatorId, _role: "business" }),
      mineProfile
        ? Promise.resolve({ data: false })
        : supabase.rpc("is_following", { _follower: userId, _following: creatorId }),
    ]);

    const isCreatorProfile = creatorRole.data === true || businessRole.data === true;
    const following = followRes.data === true;

    let query = supabase
      .from("slang_tags")
      .select(
        "id,name,description,meaning,duration,kind,unlock_type,follow_required,owner_id,creator_id,audio_url",
      )
      .eq("owner_id", creatorId)
      .eq("kind", "creator")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!mineProfile) query = query.eq("moderation_status", "approved");

    const { data: rows } = await query;
    const list = (rows ?? []) as Row[];

    // Reifung der 3-Monats-Regel serverseitig auslösen (idempotent).
    await supabase.rpc("promote_exclusive_drops", { _user_id: userId });

    const { getCreatorPrice, getCreatorSubscription } =
      await import("./creator-subscription.server");
    const [price, creatorSub, libraryRes] = await Promise.all([
      getCreatorPrice(creatorId),
      mineProfile
        ? Promise.resolve(null)
        : getCreatorSubscription(userId, creatorId, data.environment),
      supabase
        .from("slang_tag_library")
        .select("tag_id,is_permanent,permanent_after,lapsed_at,revoked_at")
        .eq("user_id", userId),
    ]);
    type LibRow = {
      tag_id: string;
      is_permanent: boolean | null;
      permanent_after: string | null;
      lapsed_at: string | null;
      revoked_at: string | null;
    };
    const library = new Map<string, LibRow>();
    for (const row of (libraryRes.data ?? []) as LibRow[]) library.set(row.tag_id, row);

    // Exclusive SlangDrops des Creators (Zeitfenster, Stückzahl).
    const { data: dropRows } = await supabase
      .from("slang_tag_drops")
      .select("tag_id,max_claims,claims_count,starts_at,ends_at,active")
      .eq("creator_id", creatorId);
    type DropRow = {
      tag_id: string;
      max_claims: number | null;
      claims_count: number;
      starts_at: string | null;
      ends_at: string | null;
      active: boolean;
    };
    const drops = new Map<string, DropRow>();
    for (const row of (dropRows ?? []) as DropRow[]) drops.set(row.tag_id, row);
    const subscribed = creatorSub?.active === true;

    // Bestehende Freigabe-Logik pro SlangTag (Grants, Follow-Bindung, Ablauf).
    const grants = await Promise.all(
      list.map((r) =>
        supabase
          .rpc("has_slang_tag_grant", { _tag_id: r.id, _user_id: userId })
          .then((g: { data: unknown }) => g.data === true),
      ),
    );

    // Probeanhören: kurzlebige signierte URL aus dem privaten Bucket.
    const paths = [...new Set(list.map((r) => r.audio_url).filter((p): p is string => !!p))];
    const signed = new Map<string, string>();
    if (paths.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: urls } = await supabaseAdmin.storage
        .from("media")
        .createSignedUrls(paths, 60 * 10);
      for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    }

    const now = Date.now();
    const tags: CreatorSlangTagView[] = list.map((row, i) => {
      const drop = drops.get(row.id) ?? null;
      // Exclusive Drops sind eine eigene, klar unterscheidbare Stufe – sie
      // durchlaufen weiterhin ausschliesslich die bestehende Drop-Logik.
      const tier: CreatorTagTier = drop ? "exclusive" : tierOf(row);
      const mine = row.owner_id === userId || row.creator_id === userId;
      const granted = grants[i] === true;
      const lib = library.get(row.id) ?? null;
      const permanent = !!lib && lib.is_permanent === true && !lib.revoked_at;
      const pending = !!lib && lib.is_permanent === false && !lib.revoked_at && !lib.lapsed_at;
      const dropWindowOpen =
        !drop ||
        (drop.active &&
          (!drop.starts_at || new Date(drop.starts_at).getTime() <= now) &&
          (!drop.ends_at || new Date(drop.ends_at).getTime() >= now));
      const dropRemaining =
        drop && drop.max_claims != null ? Math.max(0, drop.max_claims - drop.claims_count) : null;
      const entitled = drop
        ? mine || subscribed
        : mine ||
          granted ||
          tier === "free" ||
          (tier === "follower" && following) ||
          (tier === "subscriber" && subscribed);
      const inLibrary = permanent;
      const unlocked = permanent || (pending && subscribed) || entitled;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? row.meaning ?? "",
        duration: row.duration ?? "",
        kind: row.kind ?? "creator",
        tier,
        unlocked,
        inLibrary,
        isDrop: !!drop,
        dropRemaining,
        dropEndsAt: drop?.ends_at ? new Date(drop.ends_at).getTime() : null,
        dropPending: pending,
        permanentAfter: lib?.permanent_after ? new Date(lib.permanent_after).getTime() : null,
        claimable:
          !mine &&
          !permanent &&
          entitled &&
          dropWindowOpen &&
          (dropRemaining === null || dropRemaining > 0 || pending) &&
          !pending,
        previewUrl: row.audio_url ? (signed.get(row.audio_url) ?? null) : null,
        mine,
      };
    });

    return {
      creatorId,
      isCreatorProfile,
      following,
      subscribed,
      subscriptionAvailable: !!price?.active,
      priceCents: price?.priceCents ?? null,
      currency: price?.currency ?? "eur",
      cancelAtPeriodEnd: creatorSub?.cancelAtPeriodEnd ?? false,
      currentPeriodEnd: creatorSub?.currentPeriodEnd ?? null,
      tags,
    };
  });

/**
 * Einstufung eines eigenen Creator-SlangTags. Die Schreibrechte werden über
 * die bestehende RLS-Policy `slang_tags_update_own` durchgesetzt – es wird
 * bewusst der Client des angemeldeten Nutzers verwendet (kein Admin-Client).
 */
export const setCreatorSlangTagTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tagId: string; tier: CreatorTagTier }) => {
    const tier = input.tier;
    if (tier !== "free" && tier !== "follower" && tier !== "subscriber" && tier !== "exclusive") {
      throw new Error("Ungültige Einstufung");
    }
    return { tagId: String(input.tagId), tier };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Nur eigene Tags: serverseitige Prüfung, zusätzlich zur RLS-Policy
    // `slang_tags_update_own`. Frontend-State ist nie massgeblich.
    const { data: tagRow } = await supabase
      .from("slang_tags")
      .select("id,kind,owner_id,creator_id")
      .eq("id", data.tagId)
      .maybeSingle();
    const owned = !!tagRow && (tagRow.owner_id === userId || tagRow.creator_id === userId);
    if (!owned) throw new Error("Kein Zugriff auf diesen SlangTag");

    // 'Kostenlos' ist auch für $$-SlangTags zulässig: der Trigger
    // `enforce_slang_tag_kind` hält nur noch `follow_required =
    // (unlock_type = 'follow')` konsistent und erzwingt keine Follow-Bindung.

    if (data.tier === "exclusive") {
      // Bestehende Exclusive-Drop-Logik verwenden (Claim, Reifung unverändert).
      const { error } = await supabase
        .from("slang_tag_drops")
        .upsert(
          { tag_id: data.tagId, creator_id: userId, active: true, max_claims: null, ends_at: null },
          { onConflict: "tag_id" },
        );
      if (error) throw new Error(error.message);
      return { ok: true, tier: data.tier };
    }

    // Wechsel weg von Exclusive: Drop-Konfiguration entfernen. Bereits
    // erworbene Bibliotheksrechte bleiben davon unberührt.
    const { error: dropError } = await supabase
      .from("slang_tag_drops")
      .delete()
      .eq("tag_id", data.tagId)
      .eq("creator_id", userId);
    if (dropError) throw new Error(dropError.message);

    const unlock_type =
      data.tier === "subscriber" ? "premium" : data.tier === "follower" ? "follow" : "open";
    const { error } = await supabase
      .from("slang_tags")
      .update({ unlock_type, follow_required: data.tier === "follower" })
      .eq("id", data.tagId);
    if (error) throw new Error(error.message);
    return { ok: true, tier: data.tier };
  });
