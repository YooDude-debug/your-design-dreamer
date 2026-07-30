import type { SlangTagPlacement } from "@/lib/types";

/** Normalisierter Beitrag für die Detailansicht (Feed-Demo + eigene Beiträge). */
export type DetailPost = {
  id: string;
  user: string;
  avatar: string | null;
  verified: boolean;
  place: string;
  time: string;
  createdAt: number;
  title: string;
  description: string;
  image: string | null;
  placements: SlangTagPlacement[];
  hashtags: string[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  duration: string;
  color: string;
};

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
