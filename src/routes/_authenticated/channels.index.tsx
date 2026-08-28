/**
 * Zentrale Channel-Verwaltung des eingeloggten Nutzers.
 *
 * Genutzt werden ausschliesslich die bestehenden Strukturen und APIs
 * (`channels`, `channel_categories`, `channel_follows`, `channel_members`).
 * Es gibt keine parallele Datenhaltung: Rollen kommen aus
 * `listManagedChannels`, Abos aus `listFollowedChannels`.
 */

import { BackButton, CloseButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search, Settings2, Tv } from "lucide-react";
import { toast } from "sonner";
import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { categoryLabel, channelTexts } from "@/lib/i18n-channels";
import { ChannelFollowButton } from "@/components/channels/ChannelFollowButton";
import { CategoryPicker } from "@/components/channels/CategoryPicker";

import {
  createChannel,
  listChannelCategories,
  listFollowedChannels,
  searchChannels,
} from "@/lib/channels.functions";

export const Route = createFileRoute("/_authenticated/channels/")({
  head: () => ({
    meta: [
      { title: "Meine Channels — Y-Dude" },
      {
        name: "description",
        content:
          "Zentrale Y-Dude Channel-Verwaltung: eigene und moderierte Channels, gefolgte Channels und neue Channels erstellen.",
      },
      { property: "og:title", content: "Meine Channels — Y-Dude" },
      {
        property: "og:description",
        content: "Channels verwalten, moderieren und folgen.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <RouteNotice kind="error" />,
  notFoundComponent: () => <RouteNotice kind="notFound" />,
  component: ChannelsOverview,
});

/** Kurzmeldungen der Route – immer in der aktiven Sprache. */
function RouteNotice({ kind }: { kind: "error" | "notFound" }) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  return (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      {kind === "error" ? c.channelsLoadFailed : c.notFound}
    </div>
  );
}

function ChannelsOverview() {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const router = useRouter();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const term = q.trim();

  const loadFollowed = useServerFn(listFollowedChannels);
  const search = useServerFn(searchChannels);

  const { data: followed = [] } = useQuery({
    queryKey: ["followed-channels"],
    queryFn: () => loadFollowed(),
    staleTime: 60_000,
  });

  /** Suche nur bei Eingabe – ohne Eingabe bleibt die Ansicht abo-fokussiert. */
  const { data: results = [], isFetching: searching } = useQuery({
    queryKey: ["channel-search", term],
    queryFn: () => search({ data: { q: term, limit: 20, offset: 0 } }),
    enabled: term.length > 0,
    staleTime: 30_000,
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4">
      <header className="mb-4 flex items-center gap-3">
        <BackButton
          onClick={() => goBackOr(router, "/dev")}
          ariaLabel={c.back}
          className="shrink-0"
        />
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold">
          <Tv className="h-5 w-5 shrink-0 text-brand" /> {c.channelsTitle}
        </h1>
        <div className="flex shrink-0 flex-col items-stretch gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-bold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> {c.createChannel}
          </button>
          <Link
            to="/channels/mine"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-bold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            <Settings2 className="h-4 w-4" /> {c.manageChannels}
          </Link>
        </div>
      </header>


      <section className="mb-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {c.followedHeading}
        </h2>
        {followed.length === 0 ? (
          <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
            {c.noFollowedChannels}
          </p>
        ) : (
          <div className="space-y-2">
            {followed.map((x) => (
              <FollowRow
                key={x.id}
                id={x.id}
                name={x.name}
                icon={x.icon}
                meta={`${x.categoryName ? categoryLabel(lang, { name: x.categoryName, nameEn: x.categoryNameEn, nameEl: x.categoryNameEl }) : c.noCategory} · ${x.followersCount} ${c.followersSuffix}`}
                following
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <label className="mb-2 flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={c.searchPlaceholder}
            aria-label={c.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        {term.length > 0 && (
          <div className="space-y-2">
            {searching && (
              <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {c.searching}
              </p>
            )}
            {!searching && results.length === 0 && (
              <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                {c.noResults}
              </p>
            )}
            {results.map((x) => (
                <FollowRow
                  key={x.id}
                  id={x.id}
                  name={x.name}
                  icon={x.icon}
                  meta={`${x.categoryName ? categoryLabel(lang, { name: x.categoryName, nameEn: x.categoryNameEn, nameEl: x.categoryNameEl }) : c.noCategory} · ${x.followersCount} ${c.followersSuffix}`}
                  following={x.following}
                />
              ))}
          </div>
        )}
      </section>

      {createOpen && <CreateChannelDialog onClose={() => setCreateOpen(false)} />}
    </div>
  );
}


/** Zeile für gefolgte oder gefundene Channels: öffnen + folgen/entfolgen. */
function FollowRow({
  id,
  name,
  icon,
  meta,
  following,
}: {
  id: string;
  name: string;
  icon: string | null;
  meta: string;
  following: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="w-6 shrink-0 text-center text-lg">{icon ?? "📺"}</span>
      <Link to="/channels/$channelId" params={{ channelId: id }} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
      </Link>
      <ChannelFollowButton channelId={id} following={following} />
    </div>
  );
}

/** Neuen Channel anlegen – nutzt die bestehende `createChannel`-API. */
function CreateChannelDialog({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const qc = useQueryClient();
  const navigate = useNavigate();
  const create = useServerFn(createChannel);
  const loadCategories = useServerFn(listChannelCategories);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["channel-categories"],
    queryFn: () => loadCategories(),
    staleTime: 600_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: name.trim(),
          icon: icon.trim() || null,
          description: description.trim() || null,
          categoryId: categoryId || null,
        },
      }),
    onSuccess: async (channel) => {
      // Neuer Channel erscheint sofort unter „Meine Channels“.
      await qc.invalidateQueries({ queryKey: ["managed-channels"] });
      toast.success(c.channelCreated);
      onClose();
      if (channel?.id) {
        void navigate({ to: "/channels/$channelId", params: { channelId: channel.id } });
      }
    },
    onError: () => toast.error(c.channelCreateFailed),
  });

  return (
    <div className="fixed inset-0 z-[200] grid place-items-end bg-background/80 p-3 backdrop-blur sm:place-items-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-base font-bold">{c.createChannel}</h2>
          <CloseButton onClick={onClose} label={c.close} />
        </div>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={c.namePlaceholder}
            aria-label={c.namePlaceholder}
            maxLength={60}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder={c.iconPlaceholder}
            aria-label={c.iconPlaceholder}
            maxLength={8}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
          <CategoryPicker
            categories={categories}
            value={categoryId || null}
            onChange={(id) => setCategoryId(id ?? "")}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={c.descriptionPlaceholder}
            aria-label={c.descriptionPlaceholder}
            maxLength={500}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
        </div>
        <button
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {c.createChannel}
        </button>
      </div>
    </div>
  );
}
