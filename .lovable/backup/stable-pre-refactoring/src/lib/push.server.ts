/**
 * Serverseitiger Web-Push-Versand.
 *
 * Ablauf: Die Datenbank legt fuer jede neue Benachrichtigung automatisch einen
 * Versandauftrag an (`notification_jobs`). Dieser Worker holt sich eine kleine
 * Menge offener Auftraege, verschickt sie an alle Geraete des Empfaengers und
 * raeumt ungueltige Geraete auf. Das Erstellen von Beitraegen, Likes oder
 * Kommentaren wartet nie auf den Versand.
 */

import { buildPushPayload } from "@block65/webcrypto-web-push";
import { notificationLink, notificationTitle } from "@/lib/push-shared";

type Row = Record<string, unknown>;

type PushPayload = {
  id: string;
  title: string;
  body: string;
  tag: string;
  link: string;
};

const MAX_ATTEMPTS = 3;
const MAX_DEVICES_PER_USER = 10;

function vapid() {
  return {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:info@y-dude.com",
    publicKey: process.env["VAPID_PUBLIC_KEY"],
    privateKey: process.env["VAPID_PRIVATE_KEY"],
  };
}

export function pushPublicKey(): string {
  return process.env["VAPID_PUBLIC_KEY"] ?? "";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Verschickt eine Nachricht an ein Geraet. Liefert true bei Erfolg. */
async function sendToDevice(
  sub: { endpoint: string; p256dh: string; auth: string },
  data: PushPayload,
): Promise<{ ok: boolean; gone: boolean; error?: string }> {
  const keys = vapid();
  if (!keys.publicKey || !keys.privateKey)
    return { ok: false, gone: false, error: "no_vapid_keys" };
  try {
    const payload = await buildPushPayload(
      { data, options: { ttl: 60 * 60 * 24, urgency: "normal" } },
      {
        endpoint: sub.endpoint,
        expirationTime: null,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      keys,
    );
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: payload.headers,
      body: payload.body as unknown as BodyInit,
    });
    if (res.ok) return { ok: true, gone: false };
    const gone = res.status === 404 || res.status === 410;
    return { ok: false, gone, error: `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, gone: false, error: (error as Error).message };
  }
}

/**
 * Arbeitet offene Versandauftraege ab (Standard: 20 Stueck).
 * Doppelte Zustellung wird verhindert, weil ein Auftrag nur aus dem Zustand
 * "pending" heraus beansprucht werden kann.
 */
export async function processNotificationQueue(limit = 20) {
  const db = await admin();
  const nowIso = new Date().toISOString();

  const { data: jobs } = await db
    .from("notification_jobs")
    .select("id,notification_id,user_id,attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  const rows = (jobs ?? []) as Row[];
  if (rows.length === 0) return { processed: 0, sent: 0 };

  let sent = 0;
  let processed = 0;

  for (const job of rows) {
    const jobId = job.id as string;
    // Beanspruchen: nur wer den Zustand erfolgreich umsetzt, verschickt.
    const { data: claimed } = await db
      .from("notification_jobs")
      .update({ status: "sending", attempts: ((job.attempts as number) ?? 0) + 1 })
      .eq("id", jobId)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;
    processed += 1;

    try {
      const { data: notif } = await db
        .from("notifications")
        .select("id,user_id,actor_id,type,title,body,entity_type,entity_id,link")
        .eq("id", job.notification_id as string)
        .maybeSingle();

      if (!notif) {
        await db.from("notification_jobs").update({ status: "done" }).eq("id", jobId);
        continue;
      }

      const userId = notif.user_id as string;
      const { data: profile } = await db
        .from("profiles")
        .select("push_enabled")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.push_enabled) {
        await db
          .from("notification_jobs")
          .update({ status: "done", last_error: "push_disabled" })
          .eq("id", jobId);
        continue;
      }

      const { data: subs } = await db
        .from("push_subscriptions")
        .select("id,endpoint,p256dh,auth")
        .eq("user_id", userId)
        .order("last_seen_at", { ascending: false })
        .limit(MAX_DEVICES_PER_USER);

      const devices = (subs ?? []) as Row[];
      let actorName = "";
      if (notif.actor_id) {
        const { data: actor } = await db
          .from("profiles")
          .select("username")
          .eq("id", notif.actor_id as string)
          .maybeSingle();
        actorName = (actor?.username as string) ?? "";
      }

      const body = actorName
        ? `@${actorName} ${(notif.body as string) ?? ""}`.trim()
        : ((notif.body as string) ?? "");

      const payload: PushPayload = {
        id: notif.id as string,
        title: notificationTitle(notif.type as string, notif.title as string | null),
        body,
        tag: notif.id as string,
        link: notificationLink({
          type: notif.type as string,
          link: notif.link as string | null,
          entityType: notif.entity_type as string | null,
          entityId: notif.entity_id as string | null,
        }),
      };

      for (const device of devices) {
        const result = await sendToDevice(
          {
            endpoint: device.endpoint as string,
            p256dh: device.p256dh as string,
            auth: device.auth as string,
          },
          payload,
        );
        if (result.ok) {
          sent += 1;
          await db
            .from("push_subscriptions")
            .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
            .eq("id", device.id as string);
        } else if (result.gone) {
          await db
            .from("push_subscriptions")
            .delete()
            .eq("id", device.id as string);
        } else {
          const { data: current } = await db
            .from("push_subscriptions")
            .select("failure_count")
            .eq("id", device.id as string)
            .maybeSingle();
          const count = ((current?.failure_count as number) ?? 0) + 1;
          if (count >= 5) {
            await db
              .from("push_subscriptions")
              .delete()
              .eq("id", device.id as string);
          } else {
            await db
              .from("push_subscriptions")
              .update({ failure_count: count })
              .eq("id", device.id as string);
          }
        }
      }

      await db
        .from("notification_jobs")
        .update({ status: "done", last_error: null })
        .eq("id", jobId);
    } catch (error) {
      const attempts = ((job.attempts as number) ?? 0) + 1;
      const failed = attempts >= MAX_ATTEMPTS;
      await db
        .from("notification_jobs")
        .update({
          status: failed ? "failed" : "pending",
          last_error: (error as Error).message.slice(0, 500),
          next_attempt_at: new Date(Date.now() + 60_000 * attempts).toISOString(),
        })
        .eq("id", jobId);
    }
  }

  return { processed, sent };
}

/** Entfernt alte Geraete und erledigte Auftraege. */
export async function cleanupPushData() {
  const db = await admin();
  await db.rpc("cleanup_push_data");
}

/** Speichert bzw. aktualisiert ein Geraet des angemeldeten Nutzers. */
export async function saveSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent: string },
) {
  const db = await admin();
  await db.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent.slice(0, 300),
      failure_count: 0,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  // Alte Geraete bereinigen: nur die zuletzt genutzten behalten.
  const { data: all } = await db
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false });
  const extra = ((all ?? []) as Row[]).slice(MAX_DEVICES_PER_USER).map((r) => r.id as string);
  if (extra.length > 0) await db.from("push_subscriptions").delete().in("id", extra);
}

/** Entfernt genau ein Geraet des angemeldeten Nutzers. */
export async function removeSubscription(userId: string, endpoint: string) {
  const db = await admin();
  await db.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
}

/** Zaehlt die registrierten Geraete des Nutzers. */
export async function countDevices(userId: string) {
  const db = await admin();
  const { count } = await db
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}
