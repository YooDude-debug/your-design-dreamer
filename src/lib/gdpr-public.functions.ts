import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Öffentliche DSGVO-Server-Funktionen für /delete-account und /request-data.
 * Beide Funktionen führen ihre Arbeit erst nach erfolgreicher
 * Identitätsprüfung (Identifikator + Passwort) aus.
 */

const identitySchema = z.object({
  identifier: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const publicRequestDataExport = createServerFn({ method: "POST" })
  .inputValidator((data) => identitySchema.parse(data))
  .handler(async ({ data }) => {
    const { verifyPublicIdentity } = await import("@/lib/gdpr-public.server");
    const account = await import("@/lib/account.server");

    const who = await verifyPublicIdentity(data.identifier, data.password);
    if (!who) return { ok: false as const, reason: "INVALID" as const };

    const allowed = await account.checkRateLimit(who.userId, "export_attempt", 5, 60);
    if (!allowed) return { ok: false as const, reason: "RATE_LIMIT" as const };

    await account.logAccountEvent(who.userId, "export_attempt", "requested", "public form");
    const result = await account.buildDataExport(who.userId);
    await account.logAccountEvent(
      who.userId,
      "export_completed",
      "success",
      `${result.bytes} bytes, ${result.mediaFiles} media files (public form)`,
    );
    return {
      ok: true as const,
      url: result.url,
      filename: result.filename,
      bytes: result.bytes,
      expiresIn: account.EXPORT_TTL,
    };
  });

export const publicDeleteAccount = createServerFn({ method: "POST" })
  .inputValidator((data) => identitySchema.extend({ confirm: z.literal(true) }).parse(data))
  .handler(async ({ data }) => {
    const { verifyPublicIdentity } = await import("@/lib/gdpr-public.server");
    const account = await import("@/lib/account.server");

    const who = await verifyPublicIdentity(data.identifier, data.password);
    if (!who) return { ok: false as const, reason: "INVALID" as const };

    const allowed = await account.checkRateLimit(who.userId, "delete_attempt", 5, 60);
    if (!allowed) return { ok: false as const, reason: "RATE_LIMIT" as const };

    await account.logAccountEvent(who.userId, "delete_attempt", "requested", "public form");
    await account.logAccountEvent(who.userId, "delete_completed", "success", "public form");
    const result = await account.deleteUserAccount(who.userId);
    return { ok: true as const, ...result };
  });
