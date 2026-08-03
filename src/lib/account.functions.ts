import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Registrierung: Verfügbarkeitsprüfung und Profilanlage nach dem Login. */

export const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;

const usernameSchema = z.string().trim().regex(USERNAME_RE);

export const isUsernameAvailable = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ username: usernameSchema }).parse(data))
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    return { available: !row };
  });

/**
 * Legt nach erfolgreichem Login/Signup das Profil an, falls es noch fehlt.
 * Der Benutzername stammt aus den Signup-Metadaten oder dem übergebenen Wert.
 */
export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ username: usernameSchema.optional() }).parse(data ?? {}))
  .handler(async ({ data, context }): Promise<{ username: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    if (existing) return { username: existing.username };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const meta = (userRes?.user?.user_metadata ?? {}) as { username?: string };
    const raw = data.username ?? meta.username ?? "";
    let base = USERNAME_RE.test(raw.trim()) ? raw.trim() : `dude_${context.userId.slice(0, 8)}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? base : `${base}${attempt}`;
      const { error } = await supabaseAdmin.from("profiles").insert({
        id: context.userId,
        username: candidate,
        display_name: candidate,
      });
      if (!error) return { username: candidate };
      if (error.code !== "23505") throw new Error(error.message);
    }
    base = `dude_${context.userId.slice(0, 12)}`;
    const { error } = await supabaseAdmin
      .from("profiles")
      .insert({ id: context.userId, username: base, display_name: base });
    if (error) throw new Error(error.message);
    return { username: base };
  });
