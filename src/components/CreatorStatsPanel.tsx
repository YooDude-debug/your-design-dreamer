import { BackButton } from "@/components/ui/nav-buttons";
import { useEffect, useMemo, useRef, useState } from "react";
import { activeLocale } from "@/lib/active-locale";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  ImageOff,
  MessageCircle,
  Pause,
  Play,
  Trophy,
  UserRound,
} from "lucide-react";

import type { CreatorStats } from "@/lib/creator.functions";
import {
  getCreatorCommentRows,
  getCreatorFollowerRows,
  getCreatorLikeRows,
  getCreatorPostRows,
  getCreatorSeries,
  getCreatorTagRows,
  getCreatorTagUsePosts,
  type CreatorCommentRow,
  type CreatorFollowerRow,
  type CreatorLikeRow,
  type CreatorPostRow,
  type CreatorSeriesPoint,
  type CreatorTagRow,
  type CreatorTagUsePost,
  type StatActor,
} from "@/lib/creator-stats.functions";

/**
 * Interaktiver Statistikbereich für Creator/Unternehmer.
 * Design bleibt unverändert: schwarzer Hintergrund, Karten mit Rahmen,
 * grüne Hervorhebungen. Jede Kennzahl öffnet ihre Detailliste.
 */

type Metric = "posts" | "likes" | "comments" | "followers" | "tags" | "tagUses" | "tagRank";

const LABEL: Record<Metric, string> = {
  posts: "Beiträge",
  likes: "Likes erhalten",
  comments: "Kommentare",
  followers: "Follower",
  tags: "SlangTags",
  tagUses: "SlangTag-Nutzungen",
  tagRank: "SlangTag-Rang",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-black text-foreground">{value}</div>
    </>
  );
  if (!onClick) {
    return <div className="rounded-xl border border-border bg-background p-3">{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-brand/60"
    >
      {inner}
    </button>
  );
}

/** Anonymisierte oder öffentliche Darstellung einer Person. */
function ActorLine({ actor }: { actor: StatActor }) {
  if (actor.anonymous || !actor.username) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-accent/40">
          <UserRound className="h-3 w-3" />
        </span>
        Anonymer Nutzer
      </span>
    );
  }
  return (
    <Link
      to="/profile/$username"
      params={{ username: actor.username }}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-brand"
    >
      {actor.avatar ? (
        <img
          src={actor.avatar}
          alt=""
          loading="lazy"
          className="h-6 w-6 rounded-full border border-border object-cover"
        />
      ) : (
        <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-accent/40">
          <UserRound className="h-3 w-3" />
        </span>
      )}
      @{actor.username}
      {actor.verified && <BadgeCheck className="h-3 w-3 text-brand" />}
    </Link>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
      {text}
    </p>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand/40">
      {children}
    </div>
  );
}

/** Kompakter Balkenverlauf (nur wenn Daten vorhanden sind). */
function MiniSeries({
  title,
  points,
  pick,
}: {
  title: string;
  points: CreatorSeriesPoint[];
  pick: (p: CreatorSeriesPoint) => number;
}) {
  const max = Math.max(1, ...points.map(pick));
  const total = points.reduce((s, p) => s + pick(p), 0);
  if (total === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</span>
        <span className="text-xs font-black text-brand">{total}</span>
      </div>
      <div className="mt-2 flex h-12 items-end gap-[2px]">
        {points.map((p) => (
          <span
            key={p.day}
            title={`${new Date(p.day).toLocaleDateString(activeLocale())}: ${pick(p)}`}
            className="flex-1 rounded-sm bg-brand/70"
            style={{ height: `${Math.max(2, (pick(p) / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">Letzte 30 Tage</div>
    </div>
  );
}

function AudioButton({ src }: { src: string | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => ref.current?.pause(), []);
  if (!src) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        aria-label={playing ? "Audio anhalten" : "Audio abspielen"}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-brand/50 text-brand transition-colors hover:bg-brand/10"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </>
  );
}

export function CreatorStatsPanel({ stats }: { stats: CreatorStats | null }) {
  const [metric, setMetric] = useState<Metric | null>(null);
  const [series, setSeries] = useState<CreatorSeriesPoint[]>([]);
  const [posts, setPosts] = useState<CreatorPostRow[] | null>(null);
  const [likes, setLikes] = useState<CreatorLikeRow[] | null>(null);
  const [comments, setComments] = useState<CreatorCommentRow[] | null>(null);
  const [followers, setFollowers] = useState<CreatorFollowerRow[] | null>(null);
  const [tags, setTags] = useState<CreatorTagRow[] | null>(null);
  const [tagPosts, setTagPosts] = useState<CreatorTagUsePost[] | null>(null);
  const [sort, setSort] = useState<"date" | "likes" | "comments" | "tags">("date");

  useEffect(() => {
    let alive = true;
    void getCreatorSeries()
      .then((s) => alive && setSeries(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Detaildaten werden erst beim Öffnen der jeweiligen Karte geladen.
  useEffect(() => {
    if (!metric) return;
    let alive = true;
    const load = async () => {
      try {
        if (metric === "posts" && !posts) setPosts(await getCreatorPostRows());
        if (metric === "likes" && !likes) setLikes(await getCreatorLikeRows());
        if (metric === "comments" && !comments) setComments(await getCreatorCommentRows());
        if (metric === "followers" && !followers) setFollowers(await getCreatorFollowerRows());
        if ((metric === "tags" || metric === "tagUses" || metric === "tagRank") && !tags) {
          const rows = await getCreatorTagRows();
          if (!alive) return;
          setTags(rows);
          if (metric === "tagUses" && rows.length > 0) {
            const used = await getCreatorTagUsePosts({
              data: { tagIds: rows.slice(0, 50).map((t) => t.id) },
            });
            if (alive) setTagPosts(used);
          }
          return;
        }
        if (metric === "tagUses" && tags && !tagPosts && tags.length > 0) {
          const used = await getCreatorTagUsePosts({
            data: { tagIds: tags.slice(0, 50).map((t) => t.id) },
          });
          if (alive) setTagPosts(used);
        }
      } catch {
        /* Fehler bleiben stumm – die Liste zeigt dann „keine Daten“. */
      }
    };
    void load();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric]);

  const sortedPosts = useMemo(() => {
    const rows = [...(posts ?? [])];
    rows.sort((a, b) => {
      if (sort === "likes") return b.likes - a.likes;
      if (sort === "comments") return b.comments - a.comments;
      if (sort === "tags") return b.tagUses - a.tagUses;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [posts, sort]);

  const topTag = useMemo(
    () =>
      (tags ?? []).reduce<CreatorTagRow | null>(
        (best, t) => (!best || t.uses > best.uses ? t : best),
        null,
      ),
    [tags],
  );

  if (metric) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <BackButton onClick={() => setMetric(null)} ariaLabel="Zurück zur Übersicht" />
          <h2 className="text-sm font-black">{LABEL[metric]}</h2>
        </div>

        {metric === "posts" && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["date", "Neueste"],
                  ["likes", "Likes"],
                  ["comments", "Kommentare"],
                  ["tags", "SlangTags"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                    sort === key
                      ? "border-brand/60 bg-brand/10 text-brand"
                      : "border-border text-muted-foreground hover:text-brand"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {!posts && <Empty text="Beiträge werden geladen …" />}
            {posts && posts.length === 0 && <Empty text="Noch keine Beiträge." />}
            {sortedPosts.map((p) => (
              <Link
                key={p.id}
                to="/p/$postId"
                params={{ postId: p.id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand/50"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt=""
                    loading="lazy"
                    className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-border bg-accent/40 text-muted-foreground">
                    <ImageOff className="h-4 w-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{p.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {fmtDate(p.createdAt)}
                    {p.hasVideo ? " · Video" : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="h-3 w-3 text-brand" />
                      {p.likes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="h-3 w-3 text-brand" />
                      {p.comments}
                    </span>
                    <span>{p.tagUses} SlangTags</span>
                  </span>
                </span>
              </Link>
            ))}
          </>
        )}

        {metric === "likes" && (
          <>
            {!likes && <Empty text="Likes werden geladen …" />}
            {likes && likes.length === 0 && <Empty text="Noch keine Likes erhalten." />}
            {(likes ?? []).map((l, i) => (
              <Row key={`${l.postId}-${i}`}>
                <div className="flex items-center justify-between gap-2">
                  <ActorLine actor={l.actor} />
                  <span className="text-[11px] text-muted-foreground">{fmtDate(l.createdAt)}</span>
                </div>
                <Link
                  to="/p/$postId"
                  params={{ postId: l.postId }}
                  className="mt-1 block truncate text-xs text-muted-foreground hover:text-brand"
                >
                  <Heart className="mr-1 inline h-3 w-3 text-brand" />
                  {l.postTitle}
                </Link>
              </Row>
            ))}
          </>
        )}

        {metric === "comments" && (
          <>
            {!comments && <Empty text="Kommentare werden geladen …" />}
            {comments && comments.length === 0 && <Empty text="Noch keine Kommentare erhalten." />}
            {(comments ?? []).map((c) => (
              <Row key={c.id}>
                <div className="flex items-center justify-between gap-2">
                  <ActorLine actor={c.actor} />
                  <span className="text-[11px] text-muted-foreground">{fmtDate(c.createdAt)}</span>
                </div>
                <Link
                  to="/p/$postId"
                  params={{ postId: c.postId }}
                  className="mt-1 block hover:text-brand"
                >
                  <span className="line-clamp-3 block text-xs text-foreground">
                    {c.body || "(ohne Text)"}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    <MessageCircle className="mr-1 inline h-3 w-3 text-brand" />
                    {c.postTitle}
                  </span>
                </Link>
              </Row>
            ))}
          </>
        )}

        {metric === "followers" && (
          <>
            {!followers && <Empty text="Follower werden geladen …" />}
            {followers && followers.length === 0 && <Empty text="Noch keine Follower." />}
            {followers && followers.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Gesamt:{" "}
                <span className="font-black text-brand">
                  {stats?.followers ?? followers.length}
                </span>
              </p>
            )}
            {(followers ?? []).map((f, i) => (
              <Row key={`${f.createdAt}-${i}`}>
                <div className="flex items-center justify-between gap-2">
                  <ActorLine actor={f.actor} />
                  <span className="text-[11px] text-muted-foreground">{fmtDate(f.createdAt)}</span>
                </div>
              </Row>
            ))}
          </>
        )}

        {metric === "tags" && (
          <>
            {!tags && <Empty text="SlangTags werden geladen …" />}
            {tags && tags.length === 0 && <Empty text="Noch keine eigenen SlangTags." />}
            {(tags ?? []).map((t) => (
              <Row key={t.id}>
                <div className="flex items-center gap-3">
                  <AudioButton src={t.audio} />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/slangtag/$name"
                      params={{ name: t.name }}
                      className={`block truncate text-sm font-black ${
                        t.kind === "creator" ? "text-brand-cyan" : "text-brand"
                      }`}
                    >
                      {t.kind === "creator" ? "$$" : "$"}
                      {t.name}
                    </Link>
                    <span className="block text-[11px] text-muted-foreground">
                      {t.uses} Nutzungen · {t.videoUses} Video · {t.plays} Plays · Rang #{t.rank}
                    </span>
                  </div>
                </div>
              </Row>
            ))}
          </>
        )}

        {metric === "tagUses" && (
          <>
            {!tags && <Empty text="Nutzungen werden geladen …" />}
            {topTag && topTag.uses > 0 && (
              <div className="rounded-xl border border-brand/40 bg-brand/5 p-3 text-xs">
                Am häufigsten verwendet:{" "}
                <span className="font-black text-brand">
                  {topTag.kind === "creator" ? "$$" : "$"}
                  {topTag.name}
                </span>{" "}
                · {topTag.uses} Nutzungen
              </div>
            )}
            {(tags ?? []).map((t) => (
              <Row key={t.id}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-black ${t.kind === "creator" ? "text-brand-cyan" : "text-brand"}`}
                  >
                    {t.kind === "creator" ? "$$" : "$"}
                    {t.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{t.uses} Nutzungen</span>
                </div>
              </Row>
            ))}
            <h3 className="pt-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
              Beiträge mit eigenen SlangTags
            </h3>
            {tagPosts && tagPosts.length === 0 && (
              <Empty text="Noch keine Beiträge mit deinen SlangTags." />
            )}
            {(tagPosts ?? []).map((p) => (
              <Link
                key={p.postId}
                to="/p/$postId"
                params={{ postId: p.postId }}
                className="block rounded-xl border border-border bg-background p-3 transition-colors hover:border-brand/50"
              >
                <span className="block truncate text-sm font-bold">{p.title}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {fmtDate(p.createdAt)} · {p.tags.map((n) => `$${n}`).join(", ")}
                </span>
              </Link>
            ))}
          </>
        )}

        {metric === "tagRank" && (
          <>
            {!tags && <Empty text="Rang wird geladen …" />}
            {tags && tags.length === 0 && <Empty text="Noch keine eigenen SlangTags." />}
            {(tags ?? []).map((t) => (
              <Row key={t.id}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand/50 px-2 py-0.5 text-[11px] font-black text-brand">
                    <Trophy className="h-3 w-3" />#{t.rank}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-sm font-black ${t.kind === "creator" ? "text-brand-cyan" : "text-brand"}`}
                  >
                    {t.kind === "creator" ? "$$" : "$"}
                    {t.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{t.uses} Nutzungen</span>
                </div>
              </Row>
            ))}
            {stats && (
              <p className="text-[11px] text-muted-foreground">
                Bester Rang aller eigenen SlangTags:{" "}
                <span className="font-black text-brand">#{stats.slangTagRank || "–"}</span>
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard
          label={LABEL.posts}
          value={String(stats?.posts ?? 0)}
          onClick={() => setMetric("posts")}
        />
        <StatCard
          label={LABEL.likes}
          value={String(stats?.likesReceived ?? 0)}
          onClick={() => setMetric("likes")}
        />
        <StatCard
          label={LABEL.comments}
          value={String(stats?.comments ?? 0)}
          onClick={() => setMetric("comments")}
        />
        <StatCard
          label={LABEL.followers}
          value={String(stats?.followers ?? 0)}
          onClick={() => setMetric("followers")}
        />
        <StatCard
          label={LABEL.tags}
          value={String(stats?.slangTags ?? 0)}
          onClick={() => setMetric("tags")}
        />
        <StatCard
          label={LABEL.tagUses}
          value={String(stats?.slangTagUses ?? 0)}
          onClick={() => setMetric("tagUses")}
        />
        <StatCard
          label={LABEL.tagRank}
          value={String(stats?.slangTagRank ?? 0)}
          onClick={() => setMetric("tagRank")}
        />
        <StatCard
          label="Mitglied seit"
          value={
            stats?.memberSince
              ? new Date(stats.memberSince).toLocaleDateString(activeLocale())
              : "–"
          }
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <MiniSeries title="Likes pro Tag" points={series} pick={(p) => p.likes} />
        <MiniSeries title="Kommentare pro Tag" points={series} pick={(p) => p.comments} />
        <MiniSeries title="Neue Follower pro Tag" points={series} pick={(p) => p.followers} />
        <MiniSeries title="SlangTag-Nutzungen pro Tag" points={series} pick={(p) => p.tagUses} />
      </div>
    </div>
  );
}
