/**
 * Channel-Verwaltung fuer Owner und Moderatoren.
 *
 * Nutzt ausschliesslich die bestehende Channel-Struktur (`channels`,
 * `channel_categories`, `channel_follows`, `posts.channel_id`) sowie die
 * neue Rollen-Relation `channel_members`. Alle Aktionen sind serverseitig
 * über RLS bzw. geprüfte Datenbankfunktionen abgesichert – die UI blendet
 * lediglich zusaetzlich aus, was der Nutzer nicht darf.
 */

import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  Pin,
  PinOff,
  Ban,
  Trash2,
  Users,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Tv,
  Loader2,
  ShoppingBag,
} from "lucide-react";
import { goBackOr } from "@/lib/back-nav";
import { useLang } from "@/lib/lang-context";
import { categoryLabel, channelTexts } from "@/lib/i18n-channels";
import { useManagedChannels } from "@/lib/use-managed-channels";
import { ReportMenu } from "@/components/ReportDialog";
import { ChannelFollowButton } from "@/components/channels/ChannelFollowButton";
import { CategoryPicker } from "@/components/channels/CategoryPicker";
import { MarketItemCard } from "@/components/market/MarketItemCard";
import { marketTexts } from "@/lib/i18n-market";
import { listChannelMarketItems } from "@/lib/market.functions";
import { signPaths, variantPath } from "@/lib/media";

import {
  getChannel,
  listChannelCategories,
  listChannelModerationPosts,
  listChannelFollowers,
  listChannelMembers,
  listChannelBans,
  addChannelModerator,
  removeChannelMember,
  moderateChannelPost,
  setChannelBan,
  updateChannel,
} from "@/lib/channels.functions";

export const Route = createFileRoute("/_authenticated/channels/$channelId")({
  head: () => ({
    meta: [
      { title: "Channel verwalten — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Eigenen Y-Dude Channel verwalten, Beiträge moderieren und Moderatoren einsetzen.",
      },
      { property: "og:title", content: "Channel verwalten — Y-Dude" },
      { property: "og:description", content: "Channel-Einstellungen, Moderation und Follower." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => <RouteNotice kind="error" />,
  notFoundComponent: () => <RouteNotice kind="notFound" />,
  /**
   * Optionaler Tiefenlink aus der Channel-Uebersicht (`?tab=`) – erlaubt es,
   * direkt in Moderation, Einstellungen oder Team zu springen.
   */
  validateSearch: (search: Record<string, unknown>) => {
    const raw = String(search.tab ?? "");
    const tab = (["moderate", "settings", "team", "followers", "market"] as const).find(
      (x) => x === raw,
    );
    return tab ? { tab } : {};
  },
  component: ChannelManagePage,
});

type Tab = "moderate" | "settings" | "team" | "followers" | "market";

/** Kurzmeldungen der Route – immer in der aktiven Sprache. */
function RouteNotice({ kind }: { kind: "error" | "notFound" }) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  return (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      {kind === "error" ? c.channelLoadFailed : c.channelNotFound}
    </div>
  );
}

function ChannelManagePage() {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const { channelId } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const loadChannel = useServerFn(getChannel);
  const loadCategories = useServerFn(listChannelCategories);
  const loadPosts = useServerFn(listChannelModerationPosts);
  const loadFollowers = useServerFn(listChannelFollowers);
  const loadMembers = useServerFn(listChannelMembers);
  const loadBans = useServerFn(listChannelBans);
  const moderate = useServerFn(moderateChannelPost);
  const patchChannel = useServerFn(updateChannel);
  const addMod = useServerFn(addChannelModerator);
  const removeMember = useServerFn(removeChannelMember);
  const banUser = useServerFn(setChannelBan);

  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(initialTab ?? "moderate");
  const [busy, setBusy] = useState(false);

  const { data: channel, isLoading } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => loadChannel({ data: { channelId } }),
    // Channel-Metadaten (Name, Icon, Kategorie) aendern sich selten.
    staleTime: 60_000,
  });

  /**
   * Moderationsliste: seitenweise (30 Beitraege pro Seite). Die Profile der
   * Autoren kommen serverseitig gebuendelt mit – pro Seite genau zwei
   * Abfragen, unabhaengig von der Anzahl der Beitraege.
   */
  const MOD_PAGE = 30;
  const modPosts = useInfiniteQuery({
    queryKey: ["channel-mod-posts", channelId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadPosts({ data: { channelId, limit: MOD_PAGE, offset: pageParam as number } }),
    getNextPageParam: (last, all) =>
      last.length < MOD_PAGE ? undefined : all.reduce((n, page) => n + page.length, 0),
    enabled: tab === "moderate",
  });
  const posts = useMemo(() => modPosts.data?.pages.flat() ?? [], [modPosts.data]);
  const postsLoading = modPosts.isLoading;

  /** Followerliste: ebenfalls seitenweise, nur im entsprechenden Reiter. */
  const FOLLOWER_PAGE = 50;
  const followerPages = useInfiniteQuery({
    queryKey: ["channel-followers", channelId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      loadFollowers({ data: { channelId, limit: FOLLOWER_PAGE, offset: pageParam as number } }),
    getNextPageParam: (last, all) =>
      last.length < FOLLOWER_PAGE ? undefined : all.reduce((n, page) => n + page.length, 0),
    enabled: tab === "followers",
  });
  const followers = useMemo(() => followerPages.data?.pages.flat() ?? [], [followerPages.data]);

  const { data: members = [] } = useQuery({
    queryKey: ["channel-members", channelId],
    queryFn: () => loadMembers({ data: { channelId } }),
    enabled: tab === "team",
  });
  const { data: bans = [] } = useQuery({
    queryKey: ["channel-bans", channelId],
    queryFn: () => loadBans({ data: { channelId } }),
    enabled: tab === "team" || tab === "moderate",
  });
  /** Market-Reiter: verknuepfte Artikel des Channels (seitenweise Basis). */
  const loadMarket = useServerFn(listChannelMarketItems);
  const marketQuery = useQuery({
    queryKey: ["channel-market", channelId],
    queryFn: () => loadMarket({ data: { channelId, limit: 20, offset: 0 } }),
    enabled: tab === "market",
    staleTime: 60_000,
  });
  const marketItems = marketQuery.data?.items ?? [];
  const [marketCovers, setMarketCovers] = useState<Record<string, string>>({});
  const marketKey = marketItems.map((i) => `${i.id}:${i.coverPath ?? ""}`).join("|");
  useEffect(() => {
    const withCover = marketItems.filter((i) => i.coverPath);
    if (withCover.length === 0) {
      setMarketCovers({});
      return;
    }
    let alive = true;
    const paths = withCover.flatMap((i) => [
      variantPath(i.coverPath!, "medium"),
      variantPath(i.coverPath!, "thumb"),
      i.coverPath!,
    ]);
    void signPaths(paths).then((map) => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const i of withCover) {
        const medium = variantPath(i.coverPath!, "medium");
        const thumb = variantPath(i.coverPath!, "thumb");
        const url = (medium && map[medium]) ?? (thumb && map[thumb]) ?? map[i.coverPath!];
        if (url) next[i.id] = url;
      }
      setMarketCovers(next);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketKey]);

  const { data: categories = [] } = useQuery({
    queryKey: ["channel-categories"],
    queryFn: () => loadCategories(),
    enabled: tab === "settings",
    // Kategorien sind nahezu statisch.
    staleTime: 600_000,
  });

  /**
   * Berechtigung: die Rolle stammt aus `channel_members` (Server, RLS).
   * Owner sehen die Verwaltung, Moderatoren ausschliesslich die Moderation.
   * Die Liste ist bereits fuer das Menue geladen und wird hier nur
   * mitbenutzt – keine zusaetzliche Abfrage.
   */
  const { channels: managed } = useManagedChannels();
  const canManage = useMemo(
    () => managed.find((c) => c.id === channelId)?.role === "owner",
    [managed, channelId],
  );

  const bannedIds = useMemo(() => new Set(bans.map((b) => b.userId)), [bans]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["channel-mod-posts", channelId] }),
      qc.invalidateQueries({ queryKey: ["channel", channelId] }),
      qc.invalidateQueries({ queryKey: ["channel-bans", channelId] }),
      qc.invalidateQueries({ queryKey: ["channel-members", channelId] }),
      qc.invalidateQueries({ queryKey: ["managed-channels"] }),
    ]);
  };

  const runModeration = async (postId: string, action: "approve" | "remove" | "pin" | "unpin") => {
    setBusy(true);
    try {
      await moderate({ data: { postId, action } });
      toast.success(
        action === "remove"
          ? c.removedToast
          : action === "approve"
            ? c.approvedToast
            : action === "pin"
              ? c.pinnedToast
              : c.unpinnedToast,
      );
      await refresh();
    } catch {
      toast.error(c.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const toggleBan = async (userId: string, banned: boolean) => {
    setBusy(true);
    try {
      await banUser({ data: { channelId, userId, banned } });
      toast.success(banned ? c.bannedToast : c.unbannedToast);
      await refresh();
    } catch {
      toast.error(c.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {c.channelLoading}
      </div>
    );
  }
  if (!channel) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">{c.channelNotFound}</div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Tv; ownerOnly?: boolean }[] = [
    { id: "moderate", label: c.tabModerate, icon: ShieldAlert },
    { id: "settings", label: c.tabSettings, icon: Settings, ownerOnly: true },
    { id: "team", label: c.tabTeam, icon: ShieldCheck, ownerOnly: true },
    { id: "followers", label: c.tabFollowers, icon: Users },
    { id: "market", label: marketTexts[lang].marketTab, icon: ShoppingBag },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4">
      <header className="mb-4 flex items-center gap-3">
        <BackButton onClick={() => goBackOr(router, "/dev")} ariaLabel={c.back} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">
            <span className="mr-1">{channel.icon ?? "📺"}</span>
            {channel.name}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {channel.categoryName
              ? categoryLabel(lang, {
                  name: channel.categoryName,
                  nameEn: channel.categoryNameEn,
                  nameEl: channel.categoryNameEl,
                })
              : c.noCategory}{" "}
            · {channel.followersCount} {c.followersSuffix} · {channel.postsCount} {c.postsSuffix}
            {!channel.isActive && ` · ${c.deactivatedSuffix}`}
          </p>
        </div>
        {/* Folgen ist unabhaengig von der Verwaltung – der Owner behaelt
            seine Rechte, auch wenn er dem eigenen Channel nicht folgt. */}
        <ChannelFollowButton channelId={channel.id} following={channel.following} size="md" />
      </header>

      <nav className="mb-4 flex flex-wrap gap-1.5">
        {tabs
          .filter((x) => !x.ownerOnly || canManage)
          .map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                tab === x.id
                  ? "border-brand/60 bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <x.icon className="h-3.5 w-3.5" />
              {x.label}
            </button>
          ))}
      </nav>

      {tab === "market" && (
        <section className="space-y-3">
          {marketQuery.isLoading && (
            <p className="p-3 text-sm text-muted-foreground">{marketTexts[lang].loading}</p>
          )}
          {!marketQuery.isLoading && marketItems.length === 0 && (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              {marketTexts[lang].noResults}
            </p>
          )}
          {marketItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {marketItems.map((item) => (
                <MarketItemCard
                  key={item.id}
                  item={item}
                  lang={lang}
                  imageUrl={marketCovers[item.id] ?? null}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "moderate" && (
        <section className="space-y-2">
          <p className="rounded-xl border border-border bg-background p-3 text-[11px] leading-snug text-muted-foreground">
            {c.moderationHint}
          </p>
          {postsLoading && <p className="p-3 text-sm text-muted-foreground">{c.postsLoading}</p>}
          {!postsLoading && posts.length === 0 && (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              {c.noPostsInChannel}
            </p>
          )}
          {posts.map((p) => (
            <article
              key={p.id}
              className="flex gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {p.displayName ?? (p.username ? `@${p.username}` : c.userFallback)}
                  </span>
                  {p.pinned && (
                    <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] text-brand">
                      {c.pinnedBadge}
                    </span>
                  )}
                  {p.approvedAt && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {c.approvedBadge}
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {p.title ?? p.description ?? "—"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ModBtn
                    disabled={busy}
                    onClick={() => runModeration(p.id, "approve")}
                    icon={Check}
                    label={c.approveBtn}
                  />
                  <ModBtn
                    disabled={busy}
                    onClick={() => runModeration(p.id, p.pinned ? "unpin" : "pin")}
                    icon={p.pinned ? PinOff : Pin}
                    label={p.pinned ? c.unpinBtn : c.pinBtn}
                  />
                  <ModBtn
                    disabled={busy}
                    onClick={() => runModeration(p.id, "remove")}
                    icon={Trash2}
                    label={c.removeFromChannelBtn}
                    danger
                  />
                  <ModBtn
                    disabled={busy}
                    onClick={() => toggleBan(p.userId, !bannedIds.has(p.userId))}
                    icon={Ban}
                    label={bannedIds.has(p.userId) ? c.unbanUserBtn : c.banUserBtn}
                    danger={!bannedIds.has(p.userId)}
                  />
                  <ReportMenu targetType="post" targetId={p.id} targetUserId={p.userId} />
                </div>
              </div>
            </article>
          ))}
          {modPosts.hasNextPage && (
            <button
              onClick={() => void modPosts.fetchNextPage()}
              disabled={modPosts.isFetchingNextPage}
              className="w-full rounded-xl border border-border bg-background py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {modPosts.isFetchingNextPage ? c.loading : c.loadMorePosts}
            </button>
          )}
        </section>
      )}

      {tab === "settings" && canManage && (
        <ChannelSettings
          channel={channel}
          categories={categories}
          onSave={async (patch) => {
            setBusy(true);
            try {
              await patchChannel({ data: { channelId, ...patch } });
              toast.success(c.savedToast);
              await refresh();
            } catch {
              toast.error(c.saveFailed);
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      )}

      {tab === "team" && canManage && (
        <section className="space-y-3">
          <AddModerator
            busy={busy}
            onAdd={async (username) => {
              setBusy(true);
              try {
                await addMod({ data: { channelId, username } });
                toast.success(c.moderatorAdded);
                await refresh();
              } catch {
                toast.error(c.moderatorAddFailed);
              } finally {
                setBusy(false);
              }
            }}
          />
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {m.displayName ?? (m.username ? `@${m.username}` : m.userId.slice(0, 8))}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {m.role}
                </span>
                {m.role === "moderator" && (
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await removeMember({ data: { channelId, userId: m.userId } });
                        toast.success(c.moderatorRemoved);
                        await refresh();
                      } catch {
                        toast.error(c.actionFailed);
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded-full border border-destructive/50 px-2 py-1 text-[11px] text-destructive"
                  >
                    {c.removeBtn}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {bans.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-3">
              <h2 className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                {c.bannedUsersHeading}
              </h2>
              <ul className="space-y-1">
                {bans.map((b) => (
                  <li key={b.userId} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">
                      {b.displayName ?? (b.username ? `@${b.username}` : b.userId.slice(0, 8))}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => toggleBan(b.userId, false)}
                      className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {c.unbanUserBtn}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {tab === "followers" && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-background">
          {followers.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">{c.noFollowers}</li>
          )}
          {followers.map((f) => (
            <li key={f.userId} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {f.displayName ?? (f.username ? `@${f.username}` : f.userId.slice(0, 8))}
              </span>
              {f.username && <span className="text-xs text-muted-foreground">@{f.username}</span>}
            </li>
          ))}
          {followerPages.hasNextPage && (
            <li className="p-2">
              <button
                onClick={() => void followerPages.fetchNextPage()}
                disabled={followerPages.isFetchingNextPage}
                className="w-full rounded-lg border border-border py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {followerPages.isFetchingNextPage ? c.loading : c.loadMoreFollowers}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ModBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Check;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors disabled:opacity-50 ${
        danger
          ? "border-destructive/50 text-destructive hover:bg-destructive/10"
          : "border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AddModerator({ onAdd, busy }: { onAdd: (username: string) => void; busy: boolean }) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value);
        setValue("");
      }}
      className="flex items-center gap-2 rounded-xl border border-border bg-background p-3"
    >
      <UserPlus className="h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="@username"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-full border border-brand/60 px-3 py-1 text-xs text-brand disabled:opacity-50"
      >
        {c.addModerator}
      </button>
    </form>
  );
}

function ChannelSettings({
  channel,
  categories,
  onSave,
  busy,
}: {
  channel: {
    name: string;
    description: string | null;
    icon: string | null;
    imageUrl: string | null;
    categoryId: string | null;
    isPublic: boolean;
    isActive: boolean;
  };
  categories: {
    id: string;
    name: string;
    nameEn?: string | null;
    nameEl?: string | null;
    icon?: string | null;
    parentCategoryId: string | null;
  }[];
  onSave: (patch: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const { lang } = useLang();
  const c = channelTexts[lang];
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [icon, setIcon] = useState(channel.icon ?? "");
  const [imageUrl, setImageUrl] = useState(channel.imageUrl ?? "");
  // Die gespeicherte Kategorie (Haupt- oder Unterkategorie) ist die einzige
  // Quelle; Kategorie/Unterkategorie leitet der Picker daraus ab.
  const [categoryId, setCategoryId] = useState<string | null>(channel.categoryId);
  const [isPublic, setIsPublic] = useState(channel.isPublic);
  const [isActive, setIsActive] = useState(channel.isActive);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name,
          description: description.trim() || null,
          icon: icon.trim() || null,
          imageUrl: imageUrl.trim() || null,
          categoryId,
          isPublic,
          isActive,
        });
      }}
      className="space-y-3 rounded-xl border border-border bg-background p-4"
    >
      <Field label={c.fieldName}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
        />
      </Field>
      <Field label={c.fieldDescription}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={c.fieldIcon}>
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={40}
            placeholder="📺"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
        </Field>
        <Field label={c.fieldImageUrl}>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
        </Field>
      </div>

      <Field label={c.fieldCategory}>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        {c.publicToggle}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        {c.activeToggle}
      </label>
      <p className="text-[11px] leading-snug text-muted-foreground">{c.deleteHint}</p>

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
      >
        {c.save}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
