import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Heart, MessageCircle, Share2, Eye, X, BadgeCheck, Lock } from "lucide-react";
import { formatCount } from "@/lib/types";
import { useLang } from "@/lib/lang-context";
import { getPostLikers, type PostLiker } from "@/lib/post-likes.functions";

/** Weich animierte Zahl (kurzes Easing, kein Layout-Sprung). */
function useSmoothCount(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 420);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

function StatCard({
  icon: Icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: typeof Heart;
  label: string;
  value: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const shown = useSmoothCount(value);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      aria-label={`${label}: ${shown}`}
      className={`inline-flex min-w-0 items-center gap-1 rounded-lg border bg-background/60 px-2 py-1.5 transition-all duration-200 ${
        onClick ? "hover:border-brand/60 hover:bg-background/80 active:scale-[0.97]" : ""
      } ${active ? "border-brand/60" : "border-border"}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-brand" : "text-muted-foreground"}`} />
      <span className="text-xs font-black leading-none text-foreground">
        {formatCount(shown)}
      </span>
      <span className="hidden max-w-[2.5rem] truncate text-[9px] uppercase tracking-wider text-muted-foreground sm:block md:max-w-[7rem]">
        {label}
      </span>
    </Tag>
  );
}

function LikersSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const load = useServerFn(getPostLikers);
  const [rows, setRows] = useState<PostLiker[] | null>(null);

  useEffect(() => {
    let alive = true;
    void load({ data: { postId } })
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in max-h-[75vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-surface p-4 shadow-glow sm:max-w-md sm:rounded-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest">Likes</h3>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {rows === null && <p className="text-xs text-muted-foreground">…</p>}
          {rows?.length === 0 && (
            <p className="text-xs italic text-muted-foreground">Noch keine Likes.</p>
          )}
          {rows?.map((u) => (
            <div key={u.id} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/40 bg-gradient-to-br from-brand to-brand-cyan">
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : u.masked ? (
                  <Lock className="h-3.5 w-3.5 text-black" />
                ) : (
                  <span className="text-xs font-black text-black">
                    {u.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">@{u.username}</span>
                  {u.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-cyan" />}
                </div>
                {u.masked && (
                  <div className="text-[10px] text-muted-foreground">
                    Dieser Nutzer hat seine Like-Privatsphäre aktiviert.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Kompakter Statistikbereich unter einem Beitrag: vier schmale, inline-Elemente
 * als Social-Media-Infozeile. Likes öffnen die Liste (mit Privatsphäre-Maskierung),
 * Kommentare springen in den Kommentarbereich. Shares und Aufrufe zeigen nur
 * Gesamtzahlen – die Identität teilender bzw. betrachtender Nutzer wird nie
 * ausgeliefert.
 */
export function PostStatsBar({
  postId,
  likes,
  comments,
  shares,
  views,
  onOpenComments,
  className = "",
}: {
  postId: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  onOpenComments?: () => void;
  className?: string;
}) {
  const { t } = useLang();
  const [likersOpen, setLikersOpen] = useState(false);

  return (
    <>
      <div className={`flex flex-wrap items-center justify-end gap-1.5 ${className}`}>
        <StatCard
          icon={Heart}
          label={t.statLikes}
          value={likes}
          active={likersOpen}
          onClick={() => setLikersOpen(true)}
        />
        <StatCard
          icon={MessageCircle}
          label={t.statComments}
          value={comments}
          onClick={onOpenComments}
        />
        <StatCard icon={Share2} label={t.statShares} value={shares} />
        <StatCard icon={Eye} label={t.statViews} value={views} />
      </div>
      {likersOpen && <LikersSheet postId={postId} onClose={() => setLikersOpen(false)} />}
    </>
  );
}
