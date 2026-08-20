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

/** Unterstuetzte Sprachen der Push-Texte (identisch zum Sprachsystem der App). */
export const PUSH_LANGS = ["de", "en", "el"] as const;
export type PushLang = (typeof PUSH_LANGS)[number];

export function normalizePushLang(value: unknown): PushLang {
  const raw = typeof value === "string" ? value.slice(0, 2).toLowerCase() : "";
  return (PUSH_LANGS as readonly string[]).includes(raw) ? (raw as PushLang) : "de";
}

/**
 * Titel je Art in der Sprache des Empfaengers. Keine harten Texte im
 * Versandcode – alles laeuft ueber dieses Woerterbuch.
 */
const TITLES_BY_LANG: Record<PushLang, Record<string, string>> = {
  de: NOTIFICATION_TITLES,
  en: {
    comment: "New comment",
    comment_reply: "New reply",
    post_like: "New like",
    connection_request: "New connection request",
    connection_accepted: "Connection accepted",
    mention: "Mention",
    slangtag_used: "SlangTag used",
    slangtag_liked: "SlangTag liked",
    ad_campaign: "Campaign status",
    moderation: "Moderation completed",
    system: "Y-Dude",
    message: "New message",
  },
  el: {
    comment: "Νέο σχόλιο",
    comment_reply: "Νέα απάντηση",
    post_like: "Νέο like",
    connection_request: "Νέο αίτημα σύνδεσης",
    connection_accepted: "Η σύνδεση επιβεβαιώθηκε",
    mention: "Αναφορά",
    slangtag_used: "Το SlangTag χρησιμοποιήθηκε",
    slangtag_liked: "Το SlangTag έλαβε like",
    ad_campaign: "Κατάσταση καμπάνιας",
    moderation: "Ο έλεγχος ολοκληρώθηκε",
    system: "Y-Dude",
    message: "Νέο μήνυμα",
  },
};

/** "Neue Nachricht von X" / "Neue Sprachnachricht von X" je Sprache. */
const MESSAGE_TITLE: Record<PushLang, { text: (n: string) => string; voice: (n: string) => string }> = {
  de: {
    text: (n) => (n ? `Neue Nachricht von ${n}` : "Neue Nachricht"),
    voice: (n) => (n ? `Neue Sprachnachricht von ${n}` : "Neue Sprachnachricht"),
  },
  en: {
    text: (n) => (n ? `New message from ${n}` : "New message"),
    voice: (n) => (n ? `New voice message from ${n}` : "New voice message"),
  },
  el: {
    text: (n) => (n ? `Νέο μήνυμα από ${n}` : "Νέο μήνυμα"),
    voice: (n) => (n ? `Νέο φωνητικό μήνυμα από ${n}` : "Νέο φωνητικό μήνυμα"),
  },
};

/** Titel einer Push-Benachrichtigung in der Sprache des Empfaengers. */
export function pushTitle(input: {
  type: string;
  title?: string | null;
  lang: PushLang;
  actorName?: string | null;
  voice?: boolean;
}): string {
  const own = (input.title ?? "").trim();
  if (own) return own;
  const name = (input.actorName ?? "").trim();
  if (input.type === "message") {
    const set = MESSAGE_TITLE[input.lang];
    return input.voice ? set.voice(name) : set.text(name);
  }
  const dict = TITLES_BY_LANG[input.lang];
  return dict[input.type] ?? TITLES_BY_LANG.de[input.type] ?? "Y-Dude";
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
