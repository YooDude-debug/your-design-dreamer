import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, MapPin, Globe, Heart, Play, Repeat2, Users } from "lucide-react";
import { SlangTagProvider, useSlangTags, formatStat, type SortKey } from "@/lib/slangtags";
import { ProfileProvider, useProfile, formatCount } from "@/lib/profile";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { formatDate } from "@/lib/feed-types";

export const Route = createFileRoute("/_authenticated/profile/$username")({
  head: () => ({
    meta: [
      { title: "Profil — Y-Dude" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Profil mit Bio, Statistiken, Beiträgen und eigenen SlangTags." },
      { property: "og:title", content: "Profil — Y-Dude" },
      { property: "og:description", content: "Bio, Statistiken, Beiträge und SlangTags dieses Y-Dude Profils." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SlangTagProvider>
      <ProfileProvider>
        <ProfilePage />
      </ProfileProvider>
    </SlangTagProvider>
  ),
});

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Neueste" },
  { key: "uses", label: "Meist genutzt" },
  { key: "likes", label: "Meiste Likes" },
  { key: "plays", label: "Meiste Plays" },
];

function ProfilePage() {
  const { username } = Route.useParams();
  const navigate = useNavigate();
  const { profile, posts } = useProfile();
  const { sorted } = useSlangTags();
  const [sort, setSort] = useState<SortKey>("newest");
  const [postSort, setPostSort] = useState<"date" | "popular">("date");

  const isOwn = username.toLowerCase() === profile.username.toLowerCase();
  const tags = useMemo(
    () => sorted(sort, (t) => t.creator.toLowerCase() === username.toLowerCase()),
    [sorted, sort, username],
  );
  const ownPosts = useMemo(() => {
    const list = isOwn ? [...posts] : [];
    return list.sort((a, b) =>
      postSort === "date" ? b.createdAt - a.createdAt : b.likes + b.comments - (a.likes + a.comments),
    );
  }, [isOwn, posts, postSort]);

  const stats = isOwn
    ? [
        { label: "SlangTags", v: profile.stats.slangtags },
        { label: "Follower", v: profile.stats.followers },
        { label: "Folgt", v: profile.stats.following },
        { label: "Likes", v: profile.stats.likes },
      ]
    : [
        { label: "SlangTags", v: tags.length },
        { label: "Plays", v: tags.reduce((s, t) => s + t.stats.plays, 0) },
        { label: "Likes", v: tags.reduce((s, t) => s + t.stats.likes, 0) },
        { label: "Uses", v: tags.reduce((s, t) => s + t.stats.uses, 0) },
      ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/dev" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand">
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zum Feed
      </Link>

      <header className="mt-4 rounded-2xl border border-border bg-surface/60 p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-brand/60 bg-gradient-to-br from-brand to-brand-cyan shadow-glow">
            {isOwn && profile.avatar ? (
              <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-black">{username.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-black tracking-tight">
              {isOwn ? profile.displayName : `@${username}`}
              {(isOwn ? profile.verified : true) && <BadgeCheck className="h-5 w-5 text-brand-cyan" />}
            </h1>
            <div className="text-sm text-muted-foreground">@{isOwn ? profile.username : username}</div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {isOwn ? profile.location : tags[0]?.region ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" /> {isOwn ? profile.language : tags[0]?.language ?? "—"}
              </span>
            </div>
          </div>
        </div>

        {isOwn && profile.bio && <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p>}

        <div className="mt-4 grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-background/60 px-3 py-2 text-center">
              <div className="text-sm font-black text-brand">{formatCount(s.v)}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {/* SlangTags */}
      <section className="mt-6 rounded-2xl border border-border bg-surface/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-widest">EIGENE SLANGTAGS</h2>
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSort(s.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  sort === s.key ? "bg-brand/20 text-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {tags.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Noch keine SlangTags von @{username}.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-3">
            {tags.map((t) => (
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
          <h2 className="text-sm font-bold tracking-widest">BEITRÄGE</h2>
          <div className="flex gap-1">
            {(["date", "popular"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPostSort(k)}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  postSort === k ? "bg-brand/20 text-brand" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "date" ? "Datum" : "Beliebtheit"}
              </button>
            ))}
          </div>
        </div>

        {ownPosts.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {isOwn ? "Noch keine Beiträge veröffentlicht." : `Beiträge von @${username} sind hier noch nicht verfügbar.`}
          </p>
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {ownPosts.map((p) => (
              <article key={p.id} className="rounded-xl border border-border bg-background/60 p-3">
                {p.image && (
                  <SlangTagCanvas
                    image={p.image}
                    placements={p.placements ?? []}
                    onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                  />
                )}
                <h3 className="mt-2 text-sm font-bold">{p.title}</h3>
                {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-2.5 w-2.5" /> {p.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" /> {p.region}
                  </span>
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
