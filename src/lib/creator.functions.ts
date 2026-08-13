import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Creator-/Unternehmer-Bereich – serverseitige Berechtigungsprüfung.
 *
 * Grundlage ist ausschliesslich der bestehende Creator-/Unternehmer-Status aus
 * `public.user_roles` (Rollen `creator` bzw. `business`), geprüft über die
 * vorhandene Funktion `has_role`. Die Adminrolle, der Benutzername, die
 * Benutzer-ID und die E-Mail-Adresse spielen hier bewusst keine Rolle.
 */
export type CreatorAccess = {
  isCreator: boolean;
  isBusiness: boolean;
  /** Zusammengefasstes Badge „Creator / Unternehmer“. */
  allowed: boolean;
};

/** Prüft den Creator-/Unternehmer-Status des angemeldeten Kontos. */
export const getCreatorAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorAccess> => {
    const { supabase, userId } = context;
    const [creator, business] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "creator" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "business" }),
    ]);
    const isCreator = creator.data === true;
    const isBusiness = business.data === true;
    return { isCreator, isBusiness, allowed: isCreator || isBusiness };
  });

export type CreatorStats = {
  posts: number;
  comments: number;
  likesReceived: number;
  followers: number;
  following: number;
  slangTags: number;
  slangTagUses: number;
  slangTagRank: number;
  memberSince: string | null;
};

/**
 * Kennzahlen für das Creator-Dashboard. Nutzt die bestehende Serverfunktion
 * `profile_stats`; ohne Creator-/Unternehmer-Status wird abgelehnt.
 */
export const getCreatorStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreatorStats> => {
    const { supabase, userId } = context;
    const [creator, business] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "creator" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "business" }),
    ]);
    if (creator.data !== true && business.data !== true) {
      throw new Error("Forbidden");
    }

    const { data, error } = await supabase.rpc("profile_stats", { _ids: [userId] });
    if (error) throw new Error(error.message);
    const stats = (data?.[0]?.stats ?? {}) as Record<string, unknown>;
    const num = (key: string) => (typeof stats[key] === "number" ? (stats[key] as number) : 0);
    return {
      posts: num("posts"),
      comments: num("comments"),
      likesReceived: num("likesReceived"),
      followers: num("followers"),
      following: num("following"),
      slangTags: num("slangTags"),
      slangTagUses: num("slangTagUses"),
      slangTagRank: num("slangTagRank"),
      memberSince: typeof stats["memberSince"] === "string" ? (stats["memberSince"] as string) : null,
    };
  });
