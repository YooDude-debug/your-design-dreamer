import { Globe } from "lucide-react";
import type { PostVisibility } from "@/lib/types";
import { VISIBILITY_META } from "@/lib/visibility";

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
