import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Mic2, Pause, Play, Sparkles, Star, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Waveform } from "@/components/Waveform";
import { WorkAreaInfo } from "@/components/arena/WorkAreaInfo";
import { getAudio } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { formatStat, type SlangTag } from "@/lib/types";
import { SlangTagName } from "@/components/SlangTagName";
import { openUnlockPrompt } from "@/lib/unlock-prompt";
import { useSlangTagSharing } from "@/lib/slangtag-grants";

import { slangTagPrefix } from "@/lib/slangtag-rules";
import { slangTagTheme } from "@/lib/slangtag-ui";
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
  const theme = slangTagTheme(tag.kind);
  const business = theme.business;

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
      className={`group grid min-h-24 w-full min-w-0 shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface-2/60 p-3 transition-colors hover:border-foreground/25 hover:bg-surface-2 ${
        business ? "shadow-glow-cyan-subtle" : "shadow-glow-subtle"
      } ${locked ? "cursor-pointer opacity-60" : "cursor-grab active:cursor-grabbing"}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={`${slangTagPrefix(tag.kind)}${tag.name} — ${playing ? t.pause : t.play}`}
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 ${
          playing ? theme.playActive : theme.playIdle
        }`}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
      </button>

      <div className="min-w-0">
        <Waveform
          bars={12}
          color={theme.accent}
          className="mb-1 h-4 w-20 max-w-full"
          animated={playing}
        />
        <button
          type="button"
          onClick={pick}
          className="block w-full truncate text-left text-sm font-black leading-tight hover:opacity-80"
        >
          <SlangTagName tag={tag} />
        </button>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] leading-tight text-muted-foreground">
          <span className="truncate">
            {formatStat(tag.stats.plays)} {t.plays}
          </span>
          <span aria-hidden>·</span>
          <span className="truncate">
            {formatStat(tag.stats.likes)} {t.tmLikes}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {canDeleteTag(tag) ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirm(true);
            }}
            aria-label={t.deleteTag}
            title={t.deleteTag}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors ${
              business
                ? "hover:bg-brand-cyan/10 hover:text-brand-cyan"
                : "hover:bg-brand/10 hover:text-brand"
            }`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
        <span
          aria-hidden
          className={`grid h-11 w-6 shrink-0 place-items-center text-muted-foreground ${theme.hoverText}`}
        >
          <GripVertical className="h-5 w-5" />
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
  fill,
  infoText,
  query = "",
}: {
  onPick?: (tag: SlangTag) => void;
  /** Füllt den Elternbereich vollständig aus und scrollt intern. */
  fill?: boolean;
  /** Zusatztext für das ⓘ-Popover (nur im fill-Modus sichtbar). */
  infoText?: string;
  /** Sichtbarer Suchbegriff aus dem Arena-Kopf. */
  query?: string;
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

  const active = tabs.find((entry) => entry.id === tab) ?? tabs.at(0);
  if (!active) return null;
  const needle = query.trim().toLocaleLowerCase();
  const visibleItems = needle
    ? active.items.filter((tag) =>
        [tag.name, tag.region, tag.language].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase()
            .includes(needle),
        ),
      )
    : active.items;

  return (
    <div className={`isolate ${fill ? "flex h-full min-h-0 flex-col" : ""}`}>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 pb-3">
        <h3 className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-black uppercase text-foreground">
          <Sparkles className="h-5 w-5 shrink-0 text-brand" /> {t.slangBox}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-background/70 px-2 py-1 text-xs font-bold text-muted-foreground">
            {visibleItems.length}
          </span>
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
        className="control-track relative z-20 mt-3 grid shrink-0 grid-cols-3 gap-1 rounded-xl p-1"
      >
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === tab}
            onClick={() => selectTab(entry.id)}
            className={`tap-safe flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-2 text-[10px] font-bold transition-colors sm:text-xs ${
              entry.id === tab
                ? "bg-brand text-primary-foreground shadow-glow-active"
                : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {entry.id === "mine" ? (
              <Mic2 className="h-3.5 w-3.5 shrink-0" />
            ) : entry.id === "community" ? (
              <Users className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Star className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="min-w-0 truncate">{entry.label}</span>
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
          {active.empty}
        </p>
      ) : (
        <div
          style={{ WebkitOverflowScrolling: "touch" }}
          className={`relative z-0 mt-3 grid auto-rows-min grid-cols-1 content-start items-start gap-2 overflow-y-auto overscroll-contain scroll-smooth pb-1 pr-0.5 lg:grid-cols-2 ${
            fill ? "min-h-0 flex-1" : "max-h-72"
          }`}
        >
          {visibleItems.map((tag) => (
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
