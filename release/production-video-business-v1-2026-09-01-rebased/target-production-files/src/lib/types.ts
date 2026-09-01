/** Zentrale Domain-Typen. Alle Daten stammen aus der Datenbank – keine Demo-Werte. */

import { activeLang, activeLocale } from "@/lib/active-locale";

/** "jetzt"-Beschriftung je UI-Sprache für relative Zeitangaben. */
const NOW_LABEL = { de: "jetzt", en: "now", el: "τώρα" } as const;

export type SlangTagPlacement = {
  id: string;
  tagId: string;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  scale: number;
  rotation: number; // deg
  variant: "glass" | "compact" | "dot";
};

export type SlangTagStats = {
  plays: number;
  likes: number;
  uses: number;
  shares: number;
  saves: number;
  comments: number;
  /** Nur Unternehmens-SlangTags: CTA-Klicks. */
  clicks: number;
  /** Nur Unternehmens-SlangTags: Conversion-Klicks. */
  conversions: number;
  /** Nur Unternehmens-SlangTags: Reichweite (Impressionen). */
  reach: number;
};

/** Call-to-Action eines Unternehmens-SlangTags. */
export type SlangTagCtaType = "website" | "offer" | "booking" | "info" | "route";

/** Unternehmensdaten – ausschliesslich fuer Unternehmens-SlangTags gefuellt. */
export type SlangTagCompany = {
  /** Firmenname */
  name: string;
  /** Firmenlogo (URL) oder null */
  logo: string | null;
  description: string;
  ctaType: SlangTagCtaType | null;
  ctaUrl: string | null;
  discountCode: string;
  voucher: string;
  location: string;
  openingHours: string;
  phone: string;
  /** Link zur Unternehmensseite */
  url: string;
};

/** Community-SlangTags (`$`) vs. Creator-/Unternehmens-SlangTags (`$$`). */
export type SlangTagKind = "community" | "creator";

export type SlangTagOwnerType = "user" | "creator" | "company";

/** Freischaltmethode – modular erweiterbar (Challenge, Event, Premium …). */
export type SlangTagUnlockType = "open" | "follow" | "challenge" | "event" | "premium";

export type VerificationStatus = "none" | "pending" | "verified" | "rejected";

/** Vorbereitete Creator-Drop-Felder – noch nicht aktiv. */
export type SlangTagDrop = {
  releaseDate: number | null;
  limit: number | null;
  expires: number | null;
  rarity: string | null;
};

export type SlangTag = {
  id: string;
  /** Name ohne führendes $ / $$ */
  name: string;
  audio: string | null;
  audioPath: string | null;
  duration: string;
  creatorId: string;
  creator: string;
  createdAt: number;
  region: string;
  language: string;
  meaning: string;
  /** Automatisches Transkript der Audioaufnahme (Moderation, Suche, Barrierefreiheit). */
  transcript: string;
  examples: string[];
  stats: SlangTagStats;
  kind: SlangTagKind;
  /** Freigabestand des SlangTags (Grundlage der Verwendbarkeit). */
  moderationStatus?: "pending" | "approved" | "blocked";
  /** Zeitpunkt der Löschung (gesetzt = nicht mehr verwendbar). */
  deletedAt?: number | null;
  ownerId: string;
  /** Für den Slang Globe eingereicht (öffentlich sichtbare Variante). */
  communityShared: boolean;
  ownerType: SlangTagOwnerType;
  company: string;
  verificationStatus: VerificationStatus;
  unlockType: SlangTagUnlockType;
  followRequired: boolean;
  /** Nur fuer Unternehmens-SlangTags: als gesponsert gekennzeichnet. */
  sponsored: boolean;
  /** Unternehmensdaten, sonst null. */
  companyInfo: SlangTagCompany | null;
  releasedAt: number;
  drop: SlangTagDrop;
};

export type PostStats = {
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  /** Nur SlangTag-Videos: separat gezählte Videoaufrufe. */
  videoViews: number;
};

export type PostAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  verified: boolean;
  /** Testbot-Konto (nur Entwicklungsmodus). */
};

export type PostVisibility = "public" | "connections" | "private" | "following";

export type Post = {
  id: string;
  userId: string;
  author: PostAuthor;
  title: string;
  description: string;
  region: string;
  hashtags: string[];
  /** Optional zugeordneter Channel (`posts.channel_id`). */
  channelId?: string | null;
  image: string | null;
  /** 300×300 WebP für Feed und Listen */
  imageThumb?: string | null;
  /** Mittlere Auflösung für Detailansichten */
  imageMedium?: string | null;
  /** Verpixelte Teilen-Vorschau (Share Sheet, Social Preview) */
  imageShare?: string | null;
  /** Speicherpfad des Beitragsbildes (für den Varianten-Backstop, keine URL) */
  imagePath?: string | null;

  /**
   * SlangTag Video (Short, max. 5 s, ohne eigene Tonspur). Ist dieses Feld
   * gesetzt, ist der Beitrag ein SlangTag-Video – der Ton ist der SlangTag.
   */
  video?: string | null;
  /**
   * `shot` = stummer SlangShot (max. 5 s), `post` = Video-Beitrag V1
   * (max. 60 s, eigene Tonspur, Wiedergabe mit Bedienelementen).
   */
  videoKind?: "shot" | "post";
  /** Länge des Videos in Millisekunden (Shot max. 5000, Video max. 60000). */
  videoDurationMs?: number | null;
  audio: string | null;
  duration: string;
  placements: SlangTagPlacement[];
  /**
   * SlangTags in ihrer Abspielreihenfolge (Position 1–5). Die Reihenfolge des
   * Arrays IST die Reihenfolge – ein zusätzliches Positionsfeld ist unnötig.
   */
  slangTagIds: string[];
  /** true = nur der Ersteller bestimmt die Abspielreihenfolge (Schloss zu). */
  slangtagOrderLocked?: boolean;
  visibility: PostVisibility;
  stats: PostStats;
  createdAt: number;
  /**
   * Stand der KI-Prüfung. Die Prüfung läuft im Hintergrund; die Oberfläche
   * zeigt den Stand nur beim eigenen Beitrag dezent an.
   */
  moderationStatus?: PostModerationStatus;
  /** Verständlicher Hinweis der Moderation (falls vorhanden). */
  moderationReason?: string;
};

/** Persistierter Prüfstand eines Beitrags (Spalte posts.moderation_status). */
export type PostModerationStatus = "pending" | "approved" | "review" | "blocked";

export type PostComment = {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatar: string | null;
  body: string;
  slangTagIds: string[];
  createdAt: number;
};

export type LocationVisibility = "public" | "connections" | "private";

/** Sichtbarkeit des gesamten Profils. */
export type ProfileVisibility = "public" | "connections" | "private";

/** Selbst gewählter Online-Status (wird nie automatisch überschrieben). */
export type PresenceStatus = "online" | "busy" | "offline";

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  /**
   * Echter Name (Vor-/Nachname). Wird nur für das eigene Profil geladen und
   * ist standardmässig ausgeblendet – öffentliche Ansichten nutzen ihn nicht.
   */
  realName?: string;
  /** Wenn true, darf der echte Name anderen Nutzern nicht angezeigt werden. */
  realNameHidden?: boolean;
  /**
   * Bewusst gewaehlte oeffentliche Namensanzeige. Der oeffentliche
   * Anzeigename (displayName) wird daraus serverseitig abgeleitet.
   */
  displayNameMode?: "username" | "real_name" | "both";
  bio: string;
  location: string;
  /** Sichtbarkeit des Standorts – wird serverseitig durchgesetzt. */
  locationVisibility: LocationVisibility;
  /** Sichtbarkeit des Profils (Suche und Profilaufruf). */
  profileVisibility: ProfileVisibility;
  /** Selbst gewählter Online-Status. */
  presenceStatus: PresenceStatus;
  language: string;
  /** Gewähltes Erscheinungsbild der Plattform (zentrales Theme-System). */
  theme?: "aktuell" | "dark" | "white" | "rainbow";
  avatar: string | null;
  avatarPath: string | null;
  /** Kleine WebP-Variante (300 px) – für Listen, Panels und Kopfbereiche. */
  avatarThumb?: string | null;
  cover: string | null;
  coverPath: string | null;
  /** Mittlere WebP-Variante (max. 1080 px) – für Kopfbilder. */
  coverMedium?: string | null;

  verified: boolean;
  level: number;
  xp: number;
  /** Testbot-Konto (nur Entwicklungsmodus). */
  /** Push-Benachrichtigungen für dieses Konto aktiviert. */
  pushEnabled?: boolean;
};

export type SortKey = "newest" | "uses" | "likes" | "plays";

export function formatStat(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export const formatCount = formatStat;

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(activeLocale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts) / 1000;
  if (diff < 60) return NOW_LABEL[activeLang()];
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
