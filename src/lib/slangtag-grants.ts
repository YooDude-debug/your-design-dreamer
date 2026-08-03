/**
 * SlangTag-Eigentum, Freigaben und Weitergabe-Anfragen.
 *
 * Jeder SlangTag bleibt dauerhaft im Besitz seines Erstellers. Freigaben
 * (`slang_tag_grants`) erlauben ausgewaehlten Verbindungen die Nutzung,
 * Weitergaben laufen ausschliesslich ueber eine Genehmigung des Eigentuemers
 * (`slang_tag_share_requests`). Alle Rechte sind zusaetzlich per RLS gesichert.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Row = Record<string, unknown>;

export type SlangTagGrant = {
  id: string;
  tagId: string;
  ownerId: string;
  granteeId: string;
  grantedBy: string;
  createdAt: number;
};

export type ShareRequestStatus = "pending" | "approved" | "declined";

export type SlangTagShareRequest = {
  id: string;
  tagId: string;
  ownerId: string;
  requesterId: string;
  targetId: string;
  status: ShareRequestStatus;
  createdAt: number;
};

const mapGrant = (r: Row): SlangTagGrant => ({
  id: r.id as string,
  tagId: r.tag_id as string,
  ownerId: r.owner_id as string,
  granteeId: r.grantee_id as string,
  grantedBy: r.granted_by as string,
  createdAt: new Date(r.created_at as string).getTime(),
});

const mapRequest = (r: Row): SlangTagShareRequest => ({
  id: r.id as string,
  tagId: r.tag_id as string,
  ownerId: r.owner_id as string,
  requesterId: r.requester_id as string,
  targetId: r.target_id as string,
  status: r.status as ShareRequestStatus,
  createdAt: new Date(r.created_at as string).getTime(),
});

/** Freigaben und Anfragen des angemeldeten Nutzers – lesend und schreibend. */
export function useSlangTagSharing(userId: string | null) {
  const [grants, setGrants] = useState<SlangTagGrant[]>([]);
  const [requests, setRequests] = useState<SlangTagShareRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setGrants([]);
      setRequests([]);
      return;
    }
    setLoading(true);
    const [grantRes, reqRes] = await Promise.all([
      supabase
        .from("slang_tag_grants")
        .select("*")
        .or(`owner_id.eq.${userId},grantee_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("slang_tag_share_requests")
        .select("*")
        .or(`owner_id.eq.${userId},requester_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ]);
    if (grantRes.error) console.error("[grants] load failed", grantRes.error.message);
    if (reqRes.error) console.error("[grants] requests load failed", reqRes.error.message);
    setGrants(((grantRes.data ?? []) as Row[]).map(mapGrant));
    setRequests(((reqRes.data ?? []) as Row[]).map(mapRequest));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Freigaben, die ich als Eigentuemer erteilt habe. */
  const givenGrants = useMemo(() => grants.filter((g) => g.ownerId === userId), [grants, userId]);
  /** Freigaben, die ich erhalten habe. */
  const receivedGrants = useMemo(
    () => grants.filter((g) => g.granteeId === userId),
    [grants, userId],
  );
  const receivedTagIds = useMemo(() => receivedGrants.map((g) => g.tagId), [receivedGrants]);

  /** Offene Anfragen an mich als Eigentuemer. */
  const incomingRequests = useMemo(
    () => requests.filter((r) => r.ownerId === userId && r.status === "pending"),
    [requests, userId],
  );
  /** Von mir gestellte Weitergabe-Anfragen. */
  const outgoingRequests = useMemo(
    () => requests.filter((r) => r.requesterId === userId),
    [requests, userId],
  );

  /** Eigentuemer teilt einen eigenen SlangTag direkt mit einer Verbindung. */
  const shareWith = useCallback(
    async (tagId: string, ownerId: string, granteeId: string) => {
      if (!userId || ownerId !== userId) return false;
      const { error } = await supabase.from("slang_tag_grants").insert({
        tag_id: tagId,
        owner_id: ownerId,
        grantee_id: granteeId,
        granted_by: userId,
      } as never);
      if (error && error.code !== "23505") {
        console.error("[grants] share failed", error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [userId, refresh],
  );

  /** Freigabe entziehen (Eigentuemer) bzw. entfernen (Empfaenger). */
  const revokeGrant = useCallback(
    async (grantId: string) => {
      const { error } = await supabase.from("slang_tag_grants").delete().eq("id", grantId);
      if (error) {
        console.error("[grants] revoke failed", error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  /** Weitergabe eines erhaltenen SlangTags – erzeugt nur eine Anfrage. */
  const requestForward = useCallback(
    async (tagId: string, ownerId: string, targetId: string) => {
      if (!userId) return false;
      const { error } = await supabase.from("slang_tag_share_requests").insert({
        tag_id: tagId,
        owner_id: ownerId,
        requester_id: userId,
        target_id: targetId,
        status: "pending",
      } as never);
      if (error) {
        console.error("[grants] request failed", error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [userId, refresh],
  );

  /** Eigentuemer genehmigt oder lehnt eine Weitergabe ab. */
  const decideRequest = useCallback(
    async (requestId: string, approve: boolean) => {
      const { error } = await supabase
        .from("slang_tag_share_requests")
        .update({ status: approve ? "approved" : "declined" } as never)
        .eq("id", requestId);
      if (error) {
        console.error("[grants] decide failed", error.message);
        return false;
      }
      await refresh();
      return true;
    },
    [refresh],
  );

  return {
    loading,
    grants,
    givenGrants,
    receivedGrants,
    receivedTagIds,
    requests,
    incomingRequests,
    outgoingRequests,
    refresh,
    shareWith,
    revokeGrant,
    requestForward,
    decideRequest,
  };
}
