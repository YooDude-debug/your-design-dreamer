import { Lock } from "lucide-react";
import { useData } from "@/lib/data-context";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import type { SlangTag } from "@/lib/types";

/**
 * Einheitliche Kennzeichnung eines SlangTags:
 * 🟢 `$Name` (Community) · 🔵 `$$Name` (Creator / Unternehmen).
 * Gesperrte Creator-Tags bekommen zusätzlich ein Schloss-Symbol.
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
  const creator = tag.kind === "creator";
  const locked = showLock && isTagLocked(tag);

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1 ${
        creator ? "text-brand-cyan" : "text-brand"
      } ${locked ? "opacity-50" : ""} ${className}`}
    >
      <span
        aria-hidden
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
          creator ? "bg-brand-cyan" : "bg-brand"
        }`}
      />
      <span className="truncate">
        {slangTagPrefix(tag.kind)}
        {tag.name}
      </span>
      {locked && <Lock className="h-3 w-3 shrink-0" />}
    </span>
  );
}
