import { CloseButton } from "@/components/ui/nav-buttons";
import { isRedundantTitle } from "@/lib/post-caption";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { Heart, Share2, MapPin, Clock, BadgeCheck, Bookmark } from "lucide-react";

import { toast } from "sonner";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { useShotSync } from "@/lib/video/use-shot-sync";
import { ShotPlayButton } from "@/components/ShotPlayButton";
import { claimBus, stopAll } from "@/lib/autoplay";
import { TagRow } from "@/components/TagRow";
import { SlangTagOrderStrip } from "@/components/SlangTagOrderStrip";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { usePostTranslation } from "@/lib/use-post-translation";
import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { collectTagIds } from "@/lib/slangtag-ui";
import { formatDate, type Post, type SlangTag } from "@/lib/types";
import { CommentList } from "@/components/CommentList";

import { VisibilityBadge } from "@/components/VisibilityBadge";
import { visibilityLabel } from "@/lib/visibility";
import { ReportMenu } from "@/components/ReportDialog";
import { PostEditDialog } from "@/components/PostEditDialog";
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
  /** true = Like-Liste direkt geöffnet (Sprung aus einer Like-Benachrichtigung). */
  openLikers?: boolean;
};

export function PostDetailOverlay({
  posts,
  index,
  onClose,
  originRect: _originRect,
  openLikers = false,
}: Props) {
  const post = posts[index];
  const navigate = useNavigate();
  const { t } = useLang();
  // Anzeige in der Sprache des Nutzers; Original bleibt Fallback.
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
    user,
  } = useData();
  // Eigene Beiträge bleiben immer in der Originalsprache des Erstellers.
  const tr = usePostTranslation({ ...post, own: Boolean(user && post?.userId === user.id) });
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
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
  // Video-Beitrag V1 (max. 60 s, eigene Tonspur) laeuft ueber den Player.
  const isVideoPost = !!post?.video && post?.videoKind === "post";
  const isShot = !!post?.video && !isVideoPost;
  const shotTagId = isShot ? post?.placements[0]?.tagId : undefined;
  const shotAudio = shotTagId ? (getTag(shotTagId)?.audio ?? null) : null;
  const shot = useShotSync({
    audioSrc: shotAudio,
    videoSrc: isShot ? (post?.video ?? null) : null,
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
   * Gesten sind sofort verfügbar – es gibt keine Öffnungsanimation.
   */
  const ready = useRef(false);
  useLayoutEffect(() => {
    ready.current = true;
  }, []);

  const close = () => {
    onClose();
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

  /**
   * Abspielreihenfolge der SlangTags. Grundlage ist immer die gespeicherte
   * Reihenfolge des Beitrags. Bei offenem Schloss darf der Zuschauer sie nur
   * fuer die eigene Wiedergabe umsortieren – gespeichert wird dabei nichts.
   */
  const [viewerOrder, setViewerOrder] = useState<string[] | null>(null);
  useEffect(() => setViewerOrder(null), [post?.id]);
  const orderLocked = post?.slangtagOrderLocked ?? true;
  const orderedTags = useMemo(() => {
    const base =
      (post?.slangTagIds?.length ? post.slangTagIds : post?.placements.map((p) => p.tagId)) ?? [];
    const ids = !orderLocked && viewerOrder ? viewerOrder : base;
    return ids
      .map((id) => getTag(id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));
  }, [post, getTag, orderLocked, viewerOrder]);

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
      className="fixed inset-0 z-[120] overflow-y-auto bg-black"
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
              <ReportMenu
                targetType="post"
                targetId={post.id}
                targetUserId={post.userId}
                editLabel={t.editPostTitle}
                onEdit={user && post.userId === user.id ? () => setEditOpen(true) : undefined}
              />
              {/* Schliessen: direkt neben dem Beitragsmenü (•••), immer gemeinsam
                  ausgerichtet und dank sticky-Kopfzeile fest an derselben Stelle. */}
              <CloseButton
                onClick={(e) => {
                  e.stopPropagation();
                  close();
                }}
                label={t.close}
                className="shrink-0"
              />
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
                  videoRef={isShot ? shot.videoRef : undefined}
                  videoControlled={isShot}
                  videoLoop={false}
                  videoWithSound={isVideoPost}
                  videoPoster={postFullImage(post) ?? null}
                  overlay={
                    isShot ? (
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
              <div
                className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1"
                ref={tr.ref as (n: HTMLDivElement | null) => void}
              >
                {isRedundantTitle(tr.title, tr.description) ? (
                  <span className="min-w-0" />
                ) : (
                  <h2 className="min-w-0 text-base font-black tracking-tight">{tr.title}</h2>
                )}
                <PostStatsBar
                  postId={post.id}
                  likes={post.stats.likes}
                  comments={post.stats.comments}
                  shares={post.stats.shares}
                  views={post.stats.views}
                  onOpenComments={openComments}
                  openLikersInitially={openLikers}
                />
              </div>
              {tr.description && (
                <p className="text-sm leading-snug text-foreground/90">
                  <SlangText
                    text={tr.description}
                    onOpenTag={(tag) =>
                      navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                    }
                  />
                </p>
              )}
              {tr.canToggle && (
                <button
                  type="button"
                  onClick={tr.toggle}
                  className="text-[11px] text-muted-foreground/80 underline-offset-2 hover:text-brand hover:underline"
                >
                  {tr.toggleLabel}
                </button>
              )}
              <TagRow
                hashtags={post.hashtags}
                tags={placedTags.filter((t): t is NonNullable<typeof t> => Boolean(t))}
                onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
                onOpenHashtag={(h) => navigate({ to: "/hashtag/$name", params: { name: h } })}
              />

              {orderedTags.length > 0 && (
                <SlangTagOrderStrip
                  owner={`post-order-${post.id}`}
                  tags={orderedTags}
                  sortable={!orderLocked && orderedTags.length > 1}
                  lockedNote={orderLocked}
                  onReorder={setViewerOrder}
                  onReset={viewerOrder ? () => setViewerOrder(null) : undefined}
                />
              )}

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
                <CommentList
                  comments={comments}
                  profiles={profiles}
                  unknownLabel={t.unknown}
                  viewerId={user?.id ?? null}
                />
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

      <PostEditDialog post={editOpen && post ? post : null} onClose={() => setEditOpen(false)} />
    </div>
  );
}
