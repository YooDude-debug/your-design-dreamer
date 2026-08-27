import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SlangText } from "@/components/SlangTagInput";
import { useLang } from "@/lib/lang-context";
import { relativeTime, type PostComment, type Profile } from "@/lib/types";

type SortMode = "newest" | "top";

const LABELS = {
  de: {
    more: "Weitere Kommentare anzeigen",
    less: "Weniger anzeigen",
    newest: "Neueste",
    top: "Beliebteste",
  },
  en: { more: "Show more comments", less: "Show less", newest: "Newest", top: "Top" },
} as const;

/** Likes eines Kommentars (falls vom Backend geliefert) – rein für die Sortierung. */
function commentLikes(c: PostComment) {
  return (c as PostComment & { likes?: number }).likes ?? 0;
}

/**
 * Kompakte Kommentarliste: standardmäßig max. 2 Kommentare, Rest per Klick.
 * Sortierung „Neueste“ (Standard) oder „Beliebteste“ (nach Kommentar-Likes).
 * Es werden ausschließlich bereits geladene Kommentare verwendet – kein Reload.
 */
export function CommentList({
  comments,
  profiles,
  unknownLabel,
  className = "",
}: {
  comments: PostComment[];
  profiles: Record<string, Profile | undefined>;
  unknownLabel: string;
  className?: string;
}) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const L = LABELS[lang === "de" ? "de" : "en"];
  const [sort, setSort] = useState<SortMode>("newest");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    const list = [...comments];
    if (sort === "top") {
      list.sort((a, b) => commentLikes(b) - commentLikes(a) || b.createdAt - a.createdAt);
    } else {
      list.sort((a, b) => b.createdAt - a.createdAt);
    }
    return list;
  }, [comments, sort]);

  const hidden = Math.max(0, sorted.length - 2);
  const visible = expanded ? sorted : sorted.slice(0, 2);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {comments.length > 1 && (
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider">
          {(["newest", "top"] as SortMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSort(m)}
              className={`rounded-md px-1.5 py-0.5 transition-colors ${
                sort === m ? "text-brand" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "newest" ? L.newest : L.top}
            </button>
          ))}
        </div>
      )}

      {visible.map((c) => {
        const author = profiles[c.userId];
        return (
          <div key={c.id} className="flex items-start gap-2 text-sm">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-cyan to-brand">
              {author?.avatar && (
                <img
                  src={author.avatar}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 leading-tight">
                <span className="truncate font-semibold">@{author?.username ?? unknownLabel}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {relativeTime(c.createdAt)}
                </span>
              </div>
              <div className="leading-snug text-foreground/90">
                <SlangText
                  text={c.body}
                  onOpenTag={(tag) =>
                    navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-brand hover:underline"
        >
          {expanded ? L.less : `${L.more} (${hidden})`}
        </button>
      )}
    </div>
  );
}
