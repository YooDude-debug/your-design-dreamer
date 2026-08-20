/**
 * Kompakte Auswahl „Im Feed“ im Veröffentlichungsbereich des Composers.
 *
 * Standard ist immer „Im Feed“. Zusätzlich kann ein echter Channel gewählt
 * werden – Grundlage ist ausschliesslich die Channel-Architektur
 * (`channels`, `channel_follows`, `channel_members`). Der gewählte Channel
 * ersetzt den normalen Feed nicht, sondern kommt zusätzlich dazu und wird am
 * Beitrag als `posts.channel_id` gespeichert.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tv, Plus, Check, Loader2, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import {
  createChannel as createChannelFn,
  listFollowedChannels,
  listManagedChannels,
  searchChannels,
  setChannelFollow,
} from "@/lib/channels.functions";

export type ComposerChannel = { id: string; name: string; icon?: string | null };

export function FeedChannelPicker({
  value,
  onChange,
  disabled,
}: {
  /** Gewählter Channel oder null = nur normaler Feed. */
  value: ComposerChannel | null;
  onChange: (channel: ComposerChannel | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const boxRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  /** Feste Bildschirmposition: das Menü liegt als Portal über allen Containern. */
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = 240;
    const h = panelRef.current?.offsetHeight ?? 260;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    // Standardmäßig nach oben öffnen; kein Platz -> nach unten.
    const top = r.top - 8 - h >= 8 ? r.top - 8 - h : Math.min(r.bottom + 8, window.innerHeight - h - 8);
    setPos({ left, top: Math.max(8, top) });
  }, []);

  const findChannels = useServerFn(searchChannels);
  const fetchFollowed = useServerFn(listFollowedChannels);
  const fetchManaged = useServerFn(listManagedChannels);
  const createChannel = useServerFn(createChannelFn);
  const follow = useServerFn(setChannelFollow);
  const q = query.trim();

  /**
   * Ohne Suchbegriff: eigene und gefolgte Channels (zwei gebuendelte
   * Abfragen). Mit Suchbegriff: die indexgestuetzte Backend-Suche.
   */
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["composer-channels", q],
    queryFn: async (): Promise<ComposerChannel[]> => {
      if (q) {
        const rows = await findChannels({ data: { q, limit: 30 } });
        return rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon }));
      }
      const [managed, followed] = await Promise.all([fetchManaged(), fetchFollowed()]);
      const byId = new Map<string, ComposerChannel>();
      for (const c of [...managed, ...followed]) {
        if (!byId.has(c.id)) byId.set(c.id, { id: c.id, name: c.name, icon: c.icon });
      }
      return [...byId.values()];
    },
    enabled: open,
    staleTime: 30_000,
  });

  const list = useMemo(() => channels, [channels]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, list.length, isLoading]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const addChannel = async () => {
    const name = draft.trim().slice(0, 60);
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await createChannel({ data: { name } });
      // Ersteller folgt dem eigenen Channel (unabhaengig von der Owner-Rolle).
      await follow({ data: { channelId: created.id, follow: true } });
      await qc.invalidateQueries({ queryKey: ["composer-channels"] });
      await qc.invalidateQueries({ queryKey: ["channels"] });
      onChange({ id: created.id, name: created.name, icon: created.icon });
      setDraft("");
      setOpen(false);
      toast.success(t.channelCreated);
    } catch {
      toast.error(t.channelCreateFailed);
    }
    setCreating(false);
  };

  const label = value ? `${value.icon ? `${value.icon} ` : ""}${value.name}` : t.inFeedLabel;

  return (
    <div ref={boxRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        aria-expanded={open}
        aria-label={t.inFeedLabel}
        title={label}
        className={`flex h-11 max-w-[11rem] shrink-0 items-center gap-1 rounded-xl border px-2 text-[10px] transition-colors disabled:opacity-50 ${
          value
            ? "border-brand bg-brand/15 text-brand"
            : "border-border bg-background text-muted-foreground hover:border-brand/60 hover:text-brand"
        }`}
      >
        <Tv className="h-3 w-3 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: 240 }}
            className="fixed z-[200] rounded-xl border border-border bg-background p-2 shadow-glow"
          >
            <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-border bg-background px-2">
              <Search className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchChannelPh}
                aria-label={t.searchChannelPh}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-xs outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface/60 ${
                value ? "text-muted-foreground" : "text-brand"
              }`}
            >
              <Check className={`mt-0.5 h-3 w-3 shrink-0 ${value ? "opacity-0" : ""}`} />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{t.inFeedLabel}</span>
                <span className="block text-[10px] text-muted-foreground">{t.inFeedNormal}</span>
              </span>
            </button>

            <div className="mt-2 border-t border-border/60 pt-2">
              <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.myChannels}
              </div>
              <div className="mt-1 max-h-40 space-y-0.5 overflow-y-auto">
                {isLoading && (
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> {t.loading}
                  </div>
                )}
                {!isLoading && list.length === 0 && (
                  <div className="px-2 py-1.5 text-[11px] italic text-muted-foreground">
                    {q ? t.noChannelsFound : t.noChannelsYet}
                  </div>
                )}
                {list.map((c) => {
                  const active = value?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onChange(active ? null : c);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface/60 ${
                        active ? "text-brand" : "text-foreground"
                      }`}
                    >
                      <Check className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-0"}`} />
                      <span className="truncate">
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addChannel();
                  }
                }}
                placeholder={t.newChannelPh}
                aria-label={t.newChannel}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => void addChannel()}
                disabled={!draft.trim() || creating}
                aria-label={t.newChannel}
                title={t.newChannel}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand/60 bg-brand/15 text-brand disabled:opacity-40"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
