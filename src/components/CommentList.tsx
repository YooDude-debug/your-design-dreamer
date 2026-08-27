import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { SlangText } from "@/components/SlangTagInput";
import { useLang } from "@/lib/lang-context";
import { useCommentTranslation } from "@/lib/use-comment-translation";
import { relativeTime, type PostComment, type Profile } from "@/lib/types";

type SortMode = "newest" | "top";

/** Likes eines Kommentars (falls vom Backend geliefert) – rein für die Sortierung. */
function commentLikes(c: PostComment) {
  return (c as PostComment & { likes?: number }).likes ?? 0;
}

/**
 * Ein Kommentar mit Übersetzung in die Sprache des Nutzers.
 * Das Original bleibt immer der Fallback; eigene Kommentare bleiben im Original.
 */
function CommentRow({
  comment,
  author,
  unknownLabel,
  own,
}: {
  comment: PostComment;
  author: Profile | undefined;
  unknownLabel: string;
  own: boolean;
}) {
  const navigate = useNavigate();
  const tr = useCommentTranslation({ id: comment.id, body: comment.body, own });

  const username = author?.username;

  const avatar = (
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
  );

  return (
    <div className="flex items-start gap-2 text-sm">
      {username ? (
        <Link to="/profile/$username" params={{ username }} aria-label={`@${username}`}>
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 leading-tight">
          {username ? (
            <Link
              to="/profile/$username"
              params={{ username }}
              className="truncate font-semibold hover:text-brand"
            >
              @{username}
            </Link>
          ) : (
            <span className="truncate font-semibold">@{unknownLabel}</span>
          )}

          <span className="shrink-0 text-[10px] text-muted-foreground">
            {relativeTime(comment.createdAt)}
          </span>
        </div>
        <div className="leading-snug text-foreground/90">
          <SlangText
            text={tr.body}
            onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
          />
        </div>
        {tr.canToggle && (
          <button
            type="button"
            onClick={tr.toggle}
            className="mt-0.5 text-[10px] text-muted-foreground/80 underline-offset-2 hover:text-brand hover:underline"
          >
            {tr.toggleLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Kompakte Kommentarliste: standardmäßig max. 2 Kommentare, Rest per Klick.
 * Sortierung „Neueste“ (Standard) oder „Beliebteste“ (nach Kommentar-Likes).
 * Alle Bedienelemente stehen in der Sprache des Nutzers (de/en/el).
 * Es werden ausschließlich bereits geladene Kommentare verwendet – kein Reload.
 */
export function CommentList({
  comments,
  profiles,
  unknownLabel,
  viewerId = null,
  className = "",
}: {
  comments: PostComment[];
  profiles: Record<string, Profile | undefined>;
  unknownLabel: string;
  /** Angemeldeter Nutzer – eigene Kommentare bleiben im Original. */
  viewerId?: string | null;
  className?: string;
}) {
  const { t } = useLang();
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
              {m === "newest" ? t.sortNewest : t.commentsSortTop}
            </button>
          ))}
        </div>
      )}

      {visible.map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          author={profiles[c.userId]}
          unknownLabel={unknownLabel}
          own={Boolean(viewerId && c.userId === viewerId)}
        />
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-semibold text-brand hover:underline"
        >
          {expanded ? t.commentsShowLess : `${t.commentsShowMore} (${hidden})`}
        </button>
      )}
    </div>
  );
}
