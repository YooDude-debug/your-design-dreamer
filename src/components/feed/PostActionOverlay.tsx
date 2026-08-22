import { Heart, MessageCircle, Eye, Share2, Bookmark } from "lucide-react";
import { formatStat } from "@/lib/types";
import { useLang } from "@/lib/lang-context";
import type { Post } from "@/lib/types";

type Props = {
  post: Pick<Post, "id" | "stats" | "visibility">;
  liked: boolean;
  saved: boolean;
  shared: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
};

/**
 * Kompakte Interaktionsleiste als Overlay über dem Feed-Bild.
 * Unten rechts platziert, dezenter dunkler Glas-Hintergrund mit grünem Akzent.
 * Klicks auf die Buttons stoppen die Propagation, damit das darunterliegende
 * Bild nicht versehentlich die Detailansicht öffnet.
 */
export function PostActionOverlay({
  post,
  liked,
  saved,
  shared,
  onLike,
  onComment,
  onShare,
  onSave,
}: Props) {
  const { t } = useLang();
  const stop = (e: React.MouseEvent | React.PointerEvent) => e.stopPropagation();

  return (
    <div
      onClick={stop}
      onPointerDown={stop}
      className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-full border border-white/10 bg-black/55 px-1.5 py-1 shadow-glow-subtle backdrop-blur-md sm:bottom-2 sm:right-2 sm:gap-1 sm:px-2 sm:py-1.5"
    >
      <button
        type="button"
        onClick={onLike}
        aria-label={t.like}
        aria-pressed={liked}
        className={`tap-safe inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-semibold transition-colors sm:px-1.5 sm:text-xs ${
          liked ? "text-brand" : "text-white/90 hover:text-brand"
        }`}
      >
        <Heart
          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
            liked ? "fill-current" : ""
          }`}
        />
        <span>{formatStat(post.stats.likes)}</span>
      </button>

      <button
        type="button"
        onClick={onComment}
        aria-label={t.statComments}
        className="tap-safe inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-semibold text-white/90 transition-colors hover:text-brand sm:px-1.5 sm:text-xs"
      >
        <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span>{formatStat(post.stats.comments)}</span>
      </button>

      <span
        aria-label={t.statViews ?? "Views"}
        title={t.statViews ?? "Views"}
        className="tap-safe inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-semibold text-white/70 sm:px-1.5 sm:text-xs"
      >
        <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span>{formatStat(post.stats.views)}</span>
      </span>

      <button
        type="button"
        onClick={onShare}
        aria-label={t.share}
        className={`tap-safe inline-flex items-center gap-0.5 rounded-full px-1 py-0.5 text-[10px] font-semibold transition-colors sm:px-1.5 sm:text-xs ${
          shared ? "text-brand-cyan" : "text-white/90 hover:text-brand-cyan"
        }`}
      >
        <Share2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span>{formatStat(post.stats.shares)}</span>
      </button>

      <button
        type="button"
        onClick={onSave}
        aria-label={t.saveAction}
        className={`tap-safe inline-flex items-center justify-center rounded-full px-1 py-0.5 transition-colors sm:px-1.5 ${
          saved ? "text-brand-cyan" : "text-white/90 hover:text-brand-cyan"
        }`}
      >
        <Bookmark
          className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
            saved ? "fill-current" : ""
          }`}
        />
      </button>
    </div>
  );
}
