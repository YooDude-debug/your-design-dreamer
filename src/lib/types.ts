/** Zentrale Domain-Typen. Alle Daten stammen aus der Datenbank – keine Demo-Werte. */

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
};

export type PostAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  verified: boolean;
  /** Testbot-Konto (nur Entwicklungsmodus). */
  isTestBot: boolean;
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
  image: string | null;
  /** 300×300 WebP für Feed und Listen */
  imageThumb?: string | null;
  /** Mittlere Auflösung für Detailansichten */
  imageMedium?: string | null;
  audio: string | null;
  duration: string;
  placements: SlangTagPlacement[];
  slangTagIds: string[];
  visibility: PostVisibility;
  stats: PostStats;
  createdAt: number;
};

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
  bio: string;
  location: string;
  /** Sichtbarkeit des Standorts – wird serverseitig durchgesetzt. */
  locationVisibility: LocationVisibility;
  /** Sichtbarkeit des Profils (Suche und Profilaufruf). */
  profileVisibility: ProfileVisibility;
  /** Selbst gewählter Online-Status. */
  presenceStatus: PresenceStatus;
  language: string;
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
  isTestBot: boolean;
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
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts) / 1000;
  if (diff < 60) return "jetzt";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
