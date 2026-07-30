import { Globe, Users, Lock } from "lucide-react";
import type { PostVisibility } from "@/lib/types";

export const VISIBILITY_META: Record<PostVisibility, { icon: typeof Globe; emoji: string }> = {
  public: { icon: Globe, emoji: "🌍" },
  connections: { icon: Users, emoji: "👥" },
  private: { icon: Lock, emoji: "🔒" },
};

export function visibilityLabel(v: PostVisibility, t: Record<string, string>) {
  if (v === "connections") return t.visibilityConnections ?? "Connections";
  if (v === "private") return t.visibilityPrivate ?? "Private";
  return t.visibilityPublic ?? "Public";
}

/** Kleines Sichtbarkeits-Icon für Beiträge. */
export function VisibilityBadge({
  visibility,
  label,
  className = "",
}: {
  visibility: PostVisibility;
  label?: string;
  className?: string;
}) {
  const Icon = VISIBILITY_META[visibility]?.icon ?? Globe;
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 text-muted-foreground ${className}`}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}
