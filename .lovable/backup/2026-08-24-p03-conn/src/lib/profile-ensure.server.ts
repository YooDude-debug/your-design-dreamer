/**
 * Serverseitige Absicherung: kein Konto darf ohne Profilzeile arbeiten.
 *
 * Hintergrund: `posts.user_id`, `connections` und viele Ansichten verweisen auf
 * `profiles.id`. Fehlt die Profilzeile (z. B. weil die Anlage direkt nach der
 * Registrierung wegen Netzwerkabbruch nicht durchlief), schlagen Beiträge mit
 * einem Fremdschlüsselfehler fehl und Namen fehlen in Connections.
 */
import { USERNAME_RE } from "@/lib/username";

/** Legt die Profilzeile an, falls sie fehlt. Gibt den Benutzernamen zurück. */
export async function ensureProfileRow(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  if (existing) return existing.username;

  console.warn("[profiles] missing_profile_repaired");

  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
  const meta = (userRes?.user?.user_metadata ?? {}) as {
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  const email = userRes?.user?.email ?? "";
  const fromEmail = (email.split("@")[0] ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase()
    .slice(0, 24);
  const wish = (meta.username ?? "").trim();

  const { usernameStatus } = await import("@/lib/username.server");
  let base =
    USERNAME_RE.test(wish) && (await usernameStatus(wish)) !== "reserved"
      ? wish
      : USERNAME_RE.test(fromEmail)
        ? fromEmail
        : `dude_${userId.slice(0, 8)}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}${attempt}`;
    const { error } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      username: candidate,
      display_name: candidate,
      ...(meta.first_name ? { first_name: meta.first_name.trim().slice(0, 60) } : {}),
      ...(meta.last_name ? { last_name: meta.last_name.trim().slice(0, 60) } : {}),
    });
    if (!error) return candidate;
    if (error.code !== "23505") {
      console.error("[profiles] ensure_profile_failed", error.code ?? "", error.message);
      return null;
    }
  }
  base = `dude_${userId.slice(0, 12)}`;
  const { error } = await supabaseAdmin
    .from("profiles")
    .insert({ id: userId, username: base, display_name: base });
  if (error) {
    console.error("[profiles] ensure_profile_failed", error.code ?? "", error.message);
    return null;
  }
  return base;
}
