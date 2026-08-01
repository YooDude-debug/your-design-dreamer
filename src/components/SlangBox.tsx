import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Sparkles, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Waveform } from "@/components/Waveform";
import { getAudio } from "@/lib/autoplay";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { formatStat, type SlangTag } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { openUnlockPrompt } from "@/components/CreatorUnlockDialog";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const SLANGTAG_DND_TYPE = "application/x-ydude-slangtag";

function SlangBoxCard({ tag, onPick }: { tag: SlangTag; onPick?: (tag: SlangTag) => void }) {
  const { registerPlay, isTagLocked, canDeleteTag, deleteTag } = useData();
  const { t } = useLang();
  const [playing, setPlaying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const locked = isTagLocked(tag);

  useEffect(() => () => audioRef.current?.pause(), []);

  const remove = async () => {
    setBusy(true);
    const ok = await deleteTag(tag.id);
    setBusy(false);
    setConfirm(false);
    toast[ok ? "success" : "error"](ok ? t.tagDeleted : t.tagDeleteFailed);
  };

  const pick = () => (locked ? openUnlockPrompt(tag) : onPick?.(tag));

  const toggle = () => {
    if (!tag.audio) return;
    if (!audioRef.current) {
      audioRef.current = getAudio(tag.audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
      void registerPlay(tag.id);
    }
  };

  return (
    <div
      draggable={!locked}
      onDragStart={(e) => {
        if (locked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData(SLANGTAG_DND_TYPE, tag.id);
        e.dataTransfer.setData("text/plain", `${slangTagPrefix(tag.kind)}${tag.name}`);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDoubleClick={pick}
      title={locked ? t.unlockCreatorTag : t.slangBoxDragHint}
      className={`group w-full min-w-0 shrink-0 rounded-lg border border-white/20 bg-white/10 p-1 shadow-[0_0_12px_oklch(0.82_0.24_150/0.18)] backdrop-blur-xl ${
        locked ? "cursor-pointer opacity-60" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={`${slangTagPrefix(tag.kind)}${tag.name} — ${playing ? t.pause : t.play}`}
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
            playing
              ? "border-brand bg-brand/25 text-brand shadow-glow"
              : "border-brand/60 bg-black/40 text-brand"
          }`}
        >
          {playing ? (
            <Pause className="h-1.5 w-1.5" />
          ) : (
            <Play className="h-1.5 w-1.5 fill-current" />
          )}
        </button>
        <Waveform bars={8} className="h-1.5 min-w-0 flex-1" animated={playing} />
        {canDeleteTag(tag) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(true);
            }}
            aria-label={t.deleteTag}
            title={t.deleteTag}
            className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-white/20 text-white/50 transition-colors hover:border-brand/60 hover:text-brand"
          >
            <Trash2 className="h-2 w-2" />
          </button>
        )}
        <GripVertical className="h-2 w-2 shrink-0 text-white/30 group-hover:text-brand" />
      </div>
      <button
        type="button"
        onClick={pick}
        className="mt-0.5 block w-full truncate text-left text-[9px] font-black leading-tight tracking-tight hover:opacity-80"
      >
        <SlangTagName tag={tag} />
      </button>
      <div className="flex items-center gap-1 text-[8px] leading-tight text-white/70">
        <span className="truncate">
          {formatStat(tag.stats.plays)} {t.plays}
        </span>
        <span className="truncate">
          {formatStat(tag.stats.uses)} {t.uses}
        </span>
      </div>


      <ConfirmDialog
        open={confirm}
        title={t.deleteTagConfirm}
        busy={busy}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}

/**
 * Slang Box – die persönliche Sammlung: selbst erstellte und freigeschaltete
 * (gespeicherte) SlangTags. Horizontal scrollbar, per Drag & Drop platzierbar.
 */
export function SlangBox({
  onPick,
}: {
  onPick?: (tag: SlangTag) => void;
  /** @deprecated Box-Höhe ist jetzt fest (4 Kacheln sichtbar). */
  compact?: boolean;
}) {

  const { me, tags, savedTags } = useData();
  const { t } = useLang();

  const mine = useMemo(
    () =>
      tags
        .filter((t) => t.creatorId === me?.id || savedTags.includes(t.id))
        .sort((a, b) => b.createdAt - a.createdAt),
    [tags, savedTags, me],
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-brand" /> {t.slangBox}
        </h3>
        <span className="text-[10px] text-muted-foreground">{mine.length}</span>
      </div>

      {mine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
          {t.slangBoxEmpty}
        </p>
      ) : (
        <div
          style={{ WebkitOverflowScrolling: "touch" }}
          className="grid max-h-[7.25rem] grid-cols-2 gap-1.5 overflow-y-auto overscroll-contain scroll-smooth pb-1 pr-1"
        >

          {mine.map((t) => (
            <SlangBoxCard key={t.id} tag={t} onPick={onPick} />
          ))}
        </div>
      )}

      <p className="mt-1 text-[10px] text-muted-foreground">{t.slangBoxHint}</p>
    </div>
  );
}
