import type { SlangTag } from "@/lib/types";
import { HASHTAG_COLOR, slangTagColor } from "@/lib/tag-colors";

/**
 * Einheitliche Tag-Zeile unter einem Beitrag:
 * zuerst die normalen Hashtags (rot), direkt dahinter die SlangTags
 * in ihrer typabhängigen Farbe (Community grün, Creator/Unternehmen blau).
 * Gleiche Schriftgröße, automatischer Zeilenumbruch, SlangTags klickbar.
 */
export function TagRow({
  hashtags = [],
  tags = [],
  onOpenTag,
  onOpenHashtag,
  className = "",
  size = "text-xs",
}: {
  hashtags?: string[];
  tags?: SlangTag[];
  onOpenTag?: (tag: SlangTag) => void;
  onOpenHashtag?: (hashtag: string) => void;
  className?: string;
  size?: string;
}) {
  if (hashtags.length === 0 && tags.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${size} font-semibold ${className}`}>
      {hashtags.map((h) => {
        const name = h.replace(/^#/, "");
        return (
          <button
            key={`h-${name}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenHashtag?.(name);
            }}
            style={{ color: HASHTAG_COLOR }}
            className="hover:underline"
          >
            #{name}
          </button>
        );
      })}
      {tags.map((tag) => (
        <button
          key={`t-${tag.id}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTag?.(tag);
          }}
          style={{ color: slangTagColor(tag.kind) }}
          className="hover:underline"
        >
          ${tag.name}
        </button>
      ))}
    </div>
  );
}
