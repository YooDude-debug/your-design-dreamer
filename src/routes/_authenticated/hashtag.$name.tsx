import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Hash, Loader2, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  getHashtagPage,
  getTrendingHashtags,
  searchHashtags,
  setHashtagFollow,
} from "@/lib/hashtags.functions";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { TagRow } from "@/components/TagRow";
import { HASHTAG_COLOR } from "@/lib/tag-colors";
import { postPreviewImage } from "@/lib/media";
import { formatStat } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/hashtag/$name")({
  head: () => ({
    meta: [
      { title: "Hashtag — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Alle Beiträge zu einem Hashtag: Thema, Trend und passende Inhalte.",
      },
      { property: "og:title", content: "Hashtag — Y-Dude" },
      {
        property: "og:description",
        content: "Entdecke alle Beiträge zu diesem Hashtag und folge dem Thema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HashtagPage,
});

type PageState = {
  tag: string;
  postsCount: number;
  postIds: string[];
  following: boolean;
};

function HashtagPage() {
  const { name } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useLang();
  const { posts, tags } = useData();
  const loadPage = useServerFn(getHashtagPage);
  const loadTrends = useServerFn(getTrendingHashtags);
  const toggleFollow = useServerFn(setHashtagFollow);
  const runSearch = useServerFn(searchHashtags);

  const [page, setPage] = useState<PageState | null>(null);
  const [trends, setTrends] = useState<{ tag: string; score: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ tag: string; postsCount: number }[]>([]);

  const tagsById = useMemo(() => new Map(tags.map((item) => [item.id, item])), [tags]);
  const tag = name.replace(/^#+/, "").toLowerCase();

  const refresh = useCallback(async () => {
    const result = (await loadPage({ data: { tag } })) as PageState;
    setPage(result);
  }, [loadPage, tag]);

  useEffect(() => {
    setPage(null);
    void refresh().catch(() => setPage({ tag, postsCount: 0, postIds: [], following: false }));
    void loadTrends({ data: { days: 7, limit: 8 } })
      .then((rows) => setTrends(rows as { tag: string; score: number }[]))
      .catch(() => setTrends([]));
  }, [refresh, loadTrends, tag]);

  // Hashtag-Suche über den eigenen Index, entprellt.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch({ data: { q, limit: 10 } })
        .then((rows) => setResults(rows as { tag: string; postsCount: number }[]))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const shown = useMemo(() => {
    if (!page) return [];
    const order = new Map(page.postIds.map((id, i) => [id, i]));
    return posts
      .filter((p) => order.has(p.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [page, posts]);

  const onFollow = async () => {
    if (!page) return;
    setBusy(true);
    try {
      const result = (await toggleFollow({ data: { tag, follow: !page.following } })) as {
        ok: boolean;
      };
      if (!result.ok) toast.error("Hashtag nicht gefunden.");
      else await refresh();
    } catch {
      toast.error("Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-4 sm:py-6 2xl:max-w-6xl">
      <BackButton onClick={() => navigate({ to: "/dev" })} label={t.backToFeed} className="mb-4" />

      <section className="rounded-2xl border border-border bg-background p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="flex items-center gap-1 text-3xl font-black tracking-tight"
              style={{ color: HASHTAG_COLOR }}
            >
              <Hash className="h-6 w-6" />
              {tag}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {page ? formatStat(page.postsCount) : "…"} Beiträge · Thema des Beitrags
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onFollow()}
            disabled={busy || !page}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              page?.following
                ? "border border-border bg-surface text-muted-foreground hover:text-foreground"
                : "bg-brand text-background hover:opacity-90"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : page?.following ? (
              "Nicht mehr folgen"
            ) : (
              "Hashtag folgen"
            )}
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-background p-4">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hashtags suchen …"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        {results.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
            {results.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate({ to: "/hashtag/$name", params: { name: item.tag } });
                }}
                style={{ color: HASHTAG_COLOR }}
                className="hover:underline"
              >
                #{item.tag}
                <span className="ml-1 text-muted-foreground">{formatStat(item.postsCount)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {trends.length > 0 && (
        <section className="mt-4 rounded-2xl border border-border bg-background p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-brand" /> Trending Hashtags
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold">
            {trends.map((item) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => navigate({ to: "/hashtag/$name", params: { name: item.tag } })}
                style={{ color: HASHTAG_COLOR }}
                className="hover:underline"
              >
                #{item.tag}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4">
        {!page ? (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Noch keine sichtbaren Beiträge zu #{tag}.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((post) => (
              <div
                key={post.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate({ to: "/p/$postId", params: { postId: post.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ to: "/p/$postId", params: { postId: post.id } });
                  }
                }}
                className="cursor-pointer overflow-hidden rounded-2xl border border-border bg-background text-left transition-colors hover:border-brand/50"
              >
                {post.image && (
                  <img
                    src={postPreviewImage(post) ?? post.image}
                    alt={post.title}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                )}
                <div className="p-3">
                  <div className="truncate text-sm font-semibold">{post.title}</div>
                  <TagRow
                    hashtags={post.hashtags}
                    tags={post.slangTagIds
                      .map((id) => tagsById.get(id))
                      .filter((x): x is NonNullable<typeof x> => Boolean(x))}
                    className="mt-1.5"
                    onOpenHashtag={(h) => navigate({ to: "/hashtag/$name", params: { name: h } })}
                    onOpenTag={(st) =>
                      navigate({ to: "/slangtag/$name", params: { name: st.name } })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
