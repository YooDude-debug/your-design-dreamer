/**
 * Channel-Verwaltung fuer Owner und Moderatoren.
 *
 * Nutzt ausschliesslich die bestehende Channel-Struktur (`channels`,
 * `channel_categories`, `channel_follows`, `posts.channel_id`) sowie die
 * neue Rollen-Relation `channel_members`. Alle Aktionen sind serverseitig
 * über RLS bzw. geprüfte Datenbankfunktionen abgesichert – die UI blendet
 * lediglich zusaetzlich aus, was der Nutzer nicht darf.
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
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
} from "lucide-react";
import { goBackOr } from "@/lib/back-nav";
import { useManagedChannels } from "@/lib/use-managed-channels";
import { ReportMenu } from "@/components/ReportDialog";
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
  errorComponent: () => (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">
      Channel konnte nicht geladen werden.
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl p-6 text-sm text-muted-foreground">Channel nicht gefunden.</div>
  ),
  component: ChannelManagePage,
});

type Tab = "moderate" | "settings" | "team" | "followers";

function ChannelManagePage() {
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

  const [tab, setTab] = useState<Tab>("moderate");
  const [busy, setBusy] = useState(false);

  const { data: channel, isLoading } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: () => loadChannel({ data: { channelId } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["channel-members", channelId],
    queryFn: () => loadMembers({ data: { channelId } }),
  });
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["channel-mod-posts", channelId],
    queryFn: () => loadPosts({ data: { channelId } }),
  });
  const { data: followers = [] } = useQuery({
    queryKey: ["channel-followers", channelId],
    queryFn: () => loadFollowers({ data: { channelId } }),
    enabled: tab === "followers",
  });
  const { data: bans = [] } = useQuery({
    queryKey: ["channel-bans", channelId],
    queryFn: () => loadBans({ data: { channelId } }),
    enabled: tab === "team" || tab === "moderate",
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["channel-categories"],
    queryFn: () => loadCategories(),
    enabled: tab === "settings",
    staleTime: 300_000,
  });

  /**
   * Berechtigung: die Rolle stammt aus `channel_members` (Server, RLS).
   * Owner sehen die Verwaltung, Moderatoren ausschliesslich die Moderation.
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
          ? "Aus Channel entfernt – Beitrag bleibt im Feed erhalten"
          : action === "approve"
            ? "Beitrag im Channel zugelassen"
            : action === "pin"
              ? "Beitrag angepinnt"
              : "Anpinnen aufgehoben",
      );
      await refresh();
    } catch {
      toast.error("Aktion nicht möglich");
    } finally {
      setBusy(false);
    }
  };

  const toggleBan = async (userId: string, banned: boolean) => {
    setBusy(true);
    try {
      await banUser({ data: { channelId, userId, banned } });
      toast.success(banned ? "Nutzer für diesen Channel gesperrt" : "Sperre aufgehoben");
      await refresh();
    } catch {
      toast.error("Aktion nicht möglich");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Channel wird geladen…
      </div>
    );
  }
  if (!channel) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-muted-foreground">Channel nicht gefunden.</div>;
  }

  const tabs: { id: Tab; label: string; icon: typeof Tv; ownerOnly?: boolean }[] = [
    { id: "moderate", label: "Beiträge moderieren", icon: ShieldAlert },
    { id: "settings", label: "Channel verwalten", icon: Settings, ownerOnly: true },
    { id: "team", label: "Moderatoren", icon: ShieldCheck, ownerOnly: true },
    { id: "followers", label: "Follower", icon: Users },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-4">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={() => goBackOr(router, "/dev")}
          aria-label="Zurück"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold">
            <span className="mr-1">{channel.icon ?? "📺"}</span>
            {channel.name}
          </h1>
          <p className="truncate text-xs text-muted-foreground">
            {channel.categoryName ?? "Ohne Kategorie"} · {channel.followersCount} Follower ·{" "}
            {channel.postsCount} Beiträge
            {!channel.isActive && " · deaktiviert"}
          </p>
        </div>
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

      {tab === "moderate" && (
        <section className="space-y-2">
          <p className="rounded-xl border border-border bg-background p-3 text-[11px] leading-snug text-muted-foreground">
            „Aus Channel entfernen“ löscht keinen Beitrag. Der Beitrag und seine SlangTags bleiben im
            normalen Feed vollständig erhalten – nur die Channel-Zuordnung wird gelöst.
          </p>
          {postsLoading && <p className="p-3 text-sm text-muted-foreground">Beiträge werden geladen…</p>}
          {!postsLoading && posts.length === 0 && (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              Diesem Channel sind noch keine Beiträge zugeordnet.
            </p>
          )}
          {posts.map((p) => (
            <article
              key={p.id}
              className="flex gap-3 rounded-xl border border-border bg-background p-3"
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {p.displayName ?? (p.username ? `@${p.username}` : "Nutzer")}
                  </span>
                  {p.pinned && (
                    <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] text-brand">
                      angepinnt
                    </span>
                  )}
                  {p.approvedAt && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      zugelassen
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
                    label="Zulassen"
                  />
                  <ModBtn
                    disabled={busy}
                    onClick={() => runModeration(p.id, p.pinned ? "unpin" : "pin")}
                    icon={p.pinned ? PinOff : Pin}
                    label={p.pinned ? "Nicht anpinnen" : "Anpinnen"}
                  />
                  <ModBtn
                    disabled={busy}
                    onClick={() => runModeration(p.id, "remove")}
                    icon={Trash2}
                    label="Aus Channel entfernen"
                    danger
                  />
                  <ModBtn
                    disabled={busy}
                    onClick={() => toggleBan(p.userId, !bannedIds.has(p.userId))}
                    icon={Ban}
                    label={bannedIds.has(p.userId) ? "Sperre aufheben" : "Nutzer sperren"}
                    danger={!bannedIds.has(p.userId)}
                  />
                  <ReportMenu targetType="post" targetId={p.id} targetUserId={p.userId} />
                </div>
              </div>
            </article>
          ))}
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
              toast.success("Channel gespeichert");
              await refresh();
            } catch {
              toast.error("Speichern nicht möglich");
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
                toast.success("Moderator hinzugefügt");
                await refresh();
              } catch {
                toast.error("Nutzer nicht gefunden oder keine Berechtigung");
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
                        toast.success("Moderator entfernt");
                        await refresh();
                      } catch {
                        toast.error("Aktion nicht möglich");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="rounded-full border border-destructive/50 px-2 py-1 text-[11px] text-destructive"
                  >
                    Entfernen
                  </button>
                )}
              </li>
            ))}
          </ul>

          {bans.length > 0 && (
            <div className="rounded-xl border border-border bg-background p-3">
              <h2 className="mb-2 text-xs font-bold uppercase text-muted-foreground">
                Gesperrte Nutzer
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
                      Sperre aufheben
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
            <li className="p-4 text-sm text-muted-foreground">Noch keine Follower.</li>
          )}
          {followers.map((f) => (
            <li key={f.userId} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {f.displayName ?? (f.username ? `@${f.username}` : f.userId.slice(0, 8))}
              </span>
              {f.username && <span className="text-xs text-muted-foreground">@{f.username}</span>}
            </li>
          ))}
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
        Moderator hinzufügen
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
    parentCategoryId: string | null;
  }[];
  onSave: (patch: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const roots = categories.filter((c) => !c.parentCategoryId);
  const initialParent =
    categories.find((c) => c.id === channel.categoryId)?.parentCategoryId ?? channel.categoryId ?? "";

  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? "");
  const [icon, setIcon] = useState(channel.icon ?? "");
  const [imageUrl, setImageUrl] = useState(channel.imageUrl ?? "");
  const [parentId, setParentId] = useState(initialParent);
  const [subId, setSubId] = useState(
    categories.find((c) => c.id === channel.categoryId)?.parentCategoryId ? channel.categoryId ?? "" : "",
  );
  const [isPublic, setIsPublic] = useState(channel.isPublic);
  const [isActive, setIsActive] = useState(channel.isActive);

  const subs = categories.filter((c) => c.parentCategoryId === parentId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          name,
          description: description.trim() || null,
          icon: icon.trim() || null,
          imageUrl: imageUrl.trim() || null,
          categoryId: subId || parentId || null,
          isPublic,
          isActive,
        });
      }}
      className="space-y-3 rounded-xl border border-border bg-background p-4"
    >
      <Field label="Channel-Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
        />
      </Field>
      <Field label="Beschreibung">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Icon (Emoji)">
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            maxLength={40}
            placeholder="📺"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
        </Field>
        <Field label="Bild-URL">
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-brand/60"
          />
        </Field>
        <Field label="Kategorie">
          <select
            value={parentId}
            onChange={(e) => {
              setParentId(e.target.value);
              setSubId("");
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60"
          >
            <option value="">Ohne Kategorie</option>
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unterkategorie">
          <select
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            disabled={subs.length === 0}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand/60 disabled:opacity-50"
          >
            <option value="">Keine</option>
            {subs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Öffentlich sichtbar und auswählbar
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Channel aktiv
      </label>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Zur Löschung vorbereiten: Channel deaktivieren und auf „nicht öffentlich“ stellen. Bestehende
        Beiträge und SlangTags bleiben unverändert erhalten.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
      >
        Speichern
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
