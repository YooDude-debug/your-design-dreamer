import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { zipSync, strToU8, type Zippable } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Serverseitige Kontofunktionen: DSGVO-Datenexport und vollständige
 * Kontolöschung. Beides erfordert eine erneute Passwortprüfung, wird
 * ratenbegrenzt und protokolliert (ohne Passwortdaten).
 */

/** Untypisierter Zugriff für dynamische Tabellennamen (Aufräumarbeiten). */
const anyDb = supabaseAdmin as unknown as SupabaseClient;

const BUCKET = "media";
/** Obergrenze für mitgelieferte Medien im Archiv. */
const MEDIA_BUDGET = 45 * 1024 * 1024;
/** Gültigkeit des Downloadlinks. */
export const EXPORT_TTL = 60 * 60;

// ---------------------------------------------------------------- Hilfsmittel

export async function logAccountEvent(
  userId: string,
  action: string,
  outcome: string,
  detail = "",
): Promise<void> {
  await supabaseAdmin
    .from("account_security_events")
    .insert({ user_id: userId, action, outcome, detail: detail.slice(0, 300) });
}

/** Einfache Missbrauchsbremse pro Nutzer und Aktion. */
export async function checkRateLimit(
  userId: string,
  action: string,
  max: number,
  windowMinutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await supabaseAdmin
    .from("account_security_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", since);
  return (count ?? 0) < max;
}

/** Prüft das Passwort des angemeldeten Nutzers erneut. */
export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userRes?.user?.email;
  if (!email || !password) return false;

  const client = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (data?.session) await client.auth.signOut();
  return !error && !!data?.session;
}

// ------------------------------------------------------------------- Export

type Table = string;

async function rows(table: Table, column: string, userId: string): Promise<unknown[]> {
  const { data, error } = await anyDb.from(table).select("*").eq(column, userId);
  if (error) return [];
  return data ?? [];
}

function json(value: unknown): Uint8Array {
  return strToU8(JSON.stringify(value, null, 2));
}

/** Listet alle Speicherobjekte des Nutzers auf. */
async function listUserObjects(userId: string): Promise<string[]> {
  const folders = ["images", "audio", "avatars", "covers", "originals", "exports"];
  const out: string[] = [];
  for (const folder of folders) {
    const { data } = await supabaseAdmin.storage
      .from(BUCKET)
      .list(`${userId}/${folder}`, { limit: 1000 });
    for (const item of data ?? []) {
      if (item.name) out.push(`${userId}/${folder}/${item.name}`);
    }
  }
  return out;
}

export type ExportResult = { url: string; filename: string; bytes: number; mediaFiles: number };

export async function buildDataExport(userId: string): Promise<ExportResult> {
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const [
    posts,
    comments,
    likes,
    saves,
    shares,
    tags,
    tagLikes,
    tagSaves,
    tagVotes,
    followers,
    following,
    connections,
    conversationsMembers,
    notifications,
    interests,
    adPrefs,
    travel,
    pushSubs,
  ] = await Promise.all([
    rows("posts", "user_id", userId),
    rows("comments", "user_id", userId),
    rows("post_likes", "user_id", userId),
    rows("post_saves", "user_id", userId),
    rows("post_shares", "user_id", userId),
    rows("slang_tags", "owner_id", userId),
    rows("slang_tag_likes", "user_id", userId),
    rows("slang_tag_saves", "user_id", userId),
    rows("slang_tag_votes", "user_id", userId),
    rows("follows", "following_id", userId),
    rows("follows", "follower_id", userId),
    rows("connections", "requester_id", userId),
    rows("conversation_members", "user_id", userId),
    rows("notifications", "user_id", userId),
    rows("user_interests", "user_id", userId),
    rows("ad_preferences", "user_id", userId),
    rows("travel_plans", "user_id", userId),
    rows("push_subscriptions", "user_id", userId),
  ]);

  const files: Zippable = {};

  files["LIESMICH.txt"] = strToU8(
    [
      "Y-Dude – Datenexport (DSGVO Art. 15 / 20)",
      `Erstellt: ${new Date().toISOString()}`,
      `Konto: ${authUser?.user?.email ?? ""}`,
      "",
      "Struktur:",
      "  profil/        Profil, Einstellungen, Privatsphäre",
      "  community/     Beiträge, Kommentare, Likes, Gespeichertes",
      "  slangtags/     eigene SlangTags, Bewertungen, Statistiken",
      "  sozial/        Follower, Gefolgt, Verbindungen",
      "  konto/         Registrierung, letzter Login, Sitzungen (ohne Tokens)",
      "  medien/        Bilder, Audio und weitere Uploads im Original",
      "",
      "Es werden keine Passwörter, Tokens oder Sicherheitsschlüssel exportiert.",
    ].join("\n"),
  );

  const p = (profile ?? {}) as Record<string, unknown>;
  files["profil/profil.json"] = json({
    id: p.id,
    username: p.username,
    displayName: p.display_name,
    bio: p.bio,
    location: p.location,
    origin: p.origin,
    languages: p.languages,
    birthday: p.birthday,
    pronouns: p.pronouns,
    interests: p.interest_tags,
    hobbies: p.hobbies,
    music: p.fav_music,
    games: p.fav_games,
    movies: p.fav_movies,
    sports: p.fav_sports,
    website: p.website,
    instagram: p.instagram,
    tiktok: p.tiktok,
    youtube: p.youtube,
    twitch: p.twitch,
    discord: p.discord,
    verified: p.verified,
    level: p.level,
    xp: p.xp,
    createdAt: p.created_at,
  });
  files["profil/einstellungen.json"] = json({
    language: p.language,
    pushEnabled: p.push_enabled,
    adPreferences: adPrefs,
    travelPlans: travel,
  });
  files["profil/privatsphaere.json"] = json({
    profileVisibility: p.profile_visibility,
    locationVisibility: p.location_visibility,
    fieldVisibility: p.field_visibility,
  });

  files["community/beitraege.json"] = json(posts);
  files["community/kommentare.json"] = json(comments);
  files["community/likes.json"] = json(likes);
  files["community/gespeicherte-beitraege.json"] = json(saves);
  files["community/geteilte-beitraege.json"] = json(shares);

  files["slangtags/slangtags.json"] = json(tags);
  files["slangtags/bewertungen.json"] = json({ likes: tagLikes, saves: tagSaves, votes: tagVotes });
  files["slangtags/statistiken.json"] = json(
    (tags as Record<string, unknown>[]).map((t) => ({
      id: t.id,
      name: t.name,
      plays: t.plays_count,
      likes: t.likes_count,
      uses: t.uses_count,
      shares: t.shares_count,
      saves: t.saves_count,
      comments: t.comments_count,
    })),
  );

  files["sozial/follower.json"] = json(followers);
  files["sozial/gefolgt.json"] = json(following);
  files["sozial/verbindungen.json"] = json(connections);
  files["sozial/unterhaltungen.json"] = json(conversationsMembers);
  files["sozial/benachrichtigungen.json"] = json(notifications);
  files["sozial/interessen.json"] = json(interests);

  const u = authUser?.user;
  files["konto/konto.json"] = json({
    id: u?.id,
    email: u?.email,
    registeredAt: u?.created_at,
    lastSignInAt: u?.last_sign_in_at,
    emailConfirmedAt: u?.email_confirmed_at,
    provider: u?.app_metadata?.provider,
  });
  files["konto/geraete-und-sitzungen.json"] = json(
    (pushSubs as Record<string, unknown>[]).map((s) => ({
      userAgent: s.user_agent,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
    })),
  );

  // Medien im Original (mit Budget, damit das Archiv handhabbar bleibt)
  const objects = (await listUserObjects(userId)).filter((o) => !o.includes("/exports/"));
  let used = 0;
  let mediaFiles = 0;
  const skipped: string[] = [];
  for (const path of objects) {
    if (used >= MEDIA_BUDGET) {
      skipped.push(path);
      continue;
    }
    const { data } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (!data) continue;
    const buf = new Uint8Array(await data.arrayBuffer());
    if (used + buf.byteLength > MEDIA_BUDGET) {
      skipped.push(path);
      continue;
    }
    used += buf.byteLength;
    mediaFiles += 1;
    files[`medien/${path.slice(userId.length + 1)}`] = buf;
  }
  if (skipped.length > 0) {
    files["medien/NICHT-ENTHALTEN.txt"] = strToU8(
      [
        "Diese Dateien überschreiten das Archivbudget und sind nicht enthalten.",
        "Sie können über die App weiterhin abgerufen werden:",
        "",
        ...skipped,
      ].join("\n"),
    );
  }

  const zipped = zipSync(files, { level: 6 });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const objectPath = `${userId}/exports/y-dude-datenexport-${stamp}.zip`;

  // Ältere Exporte des Nutzers zuerst entfernen (temporäre Dateien).
  const { data: old } = await supabaseAdmin.storage.from(BUCKET).list(`${userId}/exports`, {
    limit: 100,
  });
  const stale = (old ?? []).map((o) => `${userId}/exports/${o.name}`);
  if (stale.length > 0) await supabaseAdmin.storage.from(BUCKET).remove(stale);

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(objectPath, zipped, { contentType: "application/zip", upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { data: signed, error: signErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, EXPORT_TTL, { download: true });
  if (signErr || !signed?.signedUrl) throw new Error(signErr?.message ?? "sign failed");

  return {
    url: signed.signedUrl,
    filename: objectPath.split("/").pop()!,
    bytes: zipped.byteLength,
    mediaFiles,
  };
}

// ------------------------------------------------------------------ Löschung

/** Tabellen ohne Fremdschlüssel-Kaskade, die explizit geräumt werden. */
const MANUAL_CLEANUP: { table: string; column: string }[] = [
  { table: "post_views", column: "user_id" },
  { table: "post_likes", column: "user_id" },
  { table: "post_saves", column: "user_id" },
  { table: "post_shares", column: "user_id" },
  { table: "slang_tag_likes", column: "user_id" },
  { table: "slang_tag_saves", column: "user_id" },
  { table: "slang_tag_shares", column: "user_id" },
  { table: "slang_tag_plays", column: "user_id" },
  { table: "slang_tag_votes", column: "user_id" },
  { table: "slang_tag_grants", column: "grantee_id" },
  { table: "slang_tag_share_requests", column: "requester_id" },
  { table: "comments", column: "user_id" },
  { table: "arena_likes", column: "user_id" },
  { table: "arena_votes", column: "user_id" },
  { table: "arena_plays", column: "user_id" },
  { table: "arena_comments", column: "user_id" },
  { table: "arena_submissions", column: "creator_id" },
  { table: "connections", column: "requester_id" },
  { table: "connections", column: "addressee_id" },
  { table: "connection_suggestions", column: "user_id" },
  { table: "connection_suggestions", column: "suggested_id" },
  { table: "connection_influence", column: "user_id" },
  { table: "conversation_members", column: "user_id" },
  { table: "messages", column: "sender_id" },
  { table: "chat_slang_tags", column: "creator_id" },
  { table: "notifications", column: "user_id" },
  { table: "notifications", column: "actor_id" },
  { table: "follows", column: "follower_id" },
  { table: "follows", column: "following_id" },
  { table: "hashtag_follows", column: "user_id" },
  { table: "feed_signals", column: "user_id" },
  { table: "feed_score_cache", column: "user_id" },
  { table: "feed_learned_weights", column: "user_id" },
  { table: "interaction_events", column: "user_id" },
  { table: "interest_confidence", column: "user_id" },
  { table: "user_interest_scores", column: "user_id" },
  { table: "user_interests", column: "user_id" },
  { table: "ad_preferences", column: "user_id" },
  { table: "ad_pauses", column: "user_id" },
  { table: "travel_plans", column: "user_id" },
  { table: "push_subscriptions", column: "user_id" },
  { table: "content_categories", column: "owner_id" },
  { table: "reports", column: "reporter_id" },
  { table: "market_favorites", column: "user_id" },
  { table: "market_searches", column: "user_id" },
  { table: "market_seller_profiles", column: "user_id" },
  { table: "moderation_appeals", column: "user_id" },
  { table: "moderation_actions", column: "target_user_id" },
];

/**
 * Market-Inserate beim Kontolöschen behandeln.
 *
 * Inserate ohne Kaufhistorie werden gelöscht. Inserate mit abgeschlossener
 * oder laufender Transaktion müssen als Buchungsnachweis erhalten bleiben
 * (§ 147 AO, § 257 HGB); dort wird der Inhalt anonymisiert und das Inserat
 * dauerhaft aus dem Market entfernt.
 */
async function handleMarketItems(userId: string): Promise<{ deleted: number; anonymized: number }> {
  const { data: items } = await supabaseAdmin
    .from("market_items")
    .select("id")
    .eq("seller_id", userId);
  const ids = (items ?? []).map((i) => i.id as string);
  if (ids.length === 0) return { deleted: 0, anonymized: 0 };

  const { data: withTx } = await supabaseAdmin
    .from("market_transactions")
    .select("item_id")
    .in("item_id", ids);
  const keep = new Set((withTx ?? []).map((t) => t.item_id as string));
  const removable = ids.filter((id) => !keep.has(id));

  if (removable.length > 0) {
    await supabaseAdmin.from("market_items").delete().in("id", removable);
  }
  if (keep.size > 0) {
    await anyDb
      .from("market_items")
      .update({
        title: "Gelöschtes Angebot",
        description: "",
        status: "removed",
        postal_code: null,
        place: null,
        lat: null,
        lon: null,
        attributes: {},
      })
      .in("id", [...keep]);
    // Bilder zum archivierten Inserat entfernen – der Nachweis braucht sie nicht.
    await anyDb.from("market_images").delete().in("item_id", [...keep]);
  }
  return { deleted: removable.length, anonymized: keep.size };
}

export type DeleteResult = {
  posts: number;
  tags: number;
  mediaObjects: number;
  marketItemsDeleted: number;
  marketItemsAnonymized: number;
};

export async function deleteUserAccount(userId: string): Promise<DeleteResult> {
  // 1) Uploads aus dem Speicher entfernen
  const objects = await listUserObjects(userId);
  if (objects.length > 0) {
    for (let i = 0; i < objects.length; i += 100) {
      await supabaseAdmin.storage.from(BUCKET).remove(objects.slice(i, i + 100));
    }
  }

  // 2) Eigene Inhalte löschen (Kindtabellen kaskadieren)
  const { data: ownTags } = await supabaseAdmin
    .from("slang_tags")
    .select("id")
    .or(`owner_id.eq.${userId},creator_id.eq.${userId}`);
  const tagIds = (ownTags ?? []).map((t) => t.id as string);

  const { data: ownPosts } = await supabaseAdmin.from("posts").select("id").eq("user_id", userId);
  const postIds = (ownPosts ?? []).map((p) => p.id as string);

  for (const step of MANUAL_CLEANUP) {
    await anyDb.from(step.table).delete().eq(step.column, userId);
  }

  if (postIds.length > 0) {
    await supabaseAdmin.from("posts").delete().in("id", postIds);
  }
  if (tagIds.length > 0) {
    // Verweise in Beiträgen/Kommentaren anderer Nutzer auflösen
    await supabaseAdmin.from("arena_submissions").delete().in("tag_id", tagIds);
    await supabaseAdmin.from("ad_campaigns").delete().in("slang_tag_id", tagIds);
    await supabaseAdmin.from("slang_tags").delete().in("id", tagIds);
  }

  // 3) Market: Inserate löschen bzw. für Buchungsnachweise anonymisieren
  const market = await handleMarketItems(userId);

  // 4) Profil und Auth-Konto entfernen (Sessions und Tokens erlöschen dabei)
  await supabaseAdmin.from("profiles").delete().eq("id", userId);
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);

  return {
    posts: postIds.length,
    tags: tagIds.length,
    mediaObjects: objects.length,
    marketItemsDeleted: market.deleted,
    marketItemsAnonymized: market.anonymized,
  };
}
