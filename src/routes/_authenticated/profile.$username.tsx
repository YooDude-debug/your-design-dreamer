import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  MapPin,
  Lock,
  Globe,
  Heart,
  MessageCircle,
  UserPlus,
  Plus,
  Check,
  Clock,
  MessageSquare,
  Users,
  Pencil,
  Trash2,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileAbout } from "@/components/ProfileAbout";
import { FollowersDialog } from "@/components/FollowersDialog";
import { ShareSheet } from "@/components/ShareSheet";
import { profileShareUrl } from "@/lib/share";
import { loadProfileStats, peekProfileStats } from "@/lib/profile-extra";
import { invalidateClientCache } from "@/lib/client-cache";

import { profileTexts } from "@/lib/i18n-profile";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangText } from "@/components/SlangTagInput";
import { useSocial } from "@/lib/social-context";
import { useSocialUI } from "@/lib/social-ui-context";
import { formatCount, formatDate, formatStat, type Post } from "@/lib/types";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { PostEditDialog } from "@/components/PostEditDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AccountTypeBadge } from "@/components/AccountTypeBadge";
import { AvatarGlowRing } from "@/components/AvatarGlow";
import { ScrollPane, LazyItem, useIncrementalList } from "@/components/ScrollPane";
import { postCardImage } from "@/lib/media";
import { CreatorSlangTagsSection } from "@/components/CreatorSlangTagsDialog";
import { loadProfileDetails } from "@/lib/profile-extra";
import { PresenceSlider, PresenceReadOnly } from "@/components/PresenceSlider";

export const Route = createFileRoute("/_authenticated/profile/$username")({
  head: () => ({
    meta: [
      { title: "Profil — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Profil mit Bio, Statistiken, Beiträgen und eigenen SlangTags.",
      },
      { property: "og:title", content: "Profil — Y-Dude" },
      {
        property: "og:description",
        content: "Bio, Statistiken, Beiträge und SlangTags dieses Y-Dude Profils.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

type StatSection = "tags" | "connections" | "posts" | "followers";

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const {
    profiles,
    posts,
    tags,
    loading,
    isAdmin,
    deletePost,
    isFollowing,
    follow,
    unfollow,
    ensureProfileDirectory,
    me,
    updateMyProfile,
  } = useData();

  const {
    relationWith,
    connectionOf,
    connectionCount,
    mutualConnections,
    connectedIds,
    sendRequest,
    acceptRequest,
    declineRequest,
  } = useSocial();
  const { openMessenger, openConnections } = useSocialUI();
  const [postSort, setPostSort] = useState<"date" | "popular">("date");
  const [section, setSection] = useState<StatSection>("tags");
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followersOpen, setFollowersOpen] = useState(false);

  /**
   * Rollen des angezeigten Profils – getrennt gefuehrt, damit ein reines
   * Unternehmer-Profil keine Creator-Bereiche zeigt (und umgekehrt).
   */
  const [profileRoles, setProfileRoles] = useState<{ creator: boolean; business: boolean }>({
    creator: false,
    business: false,
  });

  const postsSectionRef = useRef<HTMLElement | null>(null);

  /**
   * Statistik-Karten verknüpfen die bestehenden Ansichten:
   * SlangTags → Slang Box in der Arena, Connections → Connections-Reiter,
   * Beiträge → Scroll zum Beitragsbereich, Follower → Follower-Liste.
   */
  const goSection = (key: StatSection) => {
    setSection(key);
    if (key === "tags") {
      void navigate({ to: "/arena", search: { tab: "box" } });
      return;
    }
    if (key === "connections") {
      openConnections("mine");
      return;
    }
    if (key === "followers") {
      setFollowersOpen(true);
      return;
    }
    postsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const person = useMemo(
    () => Object.values(profiles).find((p) => p.username.toLowerCase() === username.toLowerCase()),
    [profiles, username],
  );

  /**
   * Profile werden seitenweise geladen (P-02). Ist das gesuchte Konto nicht im
   * Speicher, wird es gezielt serverseitig nachgeladen (P-03) – nicht mehr das
   * gesamte Verzeichnis.
   */
  useEffect(() => {
    if (!person) void ensureProfileDirectory(username);
  }, [person, username, ensureProfileDirectory]);

  /** Creator-/Unternehmer-Kennzeichnung (bestehende Serverfunktion). */
  useEffect(() => {
    if (!person) return;
    let alive = true;
    void loadProfileDetails([person.id])
      .then((d) => {
        if (alive)
          setProfileRoles({
            creator: !!d[person.id]?.isCreator,
            business: !!d[person.id]?.isBusiness,
          });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [person]);

  /**
   * Follower-Zahl kommt serverseitig aus `profile_stats` und wird nach jedem
   * Folgen/Entfolgen neu geladen, damit Anzeige und Serverstatus übereinstimmen.
   */
  const [followers, setFollowers] = useState<number | null>(() =>
    person ? (peekProfileStats([person.id])?.[person.id]?.followers ?? null) : null,
  );
  const followedByMe = person ? isFollowing(person.id) : false;
  useEffect(() => {
    if (!person) return;
    let alive = true;
    const known = peekProfileStats([person.id])?.[person.id]?.followers;
    if (typeof known === "number") setFollowers(known);
    void loadProfileStats([person.id])
      .then((s) => {
        if (alive) setFollowers(s[person.id]?.followers ?? 0);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [person?.id, followedByMe]);

  const [followBusy, setFollowBusy] = useState(false);
  const toggleFollow = async () => {
    if (!person || followBusy) return;
    setFollowBusy(true);
    const ok = followedByMe ? await unfollow(person.id) : await follow(person.id);
    // Statistiken sind nach dem Folgen veraltet – Bereich gezielt verwerfen.
    invalidateClientCache("profile:stats:");
    setFollowBusy(false);
    if (!ok) toast.error(t.actionFailed ?? "Fehler");
  };

  const userPosts = useMemo(() => {
    const list = posts.filter((p) => p.userId === person?.id);
    return list.sort((a, b) =>
      postSort === "date"
        ? b.createdAt - a.createdAt
        : b.stats.likes + b.stats.comments - (a.stats.likes + a.stats.comments),
    );
  }, [posts, person, postSort]);

  /** Stabile Callbacks/Labels: verhindern Neu-Renders der Beitragskarten. */
  const openTag = useCallback(
    (name: string) => navigate({ to: "/slangtag/$name", params: { name } }),
    [navigate],
  );
  const postLabels = useMemo(
    () => ({ edit: t.editPost, delete: t.delete }),
    [t.editPost, t.delete],
  );

  /** Scroll-Container des Beitragsbereichs (Root fuer das Lazy-Rendering). */
  const [postsPane, setPostsPane] = useState<HTMLDivElement | null>(null);

  /** Inkrementelles Rendern – niemals die gesamte Liste im DOM. */
  const postsList = useIncrementalList(userPosts, 4, postsPane);

  if (!person) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-muted-foreground">
        {loading ? t.loading : `@${username} — ${t.profileNotFound}`}
      </div>
    );
  }

  const relation = relationWith(person.id);
  const connection = connectionOf(person.id);
  const mutual = mutualConnections(person.id);

  const isSelf = relation === "self";

  /** Profil-Sichtbarkeit: direkte Aufrufe fremder, eingeschraenkter Profile blockieren. */
  const visibilityBlocked =
    !isSelf &&
    !isAdmin &&
    (person.profileVisibility === "private" ||
      (person.profileVisibility === "connections" && relation !== "connected"));

  if (visibilityBlocked) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-black tracking-tight">{t.profileHiddenTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.profileHiddenBody}</p>
        <Link to="/dev" className="mt-4 inline-block text-xs text-brand hover:underline">
          {t.backToFeed}
        </Link>
      </div>
    );
  }

  /** Bearbeiten/Löschen: nur eigene Beiträge – Administratoren duerfen alle. */
  const canManagePosts = isSelf || isAdmin;
  const editingPost = userPosts.find((p) => p.id === editId) ?? null;

  const removePost = async () => {
    if (!confirmId) return;
    setBusy(true);
    const ok = await deletePost(confirmId);
    setBusy(false);
    setConfirmId(null);
    toast[ok ? "success" : "error"](ok ? t.postDeleted : t.deleteFailed);
  };

  const stats: { label: string; v: number; key: StatSection }[] = [
    {
      label: t.statSlangTags,
      v: tags.filter((t) => t.creatorId === person?.id).length,
      key: "tags",
    },
    { label: t.statConnections, v: connectionCount(person.id), key: "connections" },
    { label: t.statPosts, v: userPosts.length, key: "posts" },
    {
      label: profileTexts[lang].statFollowers,
      v: followers ?? 0,
      key: "followers",
    },
  ];

  return (
    <main className="w-full pb-6 pt-2 sm:pb-8 sm:pt-3">
      <div className="mx-auto w-full max-w-4xl px-3 sm:px-4 2xl:max-w-5xl">
        <header className="relative overflow-hidden rounded-2xl border border-border bg-background">
          <nav aria-label={t.backToFeed} className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
            <BackButton to="/dev" label={t.backToFeed} size="sm" />
          </nav>

          {/* Hintergrundbild */}
          <div className="relative h-28 w-full bg-gradient-to-r from-brand/20 via-transparent to-brand-cyan/20 sm:h-36">
            {person.cover && (
              <img
                src={person.coverMedium ?? person.cover}
                alt=""
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover opacity-80"
              />
            )}
          </div>

          <div className="p-5">
            <div className="flex items-center gap-4">
              <AvatarGlowRing userId={person.id} size="lg" borderOpacity="60">
                {person.avatar ? (
                  <img
                    src={person.avatarThumb ?? person.avatar}
                    alt=""
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-black text-black">
                    {person.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </AvatarGlowRing>

              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-xl font-black tracking-tight">
                  {person.displayName}
                  {person.verified && <BadgeCheck className="h-5 w-5 text-brand-cyan" />}
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    aria-label={profileTexts[lang].shareProfile}
                    title={profileTexts[lang].shareProfile}
                    className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>@{person.username}</span>
                  <AccountTypeBadge userId={person.id} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" /> {person.language}
                  </span>
                </div>

                {/* Online-Status (eigenes Profil: Schieberegler, fremde: schreibgeschützt) */}
                <div className="mt-2">
                  {isSelf && me ? (
                    <PresenceSlider
                      value={me.presenceStatus}
                      onChange={(v) => void updateMyProfile({ presenceStatus: v })}
                    />
                  ) : (
                    <PresenceReadOnly value={person.presenceStatus} />
                  )}
                </div>

                {/* Kompakte Freundschafts-/Follow-Aktionen direkt unter dem Online-Status */}
                {!isSelf && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {relation === "connected" && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                        <Check className="h-3.5 w-3.5" /> {t.connected}
                      </span>
                    )}
                    {relation === "outgoing" && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> {t.requestSent}
                      </span>
                    )}
                    {relation === "incoming" && connection && (
                      <>
                        <button
                          type="button"
                          onClick={() => void acceptRequest(connection.id)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-glow"
                        >
                          <Check className="h-3.5 w-3.5" /> {t.accept}
                        </button>
                        <button
                          type="button"
                          onClick={() => void declineRequest(connection.id)}
                          className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          {t.decline}
                        </button>
                      </>
                    )}
                    {(relation === "none" || relation === "declined") && (
                      <button
                        type="button"
                        onClick={() => void sendRequest(person.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                      >
                        <Plus className="h-3.5 w-3.5" /> {t.addFriend}
                      </button>
                    )}

                    {relation === "connected" && (
                      <button
                        type="button"
                        onClick={() => openMessenger(person.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-brand/60 hover:text-brand"
                      >
                        <MessageSquare className="h-3 w-3" /> {t.message}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void toggleFollow()}
                      disabled={followBusy}
                      aria-pressed={followedByMe}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                        followedByMe
                          ? "border border-brand/50 bg-brand/10 text-brand"
                          : "border border-border text-foreground hover:border-brand/60 hover:text-brand"
                      }`}
                    >
                      {followedByMe ? (
                        <>
                          <Check className="h-3 w-3" /> {t.following}
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3 w-3" /> {t.followNow}
                        </>
                      )}
                    </button>

                    {mutual.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {mutual.length} {t.mutualConnections}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {person.bio && (
              <p className="mt-3 text-sm text-foreground/90">
                <SlangText
                  text={person.bio}
                  onOpenTag={(tag) =>
                    navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                  }
                />
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stats.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => goSection(s.key)}
                  aria-current={section === s.key}
                  className={`tap-safe rounded-xl border px-3 py-2 text-center transition-colors ${
                    section === s.key
                      ? "border-brand bg-brand/10"
                      : "border-border bg-background/60 hover:border-brand/60"
                  }`}
                >
                  <div className="text-sm font-black text-brand">{formatCount(s.v)}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Creator SlangTags – direkt sichtbar im vorderen Profilbereich */}
        {profileRoles.creator && (
          <div className="mt-4">
            <CreatorSlangTagsSection
              creatorId={person.id}
              isSelf={relation === "self"}
              variant="creator"
            />
          </div>
        )}

        {/* Unternehmer-SlangTags – ohne Creator-Monetarisierung */}
        {!profileRoles.creator && profileRoles.business && (
          <div className="mt-4">
            <CreatorSlangTagsSection
              creatorId={person.id}
              isSelf={relation === "self"}
              variant="business"
            />
          </div>
        )}

        {/* Über mich + Community-Statistiken */}
        <div className="mt-4">
          <ProfileAbout userId={person.id} />
        </div>

        {/* Beiträge */}
        <section
          ref={postsSectionRef}
          className={`mt-6 scroll-mt-20 rounded-2xl border bg-background p-4 transition-colors ${
            section === "posts" ? "border-brand/60" : "border-border"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold tracking-widest">{t.postsHeading}</h2>
            <div className="flex gap-1">
              {(["date", "popular"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setPostSort(k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    postSort === k
                      ? "bg-brand/20 text-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "date" ? t.sortDate : t.sortPopular}
                </button>
              ))}
            </div>
          </div>

          {userPosts.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{t.noPostsPublished}</p>
          ) : (
            <ScrollPane
              maxHeight="clamp(20rem, 62vh, 34rem)"
              className="mt-3"
              paneRef={setPostsPane}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {postsList.visible.map((p) => (
                  <LazyItem key={p.id} minHeight={260} root={postsPane}>
                    <ProfilePostCard
                      post={p}
                      canManage={canManagePosts}
                      labels={postLabels}
                      onEdit={setEditId}
                      onDelete={setConfirmId}
                      onOpenTag={openTag}
                    />
                  </LazyItem>
                ))}
              </div>
              {postsList.hasMore && <div ref={postsList.sentinelRef} className="h-6" />}
            </ScrollPane>
          )}
        </section>

        {/* Administrator- und Entwicklerbereiche liegen ausschliesslich im
          Hamburger-Menue des Profilpanels (nur fuer Administratoren). */}

        <FollowersDialog
          userId={person.id}
          open={followersOpen}
          onClose={() => setFollowersOpen(false)}
        />
        {shareOpen && (
          <ShareSheet
            payload={{
              url: profileShareUrl(person.username),
              title: `@${person.username} · Y-Dude`,
              author: person.displayName,
              image: person.avatarThumb ?? person.avatar ?? null,
              text: isSelf
                ? profileTexts[lang].shareProfileText
                : profileTexts[lang].shareProfileTextOther,
            }}
            onClose={() => setShareOpen(false)}
          />
        )}
        <PostEditDialog post={editingPost} onClose={() => setEditId(null)} />
        <ConfirmDialog
          open={!!confirmId}
          title={t.deletePostConfirm}
          confirmLabel={t.delete}
          busy={busy}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => void removePost()}
        />
      </div>
    </main>
  );
}

/**
 * Beitragskarte im Profil – memoisiert.
 * Bilder werden als Vorschau (Thumbnail) geladen; das Original kommt erst in der
 * Detailansicht. `fallbackImage` greift nur, wenn keine Variante existiert.
 */
const ProfilePostCard = memo(function ProfilePostCard({
  post,
  canManage,
  labels,
  onEdit,
  onDelete,
  onOpenTag,
}: {
  post: Post;
  canManage: boolean;
  labels: { edit: string; delete: string };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenTag: (name: string) => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-background/60 p-3">
      {post.image && (
        <SlangTagCanvas
          image={postCardImage(post) ?? ""}
          fallbackImage={post.image}
          placements={post.placements}
          onOpenTag={onOpenTag}
          zoomable
          zoomOriginal={post.image}
        />
      )}
      <h3 className="mt-2 text-sm font-bold">{post.title}</h3>
      {post.description && (
        <p className="text-xs text-muted-foreground">
          <SlangText text={post.description} onOpenTag={(tag) => onOpenTag(tag.name)} />
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Heart className="h-2.5 w-2.5" /> {formatStat(post.stats.likes)}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-2.5 w-2.5" /> {formatStat(post.stats.comments)}
        </span>
        {post.region && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5" /> {post.region}
          </span>
        )}
        <span>{formatDate(post.createdAt)}</span>
      </div>

      {canManage && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(post.id)}
            className="tap-safe inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:border-brand/60 hover:text-brand"
          >
            <Pencil className="h-3 w-3" /> {labels.edit}
          </button>
          <button
            type="button"
            onClick={() => onDelete(post.id)}
            className="tap-safe inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3" /> {labels.delete}
          </button>
        </div>
      )}
    </article>
  );
});
