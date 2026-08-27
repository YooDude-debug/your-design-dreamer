import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AdminActiveUserRow,
  AdminAdPauseRow,
  AdminAuditRow,
  AdminCampaignRow,
  AdminCommentRow,
  AdminOverview,
  AdminPostRow,
  AdminReportRow,
  AdminSlangTagRow,
  AdminStats,
  AdminUserRow,
  ReportStatus,
  ReportTargetType,
} from "@/lib/admin.shared";

export const adminCheckAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; isOwner: boolean }> => {
    const { isAdmin, isOwnerAdmin } = await import("@/lib/admin.server");
    const admin = await isAdmin(context);
    return { isAdmin: admin, isOwner: admin ? await isOwnerAdmin(context.userId) : false };
  });

export const adminGetOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminOverview> => {
    const { assertAdmin, loadOverview } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadOverview();
  });

/* ------------------------------------------------------------------ users */

export const adminGetUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; sort?: string }) => ({
    query: input?.query ?? "",
    sort: (["recent_activity", "oldest_activity", "newest_signup", "oldest_signup"].includes(
      input?.sort ?? "",
    )
      ? input?.sort
      : "recent_activity") as
      | "recent_activity"
      | "oldest_activity"
      | "newest_signup"
      | "oldest_signup",
  }))
  .handler(async ({ context, data }): Promise<AdminUserRow[]> => {
    const { assertAdmin, loadUsers } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadUsers(data.query, data.sort);
  });

export const adminUserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      action: string;
      reason?: string;
      days?: number;
      masterPassword?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, runUserAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await runUserAction(
      adminId,
      data.userId,
      data.action as Parameters<typeof runUserAction>[2],
      data.reason ?? "",
      data.days ?? 0,
      data.masterPassword ?? "",
    );
    return { ok: true };
  });

/* ---------------------------------------------------------------- reports */

export const adminGetReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { targetType?: string; status?: string }) => ({
    targetType: (input?.targetType ?? "all") as ReportTargetType | "all",
    status: (input?.status ?? "all") as ReportStatus | "all",
  }))
  .handler(async ({ context, data }): Promise<AdminReportRow[]> => {
    const { assertAdmin, loadReports } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadReports(data.targetType, data.status);
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; status: string; note?: string; reasonCode?: string }) => input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, resolveReport } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await resolveReport(adminId, data.id, data.status as ReportStatus, data.note ?? "", {
      reasonCode: (data.reasonCode ?? "rule_violation") as never,
    });
    return { ok: true };
  });

export const adminDeleteReportedContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reasonCode?: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, deleteReportedContent } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await deleteReportedContent(adminId, data.id, (data.reasonCode ?? "rule_violation") as never);
    return { ok: true };
  });

export const adminHideReportedContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reasonCode?: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, hideReportedContent } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await hideReportedContent(adminId, data.id, (data.reasonCode ?? "rule_violation") as never);
    return { ok: true };
  });

/* ------------------------------------------------------------- slang tags */

export const adminGetSlangTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string; includeDeleted?: boolean }) => ({
    query: input?.query ?? "",
    includeDeleted: input?.includeDeleted ?? false,
  }))
  .handler(async ({ context, data }): Promise<AdminSlangTagRow[]> => {
    const { assertAdmin, loadSlangTags } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadSlangTags(data.query, data.includeDeleted);
  });

export const adminUpdateSlangTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; name?: string; meaning?: string; region?: string; language?: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, updateSlangTag } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { id, ...patch } = data;
    await updateSlangTag(adminId, id, patch);
    return { ok: true };
  });

export const adminSetSlangTagDeleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; deleted: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, setSlangTagDeleted } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await setSlangTagDeleted(adminId, data.id, data.deleted);
    return { ok: true };
  });

export const adminPurgeSlangTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, purgeSlangTag } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await purgeSlangTag(adminId, data.id);
    return { ok: true };
  });

/* ------------------------------------------------------- posts & comments */

export const adminGetPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => ({ query: input?.query ?? "" }))
  .handler(async ({ context, data }): Promise<AdminPostRow[]> => {
    const { assertAdmin, loadPosts } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadPosts(data.query);
  });

export const adminDeletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, deletePost } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await deletePost(adminId, data.id);
    return { ok: true };
  });

export const adminGetComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => ({ query: input?.query ?? "" }))
  .handler(async ({ context, data }): Promise<AdminCommentRow[]> => {
    const { assertAdmin, loadComments } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadComments(data.query);
  });

export const adminDeleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, deleteComment } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await deleteComment(adminId, data.id);
    return { ok: true };
  });

/* ---------------------------------------------------------------- ad core */

export const adminGetCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCampaignRow[]> => {
    const { assertAdmin, loadCampaigns } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadCampaigns();
  });

export const adminSaveCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      name: string;
      kind: AdminCampaignRow["kind"];
      status: AdminCampaignRow["status"];
      region?: string;
      budgetCents?: number;
      revenueCents?: number;
      impressions?: number;
      clicks?: number;
      slangTagId?: string | null;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, saveCampaign } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const id = await saveCampaign(adminId, {
      id: data.id,
      name: data.name.trim().slice(0, 120) || "Kampagne",
      kind: data.kind,
      status: data.status,
      region: data.region ?? "",
      budgetCents: Math.max(0, Math.round(data.budgetCents ?? 0)),
      revenueCents: Math.max(0, Math.round(data.revenueCents ?? 0)),
      impressions: Math.max(0, Math.round(data.impressions ?? 0)),
      clicks: Math.max(0, Math.round(data.clicks ?? 0)),
      slangTagId: data.slangTagId ?? null,
    });
    return { id };
  });

export const adminDeleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, deleteCampaign } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    await deleteCampaign(adminId, data.id);
    return { ok: true };
  });

export const adminGetAdPauses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAdPauseRow[]> => {
    const { assertAdmin, loadAdPauses } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadAdPauses();
  });

/* ---------------------------------------------------------- active users */

export const adminGetActiveUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminActiveUserRow[]> => {
    const { assertAdmin, loadActiveUsers } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadActiveUsers();
  });

/* ------------------------------------------------------------- statistics */

export const adminGetStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { assertAdmin, loadStats } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadStats();
  });

/* -------------------------------------------------------------- audit log */

export const adminGetAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number }) => ({
    limit: Math.min(500, Math.max(10, input?.limit ?? 200)),
  }))
  .handler(async ({ context, data }): Promise<AdminAuditRow[]> => {
    const { assertAdmin, loadAudit } = await import("@/lib/admin.server");
    await assertAdmin(context);
    return loadAudit(data.limit);
  });

/**
 * Kontrollierte Korrektur gesperrter Identitätsdaten durch Administratoren.
 * Nur über diesen Weg möglich; jede Änderung wird protokolliert.
 */
export const adminCorrectIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      firstName?: string;
      lastName?: string;
      birthday?: string | null;
      reason: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin, correctIdentityData } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    return correctIdentityData(
      adminId,
      data.userId,
      {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.birthday !== undefined ? { birthday: data.birthday } : {}),
      },
      data.reason ?? "",
    );
  });

/* =================== Sperrliste für Usernames (nur Admin) ================= */

export const adminGetReservedUsernames = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query?: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, loadReservedUsernames, loadReservedUsernameConflicts } =
      await import("@/lib/admin.server");
    await assertAdmin(context);
    const [rows, conflicts] = await Promise.all([
      loadReservedUsernames(data.query ?? ""),
      loadReservedUsernameConflicts(),
    ]);
    return { rows, conflicts };
  });

export const adminAddReservedUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { username: string; category: string; reason?: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, addReservedUsername, RESERVED_CATEGORIES } =
      await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const category = (RESERVED_CATEGORIES as readonly string[]).includes(data.category)
      ? (data.category as (typeof RESERVED_CATEGORIES)[number])
      : "other";
    return addReservedUsername(adminId, {
      username: data.username,
      category,
      reason: data.reason ?? "",
    });
  });

export const adminSetReservedUsernameActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, setReservedUsernameActive } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    return setReservedUsernameActive(adminId, data.id, data.active);
  });

export const adminDeleteReservedUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, deleteReservedUsername } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    return deleteReservedUsername(adminId, data.id);
  });

/** Status der Open-Beta-Startbenachrichtigung (nur Zahlen, keine Adressen). */
export const adminGetBetaLaunchStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { getBetaLaunchStatus } = await import("@/lib/beta-launch.server");
    return getBetaLaunchStatus();
  });

/** Offene Beta aktivieren/deaktivieren; plant den Versand auf 10:00 Europe/Berlin. */
export const adminSetOpenBeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { activateOpenBeta, deactivateOpenBeta } = await import("@/lib/beta-launch.server");
    const status = data.enabled ? await activateOpenBeta(adminId) : await deactivateOpenBeta();
    await logAdminAction(adminId, data.enabled ? "open_beta_enabled" : "open_beta_disabled", {
      targetType: "beta_launch",
      details: { scheduledSendAt: status.scheduledSendAt, recipients: status.recipients },
    });
    return status;
  });

/** Testmail an eine einzelne Adresse — aendert keinen Versandstatus. */
export const adminSendBetaLaunchTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; language?: string }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { sendBetaLaunchTestEmail } = await import("@/lib/beta-launch.server");
    const lang = data.language === "en" || data.language === "el" ? data.language : "de";
    const result = await sendBetaLaunchTestEmail(data.email, lang);
    await logAdminAction(adminId, "open_beta_test_mail", {
      targetType: "beta_launch",
      details: { sent: result.sent, language: lang },
    });
    return result;
  });

/** Versand sofort ausloesen (uebergeht nur die Zeitpruefung, nie die Einmaligkeit). */
export const adminRunBetaLaunchDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { force?: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { assertAdmin, logAdminAction } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { runBetaLaunchDispatch } = await import("@/lib/beta-launch.server");
    const report = await runBetaLaunchDispatch({ force: data.force === true });
    await logAdminAction(adminId, "open_beta_dispatch", {
      targetType: "beta_launch",
      details: { ...report },
    });
    return report;
  });
