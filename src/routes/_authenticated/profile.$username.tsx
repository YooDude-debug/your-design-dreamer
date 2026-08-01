import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
} from "lucide-react";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangText } from "@/components/SlangTagInput";
import { useSocial } from "@/lib/social";
import { useSocialUI } from "@/components/SocialLayer";
import { formatCount, formatDate, formatStat, type SlangTag, type SortKey } from "@/lib/types";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { TestBotBadge } from "@/components/TestBotBadge";

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

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { profiles, posts, tags, loading } = useData();
  const {
    relationWith,
    connectionOf,
    connectionCount,
    mutualConnections,
    sendRequest,
    acceptRequest,
    declineRequest,
  } = useSocial();
  const { openMessenger } = useSocialUI();
  const [sort, setSort] = useState<SortKey>("newest");
  const [postSort, setPostSort] = useState<"date" | "popular">("date");

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

  const stats = [
    { label: t.statSlangTags, v: myTags.length },
    { label: t.statConnections, v: connectionCount(person.id) },
    { label: t.statPosts, v: userPosts.length },
    { label: t.statLikes, v: userPosts.reduce((s, p) => s + p.stats.likes, 0) },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/dev"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t.backToFeed}
      </Link>

      <header className="mt-4 rounded-2xl border border-border bg-surface/60 p-5">
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

        <div className="mt-4 grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-background/60 px-3 py-2 text-center"
            >
              <div className="text-sm font-black text-brand">{formatCount(s.v)}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* SlangTags */}
      <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-4">
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

      {/* Beiträge */}
      <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-4">
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
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
