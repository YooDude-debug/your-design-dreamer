import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  UserPlus,
  Check,
  MapPin,
  Globe,
  MessageSquare,
  Users,
  Clock,
  BadgeCheck,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { useSocial } from "@/lib/social-context";
import { relativeTime, type PresenceStatus } from "@/lib/types";
import { presenceDotClass, presenceLabel, presenceTextClass } from "@/lib/presence";

type Tab = "search" | "requests" | "mine";

function Avatar({
  src,
  name,
  status,
}: {
  src: string | null;
  name: string;
  status?: PresenceStatus;
}) {
  return (
    <div className="relative h-10 w-10 shrink-0">
      <div className="h-10 w-10 overflow-hidden rounded-full border border-brand/40 bg-gradient-to-br from-brand/40 to-brand-cyan/40">
        {src ? (
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm font-black text-brand">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      {status !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${presenceDotClass(status)}`}
        />
      )}
    </div>
  );
}

export function ConnectionsPanel({
  open,
  onClose,
  onMessage,
}: {
  open: boolean;
  onClose: () => void;
  onMessage: (userId: string) => void;
}) {
  const { profiles, ensureProfileDirectory, ensureProfiles } = useData();
  const { t, lang } = useLang();
  const {
    searchProfiles,
    relationWith,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeConnection,
    incoming,
    outgoing,
    connectedIds,
    connectionOf,
    presenceOf,
    suggestions,
    refreshSuggestions,
  } = useSocial();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const loadedRef = useRef(false);

  // Vorschlaege erst beim ersten Oeffnen laden – nicht beim Sitzungsstart.
  useEffect(() => {
    if (!open) return;
    if (!loadedRef.current) {
      loadedRef.current = true;
      void refreshSuggestions(false);
    }
    // Personensuche laeuft serverseitig und begrenzt (P-03). Die Eingabe wird
    // kurz entprellt, damit schnelles Tippen keine Abfrage je Tastendruck
    // erzeugt. Ein fehlgeschlagener Versuch darf die Suche nicht dauerhaft
    // leer lassen – daher bei jedem Oeffnen/jeder Eingabe erneut anfordern.
    const timer = window.setTimeout(() => {
      void ensureProfileDirectory(query);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, query, refreshSuggestions, ensureProfileDirectory]);

  /**
   * Vorschlaege, Anfragen und eigene Connections beziehen sich auf konkrete
   * Konten: die fehlenden Profile werden gezielt per ID nachgeladen (P-03),
   * statt das gesamte Verzeichnis zu laden.
   */
  useEffect(() => {
    if (!open) return;
    void ensureProfiles([
      ...suggestions.map((s) => s.userId),
      ...incoming.map((c) => c.requesterId),
      ...outgoing.map((c) => c.addresseeId),
      ...connectedIds,
    ]);
  }, [open, suggestions, incoming, outgoing, connectedIds, ensureProfiles]);

  if (!open) return null;

  const results = searchProfiles(query);
  const suggested = suggestions
    .map((s) => ({ s, p: profiles[s.userId] }))
    .filter(
      (x): x is { s: (typeof suggestions)[number]; p: NonNullable<typeof x.p> } =>
        Boolean(x.p) && relationWith(x.s.userId) === "none",
    )
    .slice(0, 12);

  const reasonLabel: Record<string, string> = {
    mutual: t.reasonMutual,
    language: t.reasonLanguage,
    region: t.reasonRegion,
    hashtags: t.reasonHashtags,
    slangtags: t.reasonSlangtags,
    interests: t.reasonInterests,
    active: t.reasonActive,
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "search", label: t.tabSearch },
    { key: "requests", label: t.tabRequests, count: incoming.length + outgoing.length },
    { key: "mine", label: t.tabMine, count: connectedIds.length },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6">
      <div className="my-4 w-full max-w-2xl rounded-2xl border border-border bg-surface p-5 shadow-glow">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-lg font-black tracking-tight">
            <Users className="h-5 w-5 text-brand" /> {t.connections}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="text-muted-foreground hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t.connectionsSubtitle}</p>

        <div className="mt-4 flex gap-4 border-b border-border text-sm">
          {tabs.map((x) => (
            <button
              key={x.key}
              onClick={() => setTab(x.key)}
              className={`-mb-px inline-flex items-center gap-1.5 pb-2 transition-colors ${
                tab === x.key
                  ? "border-b-2 border-brand text-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {x.label}
              {!!x.count && (
                <span className="rounded-full bg-brand/20 px-1.5 text-[10px] font-bold text-brand">
                  {x.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <Search className="h-4 w-4 text-brand" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchUserPh}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            {!query.trim() && (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-brand" /> {t.suggestionsTitle}
                  </div>
                  <button
                    onClick={() => void refreshSuggestions(true)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-brand"
                  >
                    <RefreshCw className="h-3 w-3" /> {t.suggestionsRefresh}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{t.suggestionsHint}</p>
                <div className="mt-2 space-y-2">
                  {suggested.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      {t.suggestionsEmpty}
                    </p>
                  )}
                  {suggested.map(({ s: sug, p }) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
                    >
                      <Avatar src={p.avatar} name={p.displayName} status={presenceOf(p.id)} />
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/profile/$username"
                          params={{ username: p.username }}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 truncate text-sm font-semibold hover:text-brand"
                        >
                          @{p.username}
                          {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-cyan" />}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {sug.mutualCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                              <Users className="h-2.5 w-2.5" /> {sug.mutualCount} {t.reasonMutual}
                            </span>
                          )}
                          {sug.reasons
                            .filter((r) => r !== "mutual")
                            .slice(0, 3)
                            .map((r) => (
                              <span
                                key={r}
                                className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {reasonLabel[r] ?? r}
                              </span>
                            ))}
                        </div>
                      </div>
                      <button
                        onClick={() => void sendRequest(p.id)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> {t.add}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!!query.trim() && (
              <div className="mt-3 space-y-2">
                {results.length === 0 && (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    {t.noUsersFound}
                  </p>
                )}
                {results.map((p) => {
                  const rel = relationWith(p.id);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
                    >
                      <Avatar src={p.avatar} name={p.displayName} status={presenceOf(p.id)} />
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/profile/$username"
                          params={{ username: p.username }}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 truncate text-sm font-semibold hover:text-brand"
                        >
                          @{p.username}
                          {p.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-cyan" />}
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-brand" /> {p.location || "—"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Globe className="h-3 w-3 text-brand-cyan" /> {p.language}
                          </span>
                        </div>
                      </div>
                      {rel === "connected" ? (
                        <button
                          onClick={() => onMessage(p.id)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/60 px-3 py-1.5 text-xs font-semibold text-brand"
                        >
                          <MessageSquare className="h-3.5 w-3.5" /> {t.message}
                        </button>
                      ) : rel === "outgoing" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> {t.sent}
                        </span>
                      ) : rel === "incoming" ? (
                        <button
                          onClick={() => void acceptRequest(connectionOf(p.id)!.id)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                        >
                          <Check className="h-3.5 w-3.5" /> {t.accept}
                        </button>
                      ) : (
                        <button
                          onClick={() => void sendRequest(p.id)}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow"
                        >
                          <UserPlus className="h-3.5 w-3.5" /> {t.add}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "requests" && (
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.received}
              </div>
              {incoming.length === 0 && (
                <p className="text-xs text-muted-foreground">{t.noOpenRequests}</p>
              )}
              <div className="space-y-2">
                {incoming.map((c) => {
                  const p = profiles[c.requesterId];
                  const handle = p?.username ?? "";
                  const name = p?.displayName || handle || t.unknown;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
                    >
                      <Avatar src={p?.avatar ?? null} name={name} />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="truncate font-semibold">{name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {handle ? `@${handle} · ` : ""}
                          {relativeTime(c.createdAt)}
                        </div>
                      </div>
                      <button
                        onClick={() => void acceptRequest(c.id)}
                        className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        {t.accept}
                      </button>
                      <button
                        onClick={() => void declineRequest(c.id)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t.decline}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t.sentRequests}
              </div>
              {outgoing.length === 0 && (
                <p className="text-xs text-muted-foreground">{t.noSentRequests}</p>
              )}
              <div className="space-y-2">
                {outgoing.map((c) => {
                  const p = profiles[c.addresseeId];
                  const handle = p?.username ?? "";
                  const name = p?.displayName || handle || t.unknown;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
                    >
                      <Avatar src={p?.avatar ?? null} name={name} />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="truncate font-semibold">{name}</div>
                        {!!handle && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            @{handle}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => void removeConnection(c.id)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t.withdraw}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "mine" && (
          <div className="mt-4 space-y-2">
            {connectedIds.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                {t.noConnectionsYet}
              </p>
            )}
            {connectedIds.map((id) => {
              // Fehlt das Profil (noch), wird die Verbindung trotzdem angezeigt.
              const p = profiles[id];
              const handle = p?.username ?? "";
              const name = p?.displayName || handle || t.unknown;
              const c = connectionOf(id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-2.5"
                >
                  <Avatar src={p?.avatar ?? null} name={name} status={presenceOf(id)} />
                  <div className="min-w-0 flex-1">
                    {handle ? (
                      <Link
                        to="/profile/$username"
                        params={{ username: handle }}
                        onClick={onClose}
                        className="block truncate text-sm font-semibold hover:text-brand"
                      >
                        {name} <span className="text-muted-foreground">@{handle}</span>
                      </Link>
                    ) : (
                      <div className="truncate text-sm font-semibold">{name}</div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      <span className={presenceTextClass(presenceOf(id))}>
                        {presenceLabel(lang, presenceOf(id))}
                      </span>{" "}
                      · {t.connectedSince} {relativeTime(c?.updatedAt ?? Date.now())}
                    </div>
                  </div>
                  <button
                    onClick={() => onMessage(id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand/60 px-3 py-1.5 text-xs font-semibold text-brand"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> {t.message}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
