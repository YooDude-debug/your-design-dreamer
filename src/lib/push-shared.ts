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
  "market_match",
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
  market_match: "Neues Market-Angebot",
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

/** Genauer Sprachcode oder null – nur exakte Werte de/en/el zaehlen. */
export function exactPushLang(value: unknown): PushLang | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PUSH_LANGS as readonly string[]).includes(raw) ? (raw as PushLang) : null;
}

/**
 * Freitext-Sprachangabe eines Profils ("Deutsch", "Greek", "Ελληνικά", ...)
 * auf einen Sprachcode abbilden. null, wenn nicht eindeutig.
 */
export function pushLangFromText(value: unknown): PushLang | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return null;
  if (
    /^(el|gr)/.test(raw) ||
    raw.startsWith("ελ") ||
    raw.includes("greek") ||
    raw.includes("griech")
  )
    return "el";
  if (/^de/.test(raw) || raw.includes("german")) return "de";
  if (/^en/.test(raw) || raw.includes("englis")) return "en";
  return null;
}

/**
 * Push-Sprache des Empfaengers: zuerst die im Konto gespeicherte
 * Anzeigesprache (`ui_language`), danach die Freitext-Sprachangabe,
 * zuletzt der Projekt-Standard. Sender-, Browser- oder Serversprache
 * spielen hier keine Rolle.
 */
export function resolveRecipientLang(input: {
  uiLanguage?: unknown;
  language?: unknown;
  fallback?: PushLang;
}): PushLang {
  return (
    exactPushLang(input.uiLanguage) ?? pushLangFromText(input.language) ?? input.fallback ?? "de"
  );
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
    market_match: "New Market listing",
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
    market_match: "Νέα αγγελία στο Market",
    ad_campaign: "Κατάσταση καμπάνιας",
    moderation: "Ο έλεγχος ολοκληρώθηκε",
    system: "Y-Dude",
    message: "Νέο μήνυμα",
  },
};

/** "Neue Nachricht von X" / "Neue Sprachnachricht von X" je Sprache. */
const MESSAGE_TITLE: Record<
  PushLang,
  { text: (n: string) => string; voice: (n: string) => string }
> = {
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

/** Gebündelte Chat-Nachrichten: "@Anna hat dir 5 neue Nachrichten gesendet." */
const MESSAGES_BODY: Record<PushLang, (n: number) => string> = {
  de: (n) => `hat dir ${n} neue Nachrichten gesendet.`,
  en: (n) => `sent you ${n} new messages.`,
  el: (n) => `σου έστειλε ${n} νέα μηνύματα.`,
};

/** Genau eine neue Chat-Nachricht: "@Anna hat dir eine neue Nachricht gesendet." */
const MESSAGE_ONE_BODY: Record<PushLang, string> = {
  de: "hat dir eine neue Nachricht gesendet.",
  en: "sent you a new message.",
  el: "σου έστειλε ένα νέο μήνυμα.",
};

/** Titel gebündelter Chat-Nachrichten je Sprache. */
const MESSAGES_TITLE: Record<PushLang, (n: string) => string> = {
  de: (n) => (n ? `Neue Nachrichten von ${n}` : "Neue Nachrichten"),
  en: (n) => (n ? `New messages from ${n}` : "New messages"),
  el: (n) => (n ? `Νέα μηνύματα από ${n}` : "Νέα μηνύματα"),
};

/** Arten, bei denen der auslösende Nutzer im Titel genannt wird. */
const ACTOR_TITLE_TYPES = new Set([
  "post_like",
  "comment",
  "comment_reply",
  "mention",
  "slangtag_used",
  "slangtag_liked",
  "connection_request",
  "connection_accepted",
]);

/** Titel gebündelter Like-Benachrichtigungen je Sprache. */
const LIKES_TITLE: Record<PushLang, string> = {
  de: "Neue Likes",
  en: "New likes",
  el: "Νέα likes",
};

/** Gebündelter Like-Text ("5 Personen gefällt dein Beitrag."). */
const LIKES_BODY: Record<PushLang, (n: number) => string> = {
  de: (n) => `${n} Personen gefällt dein Beitrag.`,
  en: (n) => `${n} people like your post.`,
  el: (n) => `${n} άτομα έκαναν like στη δημοσίευσή σου.`,
};

/** Genau ein Like: "Dora gefällt dein Beitrag." */
const LIKE_ONE_BODY: Record<PushLang, string> = {
  de: "gefällt dein Beitrag.",
  en: "likes your post.",
  el: "έκανε like στη δημοσίευσή σου.",
};


/** Titel einer Push-Benachrichtigung in der Sprache des Empfaengers. */
export function pushTitle(input: {
  type: string;
  title?: string | null;
  lang: PushLang;
  actorName?: string | null;
  voice?: boolean;
  /** Anzahl gebündelter Likes (nur bei `post_like`). */
  likeCount?: number | null;
  /** Anzahl gebündelter Chat-Nachrichten (nur bei `message`). */
  messageCount?: number | null;
}): string {
  const name = (input.actorName ?? "").trim();
  // Gebündelte Likes: kein einzelner Name, sondern die Gesamtzahl.
  if (input.type === "post_like" && (input.likeCount ?? 1) > 1) return LIKES_TITLE[input.lang];
  if (input.type === "message") {
    // Mehrere Nachrichten desselben Absenders werden zu einem Titel gebündelt.
    if ((input.messageCount ?? 1) > 1) return MESSAGES_TITLE[input.lang](name);
    const set = MESSAGE_TITLE[input.lang];
    return input.voice ? set.voice(name) : set.text(name);
  }
  const dict = TITLES_BY_LANG[input.lang];
  // Bekannte Arten immer in der Sprache des Empfaengers – der in der
  // Datenbank gespeicherte Titel ist die Sprache der Sender-Oberflaeche.
  const known = dict[input.type] ?? TITLES_BY_LANG.de[input.type] ?? null;
  if (known) {
    // Bei Social-Aktionen den Auslöser direkt im Titel nennen.
    return name && ACTOR_TITLE_TYPES.has(input.type) ? `${known} · @${name}` : known;
  }
  const own = (input.title ?? "").trim();
  return own || "Y-Dude";
}

/**
 * Kurztexte fuer Push-Inhalte je Art in der Sprache des Empfaengers.
 * In der Datenbank steht der Anzeigetext der Oberflaeche des Senders –
 * fuer die Push wird er hier durch die Empfaengersprache ersetzt.
 */
const BODY_BY_LANG: Record<PushLang, Record<string, string>> = {
  de: {
    connection_request: "hat dir eine Connection-Anfrage gesendet",
    connection_accepted: "hat deine Connection angenommen",
    message: "hat dir eine Nachricht gesendet",
    post_like: "hat deinen Beitrag geliked",
    comment: "hat deinen Beitrag kommentiert",
    comment_reply: "hat auf deinen Kommentar geantwortet",
    mention: "hat dich erwähnt",
    slangtag_used: "hat deinen SlangTag verwendet",
    slangtag_liked: "gefällt dein SlangTag",
    market_match: "passt zu deiner gespeicherten Suche",
  },
  en: {
    connection_request: "sent you a connection request",
    connection_accepted: "accepted your connection",
    message: "sent you a message",
    post_like: "liked your post",
    comment: "commented on your post",
    comment_reply: "replied to your comment",
    mention: "mentioned you",
    slangtag_used: "used your SlangTag",
    slangtag_liked: "liked your SlangTag",
    market_match: "matches your saved search",
  },
  el: {
    connection_request: "σου έστειλε αίτημα σύνδεσης",
    connection_accepted: "αποδέχτηκε τη σύνδεσή σου",
    message: "σου έστειλε ένα μήνυμα",
    post_like: "έκανε like στη δημοσίευσή σου",
    comment: "σχολίασε τη δημοσίευσή σου",
    comment_reply: "απάντησε στο σχόλιό σου",
    mention: "σε ανέφερε",
    slangtag_used: "χρησιμοποίησε το SlangTag σου",
    slangtag_liked: "έκανε like στο SlangTag σου",
    market_match: "ταιριάζει με την αποθηκευμένη αναζήτησή σου",
  },
};

/** Push-Inhalt in der Sprache des Empfaengers (mit @Name davor). */
export function pushBody(input: {
  type: string;
  lang: PushLang;
  actorName?: string | null;
  storedBody?: string | null;
  /** Anzahl gebündelter Likes (nur bei `post_like`). */
  likeCount?: number | null;
  /** Anzahl gebündelter Chat-Nachrichten (nur bei `message`). */
  messageCount?: number | null;
}): string {
  const name = (input.actorName ?? "").trim();
  // Chat: nur Absender und Anzahl, niemals der Nachrichteninhalt.
  if (input.type === "message") {
    const count = Math.max(1, input.messageCount ?? 1);
    const text = count > 1 ? MESSAGES_BODY[input.lang](count) : MESSAGE_ONE_BODY[input.lang];
    return (name ? `@${name} ${text}` : text).trim();
  }
  // Likes am selben Beitrag werden gebündelt: ein Name oder die Gesamtzahl.
  if (input.type === "post_like") {
    const count = Math.max(1, input.likeCount ?? 1);
    if (count > 1) return LIKES_BODY[input.lang](count);
    const one = LIKE_ONE_BODY[input.lang];
    return (name ? `@${name} ${one}` : one).trim();
  }

  const localized = BODY_BY_LANG[input.lang][input.type];
  const text = (localized ?? input.storedBody ?? "").trim();
  return (name ? `@${name} ${text}` : text).trim();
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
  // Like-Benachrichtigung: Beitrag oeffnen und die Like-Liste direkt zeigen.
  if (n.type === "post_like") {
    const base = link.startsWith("/") ? link : n.entityId ? `/p/${n.entityId}` : "";
    if (base) return base.includes("?") ? `${base}&likes=1` : `${base}?likes=1`;
  }
  if (link.startsWith("/")) return link;
  if (n.entityType === "post" && n.entityId) return `/p/${n.entityId}`;
  if (n.entityType === "campaign") return "/arena";

  // Chat-Nachricht: direkt die passende Unterhaltung oeffnen.
  if (n.type === "message" && n.entityType === "conversation" && n.entityId)
    return `/dev?chat=${n.entityId}`;
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
