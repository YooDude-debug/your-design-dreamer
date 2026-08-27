import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import { GripVertical, Lock, LockOpen, Play, RotateCcw, Square } from "lucide-react";
import { playExclusive, stopOwner } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { slangTagOrderTexts } from "@/lib/i18n-slangtag-order";
import { slangTagTheme } from "@/lib/slangtag-ui";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import type { SlangTag } from "@/lib/types";

type Props = {
  /** SlangTags in der aktuell gültigen Abspielreihenfolge (max. 5). */
  tags: SlangTag[];
  /** Sortieren erlaubt (Ersteller immer, Zuschauer nur bei offenem Schloss). */
  sortable?: boolean;
  /** Neue Reihenfolge (IDs in Abspielreihenfolge). */
  onReorder?: (ids: string[]) => void;
  /** Schloss-Schalter – nur im Composer/Bearbeiten des Erstellers. */
  lock?: { locked: boolean; onToggle: () => void };
  /** Hinweis für Zuschauer, dass der Ersteller die Reihenfolge festgelegt hat. */
  lockedNote?: boolean;
  /** Zurück zur gespeicherten Reihenfolge (Zuschauer bei offenem Schloss). */
  onReset?: () => void;
  /** Eindeutiger Besitzer für den Audio-Bus. */
  owner: string;
  /** Entfernen erlauben (nur im Composer/Bearbeiten). */
  onRemove?: (tagId: string) => void;
  className?: string;
};

/**
 * Kleine Audio-Playlist-Zone für die SlangTags eines Beitrags:
 * Reihenfolge per Drag & Drop, Schloss-Schalter und „Play All“.
 * Design und Farben kommen unverändert aus dem bestehenden SlangTag-Theme.
 */
export function SlangTagOrderStrip({
  tags,
  sortable = false,
  onReorder,
  lock,
  lockedNote = false,
  onReset,
  owner,
  onRemove,
  className = "",
}: Props) {
  const { lang } = useLang();
  const tx = slangTagOrderTexts[lang];
  const { registerPlay } = useData();
  const [dragId, setDragId] = useState<string | null>(null);
  const [playIndex, setPlayIndex] = useState(-1);
  const runRef = useRef(0);
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Wiedergabe endet, wenn die Zone verschwindet.
  useEffect(
    () => () => {
      runRef.current += 1;
      stopOwner(owner);
    },
    [owner],
  );

  if (tags.length === 0) return null;

  const playing = playIndex >= 0;

  const stop = () => {
    runRef.current += 1;
    stopOwner(owner);
    setPlayIndex(-1);
  };

  /** Spielt die SlangTags nacheinander in der aktuell gültigen Reihenfolge. */
  const playAll = () => {
    if (playing) {
      stop();
      return;
    }
    runRef.current += 1;
    const run = runRef.current;
    const step = (i: number) => {
      if (run !== runRef.current) return;
      const tag = tags[i];
      if (!tag) {
        setPlayIndex(-1);
        return;
      }
      if (!tag.audio) {
        step(i + 1);
        return;
      }
      setPlayIndex(i);
      void registerPlay(tag.id);
      playExclusive(owner, tag.audio, () => step(i + 1));
    };
    step(0);
  };

  /** Position anhand der Chip-Mitten bestimmen (Maus und Touch gleich). */
  const moveTo = (id: string, clientX: number, clientY: number) => {
    const row = rowRef.current;
    if (!row) return;
    const chips = Array.from(row.querySelectorAll<HTMLElement>("[data-order-chip]"));
    let target = -1;
    for (let i = 0; i < chips.length; i += 1) {
      const r = chips[i]!.getBoundingClientRect();
      if (clientY >= r.top - 8 && clientY <= r.bottom + 8) {
        if (clientX < r.left + r.width / 2) {
          target = i;
          break;
        }
        target = i + 1;
      }
    }
    if (target < 0) return;
    const from = tags.findIndex((t) => t.id === id);
    if (from < 0) return;
    const next = tags.map((t) => t.id);
    next.splice(from, 1);
    next.splice(target > from ? target - 1 : target, 0, id);
    if (next.some((v, i) => v !== tags[i]?.id)) onReorder?.(next);
  };

  return (
    <div
      className={`rounded-xl border border-border/60 bg-black/40 px-2 py-1.5 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>{tx.order}</span>
        {sortable && <span className="font-semibold normal-case opacity-70">{tx.hint}</span>}
        {lockedNote && !sortable && (
          <span className="inline-flex items-center gap-1 font-semibold normal-case opacity-70">
            <Lock className="h-3 w-3" /> {tx.viewerLocked}
          </span>
        )}
        <span className="flex-1" />
        {lock && (
          <button
            type="button"
            onClick={lock.onToggle}
            title={lock.locked ? tx.lockedHint : tx.unlockedHint}
            aria-label={lock.locked ? tx.lockedTitle : tx.unlockedTitle}
            aria-pressed={lock.locked}
            className={`grid h-6 w-6 place-items-center rounded-full border transition-colors ${
              lock.locked
                ? "border-brand/60 bg-brand/20 text-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {lock.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
          </button>
        )}
        {onReset && sortable && (
          <button
            type="button"
            onClick={onReset}
            aria-label={tx.reset}
            title={tx.reset}
            className="grid h-6 w-6 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      <div ref={rowRef} className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag, i) => {
          const theme = slangTagTheme(tag.kind);
          const active = playIndex === i;
          return (
            <span
              key={tag.id}
              data-order-chip=""
              onPointerDown={(e) => {
                if (!sortable) return;
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                setDragId(tag.id);
              }}
              onPointerMove={(e) => {
                if (!sortable || dragId !== tag.id) return;
                e.preventDefault();
                moveTo(tag.id, e.clientX, e.clientY);
              }}
              onPointerUp={() => setDragId(null)}
              onPointerCancel={() => setDragId(null)}
              className={`inline-flex select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                theme.business ? "text-brand-cyan" : "text-brand"
              } ${
                active
                  ? `${theme.borderStrong} ${theme.business ? "bg-brand-cyan/25" : "bg-brand/25"}`
                  : `${theme.border} ${theme.business ? "bg-brand-cyan/10" : "bg-brand/10"}`
              } ${sortable ? "cursor-grab touch-none" : ""} ${dragId === tag.id ? "opacity-70" : ""}`}
            >
              {sortable && <GripVertical className="h-3 w-3 opacity-60" />}
              <span className="tabular-nums opacity-60">{i + 1}</span>
              {slangTagPrefix(tag.kind)}
              {tag.name}
              {onRemove && (
                <CloseButton onClick={(e) => {
                    e.stopPropagation();
                    onRemove(tag.id);
                  }} label={`${slangTagPrefix(tag.kind)}${tag.name} entfernen`} size="sm" />
              )}
            </span>
          );
        })}

        <span className="flex-1" />
        <button
          type="button"
          onClick={playAll}
          aria-label={playing ? tx.stop : tx.playAll}
          className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            playing
              ? "border-brand bg-brand/25 text-brand"
              : "border-brand/60 bg-black/40 text-brand hover:bg-brand/15"
          }`}
        >
          {playing ? (
            <Square className="h-2.5 w-2.5 fill-current" />
          ) : (
            <Play className="h-2.5 w-2.5 fill-current" />
          )}
          {playing ? tx.stop : tx.playAll}
        </button>
      </div>
    </div>
  );
}
