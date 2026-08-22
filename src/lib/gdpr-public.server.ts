import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createPublicServerClient } from "@/lib/auth-public.server";

/**
 * Serverseitige Identitätsprüfung für die öffentlichen DSGVO-Seiten
 * (/delete-account und /request-data).
 *
 * Grundsatz: Es werden keine Kontoinformationen nach außen gegeben. Die
 * Prüfung erfolgt ausschließlich über E-Mail/Benutzername **und** das
 * bestehende Passwort des Kontos. Fehlerfälle liefern immer dieselbe
 * generische Antwort, damit keine Konten erraten werden können.
 */

/** Löst einen Benutzernamen serverseitig in die zugehörige E-Mail auf. */
async function emailForUsername(username: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (!data?.id) return null;
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(data.id as string);
  return userRes?.user?.email ?? null;
}

/**
 * Prüft Identifikator (E-Mail oder Benutzername) plus Passwort.
 * Gibt bei Erfolg die User-ID zurück, sonst null.
 */
export async function verifyPublicIdentity(
  identifier: string,
  password: string,
): Promise<{ userId: string; email: string } | null> {
  const id = identifier.trim();
  if (!id || !password) return null;

  const email = id.includes("@") ? id : await emailForUsername(id);
  if (!email) return null;

  const client = createPublicServerClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (data?.session) await client.auth.signOut();
  if (error || !data?.user) return null;
  return { userId: data.user.id, email };
}
