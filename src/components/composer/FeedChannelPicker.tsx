/**
 * Kompakte Auswahl „Im Feed“ im Veröffentlichungsbereich des Composers.
 *
 * Standard ist immer „Im Feed“. Zusätzlich kann ein Channel gewählt werden –
 * Channels sind thematische Bereiche und nutzen die bestehende Hashtag-
 * Architektur (`hashtags` / `hashtag_follows`). Ein gewählter Channel ersetzt
 * den normalen Feed nicht, sondern kommt zusätzlich dazu.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Tv, Plus, Check, Loader2, ChevronDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import {
  listFollowedHashtags,
  searchHashtags,
  setHashtagFollow,
} from "@/lib/hashtags.functions";


/** Channel-Namen einheitlich speichern: ohne „#“, klein, ohne Sonderzeichen. */
function normalizeChannel(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .toLowerCase()
    .slice(0, 40);
}

export function FeedChannelPicker({
  value,
  onChange,
  disabled,
}: {
  /** Gewählter Channel (ohne „#“) oder null = nur normaler Feed. */
  value: string | null;
  onChange: (channel: string | null) => void;
  disabled?: boolean;
}) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
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

  const fetchChannels = useServerFn(listFollowedHashtags);
  const follow = useServerFn(setHashtagFollow);
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["followed-channels"],
    queryFn: () => fetchChannels(),
    enabled: open,
    staleTime: 60_000,
  });

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, channels.length, isLoading]);


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

  const createChannel = async () => {
    const name = normalizeChannel(draft);
    if (!name || creating) return;
    setCreating(true);
    try {
      await follow({ data: { tag: name, follow: true } });
      await qc.invalidateQueries({ queryKey: ["followed-channels"] });
      onChange(name);
      setDraft("");
      toast.success(t.channelCreated);
    } catch {
      toast.error(t.channelCreateFailed);
    }
    setCreating(false);
  };

  const label = value ? `#${value}` : t.inFeedLabel;

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
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: 240 }}
            className="fixed z-[200] rounded-xl border border-border bg-background p-2 shadow-glow"
          >
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
              {!isLoading && channels.length === 0 && (
                <div className="px-2 py-1.5 text-[11px] italic text-muted-foreground">
                  {t.noChannelsYet}
                </div>
              )}
              {channels.map((c) => {
                const name = normalizeChannel(c);
                const active = value === name;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onChange(active ? null : name);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface/60 ${
                      active ? "text-brand" : "text-foreground"
                    }`}
                  >
                    <Check className={`h-3 w-3 shrink-0 ${active ? "" : "opacity-0"}`} />
                    <span className="truncate">#{name}</span>
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
                  void createChannel();
                }
              }}
              placeholder={t.newChannelPh}
              aria-label={t.newChannel}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => void createChannel()}
              disabled={!normalizeChannel(draft) || creating}
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
