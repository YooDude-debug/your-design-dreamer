import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AdminAppealRow } from "@/lib/moderation-dsa.functions";

/**
 * Admin-Sicht auf Einsprüche gegen Moderationsentscheidungen (DSA Art. 20).
 */
export async function listAppealsForAdmin(openOnly: boolean): Promise<AdminAppealRow[]> {
  const db = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        in: (
          c: string,
          v: string[],
        ) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }>;
          };
        };
        order: (
          c: string,
          o: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null }>;
        };
      };
    };
  };

  const base = db
    .from("moderation_appeals")
    .select("id,action_id,user_id,status,message,decision_note,created_at,decided_at");
  const query = openOnly
    ? base.in("status", ["submitted", "in_review"]).order("created_at", { ascending: true })
    : base.order("created_at", { ascending: false });
  const { data: appeals } = await query.limit(200);
  const rows = appeals ?? [];
  if (rows.length === 0) return [];

  const actionIds = [...new Set(rows.map((r) => String(r["action_id"])))];
  const userIds = [...new Set(rows.map((r) => String(r["user_id"])))];

  const { data: actions } = await supabaseAdmin
    .from("moderation_actions")
    .select(
      "id,target_type,target_label,action_kind,reason_code,public_reason,automated,created_at",
    )
    .in("id", actionIds);
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id,username")
    .in("id", userIds);

  const actionById = new Map(
    (actions ?? []).map((a) => [
      String((a as Record<string, unknown>)["id"]),
      a as Record<string, unknown>,
    ]),
  );
  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.username as string) ?? ""]),
  );

  return rows.map((r) => {
    const a = actionById.get(String(r["action_id"]));
    return {
      id: String(r["id"]),
      status: String(r["status"] ?? ""),
      message: String(r["message"] ?? ""),
      decisionNote: String(r["decision_note"] ?? ""),
      createdAt: String(r["created_at"] ?? ""),
      decidedAt: r["decided_at"] ? String(r["decided_at"]) : null,
      username: nameById.get(String(r["user_id"])) || "unbekannt",
      action: a
        ? {
            id: String(a["id"]),
            targetType: String(a["target_type"] ?? ""),
            targetLabel: String(a["target_label"] ?? ""),
            actionKind: String(a["action_kind"] ?? ""),
            reasonCode: String(a["reason_code"] ?? ""),
            publicReason: String(a["public_reason"] ?? ""),
            automated: a["automated"] === true,
            createdAt: String(a["created_at"] ?? ""),
          }
        : null,
    };
  });
}
