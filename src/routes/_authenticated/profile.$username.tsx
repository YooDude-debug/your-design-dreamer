import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  Globe,
  Heart,
  Play,
  Repeat2,
  MessageCircle,
  UserPlus,
  Check,
  Clock,
  MessageSquare,
  Users,
  User as UserIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangText } from "@/components/SlangTagInput";
import { useSocial } from "@/lib/social-context";
import { useSocialUI } from "@/lib/social-ui-context";
import { formatCount, formatDate, formatStat, type SlangTag, type SortKey } from "@/lib/types";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { TestBotBadge } from "@/components/TestBotBadge";
import { PostEditDialog } from "@/components/PostEditDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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

type StatSection = "tags" | "connections" | "posts" | "likes";

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { profiles, posts, tags, likedPosts, loading, isAdmin, deletePost } = useData();
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
  const { openMessenger } = useSocialUI();
  const [sort, setSort] = useState<SortKey>("newest");
  const [postSort, setPostSort] = useState<"date" | "popular">("date");
  const [section, setSection] = useState<StatSection>("tags");
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sectionRefs = {
    tags: useRef<HTMLElement | null>(null),
    connections: useRef<HTMLElement | null>(null),
    posts: useRef<HTMLElement | null>(null),
    likes: useRef<HTMLElement | null>(null),
  } as const;

  /** Statistik-Karte aktiviert den passenden Bereich und scrollt dorthin. */
  const goSection = (key: StatSection) => {
    setSection(key);
    sectionRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const SORTS: { key: SortKey; label: string }[] = [
    { key: "newest", label: t.sortNewest },
    { key: "uses", label: t.sortUses },
    { key: "likes", label: t.sortLikes },
    { key: "plays", label: t.sortPlays },
  ];

  const person = useMemo(
    () => Object.values(profiles).find((p) => p.username.toLowerCase() === username.toLowerCase()),
    [profiles, username],
  );

  const myTags = useMemo(() => {
    const list = tags.filter((t) => t.creatorId === person?.id);
    const cmp: Record<SortKey, (a: SlangTag, b: SlangTag) => number> = {
      newest: (a, b) => b.createdAt - a.createdAt,
      uses: (a, b) => b.stats.uses - a.stats.uses,
      likes: (a, b) => b.stats.likes - a.stats.likes,
      plays: (a, b) => b.stats.plays - a.stats.plays,
    };
    return list.sort(cmp[sort]);
  }, [tags, person, sort]);

  const userPosts = useMemo(() => {
    const list = posts.filter((p) => p.userId === person?.id);
    return list.sort((a, b) =>
      postSort === "date"
        ? b.createdAt - a.createdAt
        : b.stats.likes + b.stats.comments - (a.stats.likes + a.stats.comments),
    );
  }, [posts, person, postSort]);

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
  const likedList = isSelf
    ? posts.filter((p) => likedPosts.includes(p.id)).sort((a, b) => b.createdAt - a.createdAt)
    : [];
  const connectionList = isSelf ? connectedIds : mutual;

  const stats: { label: string; v: number; key: StatSection }[] = [
    { label: t.statSlangTags, v: myTags.length, key: "tags" },
    { label: t.statConnections, v: connectionCount(person.id), key: "connections" },
    { label: t.statPosts, v: userPosts.length, key: "posts" },
    {
      label: t.statLikes,
      v: isSelf ? likedList.length : userPosts.reduce((s, p) => s + p.stats.likes, 0),
      key: isSelf ? "likes" : "posts",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-6 sm:px-4 sm:py-8 2xl:max-w-5xl">
      <Link
        to="/dev"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t.backToFeed}
      </Link>

      <header className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface/60">
        {/* Hintergrundbild */}
        <div className="relative h-28 w-full bg-gradient-to-r from-brand/20 via-transparent to-brand-cyan/20 sm:h-36">
          {person.cover && (
            <img
              src={person.cover}
              alt=""
              decoding="async"
              className="h-full w-full object-cover opacity-80"
            />
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-brand/60 bg-gradient-to-br from-brand to-brand-cyan shadow-glow">
              {person.avatar ? (
                <img src={person.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-black">
                  {person.username.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-xl font-black tracking-tight">
                {person.displayName}
                {person.verified && <BadgeCheck className="h-5 w-5 text-brand-cyan" />}
                {person.isTestBot && <TestBotBadge />}
              </h1>
              <div className="text-sm text-muted-foreground">@{person.username}</div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {person.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {person.location}
                    {relation === "self" && person.locationVisibility === "connections" && (
                      <span className="text-[10px]">({t.locVisFriendsOnly})</span>
                    )}
                    {relation === "self" && person.locationVisibility === "private" && (
                      <span className="text-[10px]">({t.locVisPrivate})</span>
                    )}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {person.language}
                </span>
              </div>
            </div>
          </div>

          {person.bio && (
            <p className="mt-3 text-sm text-foreground/90">
              <SlangText
                text={person.bio}
                onOpenTag={(tag) => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
              />
            </p>
          )}

          {relation !== "self" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {relation === "connected" && (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">
                    <Check className="h-3.5 w-3.5" /> {t.connected}
                  </span>
                  <button
                    onClick={() => openMessenger(person.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> {t.message}
                  </button>
                </>
              )}
              {relation === "outgoing" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {t.requestSent}
                </span>
              )}
              {relation === "incoming" && connection && (
                <>
                  <button
                    onClick={() => void acceptRequest(connection.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
                  >
                    <Check className="h-3.5 w-3.5" /> {t.accept}
                  </button>
                  <button
                    onClick={() => void declineRequest(connection.id)}
                    className="rounded-full border border-border px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t.decline}
                  </button>
                </>
              )}
              {(relation === "none" || relation === "declined") && (
                <button
                  onClick={() => void sendRequest(person.id)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
                >
                  <UserPlus className="h-3.5 w-3.5" /> {t.connect}
                </button>
              )}
              {mutual.length > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {mutual.length} {t.mutualConnections}
                </span>
              )}
            </div>
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

      {/* SlangTags */}
      <section
        ref={sectionRefs.tags}
        className={`mt-6 scroll-mt-20 rounded-2xl border bg-surface/40 p-4 transition-colors ${
          section === "tags" ? "border-brand/60" : "border-border"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-widest">{t.ownSlangTags}</h2>
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  sort === s.key
                    ? "bg-brand/20 text-brand"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {myTags.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {t.noTagsFrom} @{person.username}.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {myTags.map((t) => (
              <div key={t.id} className="space-y-1">
                <SlangTagChip
                  tag={t}
                  variant="compact"
                  onOpen={() => navigate({ to: "/slangtag/$name", params: { name: t.name } })}
                />
                <div className="flex gap-3 pl-1 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5">
                    <Play className="h-2.5 w-2.5" /> {formatStat(t.stats.plays)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Heart className="h-2.5 w-2.5" /> {formatStat(t.stats.likes)}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Repeat2 className="h-2.5 w-2.5" /> {formatStat(t.stats.uses)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Connections */}
      <section
        ref={sectionRefs.connections}
        className={`mt-6 scroll-mt-20 rounded-2xl border bg-surface/40 p-4 transition-colors ${
          section === "connections" ? "border-brand/60" : "border-border"
        }`}
      >
        <h2 className="text-sm font-bold tracking-widest">{t.connections}</h2>
        {connectionList.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t.noConnectionsYet}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {connectionList.map((id) => {
              const c = profiles[id];
              if (!c) return null;
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/50 bg-background text-sm font-black text-brand">
                    {c.avatar ? (
                      <img
                        src={c.avatar}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      c.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{c.displayName}</div>
                    <div className="truncate text-[11px] text-muted-foreground">@{c.username}</div>
                  </div>
                  <button
                    onClick={() => openMessenger(id)}
                    aria-label={t.openChat}
                    title={t.openChat}
                    className="tap-safe grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <Link
                    to="/profile/$username"
                    params={{ username: c.username }}
                    aria-label={t.viewProfile}
                    title={t.viewProfile}
                    className="tap-safe grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
                  >
                    <UserIcon className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Beiträge */}
      <section
        ref={sectionRefs.posts}
        className={`mt-6 scroll-mt-20 rounded-2xl border bg-surface/40 p-4 transition-colors ${
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
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {userPosts.map((p) => (
              <article key={p.id} className="rounded-xl border border-border bg-background/60 p-3">
                {p.image && (
                  <SlangTagCanvas
                    image={p.image}
                    placements={p.placements}
                    onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                  />
                )}
                <h3 className="mt-2 text-sm font-bold">{p.title}</h3>
                {p.description && (
                  <p className="text-xs text-muted-foreground">
                    <SlangText
                      text={p.description}
                      onOpenTag={(tag) =>
                        navigate({ to: "/slangtag/$name", params: { name: tag.name } })
                      }
                    />
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5" /> {formatStat(p.stats.likes)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-2.5 w-2.5" /> {formatStat(p.stats.comments)}
                  </span>
                  {p.region && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" /> {p.region}
                    </span>
                  )}
                  <span>{formatDate(p.createdAt)}</span>
                </div>

                {canManagePosts && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setEditId(p.id)}
                      className="tap-safe inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] hover:border-brand/60 hover:text-brand"
                    >
                      <Pencil className="h-3 w-3" /> {t.editPost}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(p.id)}
                      className="tap-safe inline-flex items-center gap-1.5 rounded-full border border-destructive/50 px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" /> {t.delete}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      {/* Gelikte Beiträge – nur im eigenen Profil */}
      {isSelf && (
        <section
          ref={sectionRefs.likes}
          className={`mt-6 scroll-mt-20 rounded-2xl border bg-surface/40 p-4 transition-colors ${
            section === "likes" ? "border-brand/60" : "border-border"
          }`}
        >
          <h2 className="text-sm font-bold tracking-widest">{t.statLikes}</h2>
          {likedList.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">{t.noPostsPublished}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {likedList.map((p) => (
                <li key={p.id}>
                  <Link
                    to="/p/$postId"
                    params={{ postId: p.id }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 hover:border-brand/60"
                  >
                    {(p.imageThumb || p.image) && (
                      <img
                        src={p.imageThumb ?? p.image ?? ""}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {p.title || p.description}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                      <Heart className="h-3 w-3 fill-current text-brand" />{" "}
                      {formatStat(p.stats.likes)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
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
  );
}
