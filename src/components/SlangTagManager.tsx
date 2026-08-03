import { useMemo, useState } from "react";
import { Check, Forward, KeyRound, Pencil, Save, Share2, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useData } from "@/lib/data-context";
import { useSocial } from "@/lib/social-context";
import { useLang } from "@/lib/lang-context";
import { useSlangTagSharing, type SlangTagGrant } from "@/lib/slangtag-grants";
import { checkSlangTagName } from "@/lib/slangtag-rules";
import { SlangTagName } from "@/components/SlangTagName";
import { formatDateTime } from "@/lib/format-date";
import { formatStat, type SlangTag } from "@/lib/types";

type ManagerTab = "mine" | "shared" | "requests";

/** Auswahl einer Verbindung (Freund) für Freigabe oder Weitergabe. */
function FriendPicker({
  exclude,
  onSelect,
  onClose,
}: {
  exclude: string[];
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  const { profiles, me } = useData();
  const { connectedIds } = useSocial();
  const { t } = useLang();
  const friends = connectedIds.filter((id) => id !== me?.id && !exclude.includes(id));

  return (
    <div className="mt-1.5 rounded-lg border border-brand/30 bg-black/30 p-1.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
          {t.tmShareWith}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="text-muted-foreground hover:text-brand"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {friends.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">{t.tmNoConnections}</p>
      ) : (
        <div className="max-h-24 space-y-1 overflow-y-auto overscroll-contain pr-1">
          {friends.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className="flex w-full items-center gap-1.5 rounded-md border border-white/10 px-1.5 py-1 text-left text-[10px] hover:border-brand/50 hover:text-brand"
            >
              <Users className="h-3 w-3 shrink-0" />
              <span className="truncate">@{profiles[id]?.username ?? id.slice(0, 6)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="truncate">
      {value} {label}
    </span>
  );
}

/** Eigener SlangTag: umbenennen, löschen, Freigaben verwalten. */
function OwnedRow({
  tag,
  grants,
  onShare,
  onRevoke,
  onChanged,
}: {
  tag: SlangTag;
  grants: SlangTagGrant[];
  onShare: (tagId: string, granteeId: string) => Promise<boolean>;
  onRevoke: (grantId: string) => Promise<boolean>;
  onChanged: () => void;
}) {
  const { tags, profiles, canDeleteTag, deleteTag } = useData();
  const { t } = useLang();
  const [picking, setPicking] = useState(false);
  const [showGrants, setShowGrants] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(tag.name);
  const [busy, setBusy] = useState(false);

  const rename = async () => {
    const check = checkSlangTagName(
      name,
      tags.filter((entry) => entry.id !== tag.id),
    );
    if (!check.ok) {
      toast.error(check.error ?? t.tmActionFailed);
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("slang_tags")
      .update({ name: check.value } as never)
      .eq("id", tag.id);
    setBusy(false);
    if (error) {
      toast.error(t.tmActionFailed);
      return;
    }
    setRenaming(false);
    toast.success(t.tmSaved);
    onChanged();
  };

  return (
    <div className="rounded-lg border border-white/15 bg-white/5 p-2 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-1.5">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex items-center gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-32 rounded-md border border-brand/40 bg-black/40 px-1.5 py-0.5 text-[11px] outline-none focus:border-brand"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void rename()}
                aria-label={t.save}
                className="text-brand hover:opacity-80 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setName(tag.name);
                }}
                aria-label={t.cancel}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <p className="truncate text-[11px] font-black leading-tight">
              <SlangTagName tag={tag} />
            </p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-white/70">
            <span>{tag.duration}</span>
            <Stat label={t.plays} value={formatStat(tag.stats.plays)} />
            <Stat label={t.uses} value={formatStat(tag.stats.uses)} />
            <Stat label={t.tmLikes} value={formatStat(tag.stats.likes)} />
            <span className="truncate">
              {formatDateTime(new Date(tag.createdAt).toISOString())}
            </span>
            <span className="rounded-full border border-brand/40 px-1.5 text-brand">
              {t.tmStatusOwner}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-brand/40 px-2 py-0.5 text-[9px] font-bold text-brand hover:bg-brand/10"
          >
            <Share2 className="h-2.5 w-2.5" /> {t.tmShare}
          </button>
          <button
            type="button"
            onClick={() => setShowGrants((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[9px] font-bold text-muted-foreground hover:text-foreground"
          >
            <KeyRound className="h-2.5 w-2.5" /> {t.tmManageGrants} ({grants.length})
          </button>
          {!renaming && (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              aria-label={t.tmRename}
              title={t.tmRename}
              className="text-muted-foreground hover:text-brand"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {canDeleteTag(tag) && (
            <button
              type="button"
              onClick={() => {
                void deleteTag(tag.id).then((ok) =>
                  toast[ok ? "success" : "error"](ok ? t.tagDeleted : t.tagDeleteFailed),
                );
              }}
              aria-label={t.deleteTag}
              title={t.deleteTag}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {picking && (
        <FriendPicker
          exclude={grants.map((g) => g.granteeId)}
          onClose={() => setPicking(false)}
          onSelect={(id) => {
            void onShare(tag.id, id).then((ok) => {
              toast[ok ? "success" : "error"](ok ? t.tmSharedOk : t.tmActionFailed);
              if (ok) setPicking(false);
            });
          }}
        />
      )}

      {showGrants && (
        <div className="mt-1.5 space-y-1 rounded-lg border border-white/10 bg-black/20 p-1.5">
          {grants.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">{t.tmNoGrants}</p>
          ) : (
            grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-1.5 text-[10px]">
                <span className="truncate">
                  @{profiles[g.granteeId]?.username ?? g.granteeId.slice(0, 6)} ·{" "}
                  {formatDateTime(new Date(g.createdAt).toISOString())}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void onRevoke(g.id).then((ok) =>
                      toast[ok ? "success" : "error"](ok ? t.tmRevoked : t.tmActionFailed),
                    );
                  }}
                  className="shrink-0 rounded-full border border-white/20 px-1.5 text-[9px] font-bold text-muted-foreground hover:border-destructive/60 hover:text-destructive"
                >
                  {t.tmRevoke}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * SlangTag Manager – zentrale Verwaltung aller eigenen SlangTags,
 * erhaltener Freigaben und offener Freigabeanfragen. Eigentum bleibt
 * dauerhaft beim Ersteller; alle Statistiken bleiben an der SlangTag-ID.
 */
export function SlangTagManager() {
  const { me, tags, getTag, profiles } = useData();
  const { t } = useLang();
  const [tab, setTab] = useState<ManagerTab>("mine");
  const {
    givenGrants,
    receivedGrants,
    incomingRequests,
    shareWith,
    revokeGrant,
    requestForward,
    decideRequest,
    refresh,
  } = useSlangTagSharing(me?.id ?? null);
  const [forwardFor, setForwardFor] = useState<string | null>(null);

  const owned = useMemo(
    () =>
      tags
        .filter((tag) => tag.ownerId === me?.id || tag.creatorId === me?.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [tags, me],
  );

  const grantsByTag = useMemo(() => {
    const map = new Map<string, SlangTagGrant[]>();
    for (const g of givenGrants) map.set(g.tagId, [...(map.get(g.tagId) ?? []), g]);
    return map;
  }, [givenGrants]);

  const tabs: { id: ManagerTab; icon: string; label: string; count: number }[] = [
    { id: "mine", icon: "🔑", label: t.tmTabMine, count: owned.length },
    { id: "shared", icon: "🤝", label: t.tmTabShared, count: receivedGrants.length },
    { id: "requests", icon: "📩", label: t.tmTabRequests, count: incomingRequests.length },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-foreground">
          <KeyRound className="h-3.5 w-3.5 text-brand" /> {t.tagManager}
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {tabs.find((entry) => entry.id === tab)?.count ?? 0}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t.tagManager}
        className="mb-2 flex items-center gap-1 overflow-x-auto rounded-lg border border-white/15 bg-white/5 p-1 backdrop-blur-xl"
      >
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === tab}
            onClick={() => setTab(entry.id)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-bold tracking-tight transition-colors ${
              entry.id === tab
                ? "border border-brand/50 bg-brand/20 text-brand shadow-glow"
                : "border border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden>{entry.icon}</span> {entry.label}
            {entry.count > 0 && <span className="ml-1 opacity-70">{entry.count}</span>}
          </button>
        ))}
      </div>

      <div
        style={{ WebkitOverflowScrolling: "touch" }}
        className="max-h-64 space-y-1.5 overflow-y-auto overscroll-contain pb-1 pr-1"
      >
        {tab === "mine" &&
          (owned.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
              {t.tmEmptyMine}
            </p>
          ) : (
            owned.map((tag) => (
              <OwnedRow
                key={tag.id}
                tag={tag}
                grants={grantsByTag.get(tag.id) ?? []}
                onShare={(tagId, granteeId) => shareWith(tagId, me!.id, granteeId)}
                onRevoke={revokeGrant}
                onChanged={refresh}
              />
            ))
          ))}

        {tab === "shared" &&
          (receivedGrants.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
              {t.tmEmptyShared}
            </p>
          ) : (
            receivedGrants.map((grant) => {
              const tag = getTag(grant.tagId);
              if (!tag) return null;
              return (
                <div
                  key={grant.id}
                  className="rounded-lg border border-white/15 bg-white/5 p-2 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black leading-tight">
                        <SlangTagName tag={tag} />
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-white/70">
                        <span>{tag.duration}</span>
                        <Stat label={t.plays} value={formatStat(tag.stats.plays)} />
                        <Stat label={t.uses} value={formatStat(tag.stats.uses)} />
                        <span className="truncate">
                          {t.tmOwner}: @{profiles[grant.ownerId]?.username ?? "—"}
                        </span>
                        <span className="rounded-full border border-white/20 px-1.5">
                          {t.tmStatusShared}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForwardFor(forwardFor === grant.id ? null : grant.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-brand/40 px-2 py-0.5 text-[9px] font-bold text-brand hover:bg-brand/10"
                    >
                      <Forward className="h-2.5 w-2.5" /> {t.tmForward}
                    </button>
                  </div>
                  {forwardFor === grant.id && (
                    <FriendPicker
                      exclude={[grant.ownerId]}
                      onClose={() => setForwardFor(null)}
                      onSelect={(id) => {
                        void requestForward(grant.tagId, grant.ownerId, id).then((ok) => {
                          toast[ok ? "success" : "error"](ok ? t.tmRequestSent : t.tmActionFailed);
                          if (ok) setForwardFor(null);
                        });
                      }}
                    />
                  )}
                  <p className="mt-1 text-[9px] text-muted-foreground">{t.tmForwardHint}</p>
                </div>
              );
            })
          ))}

        {tab === "requests" &&
          (incomingRequests.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
              {t.tmEmptyRequests}
            </p>
          ) : (
            incomingRequests.map((req) => {
              const tag = getTag(req.tagId);
              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-white/15 bg-white/5 p-2 backdrop-blur-xl"
                >
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <div className="min-w-0 text-[10px]">
                      <p className="truncate text-[11px] font-black leading-tight">
                        {tag ? <SlangTagName tag={tag} /> : "—"}
                      </p>
                      <p className="mt-0.5 truncate text-white/70">
                        @{profiles[req.requesterId]?.username ?? "—"} → @
                        {profiles[req.targetId]?.username ?? "—"}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {formatDateTime(new Date(req.createdAt).toISOString())}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          void decideRequest(req.id, true).then((ok) =>
                            toast[ok ? "success" : "error"](ok ? t.tmApproved : t.tmActionFailed),
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-brand/50 bg-brand/15 px-2 py-0.5 text-[9px] font-bold text-brand"
                      >
                        <Check className="h-2.5 w-2.5" /> {t.tmApprove}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void decideRequest(req.id, false).then((ok) =>
                            toast[ok ? "success" : "error"](ok ? t.tmDeclined : t.tmActionFailed),
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-white/20 px-2 py-0.5 text-[9px] font-bold text-muted-foreground hover:border-destructive/60 hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" /> {t.tmDecline}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ))}
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground">{t.tagManagerHint}</p>
    </div>
  );
}
