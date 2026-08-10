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
  .inputValidator((data) =>
    z
      .object({
        username: usernameSchema.optional(),
        firstName: z.string().trim().max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        displayNameMode: z.enum(["username", "real_name", "both"]).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ username: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", context.userId)
      .maybeSingle();
    if (existing) return { username: existing.username };

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const meta = (userRes?.user?.user_metadata ?? {}) as {
      username?: string;
      birthdate?: string;
      first_name?: string;
      last_name?: string;
      display_name_mode?: string;
    };
    // Identitaetsdaten aus der Registrierung; die oeffentliche Anzeige leitet
    // die Datenbank aus dem gewaehlten Modus ab (Standard: nur Username).
    const firstName = (data.firstName ?? meta.first_name ?? "").trim().slice(0, 60);
    const lastName = (data.lastName ?? meta.last_name ?? "").trim().slice(0, 60);
    const modeRaw = data.displayNameMode ?? meta.display_name_mode ?? "username";
    const displayNameMode = ["username", "real_name", "both"].includes(modeRaw)
      ? modeRaw
      : "username";
    // Geburtsdatum aus der Registrierung (Jugendschutz-Selbstauskunft) uebernehmen.
    const birthday = meta.birthdate && /^\d{4}-\d{2}-\d{2}$/.test(meta.birthdate)
      ? meta.birthdate
      : null;
    const raw = data.username ?? meta.username ?? "";
    let base = USERNAME_RE.test(raw.trim()) ? raw.trim() : `dude_${context.userId.slice(0, 8)}`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? base : `${base}${attempt}`;
      const { error } = await supabaseAdmin.from("profiles").insert({
        id: context.userId,
        username: candidate,
        display_name: candidate,
        first_name: firstName,
        last_name: lastName,
        display_name_mode: displayNameMode as "username" | "real_name" | "both",
        ...(birthday ? { birthday } : {}),
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

/**
 * DSGVO-Datenexport (Art. 15/20). Erfordert die erneute Eingabe des
 * Passworts, ist ratenbegrenzt und liefert einen zeitlich befristeten
 * Downloadlink auf ein ZIP-Archiv.
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ password: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data, context }) => {
    const account = await import("@/lib/account.server");

    const allowed = await account.checkRateLimit(context.userId, "export_attempt", 5, 60);
    if (!allowed) throw new Error("RATE_LIMIT");

    await account.logAccountEvent(context.userId, "export_attempt", "requested");

    const ok = await account.verifyPassword(context.userId, data.password);
    if (!ok) {
      await account.logAccountEvent(context.userId, "export_attempt", "wrong_password");
      throw new Error("INVALID_PASSWORD");
    }

    const result = await account.buildDataExport(context.userId);
    await account.logAccountEvent(
      context.userId,
      "export_completed",
      "success",
      `${result.bytes} bytes, ${result.mediaFiles} media files`,
    );
    return { ...result, expiresIn: account.EXPORT_TTL };
  });

/**
 * Vollständige Kontolöschung (DSGVO Art. 17). Passwortprüfung, Ratenlimit,
 * Protokollierung; entfernt Profil, Inhalte, Uploads und das Auth-Konto.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ password: z.string().min(1).max(200), confirm: z.literal(true) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const account = await import("@/lib/account.server");

    const allowed = await account.checkRateLimit(context.userId, "delete_attempt", 5, 60);
    if (!allowed) throw new Error("RATE_LIMIT");

    await account.logAccountEvent(context.userId, "delete_attempt", "requested");

    const ok = await account.verifyPassword(context.userId, data.password);
    if (!ok) {
      await account.logAccountEvent(context.userId, "delete_attempt", "wrong_password");
      throw new Error("INVALID_PASSWORD");
    }

    // Abschlussprotokoll vor der Löschung schreiben (Zeile ohne Fremdschlüssel).
    await account.logAccountEvent(context.userId, "delete_completed", "success");
    const result = await account.deleteUserAccount(context.userId);
    return result;
  });
