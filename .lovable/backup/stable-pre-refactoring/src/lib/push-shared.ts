/**
 * Gemeinsame Definitionen des Benachrichtigungssystems (Browser + Server).
 * Enthaelt keine Geheimnisse und keine Server-Abhaengigkeiten.
 */

export const NOTIFICATION_TYPES = [
  "comment",
  "comment_reply",
  "post_like",
  "connection_request",
  "connection_accepted",
  "mention",
  "slangtag_used",
  "slangtag_liked",
  "ad_campaign",
  "moderation",
  "system",
  "message",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Standard-Titel je Art (falls die Benachrichtigung keinen eigenen mitbringt). */
export const NOTIFICATION_TITLES: Record<string, string> = {
  comment: "Neuer Kommentar",
  comment_reply: "Neue Antwort",
  post_like: "Neues Like",
  connection_request: "Neue Verbindungsanfrage",
  connection_accepted: "Verbindung bestätigt",
  mention: "Erwähnung",
  slangtag_used: "SlangTag verwendet",
  slangtag_liked: "SlangTag geliked",
  ad_campaign: "Kampagnenstatus",
  moderation: "Moderation abgeschlossen",
  system: "Y-Dude",
  message: "Neue Nachricht",
};

export function notificationTitle(type: string, title?: string | null): string {
  const own = (title ?? "").trim();
  if (own) return own;
  return NOTIFICATION_TITLES[type] ?? "Y-Dude";
}

/**
 * Sprungziel einer Benachrichtigung. Gespeicherte Links haben Vorrang,
 * ansonsten wird aus Art und Bezug ein sinnvolles Ziel gebildet.
 */
export function notificationLink(n: {
  type: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}): string {
  const link = (n.link ?? "").trim();
  if (link.startsWith("/")) return link;
  if (n.entityType === "post" && n.entityId) return `/p/${n.entityId}`;
  if (n.entityType === "campaign") return "/arena";
  return "/dev";
}

/** base64url -> Uint8Array (fuer den VAPID-Schluessel im Browser). */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}
