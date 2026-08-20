/**
 * Channels entdecken – Suche, beliebte Channels und die eigenen Abos.
 *
 * Es wird ausschliesslich die bestehende Struktur genutzt (`channels`,
 * `channel_categories`, `channel_follows`). Der Follow-Status kommt
 * serverseitig gebuendelt mit den Channel-Daten (keine N+1-Abfragen);
 * Suche und Listen sind seitenweise.
 */

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Search, Tv } from "lucide-react";
import { goBackOr } from "@/lib/back-nav";
import { ChannelFollowButton } from "@/components/channels/ChannelFollowButton";
import { listFollowedChannels, searchChannels } from "@/lib/channels.functions";

export const Route = createFileRoute("/_authenticated/channels/")({
  head: () => ({
    meta: [
      { title: "Channels entdecken — Y-Dude" },
      {
        name: "description",
        content:
          "Y-Dude Channels durchsuchen, Themenbereiche folgen und die eigenen Channel-Abos verwalten.",
      },
      { property: "og:title", content: "Channels entdecken — Y-Dude" },
      {
        property: "og:description",
        content: "Themen-Channels finden und mit einem Klick folgen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      Channels konnten nicht geladen werden.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Nicht gefunden.</div>
  ),
  component: ChannelsPage,
});

const PAGE = 20;

function ChannelsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const term = q.trim();

  const search = useServerFn(searchChannels);
  const loadFollowed = useServerFn(listFollowedChannels);

  /** Suche bzw. beliebteste Channels – eine Abfrage inkl. Follow-Status. */
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["channel-search", term],
    queryFn: () => search({ data: { q: term, limit: PAGE, offset: 0 } }),
    staleTime: 30_000,
  });

  const { data: followed = [] } = useQuery({
    queryKey: ["followed-channels"],
    queryFn: () => loadFollowed(),
    staleTime: 60_000,
  });

  const followedIds = useMemo(() => new Set(followed.map((c) => c.id)), [followed]);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => goBackOr(router, "/dev")}
          aria-label="Zurück"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Tv className="h-5 w-5 text-brand" /> Channels
        </h1>
      </header>

      <label className="mb-4 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Channel suchen…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {followed.length > 0 && !term && (
        <section className="mb-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Meine Channels
          </h2>
          <div className="space-y-2">
            {followed.map((c) => (
              <ChannelRow key={c.id} channel={{ ...c, following: true }} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {term ? "Suchergebnisse" : "Beliebte Channels"}
        </h2>
        {isLoading && (
          <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Channels werden geladen…
          </p>
        )}
        {!isLoading && results.length === 0 && (
          <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            Keine Channels gefunden.
          </p>
        )}
        <div className="space-y-2">
          {results.map((c) => (
            <ChannelRow
              key={c.id}
              channel={{ ...c, following: c.following || followedIds.has(c.id) }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

type Row = {
  id: string;
  name: string;
  icon: string | null;
  categoryName: string | null;
  followersCount: number;
  postsCount: number;
  following: boolean;
};

function ChannelRow({ channel }: { channel: Row }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="w-6 shrink-0 text-center text-lg">{channel.icon ?? "📺"}</span>
      <Link
        to="/channels/$channelId"
        params={{ channelId: channel.id }}
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-sm font-semibold">{channel.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {channel.categoryName ?? "Ohne Kategorie"} · {channel.followersCount} Follower ·{" "}
          {channel.postsCount} Beiträge
        </span>
      </Link>
      <ChannelFollowButton channelId={channel.id} following={channel.following} />
    </div>
  );
}
