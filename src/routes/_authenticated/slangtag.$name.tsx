import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Heart, Play, Repeat2, Share2, Bookmark, MessageCircle, MapPin, Globe, User, ArrowLeft, Trophy } from "lucide-react";
import { SlangTagChip } from "@/components/SlangTagChip";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagProvider, useSlangTags, formatStat } from "@/lib/slangtags";
import { ProfileProvider, useProfile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/slangtag/$name")({
  head: () => ({
    meta: [
      { title: "SlangTag — Y-Dude" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "SlangTag Detailseite: Audio, Bedeutung, Region, Beispiele und Beiträge." },
      { property: "og:title", content: "SlangTag — Y-Dude" },
      { property: "og:description", content: "Höre den SlangTag, sieh Bedeutung, Region und alle Beiträge." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SlangTagProvider>
      <ProfileProvider>
        <SlangTagDetail />
      </ProfileProvider>
    </SlangTagProvider>
  ),
});

function SlangTagDetail() {
  const { name } = Route.useParams();
  const navigate = useNavigate();
  const { getTag, sorted, toggleLike, toggleSave, likedIds, savedIds, bump } = useSlangTags();
  const { posts } = useProfile();
  const tag = getTag(name);

  const usedIn = useMemo(
    () => posts.filter((p) => (p.slangTagIds ?? []).includes(tag?.id ?? "")),
    [posts, tag],
  );

  const ranking = sorted("plays").slice(0, 10);

  if (!tag) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">SlangTag ${name} nicht gefunden.</p>
      </div>
    );
  }

  const liked = likedIds.includes(tag.id);
  const saved = savedIds.includes(tag.id);

  const stats = [
    { icon: Play, label: "Wiedergaben", v: tag.stats.plays },
    { icon: Heart, label: "Likes", v: tag.stats.likes },
    { icon: Repeat2, label: "Verwendungen", v: tag.stats.uses },
    { icon: Share2, label: "Geteilt", v: tag.stats.shares },
    { icon: Bookmark, label: "Gespeichert", v: tag.stats.saves },
    { icon: MessageCircle, label: "Kommentare", v: tag.stats.comments },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <button
        onClick={() => navigate({ to: "/dev" })}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-brand"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zum Feed
      </button>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface/40 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <SlangTagChip tag={tag} variant="glass" showStats={false} />
          <div className="min-w-0">
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-gradient-green">${tag.name}</span>
            </h1>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-brand" /> {tag.region}</span>
              <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3 text-brand-cyan" /> {tag.language}</span>
              <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> @{tag.creator}</span>
              <span>{new Date(tag.createdAt).toLocaleDateString("de-DE")}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => toggleLike(tag.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${liked ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground hover:text-brand"}`}
            >
              <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> {formatStat(tag.stats.likes)}
            </button>
            <button
              onClick={() => toggleSave(tag.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${saved ? "border-brand-cyan bg-brand-cyan/15 text-brand-cyan" : "border-border text-muted-foreground hover:text-brand-cyan"}`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} /> Speichern
            </button>
            <button
              onClick={() => bump(tag.id, "shares")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-brand"
            >
              <Share2 className="h-3.5 w-3.5" /> Teilen
            </button>
          </div>
        </div>

        {tag.meaning && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{tag.meaning}</p>}

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-background/50 p-3 text-center">
              <s.icon className="mx-auto h-4 w-4 text-brand" />
              <div className="mt-1 text-base font-black">{formatStat(s.v)}</div>
              <div className="truncate text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {tag.examples.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface/40 p-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest">Beispielsätze</h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {tag.examples.map((ex) => (
                  <li key={ex} className="rounded-lg border border-border bg-background/50 px-3 py-2">„{ex}"</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-surface/40 p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest">
              Beiträge mit ${tag.name} ({usedIn.length})
            </h2>
            {usedIn.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine eigenen Beiträge mit diesem SlangTag.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {usedIn.map((p) =>
                  p.image ? (
                    <SlangTagCanvas
                      key={p.id}
                      image={p.image}
                      placements={p.placements ?? []}
                      onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
                    />
                  ) : (
                    <div key={p.id} className="rounded-xl border border-border bg-background/50 p-3 text-sm">
                      {p.description || p.title}
                    </div>
                  ),
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="rounded-2xl border border-border bg-surface/40 p-5">
          <h2 className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest">
            <Trophy className="h-3.5 w-3.5 text-brand" /> Top SlangTags
          </h2>
          <ol className="space-y-1">
            {ranking.map((t, i) => (
              <li key={t.id}>
                <button
                  onClick={() => navigate({ to: "/slangtag/$name", params: { name: t.name } })}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-brand/10 ${t.id === tag.id ? "bg-brand/10" : ""}`}
                >
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <span className="truncate font-semibold text-brand">${t.name}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{formatStat(t.stats.plays)}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
