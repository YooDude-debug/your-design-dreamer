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
};

export type SlangTag = {
  id: string;
  /** Name ohne führendes $ */
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
  examples: string[];
  stats: SlangTagStats;
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
};

export type Post = {
  id: string;
  userId: string;
  author: PostAuthor;
  title: string;
  description: string;
  region: string;
  hashtags: string[];
  image: string | null;
  audio: string | null;
  duration: string;
  placements: SlangTagPlacement[];
  slangTagIds: string[];
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

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  language: string;
  avatar: string | null;
  avatarPath: string | null;
  cover: string | null;
  coverPath: string | null;
  verified: boolean;
  level: number;
  xp: number;
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
