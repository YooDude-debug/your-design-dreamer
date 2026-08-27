import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { ModerationReasonCode } from "@/lib/moderation-reasons";

/** Kurzbezeichnung des betroffenen Inhalts für die Nutzerbenachrichtigung. */
const TARGET_LABELS: Record<string, string> = {
  post: "Beitrag",
  comment: "Kommentar",
  message: "Nachricht",
  slang_tag: "SlangTag",
  profile: "Profil",
  market_item: "Market-Angebot",
};

import {
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
  type AdminUserRow,
  type AdminUserSort,
  type ReportStatus,
  type ReportTargetType,
  type SeriesPoint,
} from "@/lib/admin.shared";

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

/** Verifies the caller holds the admin or moderator role (Moderationsbereich). */
export async function assertModerator(ctx: Ctx): Promise<string> {
  for (const role of ["admin", "moderator"] as const) {
    const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
    if (data === true) return ctx.userId;
  }
  throw new Error("Forbidden");
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
  const [users, posts, comments, tags, reportsTotal, campaigns, audit] = await Promise.all([
    countOf("profiles"),
    countOf("posts"),
    countOf("comments"),
    countOf("slang_tags"),
    countOf("reports"),
    countOf("ad_campaigns"),
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
  const { count: feedbackOpen } = await supabaseAdmin
    .from("feedback")
    .select("*", { count: "exact", head: true })
    .in("status", ["new", "in_progress"]);
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
    feedbackOpen: feedbackOpen ?? 0,
    auditEntries: audit,
  };
}

/* ------------------------------------------------------------------ users */

export async function loadUsers(
  query: string,
  sort: AdminUserSort = "recent_activity",
): Promise<AdminUserRow[]> {
  let q = supabaseAdmin
    .from("profiles")
    .select("id,username,display_name,location,language,verified,level,created_at,last_seen_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (query.trim())
    q = q.or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  // Registrierte Konten ohne Profilzeile (Double-Opt-in bestätigt, aber noch
  // nie eingeloggt) sind sonst im Dashboard unsichtbar. Sie werden hier aus
  // der Kontoverwaltung ergänzt, damit jede echte Registrierung erscheint.
  const profileIds = new Set((data ?? []).map((r) => r.id));
  const term = query.trim().toLowerCase();
  const pending: AdminUserRow[] = [];
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  /** E-Mail-Adressen aus dem Auth-System – nur für Admin-Anzeige. */
  const emailById = new Map<string, string>();
  /** Letzter Login aus der Kontoverwaltung – zweite belastbare Aktivitätsquelle. */
  const lastSignIn = new Map<string, string>();
  for (const u of authList?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
    if (u.last_sign_in_at) lastSignIn.set(u.id, u.last_sign_in_at);
  }
  for (const u of authList?.users ?? []) {
    if (profileIds.has(u.id)) continue;
    const meta = (u.user_metadata ?? {}) as { username?: string };
    const username = (meta.username ?? u.email?.split("@")[0] ?? "").trim();
    if (
      term &&
      !username.toLowerCase().includes(term) &&
      !(u.email ?? "").toLowerCase().includes(term)
    )
      continue;
    pending.push({
      id: u.id,
      username,
      email: u.email ?? null,
      displayName: u.email ?? username,
      location: "",
      language: "",
      verified: false,
      level: 0,
      createdAt: u.created_at,
      lastSeenAt: u.last_sign_in_at ?? null,
      isAdmin: false,
      isCreator: false,
      isBusiness: false,
      banned: false,
      banReason: "",
      banExpiresAt: null,
      warnings: 0,
      pendingProfile: true,
    });
  }

  const ids = (data ?? []).map((r) => r.id);
  const [{ data: roles }, { data: bans }, { data: warns }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    supabaseAdmin.from("user_bans").select("user_id,reason,expires_at,active").in("user_id", ids),
    supabaseAdmin.from("user_warnings").select("user_id").in("user_id", ids),
  ]);

  const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
  const creatorIds = new Set(
    (roles ?? []).filter((r) => r.role === "creator").map((r) => r.user_id),
  );
  const businessIds = new Set(
    (roles ?? []).filter((r) => r.role === "business").map((r) => r.user_id),
  );
  const banMap = new Map((bans ?? []).filter((b) => b.active).map((b) => [b.user_id, b]));
  const warnCount = new Map<string, number>();
  for (const w of warns ?? []) warnCount.set(w.user_id, (warnCount.get(w.user_id) ?? 0) + 1);

  const rows: AdminUserRow[] = (data ?? []).map((r) => {
    const ban = banMap.get(r.id);
    // Der jüngere der beiden belastbaren Zeitstempel gilt. Entspricht der
    // Wert exakt der Registrierung und gab es nie einen Login, bleibt die
    // Aktivität unbekannt (kein künstlicher Wert).
    const candidates = [r.last_seen_at, lastSignIn.get(r.id) ?? null].filter(
      (v): v is string => !!v,
    );
    let lastSeenAt: string | null =
      candidates.length > 0
        ? candidates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
        : null;
    if (lastSeenAt && !lastSignIn.has(r.id) && lastSeenAt === r.created_at) lastSeenAt = null;
    return {
      id: r.id,
      username: r.username,
      email: emailById.get(r.id) ?? null,
      displayName: r.display_name,
      location: r.location,
      language: r.language,
      verified: r.verified,
      level: r.level,
      createdAt: r.created_at,
      lastSeenAt,
      isAdmin: adminIds.has(r.id),
      isCreator: creatorIds.has(r.id),
      isBusiness: businessIds.has(r.id),
      banned: !!ban,
      banReason: ban?.reason ?? "",
      banExpiresAt: ban?.expires_at ?? null,
      warnings: warnCount.get(r.id) ?? 0,
    };
  });

  const all = [...rows, ...pending];
  const seen = (r: AdminUserRow) => (r.lastSeenAt ? new Date(r.lastSeenAt).getTime() : 0);
  const created = (r: AdminUserRow) => new Date(r.createdAt).getTime();
  all.sort((a, b) => {
    switch (sort) {
      case "recent_activity":
        return seen(b) - seen(a) || created(b) - created(a);
      case "oldest_activity":
        return seen(a) - seen(b) || created(a) - created(b);
      case "oldest_signup":
        return created(a) - created(b);
      case "newest_signup":
      default:
        return created(b) - created(a);
    }
  });
  return all;
}

export type UserAction =
  | "warn"
  | "ban"
  | "unban"
  | "delete"
  | "grant_admin"
  | "revoke_admin"
  | "grant_creator"
  | "revoke_creator"
  | "grant_business"
  | "revoke_business"
  | "verify"
  | "unverify";

/** Master-/Owner-Admin? Die Prüfung läuft ausschließlich serverseitig. */
export async function isOwnerAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("is_admin_owner", { _user_id: userId });
  return data === true;
}

/**
 * Timing-sichere Prüfung des Master-Passworts. Das Passwort liegt nur als
 * Server-Secret (MASTER_ADMIN_PASSWORD) vor, wird nie an den Client gesendet
 * und nie geloggt; verglichen werden ausschließlich SHA-256-Digests.
 */
async function masterPasswordMatches(input: string): Promise<boolean> {
  const expected = process.env["MASTER_ADMIN_PASSWORD"] ?? "";
  if (!expected || !input) return false;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * Rollenwechsel „admin“ – besonders geschützte Owner-Aktion:
 * Owner-Prüfung + Master-Passwort, danach die geprüfte Datenbankfunktion
 * (`owner_set_admin_role`), die direkte Schreibversuche per Trigger blockt.
 */
async function changeAdminRole(
  adminId: string,
  userId: string,
  grant: boolean,
  masterPassword: string,
  label: string,
) {
  const action = grant ? "grant_admin" : "revoke_admin";
  const deny = async (reason: string) => {
    await logAdminAction(adminId, `${action}_denied`, {
      targetType: "user",
      targetUserId: userId,
      targetLabel: label,
      details: { reason },
    });
    throw new Error(
      reason === "not_owner"
        ? "Nur der Master-Owner darf Adminrechte vergeben oder entziehen."
        : "Master-Passwort ist ungültig. Die Rolle wurde nicht geändert.",
    );
  };

  if (!(await isOwnerAdmin(adminId))) await deny("not_owner");
  if (!(await masterPasswordMatches(masterPassword))) await deny("invalid_master_password");

  const { error } = await supabaseAdmin.rpc("owner_set_admin_role", {
    _actor: adminId,
    _target: userId,
    _grant: grant,
  });
  if (error) {
    await logAdminAction(adminId, `${action}_denied`, {
      targetType: "user",
      targetUserId: userId,
      targetLabel: label,
      details: { reason: "database_rejected" },
    });
    throw new Error(error.message);
  }
}

/**
 * Vergabe/Entzug der einfachen Rollen `creator` und `business`.
 *
 * Bewusst OHNE zusaetzliche Passwortpruefung: die Aktion laeuft nur im bereits
 * serverseitig geprueften Adminbereich (`assertAdmin`). Die besonders
 * geschuetzte Adminrolle bleibt unveraendert bei `owner_set_admin_role`.
 */
async function setSimpleRole(userId: string, role: "creator" | "business", grant: boolean) {
  if (grant) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role })
      .select("id")
      .maybeSingle();
    // Doppelte Vergabe ist kein Fehler (unique user_id+role).
    if (error && error.code !== "23505") throw new Error(error.message);
    return;
  }
  const { error } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("role", role);
  if (error) throw new Error(error.message);
}

export async function runUserAction(
  adminId: string,
  userId: string,
  action: UserAction,
  reason: string,
  days: number,
  masterPassword = "",
) {
  const label = await usernameOf(userId);
  if (
    userId === adminId &&
    (action === "delete" ||
      action === "ban" ||
      action === "revoke_admin" ||
      action === "warn" ||
      action === "unverify")
  ) {
    throw new Error("Diese Aktion ist auf dem eigenen Konto nicht erlaubt.");
  }

  switch (action) {
    case "warn": {
      await supabaseAdmin
        .from("user_warnings")
        .insert({ user_id: userId, admin_id: adminId, reason, note: "" });
      const { recordModerationAction } = await import("@/lib/moderation-dsa.server");
      await recordModerationAction({
        targetType: "profile",
        targetId: userId,
        targetUserId: userId,
        actionKind: "user_warned",
        reasonCode: "rule_violation",
        internalNote: reason,
        adminId,
        targetLabel: "Konto",
      });
      break;
    }
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
      const { recordModerationAction } = await import("@/lib/moderation-dsa.server");
      await recordModerationAction({
        targetType: "profile",
        targetId: userId,
        targetUserId: userId,
        actionKind: "user_banned",
        reasonCode: "rule_violation",
        internalNote: reason,
        adminId,
        targetLabel: days > 0 ? `Konto (${days} Tage)` : "Konto (unbefristet)",
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
      await supabaseAdmin.auth.admin.deleteUser(userId);
      break;
    case "grant_creator":
      await setSimpleRole(userId, "creator", true);
      break;
    case "revoke_creator":
      await setSimpleRole(userId, "creator", false);
      break;
    case "grant_business":
      await setSimpleRole(userId, "business", true);
      break;
    case "revoke_business":
      await setSimpleRole(userId, "business", false);
      break;
    case "grant_admin":
      await changeAdminRole(adminId, userId, true, masterPassword, label);
      break;
    case "revoke_admin":
      await changeAdminRole(adminId, userId, false, masterPassword, label);
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
  if (type === "market_item") {
    const { data } = await supabaseAdmin
      .from("market_items")
      .select("title,seller_id")
      .eq("id", id)
      .maybeSingle();
    return { label: data?.title ?? "(gelöscht)", owner: data?.seller_id ?? null };
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
  options: { reasonCode?: ModerationReasonCode; informReporterOutcome?: "actioned" | "no_action" } = {},
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

  // DSA Art. 16 Abs. 5: Die meldende Person wird über das Ergebnis informiert.
  const outcome =
    options.informReporterOutcome ?? (status === "resolved" ? "actioned" : "no_action");
  const { informReporter } = await import("@/lib/moderation-dsa.server");
  await informReporter(id, options.reasonCode ?? "rule_violation", outcome);
}

export async function deleteReportedContent(
  adminId: string,
  id: string,
  reasonCode: ModerationReasonCode = "rule_violation",
) {
  const { data: report } = await supabaseAdmin
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!report) throw new Error("Meldung nicht gefunden");

  const { ownerOfTarget, recordModerationAction } = await import("@/lib/moderation-dsa.server");
  const targetType = report.target_type as Parameters<typeof ownerOfTarget>[0];
  // Urheber vor dem Löschen bestimmen, damit die Begründung zugestellt werden kann.
  const targetUserId = await ownerOfTarget(targetType, report.target_id);

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

  await recordModerationAction({
    targetType,
    targetId: report.target_id,
    targetUserId,
    actionKind: report.target_type === "slang_tag" ? "slang_tag_hidden" : "content_removed",
    reasonCode,
    reportId: id,
    adminId,
    targetLabel: TARGET_LABELS[report.target_type] ?? report.target_type,
  });

  await resolveReport(adminId, id, "resolved", "Inhalt entfernt", {
    reasonCode,
    informReporterOutcome: "actioned",
  });
  await logAdminAction(adminId, "delete_reported_content", {
    targetType: report.target_type,
    targetId: report.target_id,
  });
}

/** Gemeldeten Beitrag nur verbergen (Inhalt bleibt erhalten). */
export async function hideReportedContent(
  adminId: string,
  id: string,
  reasonCode: ModerationReasonCode = "rule_violation",
) {
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

  const { recordModerationAction } = await import("@/lib/moderation-dsa.server");
  await recordModerationAction({
    targetType: "post",
    targetId: report.target_id,
    targetUserId: null,
    actionKind: "content_hidden",
    reasonCode,
    reportId: id,
    adminId,
    targetLabel: TARGET_LABELS["post"] ?? "Beitrag",
  });

  await resolveReport(adminId, id, "resolved", "Beitrag verborgen", {
    reasonCode,
    informReporterOutcome: "actioned",
  });
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

  const rows = data ?? [];

  const ownerIds = [...new Set(rows.map((r) => r.owner_id))];
  const { data: owners } = ownerIds.length
    ? await supabaseAdmin.from("profiles").select("id,username").in("id", ownerIds)
    : { data: [] };
  const nameOf = new Map((owners ?? []).map((o) => [o.id, o.username]));

  // audio_url ist ein Pfad im privaten media-Bucket. Für die Wiedergabe im
  // Cockpit werden signierte, zeitlich begrenzte Links erzeugt.
  const audioPaths = [...new Set(rows.map((r) => r.audio_url).filter((p): p is string => !!p))];
  const signed = new Map<string, string>();
  if (audioPaths.length) {
    const { data: urls } = await supabaseAdmin.storage
      .from("media")
      .createSignedUrls(audioPaths, 60 * 60);
    (urls ?? []).forEach((u) => {
      if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
    });
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    ownerUsername: nameOf.get(r.owner_id) ?? "",
    region: r.region,
    language: r.language,
    meaning: r.meaning,
    audioUrl: r.audio_url ? (signed.get(r.audio_url) ?? null) : null,
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

/**
 * Administrative Korrektur gesperrter Identitätsdaten (Vorname, Nachname,
 * Geburtsdatum). Ausschliesslich über diesen kontrollierten Prozess möglich –
 * der normale Profil-Editor kann diese Felder nicht ändern. Jede Änderung
 * wird im Admin-Protokoll festgehalten.
 */
export async function correctIdentityData(
  adminId: string,
  userId: string,
  patch: { firstName?: string; lastName?: string; birthday?: string | null },
  reason: string,
) {
  const label = await usernameOf(userId);
  const update: {
    first_name?: string;
    last_name?: string;
    birthday?: string | null;
  } = {};
  if (patch.firstName !== undefined) update.first_name = patch.firstName.trim().slice(0, 60);
  if (patch.lastName !== undefined) update.last_name = patch.lastName.trim().slice(0, 60);
  if (patch.birthday !== undefined) {
    const v = (patch.birthday ?? "").trim();
    update.birthday = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }
  if (Object.keys(update).length === 0) return { ok: false as const };

  const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", userId);
  if (error) throw new Error(error.message);

  await logAdminAction(adminId, "identity_correction", {
    targetType: "profile",
    targetId: userId,
    targetUserId: userId,
    targetLabel: label,
    details: { fields: Object.keys(update), reason },
  });
  return { ok: true as const };
}

/* ============================ Sperrliste Usernames ======================== */

export const RESERVED_CATEGORIES = [
  "system",
  "staff",
  "admin",
  "support",
  "moderation",
  "official",
  "brand",
  "reserved",
  "impersonation",
  "inappropriate",
  "other",
] as const;

export type ReservedCategory = (typeof RESERVED_CATEGORIES)[number];

export type ReservedUsernameRow = {
  id: string;
  username: string;
  normalized: string;
  category: ReservedCategory;
  reason: string;
  active: boolean;
  createdAt: string;
};

export async function loadReservedUsernames(
  query: string,
  limit = 300,
): Promise<ReservedUsernameRow[]> {
  let q = supabaseAdmin
    .from("reserved_usernames")
    .select("id, username, normalized_username, category, reason, is_active, created_at")
    .order("category", { ascending: true })
    .order("normalized_username", { ascending: true })
    .limit(limit);
  const term = query.trim();
  if (term) q = q.ilike("normalized_username", `%${term.toLowerCase()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    username: r.username,
    normalized: r.normalized_username ?? r.username.toLowerCase(),
    category: r.category as ReservedCategory,
    reason: r.reason ?? "",
    active: r.is_active,
    createdAt: r.created_at,
  }));
}

export async function addReservedUsername(
  adminId: string,
  input: { username: string; category: ReservedCategory; reason: string },
) {
  const username = input.username.normalize("NFKC").trim().slice(0, 64);
  if (username.length < 2) return { ok: false as const, error: "Eintrag zu kurz" };
  const { error } = await supabaseAdmin.from("reserved_usernames").upsert(
    {
      username,
      normalized_username: username.toLowerCase(),
      category: input.category,
      reason: input.reason.trim().slice(0, 200),
      is_active: true,
    },
    { onConflict: "normalized_username" },
  );
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "reserved_username_add", {
    targetType: "reserved_username",
    targetLabel: username,
    details: { category: input.category, reason: input.reason },
  });
  return { ok: true as const };
}

export async function setReservedUsernameActive(adminId: string, id: string, active: boolean) {
  const { data, error } = await supabaseAdmin
    .from("reserved_usernames")
    .update({ is_active: active })
    .eq("id", id)
    .select("username")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, active ? "reserved_username_enable" : "reserved_username_disable", {
    targetType: "reserved_username",
    targetId: id,
    targetLabel: data?.username ?? "",
  });
  return { ok: true as const };
}

export async function deleteReservedUsername(adminId: string, id: string) {
  const { data, error } = await supabaseAdmin
    .from("reserved_usernames")
    .delete()
    .eq("id", id)
    .select("username")
    .maybeSingle();
  if (error) throw new Error(error.message);
  await logAdminAction(adminId, "reserved_username_delete", {
    targetType: "reserved_username",
    targetId: id,
    targetLabel: data?.username ?? "",
  });
  return { ok: true as const };
}

/** Bestandskonten, deren Username inzwischen auf der Sperrliste steht. */
export async function loadReservedUsernameConflicts(): Promise<
  { userId: string; username: string; category: ReservedCategory }[]
> {
  const { data, error } = await supabaseAdmin
    .from("reserved_usernames")
    .select("normalized_username, category")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((r) => [r.normalized_username, r.category]));
  const { data: profiles, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, username")
    .limit(5000);
  if (pErr) throw new Error(pErr.message);
  const out: { userId: string; username: string; category: ReservedCategory }[] = [];
  for (const p of profiles ?? []) {
    const cat = map.get(p.username.toLowerCase());
    if (cat) out.push({ userId: p.id, username: p.username, category: cat as ReservedCategory });
  }
  return out;
}
