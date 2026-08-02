import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_BOT_CONFIG,
  type AdminActiveUserRow,
  type AdminAdPauseRow,
  type AdminAuditRow,
  type AdminCampaignRow,
  type AdminCommentRow,
  type AdminOverview,
  type AdminPostRow,
  type AdminReportRow,
  type AdminSlangTagRow,
  type AdminStats,
  type AdminTestAccount,
  type AdminUserRow,
  type BotConfig,
  type ReportStatus,
  type ReportTargetType,
  type SeriesPoint,
} from "@/lib/admin.shared";
import { randomPassword } from "@/lib/test-accounts.shared";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

/** Verifies the caller holds the admin role through their own (RLS-scoped) client. */
export async function assertAdmin(ctx: Ctx): Promise<string> {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || data !== true) throw new Error("Forbidden");
  return ctx.userId;
}

export async function isAdmin(ctx: Ctx): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  return data === true;
}

async function usernameOf(userId: string | null | undefined): Promise<string> {
  if (!userId) return "";
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  return data?.username ?? "";
}

/** Writes one entry into the admin security protocol. */
export async function logAdminAction(
  adminId: string,
  action: string,
  opts: {
    targetType?: string;
    targetId?: string | null;
    targetUserId?: string | null;
    targetLabel?: string;
    details?: Record<string, unknown>;
  } = {},
) {
  await supabaseAdmin.from("admin_audit_log").insert({
    admin_id: adminId,
    admin_username: await usernameOf(adminId),
    action,
    target_type: opts.targetType ?? "",
    target_id: opts.targetId ?? null,
    target_user_id: opts.targetUserId ?? null,
    target_label: opts.targetLabel ?? "",
    details: (opts.details ?? {}) as never,
  });
}

async function countOf(
  table:
    | "profiles"
    | "posts"
    | "comments"
    | "slang_tags"
    | "reports"
    | "ad_campaigns"
    | "ad_pauses"
    | "test_accounts"
    | "admin_audit_log",
): Promise<number> {
  const { count } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

function monthKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function loadOverview(): Promise<AdminOverview> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [users, posts, comments, tags, reportsTotal, campaigns, testAccounts, audit] =
    await Promise.all([
      countOf("profiles"),
      countOf("posts"),
      countOf("comments"),
      countOf("slang_tags"),
      countOf("reports"),
      countOf("ad_campaigns"),
      countOf("test_accounts"),
      countOf("admin_audit_log"),
    ]);

  const { count: activeUsers } = await supabaseAdmin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("last_seen_at", sevenDaysAgo);
  const { count: reportsOpen } = await supabaseAdmin
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");
  const { count: pauses } = await supabaseAdmin
    .from("ad_pauses")
    .select("*", { count: "exact", head: true })
    .eq("month_key", monthKey());

  return {
    users,
    activeUsers: activeUsers ?? 0,
    posts,
    slangTags: tags,
    comments,
    reportsOpen: reportsOpen ?? 0,
    reportsTotal,
    campaigns,
    adPausesMonth: pauses ?? 0,
    testAccounts,
    auditEntries: audit,
  };
}

/* ------------------------------------------------------------------ users */

export async function loadUsers(query: string): Promise<AdminUserRow[]> {
  let q = supabaseAdmin
    .from("profiles")
    .select("id,username,display_name,location,language,verified,level,created_at,last_seen_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (query.trim())
    q = q.or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((r) => r.id);
  const [{ data: roles }, { data: bans }, { data: warns }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    supabaseAdmin.from("user_bans").select("user_id,reason,expires_at,active").in("user_id", ids),
    supabaseAdmin.from("user_warnings").select("user_id").in("user_id", ids),
  ]);

  const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
  const banMap = new Map((bans ?? []).filter((b) => b.active).map((b) => [b.user_id, b]));
  const warnCount = new Map<string, number>();
  for (const w of warns ?? []) warnCount.set(w.user_id, (warnCount.get(w.user_id) ?? 0) + 1);

  return (data ?? []).map((r) => {
    const ban = banMap.get(r.id);
    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      location: r.location,
      language: r.language,
      verified: r.verified,
      level: r.level,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      isAdmin: adminIds.has(r.id),
      banned: !!ban,
      banReason: ban?.reason ?? "",
      banExpiresAt: ban?.expires_at ?? null,
      warnings: warnCount.get(r.id) ?? 0,
    };
  });
}

export type UserAction =
  | "warn"
  | "ban"
  | "unban"
  | "delete"
  | "grant_admin"
  | "revoke_admin"
  | "verify"
  | "unverify";

export async function runUserAction(
  adminId: string,
  userId: string,
  action: UserAction,
  reason: string,
  days: number,
) {
  const label = await usernameOf(userId);
  if (
    userId === adminId &&
    (action === "delete" || action === "ban" || action === "revoke_admin")
  ) {
    throw new Error("Diese Aktion ist auf dem eigenen Konto nicht erlaubt.");
  }

  switch (action) {
    case "warn":
      await supabaseAdmin
        .from("user_warnings")
        .insert({ user_id: userId, admin_id: adminId, reason, note: "" });
      break;
    case "ban": {
      const expires = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      await supabaseAdmin
        .from("user_bans")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("active", true);
      await supabaseAdmin.from("user_bans").insert({
        user_id: userId,
        admin_id: adminId,
        reason,
        expires_at: expires,
        active: true,
      });
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        ban_duration: days > 0 ? `${days * 24}h` : "876000h",
      });
      break;
    }
    case "unban":
      await supabaseAdmin
        .from("user_bans")
        .update({ active: false })
        .eq("user_id", userId)
        .eq("active", true);
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      break;
    case "delete":
      await supabaseAdmin.from("test_accounts").delete().eq("user_id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      break;
    case "grant_admin":
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
      break;
    case "revoke_admin":
      await supabaseAdmin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      break;
    case "verify":
    case "unverify":
      await supabaseAdmin
        .from("profiles")
        .update({ verified: action === "verify" })
        .eq("id", userId);
      break;
  }

  await logAdminAction(adminId, action, {
    targetType: "user",
    targetUserId: userId,
    targetLabel: label,
    details: { reason, days },
  });
}

/* ---------------------------------------------------------------- reports */

async function labelForReport(type: ReportTargetType, id: string) {
  if (type === "post") {
    const { data } = await supabaseAdmin
      .from("posts")
      .select("title,user_id")
      .eq("id", id)
      .maybeSingle();
    return { label: data?.title ?? "(gelöscht)", owner: data?.user_id ?? null };
  }
  if (type === "slang_tag") {
    const { data } = await supabaseAdmin
      .from("slang_tags")
      .select("name,owner_id")
      .eq("id", id)
      .maybeSingle();
    return { label: data ? `$${data.name}` : "(gelöscht)", owner: data?.owner_id ?? null };
  }
  if (type === "comment") {
    const { data } = await supabaseAdmin
      .from("comments")
      .select("body,user_id")
      .eq("id", id)
      .maybeSingle();
    return { label: data?.body?.slice(0, 120) ?? "(gelöscht)", owner: data?.user_id ?? null };
  }
  if (type === "message") {
    const { data } = await supabaseAdmin
      .from("messages")
      .select("body,sender_id")
      .eq("id", id)
      .maybeSingle();
    return { label: data?.body?.slice(0, 120) ?? "(gelöscht)", owner: data?.sender_id ?? null };
  }
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", id)
    .maybeSingle();
  return { label: data ? `@${data.username}` : "(gelöscht)", owner: id };
}

export async function loadReports(
  targetType: ReportTargetType | "all",
  status: ReportStatus | "all",
): Promise<AdminReportRow[]> {
  let q = supabaseAdmin
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (targetType !== "all") q = q.eq("target_type", targetType);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows: AdminReportRow[] = [];
  for (const r of data ?? []) {
    const { label, owner } = await labelForReport(r.target_type, r.target_id);
    rows.push({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      targetLabel: label,
      targetUsername: await usernameOf(r.target_user_id ?? owner),
      targetUserId: r.target_user_id ?? owner ?? null,
      reporterUsername: await usernameOf(r.reporter_id),
      reason: r.reason,
      details: r.details,
      status: r.status,
      reviewNote: r.review_note,
      createdAt: r.created_at,
    });
  }
  return rows;
}

export async function resolveReport(
  adminId: string,
  id: string,
  status: ReportStatus,
  note: string,
) {
  const { error } = await supabaseAdmin
    .from("reports")
    .update({
      status,
      review_note: note,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, `report_${status}`, {
    targetType: "report",
    targetId: id,
    details: { note },
  });
}

export async function deleteReportedContent(adminId: string, id: string) {
  const { data: report } = await supabaseAdmin
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) throw new Error("Meldung nicht gefunden");

  if (report.target_type === "post")
    await supabaseAdmin.from("posts").delete().eq("id", report.target_id);
  if (report.target_type === "comment")
    await supabaseAdmin.from("comments").delete().eq("id", report.target_id);
  if (report.target_type === "message")
    await supabaseAdmin.from("messages").delete().eq("id", report.target_id);
  if (report.target_type === "slang_tag")
    await supabaseAdmin
      .from("slang_tags")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", report.target_id);

  await resolveReport(adminId, id, "resolved", "Inhalt entfernt");
  await logAdminAction(adminId, "delete_reported_content", {
    targetType: report.target_type,
    targetId: report.target_id,
  });
}

/** Gemeldeten Beitrag nur verbergen (Inhalt bleibt erhalten). */
export async function hideReportedContent(adminId: string, id: string) {
  const { data: report } = await supabaseAdmin
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) throw new Error("Meldung nicht gefunden");
  if (report.target_type !== "post") throw new Error("Nur Beiträge können verborgen werden.");

  const { error } = await supabaseAdmin
    .from("posts")
    .update({ hidden_at: new Date().toISOString() } as never)
    .eq("id", report.target_id);
  if (error) throw new Error(error.message);

  await resolveReport(adminId, id, "resolved", "Beitrag verborgen");
  await logAdminAction(adminId, "hide_reported_content", {
    targetType: report.target_type,
    targetId: report.target_id,
  });
}

/* ------------------------------------------------------------- slang tags */

export async function loadSlangTags(
  query: string,
  includeDeleted: boolean,
): Promise<AdminSlangTagRow[]> {
  let q = supabaseAdmin
    .from("slang_tags")
    .select(
      "id,name,kind,owner_id,region,language,meaning,audio_url,plays_count,uses_count,likes_count,created_at,deleted_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (!includeDeleted) q = q.is("deleted_at", null);
  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const ownerIds = [...new Set((data ?? []).map((r) => r.owner_id))];
  const { data: owners } = await supabaseAdmin
    .from("profiles")
    .select("id,username")
    .in("id", ownerIds);
  const nameOf = new Map((owners ?? []).map((o) => [o.id, o.username]));

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    ownerUsername: nameOf.get(r.owner_id) ?? "",
    region: r.region,
    language: r.language,
    meaning: r.meaning,
    audioUrl: r.audio_url,
    playsCount: r.plays_count,
    usesCount: r.uses_count,
    likesCount: r.likes_count,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
  }));
}

export async function updateSlangTag(
  adminId: string,
  id: string,
  patch: { name?: string; meaning?: string; region?: string; language?: string },
) {
  const { error } = await supabaseAdmin.from("slang_tags").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "slang_tag_update", {
    targetType: "slang_tag",
    targetId: id,
    details: patch,
  });
}

export async function setSlangTagDeleted(adminId: string, id: string, deleted: boolean) {
  const { error } = await supabaseAdmin
    .from("slang_tags")
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, deleted ? "slang_tag_delete" : "slang_tag_restore", {
    targetType: "slang_tag",
    targetId: id,
  });
}

export async function purgeSlangTag(adminId: string, id: string) {
  const { error } = await supabaseAdmin.from("slang_tags").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "slang_tag_purge", { targetType: "slang_tag", targetId: id });
}

/* ------------------------------------------------------- posts & comments */

export async function loadPosts(query: string): Promise<AdminPostRow[]> {
  let q = supabaseAdmin
    .from("posts")
    .select(
      "id,title,description,user_id,region,visibility,image_url,likes_count,comments_count,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const { data: owners } = await supabaseAdmin
    .from("profiles")
    .select("id,username")
    .in("id", [...new Set((data ?? []).map((r) => r.user_id))]);
  const nameOf = new Map((owners ?? []).map((o) => [o.id, o.username]));

  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    username: nameOf.get(r.user_id) ?? "",
    region: r.region,
    visibility: r.visibility,
    imageUrl: r.image_url,
    likesCount: r.likes_count,
    commentsCount: r.comments_count,
    createdAt: r.created_at,
  }));
}

export async function deletePost(adminId: string, id: string) {
  const { error } = await supabaseAdmin.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "post_delete", { targetType: "post", targetId: id });
}

export async function loadComments(query: string): Promise<AdminCommentRow[]> {
  let q = supabaseAdmin
    .from("comments")
    .select("id,post_id,user_id,body,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (query.trim()) q = q.ilike("body", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const [{ data: owners }, { data: posts }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id,username")
      .in("id", [...new Set((data ?? []).map((r) => r.user_id))]),
    supabaseAdmin
      .from("posts")
      .select("id,title")
      .in("id", [...new Set((data ?? []).map((r) => r.post_id))]),
  ]);
  const nameOf = new Map((owners ?? []).map((o) => [o.id, o.username]));
  const titleOf = new Map((posts ?? []).map((p) => [p.id, p.title]));

  return (data ?? []).map((r) => ({
    id: r.id,
    postId: r.post_id,
    postTitle: titleOf.get(r.post_id) ?? "",
    username: nameOf.get(r.user_id) ?? "",
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function deleteComment(adminId: string, id: string) {
  const { error } = await supabaseAdmin.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "comment_delete", { targetType: "comment", targetId: id });
}

/* ------------------------------------------------------------- ad core */

export async function loadCampaigns(): Promise<AdminCampaignRow[]> {
  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const tagIds = (data ?? []).map((r) => r.slang_tag_id).filter((v): v is string => !!v);
  const { data: tags } = tagIds.length
    ? await supabaseAdmin.from("slang_tags").select("id,name").in("id", tagIds)
    : { data: [] as { id: string; name: string }[] };
  const tagName = new Map((tags ?? []).map((t) => [t.id, t.name]));

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    status: r.status,
    region: r.region,
    slangTagId: r.slang_tag_id,
    slangTagName: r.slang_tag_id ? (tagName.get(r.slang_tag_id) ?? "") : "",
    budgetCents: r.budget_cents,
    revenueCents: r.revenue_cents,
    impressions: r.impressions,
    clicks: r.clicks,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    createdAt: r.created_at,
  }));
}

export type CampaignInput = {
  id?: string;
  name: string;
  kind: AdminCampaignRow["kind"];
  status: AdminCampaignRow["status"];
  region: string;
  budgetCents: number;
  revenueCents: number;
  impressions: number;
  clicks: number;
  slangTagId: string | null;
};

export async function saveCampaign(adminId: string, input: CampaignInput) {
  const row = {
    name: input.name,
    kind: input.kind,
    status: input.status,
    region: input.region,
    budget_cents: input.budgetCents,
    revenue_cents: input.revenueCents,
    impressions: input.impressions,
    clicks: input.clicks,
    slang_tag_id: input.slangTagId,
  };
  if (input.id) {
    const { error } = await supabaseAdmin.from("ad_campaigns").update(row).eq("id", input.id);
    if (error) throw new Error(error.message);
    await logAdminAction(adminId, "campaign_update", {
      targetType: "ad_campaign",
      targetId: input.id,
      targetLabel: input.name,
    });
    return input.id;
  }
  const { data, error } = await supabaseAdmin
    .from("ad_campaigns")
    .insert({ ...row, owner_id: adminId })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "campaign_create", {
    targetType: "ad_campaign",
    targetId: data.id,
    targetLabel: input.name,
  });
  return data.id;
}

export async function deleteCampaign(adminId: string, id: string) {
  const { error } = await supabaseAdmin.from("ad_campaigns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "campaign_delete", { targetType: "ad_campaign", targetId: id });
}

export async function loadAdPauses(): Promise<AdminAdPauseRow[]> {
  const { data, error } = await supabaseAdmin
    .from("ad_pauses")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const { data: owners } = await supabaseAdmin
    .from("profiles")
    .select("id,username")
    .in("id", [...new Set((data ?? []).map((r) => r.user_id))]);
  const nameOf = new Map((owners ?? []).map((o) => [o.id, o.username]));
  return (data ?? []).map((r) => ({
    id: r.id,
    username: nameOf.get(r.user_id) ?? "",
    localDate: r.local_date,
    monthKey: r.month_key,
    timezone: r.timezone,
    endsAt: r.ends_at,
    createdAt: r.created_at,
  }));
}

/* --------------------------------------------------------- active users */

export async function loadActiveUsers(): Promise<AdminActiveUserRow[]> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,username,location,last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const { data: allPosts } = await supabaseAdmin.from("posts").select("user_id").limit(5000);
  const postCount = new Map<string, number>();
  for (const p of allPosts ?? []) postCount.set(p.user_id, (postCount.get(p.user_id) ?? 0) + 1);
  const now = Date.now();
  return (data ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    location: r.location,
    lastSeenAt: r.last_seen_at,
    posts: postCount.get(r.id) ?? 0,
    online: now - new Date(r.last_seen_at).getTime() < 5 * 60000,
  }));
}

/* -------------------------------------------------------------- statistics */

function bucket(dates: (string | null)[], days = 30): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const map = new Map<string, number>();
  for (const d of dates) {
    if (!d) continue;
    const key = d.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, value: map.get(key) ?? 0 });
  }
  return out;
}

export async function loadStats(): Promise<AdminStats> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [profiles, posts, tags, pauses, campaigns] = await Promise.all([
    supabaseAdmin.from("profiles").select("created_at,location,language").limit(5000),
    supabaseAdmin.from("posts").select("created_at,region").gte("created_at", since).limit(5000),
    supabaseAdmin.from("slang_tags").select("created_at").gte("created_at", since).limit(5000),
    supabaseAdmin.from("ad_pauses").select("created_at").gte("created_at", since).limit(5000),
    supabaseAdmin
      .from("ad_campaigns")
      .select("created_at,revenue_cents,impressions,clicks")
      .limit(2000),
  ]);

  const regionCount = new Map<string, number>();
  const languageCount = new Map<string, number>();
  for (const p of profiles.data ?? []) {
    const region = (p.location || "Unbekannt").split(",").pop()?.trim() || "Unbekannt";
    regionCount.set(region, (regionCount.get(region) ?? 0) + 1);
    const lang = p.language || "Unbekannt";
    languageCount.set(lang, (languageCount.get(lang) ?? 0) + 1);
  }

  const revenueByDay = new Map<string, number>();
  let revenueTotalCents = 0;
  let impressions = 0;
  let clicks = 0;
  for (const c of campaigns.data ?? []) {
    revenueTotalCents += c.revenue_cents;
    impressions += c.impressions;
    clicks += c.clicks;
    const key = c.created_at.slice(0, 10);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + c.revenue_cents);
  }
  const revenueSeries = bucket([]).map((p) => ({
    date: p.date,
    value: (revenueByDay.get(p.date) ?? 0) / 100,
  }));

  const sortTop = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

  return {
    users: bucket((profiles.data ?? []).map((p) => p.created_at)),
    posts: bucket((posts.data ?? []).map((p) => p.created_at)),
    slangTags: bucket((tags.data ?? []).map((p) => p.created_at)),
    adPauses: bucket((pauses.data ?? []).map((p) => p.created_at)),
    revenue: revenueSeries,
    regions: sortTop(regionCount),
    languages: sortTop(languageCount),
    revenueTotalCents,
    impressions,
    clicks,
  };
}

/* --------------------------------------------------------------- audit log */

export async function loadAudit(limit: number): Promise<AdminAuditRow[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    adminUsername: r.admin_username || "—",
    action: r.action,
    targetType: r.target_type,
    targetLabel: r.target_label,
    details: r.details ? JSON.stringify(r.details) : "",
    createdAt: r.created_at,
  }));
}

/* ------------------------------------------------------------- test users */

function parseBotConfig(value: unknown): BotConfig {
  const raw = (value ?? {}) as Partial<BotConfig>;
  return {
    enabled: raw.enabled ?? DEFAULT_BOT_CONFIG.enabled,
    intervalMinutes: raw.intervalMinutes ?? DEFAULT_BOT_CONFIG.intervalMinutes,
    actions: Array.isArray(raw.actions) ? raw.actions : DEFAULT_BOT_CONFIG.actions,
    tone: raw.tone ?? DEFAULT_BOT_CONFIG.tone,
  };
}

export async function loadTestAccounts(): Promise<AdminTestAccount[]> {
  const { data, error } = await supabaseAdmin
    .from("test_accounts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    email: r.email,
    initialPassword: r.initial_password,
    region: r.region,
    language: r.language,
    active: r.active,
    botConfig: parseBotConfig(r.bot_config),
    registeredAt: r.registered_at,
  }));
}

export async function createTestAccount(
  adminId: string,
  input: { username: string; region: string; language: string },
) {
  const username = input.username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "");
  if (username.length < 2) throw new Error("Ungültiger Benutzername");
  const email = `${username}@testaccount.y-dude.com`;

  const { data: existing } = await supabaseAdmin
    .from("test_accounts")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) throw new Error("Testuser existiert bereits");

  const password = randomPassword();
  const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, test_account: true },
  });
  if (userError || !user.user) throw new Error(userError?.message ?? "createUser fehlgeschlagen");

  await supabaseAdmin.from("profiles").upsert({
    id: user.user.id,
    username,
    display_name: username,
    bio: "",
    location: input.region,
    language: input.language,
  });
  const { error } = await supabaseAdmin.from("test_accounts").insert({
    user_id: user.user.id,
    username,
    email,
    initial_password: password,
    region: input.region,
    language: input.language,
  });
  if (error) throw new Error(error.message);

  await logAdminAction(adminId, "test_user_create", {
    targetType: "test_account",
    targetUserId: user.user.id,
    targetLabel: username,
  });
  return { username, email, password };
}

export async function updateTestAccount(
  adminId: string,
  id: string,
  patch: {
    username?: string;
    region?: string;
    language?: string;
    active?: boolean;
    botConfig?: BotConfig;
  },
) {
  const { data: row } = await supabaseAdmin
    .from("test_accounts")
    .select("user_id,username")
    .eq("id", id)
    .maybeSingle();
  if (!row) throw new Error("Testuser nicht gefunden");

  const update: Database["public"]["Tables"]["test_accounts"]["Update"] = {};
  if (patch.username) update.username = patch.username.trim().toLowerCase();
  if (patch.region !== undefined) update.region = patch.region;
  if (patch.language !== undefined) update.language = patch.language;
  if (patch.active !== undefined) update.active = patch.active;
  if (patch.botConfig) update.bot_config = patch.botConfig as never;

  const { error } = await supabaseAdmin.from("test_accounts").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  if (patch.username || patch.region || patch.language) {
    await supabaseAdmin
      .from("profiles")
      .update({
        ...(patch.username ? { username: patch.username.trim().toLowerCase() } : {}),
        ...(patch.region !== undefined ? { location: patch.region } : {}),
        ...(patch.language !== undefined ? { language: patch.language } : {}),
      })
      .eq("id", row.user_id);
  }
  if (patch.active !== undefined) {
    await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      ban_duration: patch.active ? "none" : "876000h",
    });
  }

  await logAdminAction(adminId, "test_user_update", {
    targetType: "test_account",
    targetId: id,
    targetUserId: row.user_id,
    targetLabel: row.username,
    details: patch as Record<string, unknown>,
  });
}

export async function deleteTestAccount(adminId: string, id: string) {
  const { data: row } = await supabaseAdmin
    .from("test_accounts")
    .select("user_id,username")
    .eq("id", id)
    .maybeSingle();
  if (!row) return;
  await supabaseAdmin.from("test_accounts").delete().eq("id", id);
  await supabaseAdmin.auth.admin.deleteUser(row.user_id);
  await logAdminAction(adminId, "test_user_delete", {
    targetType: "test_account",
    targetUserId: row.user_id,
    targetLabel: row.username,
  });
}

const BOT_COMMENTS = [
  "Stark! 🔥",
  "Das ist echt lokal 😄",
  "Krass, kannte ich noch nicht.",
  "Mega SlangTag!",
  "Bei uns sagt man das auch.",
];

/** Runs one bot/test action on behalf of a test account. */
export async function runTestAction(adminId: string, id: string, action: string) {
  const { data: row } = await supabaseAdmin
    .from("test_accounts")
    .select("user_id,username,active")
    .eq("id", id)
    .maybeSingle();
  if (!row) throw new Error("Testuser nicht gefunden");
  if (!row.active) throw new Error("Testuser ist deaktiviert");

  const uid = row.user_id;
  let result = "";

  if (action === "like" || action === "comment") {
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id")
      .neq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(25);
    const pick = (posts ?? [])[Math.floor(Math.random() * (posts?.length || 1))];
    if (!pick) throw new Error("Keine Beiträge vorhanden");
    if (action === "like") {
      await supabaseAdmin.from("post_likes").upsert({ post_id: pick.id, user_id: uid });
      result = `Beitrag ${pick.id} geliked`;
    } else {
      await supabaseAdmin.from("comments").insert({
        post_id: pick.id,
        user_id: uid,
        body: BOT_COMMENTS[Math.floor(Math.random() * BOT_COMMENTS.length)],
      });
      result = `Kommentar auf ${pick.id}`;
    }
  } else if (action === "follow") {
    const { data: users } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .neq("id", uid)
      .limit(25);
    const pick = (users ?? [])[Math.floor(Math.random() * (users?.length || 1))];
    if (!pick) throw new Error("Keine Nutzer vorhanden");
    await supabaseAdmin.from("follows").upsert({ follower_id: uid, following_id: pick.id });
    result = `Folgt ${pick.id}`;
  } else if (action === "play") {
    const { data: tags } = await supabaseAdmin
      .from("slang_tags")
      .select("id")
      .is("deleted_at", null)
      .limit(25);
    const pick = (tags ?? [])[Math.floor(Math.random() * (tags?.length || 1))];
    if (!pick) throw new Error("Keine SlangTags vorhanden");
    await supabaseAdmin.from("slang_tag_plays").insert({ tag_id: pick.id, user_id: uid });
    result = `SlangTag ${pick.id} abgespielt`;
  } else {
    throw new Error("Unbekannte Aktion");
  }

  await supabaseAdmin
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", uid);
  await logAdminAction(adminId, `test_action_${action}`, {
    targetType: "test_account",
    targetId: id,
    targetUserId: uid,
    targetLabel: row.username,
    details: { result },
  });
  return result;
}
