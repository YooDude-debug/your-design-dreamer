import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  clampFeedbackText,
  FEEDBACK_MIN_CHARS,
  statusLabel,
  type FeedbackCategory,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/feedback.shared";

type DbRow = {
  id: string;
  user_id: string;
  username: string;
  user_roles: string[] | null;
  category: FeedbackCategory;
  message: string;
  area: string;
  device: string;
  browser: string;
  os: string;
  status: FeedbackStatus;
  admin_note: string;
  created_at: string;
  handled_at: string | null;
};

const SELECT =
  "id,user_id,username,user_roles,category,message,area,device,browser,os,status,admin_note,created_at,handled_at";

function toRow(r: DbRow): FeedbackRow {
  return {
    id: r.id,
    userId: r.user_id,
    username: r.username,
    roles: r.user_roles ?? [],
    category: r.category,
    message: r.message,
    area: r.area,
    device: r.device,
    browser: r.browser,
    os: r.os,
    status: r.status,
    adminNote: r.admin_note ?? "",
    createdAt: r.created_at,
    handledAt: r.handled_at,
  };
}

/** Legt ein Feedback im Namen des angemeldeten Nutzers an (RLS-geschuetzt). */
export async function submitFeedback(
  ctx: { supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>; userId: string },
  input: { category: FeedbackCategory; message: string; area: string; device: string; browser: string; os: string },
): Promise<{ ok: true }> {
  const message = clampFeedbackText(input.message).trim();
  if (message.length < FEEDBACK_MIN_CHARS) throw new Error("Bitte beschreibe dein Feedback etwas genauer.");

  // Rolle und Username serverseitig ermitteln – niemals aus dem Client uebernehmen.
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("username").eq("id", ctx.userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", ctx.userId),
  ]);

  const { error } = await ctx.supabase.from("feedback").insert({
    user_id: ctx.userId,
    username: profile?.username ?? "",
    user_roles: (roles ?? []).map((r) => r.role as string),
    category: input.category,
    message,
    area: input.area.slice(0, 200),
    device: input.device.slice(0, 120),
    browser: input.browser.slice(0, 120),
    os: input.os.slice(0, 120),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Eigene Feedbacks des Nutzers (Verlauf mit Status). */
export async function listOwnFeedback(ctx: {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
}): Promise<FeedbackRow[]> {
  const { data, error } = await ctx.supabase
    .from("feedback")
    .select(SELECT)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data as DbRow[] | null)?.map(toRow) ?? [];
}

/** Admin: Liste aller Feedbacks, optional nach Status/Kategorie gefiltert. */
export async function adminListFeedback(filter: {
  status?: FeedbackStatus | "all";
  category?: FeedbackCategory | "all";
}): Promise<{ rows: FeedbackRow[]; counts: Record<string, number> }> {
  let query = supabaseAdmin.from("feedback").select(SELECT).order("created_at", { ascending: false }).limit(300);
  if (filter.status && filter.status !== "all") query = query.eq("status", filter.status);
  if (filter.category && filter.category !== "all") query = query.eq("category", filter.category);
  const [{ data, error }, all] = await Promise.all([
    query,
    supabaseAdmin.from("feedback").select("status"),
  ]);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = { all: all.data?.length ?? 0 };
  for (const r of all.data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return { rows: (data as DbRow[] | null)?.map(toRow) ?? [], counts };
}

/** Admin: Status/Notiz aendern und den Nutzer bei Abschluss informieren. */
export async function adminUpdateFeedback(
  adminId: string,
  input: { id: string; status: FeedbackStatus; adminNote: string; notify: boolean },
): Promise<FeedbackRow> {
  const { data: before } = await supabaseAdmin
    .from("feedback")
    .select("user_id,status,category")
    .eq("id", input.id)
    .maybeSingle();
  if (!before) throw new Error("Feedback nicht gefunden.");

  const { data, error } = await supabaseAdmin
    .from("feedback")
    .update({
      status: input.status,
      admin_note: input.adminNote.slice(0, 4000),
      handled_by: adminId,
      handled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);

  const finished = input.status === "done" || input.status === "rejected";
  if (input.notify && finished && before.status !== input.status) {
    const body =
      input.status === "done"
        ? `Dein Feedback wurde umgesetzt.${input.adminNote ? ` ${input.adminNote}` : ""}`
        : `Dein Feedback wurde geprüft.${input.adminNote ? ` ${input.adminNote}` : ""}`;
    await supabaseAdmin.rpc("push_notify", {
      p_user: before.user_id,
      p_actor: adminId,
      p_type: "system",
      p_title: `Feedback: ${statusLabel(input.status)}`,
      p_body: body.slice(0, 400),
      p_entity_type: "feedback",
      p_entity_id: input.id,
      p_link: "/dev",
    });
  }

  const { logAdminAction } = await import("@/lib/admin.server");
  await logAdminAction(adminId, "feedback_status", {
    targetType: "feedback",
    targetId: input.id,
    targetUserId: before.user_id,
    targetLabel: statusLabel(input.status),
    details: { status: input.status, note: input.adminNote },
  });

  return toRow(data as DbRow);
}
