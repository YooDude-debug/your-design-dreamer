import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Sparkles, GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Waveform } from "@/components/Waveform";
import { getAudio } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { formatStat, type SlangTag } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { openUnlockPrompt } from "@/lib/unlock-prompt";
import { useSlangTagSharing } from "@/lib/slangtag-grants";

import { slangTagPrefix } from "@/lib/slangtag-rules";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  emptyStats,
  groupCommunityTags,
  useSlangTagVotes,
  voteScore,
  type VoteStats,
} from "@/lib/slangtag-votes";

export const SLANGTAG_DND_TYPE = "application/x-ydude-slangtag";

function SlangBoxCard({ tag, onPick }: { tag: SlangTag; onPick?: (tag: SlangTag) => void }) {
  const { registerPlay, isTagLocked, canDeleteTag, deleteTag } = useData();
  const { t } = useLang();
  const [playing, setPlaying] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const locked = isTagLocked(tag);
  // Brand-/Creator-SlangTags sind vollstaendig blau, Community bleibt gruen.
  const business = tag.kind === "creator";

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
      className={`group w-full min-w-0 shrink-0 rounded-lg border border-white/20 bg-white/10 p-1 backdrop-blur-xl ${
        business
          ? "shadow-[0_0_12px_oklch(0.78_0.16_210/0.22)]"
          : "shadow-[0_0_12px_oklch(0.82_0.24_150/0.18)]"
      } ${locked ? "cursor-pointer opacity-60" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={toggle}
          aria-label={`${slangTagPrefix(tag.kind)}${tag.name} — ${playing ? t.pause : t.play}`}
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
            playing
              ? business
                ? "border-brand-cyan bg-brand-cyan/25 text-brand-cyan shadow-[0_0_10px_oklch(0.78_0.16_210/0.4)]"
                : "border-brand bg-brand/25 text-brand shadow-glow"
              : business
                ? "border-brand-cyan/60 bg-black/40 text-brand-cyan"
                : "border-brand/60 bg-black/40 text-brand"
          }`}
        >
          {playing ? (
            <Pause className="h-1.5 w-1.5" />
          ) : (
            <Play className="h-1.5 w-1.5 fill-current" />
          )}
        </button>
        <Waveform
          bars={8}
          color={business ? "var(--brand-cyan)" : "var(--brand)"}
          className="h-1.5 min-w-0 flex-1"
          animated={playing}
        />
        {canDeleteTag(tag) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(true);
            }}
            aria-label={t.deleteTag}
            title={t.deleteTag}
            className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border border-white/20 text-white/50 transition-colors ${
              business
                ? "hover:border-brand-cyan/60 hover:text-brand-cyan"
                : "hover:border-brand/60 hover:text-brand"
            }`}
          >
            <Trash2 className="h-2 w-2" />
          </button>
        )}
        <GripVertical
          className={`h-2 w-2 shrink-0 text-white/30 ${
            business ? "group-hover:text-brand-cyan" : "group-hover:text-brand"
          }`}
        />
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

type SlangBoxTab = "mine" | "community" | "creator";

const TAB_STORAGE_KEY = "ydude.slangbox.tab";

/** Kombinierter Beliebtheits-Score: Bewertung, Plays, Uses, Aktualität. */
function popularityScore(tag: SlangTag, vote: VoteStats, now: number) {
  const rating = voteScore(vote) * 6;
  const plays = tag.stats.plays;
  const uses = tag.stats.uses * 3;
  const ageDays = Math.max(0, (now - tag.createdAt) / 86_400_000);
  const recency = 120 / (1 + ageDays / 7);
  return rating + plays + uses + recency;
}

/**
 * Slang Box – zentrale SlangTag-Bibliothek mit Kategorien: eigene Sammlung,
 * beliebteste Community-Standards und verifizierte Creator-SlangTags.
 * Scrollbar, per Drag & Drop platzierbar.
 */
export function SlangBox({
  onPick,
}: {
  onPick?: (tag: SlangTag) => void;
  /** @deprecated Box-Höhe ist jetzt fest (4 Kacheln sichtbar). */
  compact?: boolean;
}) {
  const { me, tags, posts, savedTags } = useData();
  const { t } = useLang();
  const [tab, setTab] = useState<SlangBoxTab>("mine");

  // Zuletzt gewählte Kategorie beim Öffnen wiederherstellen.
  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === "mine" || saved === "community" || saved === "creator") setTab(saved);
  }, []);

  const selectTab = (next: SlangBoxTab) => {
    setTab(next);
    localStorage.setItem(TAB_STORAGE_KEY, next);
  };

  // Freigegebene SlangTags erscheinen zusätzlich in der eigenen Sammlung –
  // Eigentum und Statistiken bleiben beim ursprünglichen Ersteller.
  const { receivedTagIds } = useSlangTagSharing(me?.id ?? null);

  // Die Slang Box zeigt ausschliesslich SlangTags, die bereits in mindestens
  // einem veroeffentlichten Beitrag verwendet wurden – keine Entwuerfe.
  const publishedTagIds = useMemo(() => {
    const ids = new Set<string>();
    for (const post of posts) for (const id of post.slangTagIds) ids.add(id);
    return ids;
  }, [posts]);

  const mine = useMemo(
    () =>
      tags
        .filter(
          (tag) =>
            publishedTagIds.has(tag.id) &&
            (tag.creatorId === me?.id ||
              savedTags.includes(tag.id) ||
              receivedTagIds.includes(tag.id)),
        )
        .sort((a, b) => b.createdAt - a.createdAt),
    [tags, savedTags, me, receivedTagIds, publishedTagIds],
  );

  const communityTags = useMemo(() => tags.filter((tag) => tag.kind === "community"), [tags]);
  const voteIds = useMemo(() => communityTags.map((tag) => tag.id), [communityTags]);
  const { votes } = useSlangTagVotes(voteIds, me?.id ?? null);

  /** Community: nur die als Standard akzeptierte Version je Name, nach Score sortiert. */
  const community = useMemo(() => {
    const now = Date.now();
    return groupCommunityTags(communityTags, votes)
      .map((group) => group.primary)
      .sort(
        (a, b) =>
          popularityScore(b, votes[b.id] ?? emptyStats, now) -
          popularityScore(a, votes[a.id] ?? emptyStats, now),
      );
  }, [communityTags, votes]);

  /** Creator: verifizierte Creator-Tags, sortiert nach Beliebtheit, Aktualität, Creator-Ranking. */
  const creator = useMemo(() => {
    const now = Date.now();
    const list = tags.filter(
      (tag) =>
        tag.kind === "creator" &&
        tag.ownerType === "creator" &&
        tag.verificationStatus === "verified",
    );
    const ranking = new Map<string, number>();
    for (const tag of list) {
      ranking.set(
        tag.creatorId,
        (ranking.get(tag.creatorId) ?? 0) + tag.stats.plays + tag.stats.uses * 2,
      );
    }
    return list.sort(
      (a, b) =>
        popularityScore(b, emptyStats, now) +
        (ranking.get(b.creatorId) ?? 0) / 10 -
        (popularityScore(a, emptyStats, now) + (ranking.get(a.creatorId) ?? 0) / 10),
    );
  }, [tags]);

  const tabs: { id: SlangBoxTab; icon: string; label: string; items: SlangTag[]; empty: string }[] =
    [
      { id: "mine", icon: "🎤", label: t.slangBoxTabMine, items: mine, empty: t.slangBoxEmpty },
      {
        id: "community",
        icon: "🏆",
        label: t.slangBoxTabCommunity,
        items: community,
        empty: t.slangBoxEmptyCommunity,
      },
      {
        id: "creator",
        icon: "⭐",
        label: t.slangBoxTabCreator,
        items: creator,
        empty: t.slangBoxEmptyCreator,
      },
    ];

  const active = tabs.find((entry) => entry.id === tab) ?? tabs[0]!;

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col" : undefined}>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] font-bold uppercase tracking-widest text-foreground">
          <Sparkles className="h-3 w-3 shrink-0 text-brand" /> {t.slangBox}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground">{active.items.length}</span>
          {fill && (
            <WorkAreaInfo
              label={t.slangBox}
              text={infoText ? `${infoText} ${t.slangBoxHint}` : t.slangBoxHint}
            />
          )}
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t.slangBox}
        className="mt-1 flex shrink-0 items-center gap-0.5 overflow-x-auto rounded-lg border border-white/15 bg-white/5 p-0.5 backdrop-blur-xl"
      >
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === tab}
            onClick={() => selectTab(entry.id)}
            className={`min-h-7 flex-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-tight transition-colors ${
              entry.id === tab
                ? "border border-brand/50 bg-brand/20 text-brand shadow-glow"
                : "border border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span aria-hidden>{entry.icon}</span> {entry.label}
          </button>
        ))}
      </div>

      {active.items.length === 0 ? (
        <p className="mt-1 rounded-lg border border-dashed border-border p-2 text-[10px] leading-tight text-muted-foreground">
          {active.empty}
        </p>
      ) : (
        <div
          style={{ WebkitOverflowScrolling: "touch" }}
          className={`mt-1 grid grid-cols-1 gap-1 overflow-y-auto overscroll-contain scroll-smooth pb-0.5 pr-0.5 xs:grid-cols-2 2xl:grid-cols-3 ${
            fill ? "min-h-0 flex-1" : "max-h-[6.5rem] sm:max-h-[8rem]"
          }`}
        >
          {active.items.map((tag) => (
            <SlangBoxCard key={tag.id} tag={tag} onPick={onPick} />
          ))}
        </div>
      )}

      {!fill && (
        <p className="mt-1 text-[9px] leading-tight text-muted-foreground">{t.slangBoxHint}</p>
      )}
    </div>
  );
}
