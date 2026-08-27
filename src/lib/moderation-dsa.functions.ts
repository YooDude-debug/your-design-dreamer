import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-Funktionen für Moderationstransparenz und Einsprüche (DSA Art. 17/20).
 * Nutzer sehen ausschließlich Maßnahmen, die sie selbst betreffen.
 */

export type MyModerationAction = {
  id: string;
  targetType: string;
  targetLabel: string;
  actionKind: string;
  reasonCode: string;
  publicReason: string;
  automated: boolean;
  createdAt: string;
  appealDeadline: string | null;
  appeal: {
    id: string;
    status: string;
    message: string;
    decisionNote: string;
    createdAt: string;
    decidedAt: string | null;
  } | null;
};

export type AdminAppealRow = {
  id: string;
  status: string;
  message: string;
  decisionNote: string;
  createdAt: string;
  decidedAt: string | null;
  action: {
    id: string;
    targetType: string;
    targetLabel: string;
    actionKind: string;
    reasonCode: string;
    publicReason: string;
    automated: boolean;
    createdAt: string;
  } | null;
  username: string;
};

export const getMyModerationActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyModerationAction[]> => {
    const sb = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => {
            order: (
              c: string,
              o: { ascending: boolean },
            ) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }> };
          };
          in: (c: string, v: string[]) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
      };
    };

    const { data: actions } = await sb
      .from("moderation_actions")
      .select(
        "id,target_type,target_label,action_kind,reason_code,public_reason,automated,created_at,appeal_deadline",
      )
      .eq("target_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = actions ?? [];
    const ids = rows.map((r) => String(r["id"]));
    const { data: appeals } = ids.length
      ? await sb
          .from("moderation_appeals")
          .select("id,action_id,status,message,decision_note,created_at,decided_at")
          .in("action_id", ids)
      : { data: [] as Record<string, unknown>[] };

    const byAction = new Map<string, Record<string, unknown>>();
    for (const a of appeals ?? []) byAction.set(String(a["action_id"]), a);

    return rows.map((r) => {
      const a = byAction.get(String(r["id"]));
      return {
        id: String(r["id"]),
        targetType: String(r["target_type"] ?? ""),
        targetLabel: String(r["target_label"] ?? ""),
        actionKind: String(r["action_kind"] ?? ""),
        reasonCode: String(r["reason_code"] ?? ""),
        publicReason: String(r["public_reason"] ?? ""),
        automated: r["automated"] === true,
        createdAt: String(r["created_at"] ?? ""),
        appealDeadline: r["appeal_deadline"] ? String(r["appeal_deadline"]) : null,
        appeal: a
          ? {
              id: String(a["id"]),
              status: String(a["status"] ?? ""),
              message: String(a["message"] ?? ""),
              decisionNote: String(a["decision_note"] ?? ""),
              createdAt: String(a["created_at"] ?? ""),
              decidedAt: a["decided_at"] ? String(a["decided_at"]) : null,
            }
          : null,
      };
    });
  });

export const submitModerationAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { actionId: string; message: string }) => input)
  .handler(async ({ context, data }) => {
    const message = data.message.trim().slice(0, 2000);
    if (message.length < 10)
      throw new Error("Bitte begründe deinen Einspruch (mindestens 10 Zeichen).");

    const sb = context.supabase as unknown as {
      from: (t: string) => {
        insert: (v: unknown) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await sb.from("moderation_appeals").insert({
      action_id: data.actionId,
      user_id: context.userId,
      message,
    });
    if (error) throw new Error("Einspruch konnte nicht gespeichert werden.");
    return { ok: true };
  });

export const adminListAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { openOnly: boolean }) => input)
  .handler(async ({ context, data }): Promise<AdminAppealRow[]> => {
    const { assertAdmin } = await import("@/lib/admin.server");
    await assertAdmin(context);
    const { listAppealsForAdmin } = await import("@/lib/moderation-appeals.server");
    return listAppealsForAdmin(data.openOnly);
  });

export const adminDecideAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      appealId: string;
      decision: "in_review" | "upheld" | "overturned" | "rejected";
      note: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("@/lib/admin.server");
    const adminId = await assertAdmin(context);
    const { decideAppeal } = await import("@/lib/moderation-dsa.server");
    await decideAppeal(adminId, data.appealId, data.decision, data.note ?? "");
    return { ok: true };
  });
