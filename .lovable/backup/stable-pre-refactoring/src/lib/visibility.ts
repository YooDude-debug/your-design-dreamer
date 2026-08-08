import { Globe, Users, Lock, Star } from "lucide-react";
import type { PostVisibility } from "@/lib/types";

export const VISIBILITY_META: Record<PostVisibility, { icon: typeof Globe; emoji: string }> = {
  public: { icon: Globe, emoji: "🌍" },
  connections: { icon: Users, emoji: "👥" },
  following: { icon: Star, emoji: "⭐" },
  private: { icon: Lock, emoji: "👤" },
};

export function visibilityLabel(v: PostVisibility, t: Record<string, string>) {
  if (v === "connections") return t.visibilityConnections ?? "Friends";
  if (v === "following") return t.visibilityFollowing ?? "I follow";
  if (v === "private") return t.visibilityPrivate ?? "Only me";
  return t.visibilityPublic ?? "Public";
}
