import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { X, Heart, Share2, MapPin, Clock, BadgeCheck, Bookmark } from "lucide-react";

import { toast } from "sonner";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { useShotSync } from "@/lib/video/use-shot-sync";
import { ShotPlayButton } from "@/components/ShotPlayButton";
import { claimBus, stopAll } from "@/lib/autoplay";
import { TagRow } from "@/components/TagRow";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { collectTagIds } from "@/lib/slangtag-ui";
import { formatDate, type Post, type SlangTag } from "@/lib/types";
import { CommentList } from "@/components/CommentList";

import { VisibilityBadge } from "@/components/VisibilityBadge";
import { visibilityLabel } from "@/lib/visibility";
import { ReportMenu } from "@/components/ReportDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { isShareable, postShareUrl, shareTitle } from "@/lib/share";
import { postFullImage, postShareImage } from "@/lib/media";
import { PostStatsBar } from "@/components/PostStatsBar";

type Props = {
  posts: Post[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** Rechteck des angeklickten Bildes für die Zoom-Animation */
  originRect?: DOMRect | null;
};

export function PostDetailOverlay({ posts, index, onClose, originRect }: Props) {
  const post = posts[index];
  const navigate = useNavigate();
  const { t } = useLang();
  const {
    profiles,
    getTag,
    commentsByPost,
    syncPost,
    addComment,
    likedPosts,
    savedPosts,
    togglePostLike,
    togglePostSave,
    sharePost,
    registerView,
    registerVideoView,
  } = useData();
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [draft, setDraft] = useState("");
  /** Im Kommentarfeld eingefügte SlangTags (auch neu aufgenommene). */
  const insertedTags = useRef<SlangTag[]>([]);

  const comments = commentsByPost[post?.id ?? ""] ?? [];
  const liked = likedPosts.includes(post?.id ?? "");
  const saved = savedPosts.includes(post?.id ?? "");

  /**
   * Einmal pro Beitrag und Sitzung: echte Zähler + Kommentare holen und Aufruf
   * zählen. Beim Zurückwischen auf einen bereits geladenen Beitrag entsteht
   * keine neue Datenbankabfrage – die Daten kommen aus dem Cache.
   */
  /**
   * SlangShot in der Detailansicht: Video (Master) und SlangTag-Audio starten
   * gemeinsam bei 0 – ausschliesslich per Playbutton, nie automatisch.
   */
  const shotTagId = post?.video ? post.placements[0]?.tagId : undefined;
  const shotAudio = shotTagId ? (getTag(shotTagId)?.audio ?? null) : null;
  const shot = useShotSync({
    audioSrc: shotAudio,
    videoSrc: post?.video ?? null,
    loop: false,
  });
  const toggleShot = () => {
    if (shot.playing) {
      shot.pause();
      return;
    }
    if (shot.audioRef.current && post)
      claimBus(`shot:${post.id}`, shot.audioRef.current, shot.pause);
    shot.toggle();
  };
  useEffect(() => () => stopAll(), []);

  const synced = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!post || synced.current.has(post.id)) return;
    synced.current.add(post.id);
    void syncPost(post.id);
    void registerView(post.id);
    // SlangTag Videos zaehlen zusaetzlich einen Videoaufruf.
    if (post.video) void registerVideoView(post.id);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Scroll-Sperre synchron VOR dem ersten Paint setzen. Wird sie erst in einem
   * `useEffect` gesetzt, kann der Hintergrund in den ersten Frames noch
   * mitscrollen – auf Android wirkt die Ansicht dadurch kurz „verschiebbar“.
   */
  useLayoutEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /**
   * Gesten erst freigeben, wenn Layout und Öffnungsanimation fertig sind.
   * Verhindert das Nachjustieren/Verschieben beim allerersten Öffnen.
   */
  const ready = useRef(false);
  useLayoutEffect(() => {
    const t = window.setTimeout(() => {
      ready.current = true;
    }, 360);
    return () => window.clearTimeout(t);
  }, []);

  /** FLIP-Zoom: startet im Feed-Rechteck und fährt flüssig in die Detailansicht */
  useLayoutEffect(() => {
    const el = mediaRef.current;
    if (!el || !originRect) return;
    const target = el.getBoundingClientRect();
    if (!target.width || !target.height) return;
    const sx = originRect.width / target.width;
    const sy = originRect.height / target.height;
    el.style.transformOrigin = "top left";
    el.style.transition = "none";
    el.style.transform = `translate(${originRect.left - target.left}px, ${originRect.top - target.top}px) scale(${sx}, ${sy})`;
    el.style.opacity = "0.6";
    requestAnimationFrame(() => {
      el.style.transition = "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out";
      el.style.transform = "translate(0,0) scale(1)";
      el.style.opacity = "1";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    const el = mediaRef.current;
    setClosing(true);
    if (el && originRect) {
      const target = el.getBoundingClientRect();
      const sx = originRect.width / target.width;
      const sy = originRect.height / target.height;
      el.style.transition = "transform 260ms cubic-bezier(0.4,0,0.2,1), opacity 220ms ease-in";
      el.style.transform = `translate(${originRect.left - target.left}px, ${originRect.top - target.top}px) scale(${sx}, ${sy})`;
      el.style.opacity = "0";
      setTimeout(onClose, 240);
      return;
    }
    setTimeout(onClose, 120);
  };

  /**
   * Feste Detailansicht: der geöffnete Beitrag bleibt stehen. Es gibt bewusst
   * keine horizontale Wischgeste und keinen Beitragswechsel innerhalb der
   * Ansicht – geschlossen wird über X, Escape oder den Hintergrund.
   */
  const cardRef = useRef<HTMLDivElement | null>(null);

  /**
   * Tastatursteuerung: der Listener wird genau einmal registriert. Die
   * aktuellen Callbacks kommen über eine Ref, damit nicht bei jedem Render
   * ein neuer `keydown`-Listener an das Fenster gehängt wird.
   */
  const keyActions = useRef({ close });
  keyActions.current = { close };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Beim Schreiben (Kommentarfeld, SlangTag-Suche) darf die Tastatur nicht
      // die Beitragsnavigation steuern – sonst springt der Cursor weg.
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable ||
          !!el.closest("input, textarea, [contenteditable='true']"));
      if (typing) return;
      // Nur Schliessen – keine Navigation zwischen Beiträgen in der Detailansicht.
      if (e.key === "Escape") keyActions.current.close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const placedTags = useMemo(
    () => (post?.placements ?? []).map((p) => getTag(p.tagId)).filter(Boolean),
    [post, getTag],
  );

  if (!post) return null;

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const tagIds = collectTagIds(text, getTag, insertedTags.current);
    setDraft("");
    insertedTags.current = [];
    await addComment(post.id, text, tagIds);
  };

  const openShare = () => {
    if (!isShareable(post.visibility)) {
      toast.error("Private Beiträge können nicht geteilt werden.");
      return;
    }
    setShareOpen(true);
  };

  const openComments = () => {
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div
      /* Gleicher tiefschwarzer Untergrund wie der Feed – keine Lightbox-Optik,
         kein Blur, keine fremde Oberflaeche. Der Feed bleibt dahinter bestehen. */
      className={`fixed inset-0 z-[120] overflow-y-auto bg-black transition-opacity duration-200 ${
        closing ? "opacity-0" : "animate-fade-in opacity-100"
      }`}
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      {/* Safe Areas (Notch/Statusleiste, Home-Indicator) werden respektiert,
          damit der Schliessen-Button oben rechts mobil immer erreichbar ist. */}
      <div
        className="mx-auto flex min-h-full max-w-3xl items-start justify-center px-3"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)",
          paddingLeft: "calc(env(safe-area-inset-left, 0px) + 0.75rem)",
          paddingRight: "calc(env(safe-area-inset-right, 0px) + 0.75rem)",
        }}
      >
        <div
          ref={cardRef}
          onClick={(e) => e.stopPropagation()}
          style={{ touchAction: "pan-y" }}
          /* Kartenoptik identisch zur Feed-Karte */
          className="w-full overflow-hidden rounded-xl border border-border bg-background/60"
        >
          {/* Ersteller */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-black px-3 py-2.5">
            <Link
              to="/profile/$username"
              params={{ username: post.author.username }}
              className="group flex items-center gap-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/50 bg-gradient-to-br from-brand to-brand-cyan">
                {post.author.avatar ? (
                  <img
                    src={post.author.avatar}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-black text-black">
                    {post.author.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold group-hover:text-brand">
                  @{post.author.username}
                  {post.author.verified && <BadgeCheck className="h-4 w-4 text-brand-cyan" />}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {post.region || "—"}
                  <VisibilityBadge
                    visibility={post.visibility}
                    label={visibilityLabel(post.visibility, t as unknown as Record<string, string>)}
                  />
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <ReportMenu targetType="post" targetId={post.id} targetUserId={post.userId} />
              {/* Schliessen: direkt neben dem Beitragsmenü (•••), immer gemeinsam
                  ausgerichtet und dank sticky-Kopfzeile fest an derselben Stelle. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={t.close}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground hover:border-brand/60 hover:text-brand"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Bild groß, SlangTags in Originalposition & interaktiv */}
          <div className="px-3 py-3">
            <div ref={mediaRef} className="will-change-transform">
              {/* Bild + SlangTag-Ebene (inkl. Glas-/Blur-Flaeche der Chips) nutzen
                  dieselbe Transformationsmatrix: Pinch-Zoom und Verschieben bleiben
                  pixelgenau synchron. SlangShots bleiben fix, damit Video und Ton
                  exakt synchron laufen. */}
              {post.image ? (
                <SlangTagCanvas
                  image={postFullImage(post) ?? ""}
                  video={post.video ?? null}
                  videoRef={post.video ? shot.videoRef : undefined}
                  videoControlled={!!post.video}
                  videoLoop={false}
                  overlay={
                    post.video ? (
                      <ShotPlayButton
                        playing={shot.playing}
                        preparing={shot.preparing}
                        onToggle={toggleShot}
                        label={t.play}
                        pauseLabel={t.pause}
                      />
                    ) : undefined
                  }
                  fallbackImage={post.image}
                  placements={post.placements}
                  zoomable={!post.video}
                  zoomOriginal={post.image}
                  onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                  className="bg-black"

                />
              ) : (
                <div className="grid h-52 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                  {t.noImage}
                </div>
              )}
            </div>

            {/* Informationszeile: SlangTag-Titel links, kompakte Statistiken rechts */}
            <div className="mt-2 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <h2 className="min-w-0 text-base font-black tracking-tight">{post.title}</h2>
                <PostStatsBar
                  postId={post.id}
                  likes={post.stats.likes}
                  comments={post.stats.comments}
                  shares={post.stats.shares}
                  views={post.stats.views}
                  onOpenComments={openComments}
                />
              </div>
              {post.description && (
                <p className="text-sm leading-snug text-foreground/90">
                  <SlangText
                    text={post.description}
                    onOpenTag={(tag) =>
                      navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                    }
                  />
                </p>
              )}
              <TagRow
                hashtags={post.hashtags}
                tags={placedTags.filter((t): t is NonNullable<typeof t> => Boolean(t))}
                onOpenTag={(tag) =>
                  navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                }
                onOpenHashtag={(h) => navigate({ to: "/hashtag/$name", params: { name: h } })}
              />

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {formatDate(post.createdAt)}
                </span>
                {post.region && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{post.region}</span>
                  </span>
                )}
              </div>
            </div>


            <div className="mt-2 flex items-center gap-4 border-t border-border pt-2 text-sm text-muted-foreground">
              <button
                onClick={() => void togglePostLike(post.id)}
                className={`inline-flex items-center gap-1.5 ${liked ? "text-brand" : "hover:text-foreground"}`}
              >
                <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {t.like}
              </button>
              <button
                onClick={openShare}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Share2 className="h-4 w-4" /> {t.share}
              </button>
              <button
                onClick={() => void togglePostSave(post.id)}
                aria-label={t.saveAction}
                className={`ml-auto ${saved ? "text-brand-cyan" : "hover:text-foreground"}`}
              >
                <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* Kommentare (kompakt: max. 2 sichtbar, Sortierung wählbar) */}
            <div ref={commentsRef} className="mt-2 space-y-2">
              {comments.length === 0 && (
                <p className="text-xs italic text-muted-foreground">{t.noComments}</p>
              )}
              {comments.length > 0 && (
                <CommentList comments={comments} profiles={profiles} unknownLabel={t.unknown} />
              )}

              <div className="flex items-center gap-2 pt-1">
                <div
                  className="min-w-0 flex-1 cursor-text rounded-2xl border border-border bg-background px-3 py-1.5 focus-within:border-brand"
                  onMouseDown={(e) => {
                    // Klick auf Rand/Innenabstand fokussiert das Eingabefeld.
                    if (e.target !== e.currentTarget) return;
                    e.preventDefault();
                    const el = e.currentTarget.querySelector("input");
                    el?.focus();
                    el?.setSelectionRange(el.value.length, el.value.length);
                  }}
                >
                  <SlangTagField
                    value={draft}
                    onChange={setDraft}
                    onTagInserted={(tag) => {
                      insertedTags.current = [
                        ...insertedTags.current.filter((x) => x.id !== tag.id),
                        tag,
                      ];
                    }}
                    onSubmit={() => void submit()}
                    region={post.region}
                    keepFocus
                    placeholder={t.commentPh}
                    aria-label={t.commentPh}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!draft.trim()}
                  className="text-xs font-bold uppercase tracking-wider text-brand disabled:opacity-40"
                >
                  {t.send}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {shareOpen && (
        <ShareSheet
          payload={{
            url: postShareUrl(post.id),
            title: shareTitle(post.title, post.description),
            author: post.author.displayName || post.author.username,
            image: postShareImage(post),
          }}
          onShared={() => void sharePost(post.id)}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
