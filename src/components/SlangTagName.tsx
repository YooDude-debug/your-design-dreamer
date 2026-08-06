import { Lock } from "lucide-react";
import { useData } from "@/lib/data-context";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import { slangTagColor } from "@/lib/tag-colors";
import type { SlangTag } from "@/lib/types";

/**
 * Einheitliche Kennzeichnung eines SlangTags. Die Farbe kommt dynamisch
 * aus dem SlangTag-Typ (Backend) – Community grün, Creator/Unternehmen blau,
 * neue Typen automatisch über ihr Design-Token.
 * Gesperrte Tags bekommen zusätzlich ein Schloss-Symbol.
 */
export function SlangTagName({
  tag,
  className = "",
  showLock = true,
}: {
  tag: SlangTag;
  className?: string;
  showLock?: boolean;
}) {
  const { isTagLocked } = useData();
  const locked = showLock && isTagLocked(tag);
  const color = slangTagColor(tag.kind);

  return (
    <span
      style={{ color }}
      className={`inline-flex min-w-0 items-center gap-1 ${locked ? "opacity-50" : ""} ${className}`}
    >
      <span
        aria-hidden
        style={{ backgroundColor: color }}
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      />
      <span className="truncate">
        {slangTagPrefix(tag.kind)}
        {tag.name}
      </span>
      {locked && <Lock className="h-3 w-3 shrink-0" />}
    </span>
  );
}

