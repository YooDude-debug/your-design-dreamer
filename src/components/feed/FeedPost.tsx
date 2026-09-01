/**
 * Feed-Beitragskarte (aus `src/routes/_authenticated/dev.tsx` herausgelöst).
 *
 * Reine Darstellung eines Beitrags im Feed inklusive Sichtbarkeitsmelder.
 * Verhalten unverändert – nur der Ort im Projekt hat sich geändert.
 */
import { useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useMemo, useEffect, useCallback, memo, type ReactNode } from "react";
import {
  useAutoPlay,
  playExclusive,
  stopOwner,
  stopAll,
  isOwnerPlaying,
  isAutoPlayVisible,
  claimBus,
  getAudio,
} from "@/lib/autoplay";
import { useShotSync } from "@/lib/video/use-shot-sync";
import { useViewportVideo } from "@/lib/video/viewport-video";
import { ShotPlayButton } from "@/components/ShotPlayButton";
import { BadgeCheck, ImageOff } from "lucide-react";
import { MarketMatchStrip } from "@/components/market/MarketMatchStrip";
import { useLang } from "@/lib/lang-context";
import { isRedundantTitle } from "@/lib/post-caption";
import { usePostTranslation } from "@/lib/use-post-translation";
import { useData } from "@/lib/data-context";
import { relativeTime, type Post, type SlangTag } from "@/lib/types";
import { CommentList } from "@/components/CommentList";
import { VisibilityBadge } from "@/components/VisibilityBadge";
import { visibilityLabel } from "@/lib/visibility";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagOrderStrip } from "@/components/SlangTagOrderStrip";
import { TagRow } from "@/components/TagRow";
import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { collectTagIds } from "@/lib/slangtag-ui";
import { PostActionOverlay } from "@/components/feed/PostActionOverlay";
import { ReportMenu } from "@/components/ReportDialog";
import { PostModerationNotice, isPostUnderReview } from "@/components/PostModerationNotice";
import { ShareSheet } from "@/components/ShareSheet";
import { PostEditDialog } from "@/components/PostEditDialog";
import { isShareable, postShareUrl, shareTitle } from "@/lib/share";
import { toast } from "sonner";
import { postCardImage, postShareImage } from "@/lib/media";

/** Ein echter Beitrag im Feed – alle Zahlen kommen aus der Datenbank. */
function FeedPostBase({
  post,
  index,
  onOpen,
  scrollRoot,
}: {
  post: Post;
  index: number;
  /** Stabile Referenz: der Beitrag muss dafür nicht neu gerendert werden. */
  onOpen: (rect: DOMRect, post: Post, index: number) => void;
  scrollRoot?: HTMLElement | null;
}) {
  const navigate = useNavigate();
  const { t } = useLang();

  const {
    getTag,
    likedPosts,
    savedPosts,
    sharedPosts,
    togglePostLike,
    togglePostSave,
    sharePost,
    commentsByPost,
    loadComments,
    addComment,
    profiles,
    registerPlay,
    registerView,
    user,
  } = useData();
  // Anzeige in der Sprache des Nutzers; Original bleibt Fallback und in der DB.
  // Eigene Beiträge bleiben immer in der Originalsprache des Erstellers.
  const tr = usePostTranslation({ ...post, own: Boolean(user && post.userId === user.id) });
  /** Detailansicht öffnen – Beitrag und Position kommen aus diesem Beitrag. */
  const open = useCallback((rect: DOMRect) => onOpen(rect, post, index), [onOpen, post, index]);
  const [showComments, setShowComments] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const articleRef = useRef<HTMLElement | null>(null);
  /** Im Kommentarfeld eingefügte SlangTags (auch neu aufgenommene). */
  const insertedTags = useRef<SlangTag[]>([]);

  const { autoPlay } = useAutoPlay();

  const liked = likedPosts.includes(post.id);
  const saved = savedPosts.includes(post.id);
  const shared = sharedPosts.includes(post.id);
  const comments = commentsByPost[post.id] ?? [];
  const tags = post.slangTagIds.map((id) => getTag(id)).filter(Boolean);

  /**
   * Erster nutzbarer SlangTag des Beitrags (Kommentare bleiben ausgeschlossen).
   * Fremde SlangTags sind nur fuer die Weiterverwendung gesperrt – anhoeren
   * bzw. automatisch abspielen ist immer erlaubt.
   */
  const autoTag = tags.find((tag) => !!tag?.audio);

  /**
   * Reihenfolge der SlangTags im Feed. Bei gesperrtem Schloss gilt immer die
   * gespeicherte Reihenfolge des Erstellers; bei offenem Schloss darf der
   * Zuschauer sie nur fuer die eigene Wiedergabe umsortieren (nicht gespeichert).
   */
  const orderLocked = post.slangtagOrderLocked ?? true;
  const [viewerOrder, setViewerOrder] = useState<string[] | null>(null);
  const orderedTags = useMemo(() => {
    const base = post.slangTagIds.length ? post.slangTagIds : post.placements.map((p) => p.tagId);
    const ids = !orderLocked && viewerOrder ? viewerOrder : base;
    return ids.map((id) => getTag(id)).filter((tag): tag is SlangTag => Boolean(tag));
  }, [post.slangTagIds, post.placements, orderLocked, viewerOrder, getTag]);

  /**
   * SlangShot (Video + aktuell ausgewaehlter SlangTag) ist eine
   * Wiedergabe-Einheit: Video ist Master-Zeitquelle, das SlangTag-Audio startet
   * nie separat. Die bestehende SlangTag-AutoPlay-Einstellung gilt auch hier:
   * ist sie aktiv, startet der sichtbare SlangShot automatisch, sonst nur per
   * Playbutton.
   */
  // Video-Beitrag V1 (max. 60 s, eigene Tonspur) ist kein SlangShot.
  const isVideoPost = !!post.video && post.videoKind === "post";
  const isShot = !!post.video && !isVideoPost;
  const shot = useShotSync({
    audioSrc: isShot ? (autoTag?.audio ?? null) : null,
    videoSrc: isShot ? (post.video ?? null) : null,
    loop: false,
  });
  /** Stabile Referenz, damit der Observer nicht bei jedem Statuswechsel neu bindet. */
  const shotRef = useRef(shot);
  shotRef.current = shot;

  /**
   * Video-Beitrag (eigene Tonspur): viewport-basierte Wiedergabe ueber den
   * zentralen Controller – stummer Autostart beim Sichtwerden, Pause beim
   * Verlassen, immer nur ein Video gleichzeitig.
   */
  const postVideoRef = useRef<HTMLVideoElement | null>(null);
  useViewportVideo(postVideoRef, {
    enabled: isVideoPost,
    root: scrollRoot ?? null,
    src: post.video ?? null,
  });

  /**
   * Aufruf zählen, sobald der Beitrag wirklich im Feed sichtbar war
   * (>= 50 % für 1 s). `registerView` entprellt zusätzlich pro Sitzung und die
   * Datenbank verhindert Doppelzählungen pro Nutzer und Beitrag – schnelles
   * Scrollen, Feed-Updates oder erneutes Mounten lösen also keine weiteren
   * Anfragen aus.
   */
  useEffect(() => {
    const el = articleRef.current;
    if (!el || !user) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timer !== undefined) return;
          timer = window.setTimeout(() => {
            timer = undefined;
            void registerView(post.id);
            io.disconnect();
          }, 1000);
        } else if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
      },
      { root: scrollRoot ?? null, threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      io.disconnect();
    };
  }, [post.id, user, scrollRoot, registerView]);

  /** Gemeinsamer Start-Trigger: Video + SlangTag bei 0. */
  const toggleShot = () => {
    const owner = `post:${post.id}`;
    if (shot.playing) {
      shot.pause();
      return;
    }
    if (shot.audioRef.current) claimBus(owner, shot.audioRef.current, shot.pause);
    shot.toggle();
    if (autoTag) void registerPlay(autoTag.id);
  };

  /**
   * Normale Beitraege (kein SlangShot): die bestehende Wellenform wird an das
   * tatsaechlich laufende SlangTag-Audio gekoppelt – auch wenn AutoPlay es
   * startet. Kein zusaetzlicher Klick, keine unabhaengige CSS-Animation.
   */
  const [tagPlaying, setTagPlaying] = useState(false);
  const [tagMedia, setTagMedia] = useState<HTMLMediaElement | null>(null);

  /** Startet das SlangTag-Audio exklusiv und meldet es fuer die Wellenform an. */
  const startTagAudio = useCallback((owner: string, src: string) => {
    playExclusive(owner, src, () => setTagPlaying(false));
    const audio = getAudio(src);
    claimBus(owner, audio, () => setTagPlaying(false));
    setTagMedia(audio);
    setTagPlaying(true);
  }, []);

  const toggleTagAudio = () => {
    if (!autoTag?.audio) return;
    const owner = `post:${post.id}`;
    if (tagPlaying || isOwnerPlaying(owner)) {
      stopOwner(owner);
      setTagPlaying(false);
      return;
    }
    startTagAudio(owner, autoTag.audio);
    void registerPlay(autoTag.id);
  };

  /** AutoPlay: spielt beim Sichtbarwerden, stoppt beim Verlassen. Nur ein Tag gleichzeitig. */
  useEffect(() => {
    const el = articleRef.current;
    if (!el || !autoTag?.audio) return;
    // Ohne AutoPlay muss der Shot beim Verlassen dennoch stoppen -> Observer
    // bleibt aktiv, startet aber nur bei aktivem AutoPlay.
    if (!autoPlay && !isShot) return;
    const owner = `post:${post.id}`;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (isAutoPlayVisible(entry)) {
          if (!autoPlay) return;
          if (isOwnerPlaying(owner)) return;
          if (isShot) {
            // Einheit gemeinsam bei 0 starten und im Audio-Bus anmelden,
            // damit nie zwei Quellen gleichzeitig laufen.
            if (shotRef.current.audioRef.current) {
              claimBus(owner, shotRef.current.audioRef.current, shotRef.current.pause);
            } else {
              stopAll();
            }
            shotRef.current.play();
            void registerPlay(autoTag.id);
          } else {
            startTagAudio(owner, autoTag.audio!);
            void registerPlay(autoTag.id);
          }
        } else {
          if (isShot) shotRef.current.pause();
          stopOwner(owner);
          setTagPlaying(false);
        }
      },
      { root: scrollRoot ?? null, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );

    io.observe(el);
    return () => {
      io.disconnect();
      if (isShot) shotRef.current.pause();
      stopOwner(owner);
      setTagPlaying(false);
    };
  }, [
    autoPlay,
    autoTag?.id,
    autoTag?.audio,
    post.id,
    scrollRoot,
    registerPlay,
    isShot,
    startTagAudio,
  ]);

  const openComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments(post.id);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    const tagIds = collectTagIds(text, getTag, insertedTags.current);
    setDraft("");
    insertedTags.current = [];
    await addComment(post.id, text, tagIds);
  };

  /** Eigener Beitrag noch in Prüfung → dezent ausgegraut (nicht deaktiviert). */
  const underReview = isPostUnderReview(post, user?.id);

  return (
    <article
      ref={articleRef}
      data-post-id={post.id}
      // `auto` merkt sich die zuletzt gerenderte Höhe. Ohne das fallen
      // ausgeblendete Karten auf 520px zurück und der Feed springt.
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 520px" }}
      className={`feed-card overflow-hidden transition-opacity duration-300 ${
        underReview ? "opacity-70" : "opacity-100"
      }`}
    >
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
        <Link
          to="/profile/$username"
          params={{ username: post.author.username }}
          className="group flex min-w-0 items-center gap-2.5"
        >
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-cyan">
            {post.author.avatar && (
              <img
                src={post.author.avatar}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1 text-sm font-semibold leading-tight group-hover:text-brand">
              <span className="truncate">@{post.author.username}</span>
              {post.author.verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-cyan" />
              )}
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{post.region || "—"}</span>
              <span aria-hidden className="shrink-0 opacity-50">
                ·
              </span>
              <span className="shrink-0 whitespace-nowrap">{relativeTime(post.createdAt)}</span>
            </div>
          </div>
        </Link>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:gap-1.5 sm:text-xs">
          <VisibilityBadge
            visibility={post.visibility}
            label={visibilityLabel(post.visibility, t as unknown as Record<string, string>)}
          />
          <ReportMenu
            targetType="post"
            targetId={post.id}
            targetUserId={post.userId}
            editLabel={t.editPostTitle}
            onEdit={user && post.userId === user.id ? () => setEditOpen(true) : undefined}
          />
        </span>
      </header>

      <PostModerationNotice post={post} ownUserId={user?.id} />

      {post.image ? (
        <div
          onClick={(e) => open((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="relative block w-full cursor-pointer px-2 text-left"
        >
          <SlangTagCanvas
            frameAspect={4 / 5}
            image={postCardImage(post) ?? ""}
            video={post.video ?? null}
            videoRef={isShot ? shot.videoRef : isVideoPost ? postVideoRef : undefined}
            videoControlled={isShot}
            videoLoop={false}
            videoWithSound={isVideoPost}
            videoPoster={postCardImage(post) ?? null}
            overlay={
              isShot ? (
                <ShotPlayButton
                  playing={shot.playing}
                  preparing={shot.preparing}
                  onToggle={toggleShot}
                  label={t.play ?? "Play"}
                  pauseLabel={t.pause ?? "Pause"}
                />
              ) : undefined
            }
            fallbackImage={post.image}
            placements={post.placements}
            {...(autoTag
              ? isShot
                ? {
                    // Bestehende SlangTag-Wellenform wiederverwenden: sie folgt
                    // direkt dem laufenden SlangShot-Audio.
                    activeTagId: autoTag.id,
                    activePlaying: shot.playing,
                    activeMedia: shot.audio,
                    onActiveToggle: toggleShot,
                  }
                : {
                    // Normaler Beitrag: gleiche Wellenform, gekoppelt an das
                    // real laufende SlangTag-Audio (auch bei AutoPlay).
                    activeTagId: autoTag.id,
                    activePlaying: tagPlaying,
                    activeMedia: tagMedia,
                    onActiveToggle: toggleTagAudio,
                  }
              : {})}
            onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
          />
          <PostActionOverlay
            post={post}
            liked={liked}
            saved={saved}
            shared={shared}
            onLike={() => void togglePostLike(post.id)}
            onComment={() => void openComments()}
            onShare={() => {
              if (!isShareable(post.visibility)) {
                toast.error("Private Beiträge können nicht geteilt werden.");
                return;
              }
              setShareOpen(true);
            }}
            onSave={() => void togglePostSave(post.id)}
          />
        </div>
      ) : (
        <div className="relative mx-3 grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          <ImageOff className="h-4 w-4" />
          <PostActionOverlay
            post={post}
            liked={liked}
            saved={saved}
            shared={shared}
            onLike={() => void togglePostLike(post.id)}
            onComment={() => void openComments()}
            onShare={() => {
              if (!isShareable(post.visibility)) {
                toast.error("Private Beiträge können nicht geteilt werden.");
                return;
              }
              setShareOpen(true);
            }}
            onSave={() => void togglePostSave(post.id)}
          />
        </div>
      )}

      <div className="px-3 pt-2" ref={tr.ref as (n: HTMLDivElement | null) => void}>
        {/* Titel nur zeigen, wenn er nicht bloss der Anfang der Beschreibung ist. */}
        {!isRedundantTitle(tr.title, tr.description) && (
          <button
            type="button"
            onClick={(e) => open((e.currentTarget as HTMLElement).getBoundingClientRect())}
            className="text-left text-base font-semibold leading-tight hover:text-brand"
          >
            {tr.title}
          </button>
        )}
        {tr.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            <SlangText
              text={tr.description}
              onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
            />
          </p>
        )}
        {/* Dezenter Hinweis, sobald eine Übersetzung angezeigt wird. */}
        {tr.canToggle && (
          <button
            type="button"
            onClick={tr.toggle}
            className="mt-1 text-[11px] text-muted-foreground/80 underline-offset-2 hover:text-brand hover:underline"
          >
            {tr.toggleLabel}
          </button>
        )}

        <TagRow
          hashtags={post.hashtags}
          tags={
            orderedTags.length > 0 ? [] : tags.filter((t): t is NonNullable<typeof t> => Boolean(t))
          }
          onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
          onOpenHashtag={(h) => navigate({ to: "/hashtag/$name", params: { name: h } })}
          className="mt-2"
        />
        {/* Reihenfolge + Play All direkt im Feed (bei Schloss nicht sortierbar) */}
        {orderedTags.length > 0 && (
          <SlangTagOrderStrip
            className="mt-2"
            owner={`feed-order:${post.id}`}
            tags={orderedTags}
            sortable={!orderLocked && orderedTags.length > 1}
            lockedNote={orderLocked}
            onReorder={setViewerOrder}
            onReset={viewerOrder ? () => setViewerOrder(null) : undefined}
          />
        )}
      </div>

      {showComments && (
        <div className="space-y-2 border-t border-border/60 bg-background/40 px-3 py-3">
          {comments.length === 0 && (
            <div className="text-xs italic text-muted-foreground">{t.noComments}</div>
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
              className="min-w-0 flex-1 cursor-text rounded-2xl border border-border bg-surface/60 px-3 py-1.5 focus-within:border-brand"
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
                placeholder={t.commentPh}
                region={post.region}
                keepFocus
                aria-label={t.commentPh}
              />
            </div>

            <button
              type="button"
              onClick={() => void submit()}
              disabled={!draft.trim()}
              className="tap-safe shrink-0 rounded-lg px-2 text-xs font-bold uppercase tracking-wider text-brand disabled:opacity-40"
            >
              {t.send}
            </button>
          </div>
        </div>
      )}

      {/* Passende Market-Angebote – nur bei Channel-Beiträgen mit Suchabsicht. */}
      {post.channelId && (
        <MarketMatchStrip text={`${post.title ?? ""} ${post.description ?? ""}`} />
      )}

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

      <PostEditDialog post={editOpen ? post : null} onClose={() => setEditOpen(false)} />
    </article>
  );
}

/**
 * Ein Beitrag rendert nur neu, wenn sich sein eigener Datensatz, seine Position
 * oder der Feed-Container ändert. Globale Zustandswechsel (Werbeplan, Zähler,
 * Nachladen weiter unten) lassen bestehende Karten unangetastet.
 */
export const FeedPost = memo(FeedPostBase);

/**
 * Meldet einmalig, wenn der eingeschlossene Beitrag wirklich gesehen wurde:
 * mindestens 50 % Fläche für mindestens 800 ms im Feed sichtbar. Reine
 * Datenabfragen (Live-Refresh) lösen das niemals aus.
 */
export function SeenWatcher({
  root,
  enabled,
  onSeen,
  children,
}: {
  root: HTMLElement | null;
  enabled: boolean;
  onSeen: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const done = useRef(false);
  // Callback in einer Ref: der Beobachter wird nicht bei jedem Render neu gestartet.
  const cb = useRef(onSeen);
  cb.current = onSeen;

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || done.current) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (timer === undefined) {
              timer = window.setTimeout(() => {
                done.current = true;
                io.disconnect();
                cb.current();
              }, 800);
            }
          } else if (timer !== undefined) {
            window.clearTimeout(timer);
            timer = undefined;
          }
        }
      },
      { root: root ?? null, threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      io.disconnect();
    };
  }, [enabled, root]);

  return <div ref={ref}>{children}</div>;
}
