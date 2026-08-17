import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Pause,
  Play,
  Share2,
  Trash2,
  Trophy,
  Vote,
} from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { SlangTagName } from "@/components/SlangTagName";
import { SlangTagField, SlangText } from "@/components/SlangTagInput";
import { ShareSheet } from "@/components/ShareSheet";
import { getAudio } from "@/lib/autoplay";
import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { extractTagIds, slangTagTheme } from "@/lib/slangtag-ui";
import { SHARE_BASE_URL } from "@/lib/share";
import { formatStat, relativeTime } from "@/lib/types";
import {
  arenaScore,
  completionRate,
  MEDALS,
  type ArenaComment,
  type ArenaSubmission,
} from "@/lib/arena";

type Props = {
  submission: ArenaSubmission;
  rank: number;
  voted: boolean;
  liked: boolean;
  comments: ArenaComment[] | undefined;
  canDelete: boolean;
  award?: { place: number; licensed: boolean };
  onVote: () => void;
  onLike: () => void;
  onPlay: () => void;
  onLoadComments: () => void;
  onComment: (body: string, tagIds: string[]) => Promise<boolean>;
  onDelete: () => void;
};

/** Wettbewerbskarte eines Creators in der SlangTag Arena. */
export function ArenaCard({
  submission,
  rank,
  voted,
  liked,
  comments,
  canDelete,
  award,
  onVote,
  onLike,
  onPlay,
  onLoadComments,
  onComment,
  onDelete,
}: Props) {
  const navigate = useNavigate();
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const { profiles, getTag } = useData();
  const tag = getTag(submission.tagId);
  const creator = profiles[submission.creatorId];
  const [playing, setPlaying] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const theme = slangTagTheme(tag?.kind);
  const business = theme.business;
  const accent = theme.text;
  const wave = theme.accent;

  const toggleAudio = () => {
    if (!tag?.audio) return;
    if (!audioRef.current) {
      audioRef.current = getAudio(tag.audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    void audioRef.current.play();
    setPlaying(true);
    onPlay();
  };

  const toggleComments = () => {
    setShowComments((v) => {
      if (!v && !comments) onLoadComments();
      return !v;
    });
  };

  const submitComment = async () => {
    const body = draft.trim();
    if (!body) return;
    const ok = await onComment(body, extractTagIds(body, getTag));
    if (ok) setDraft("");
  };

  const medal = rank <= 3 ? MEDALS[rank - 1] : null;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-background p-4 transition-all hover:border-brand/50 hover:shadow-glow ${
        award?.place === 1 ? "border-brand/60" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() =>
            creator &&
            navigate({ to: "/profile/$username", params: { username: creator.username } })
          }
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-cyan to-brand"
          aria-label={creator?.username ?? at.creatorFallback}
        >
          {creator?.avatar && (
            <img
              src={creator.avatar}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold">
              {creator?.displayName || creator?.username || at.creatorFallback}
            </span>
            {creator?.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-cyan" />}
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {relativeTime(submission.createdAt)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>@{creator?.username ?? "unknown"}</span>
            <span className={`font-bold ${accent}`}>
              {arenaScore(submission)} {at.pointsSuffix}
            </span>
            <span>
              {Math.round(completionRate(submission) * 100)}
              {at.completionSuffix}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {medal && <span className="text-lg leading-none">{medal}</span>}
          {!medal && <span className="text-xs text-muted-foreground">#{rank}</span>}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={at.removeSubmissionAria}
              className="tap-safe grid place-items-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {award && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand">
          <Trophy className="h-3 w-3" />
          {award.place === 1 ? at.winnerBadge : at.placeBadge(award.place)}
          {award.licensed && <span>· {at.licensedBadge}</span>}
        </div>
      )}

      {/* SlangTag mit Wellenform und Wiedergabe */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-3 backdrop-blur-xl">
        <button
          type="button"
          onClick={toggleAudio}
          disabled={!tag?.audio}
          aria-label={playing ? at.pauseAria : at.playAria}
          className={`tap-safe grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-transform hover:scale-105 disabled:opacity-40 ${accent} ${
            business ? "border-brand-cyan/60 bg-brand-cyan/10" : "border-brand/60 bg-brand/10"
          }`}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          {tag ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
              className="max-w-full truncate text-left"
            >
              <SlangTagName tag={tag} className="text-sm font-bold" />
            </button>
          ) : (
            <span className="text-xs italic text-muted-foreground">{at.tagUnavailable}</span>
          )}
          <Waveform bars={32} color={wave} animated={playing} className="mt-1 h-6" />
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {tag?.duration ?? "0:00"}
        </span>
      </div>

      {submission.pitch && (
        <p className="mt-3 text-sm text-foreground/90">
          <SlangText
            text={submission.pitch}
            onOpenTag={(t) => navigate({ to: "/slangtag/$name", params: { name: t.name } })}
          />
        </p>
      )}

      {/* Aktionen */}
      <footer className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={onVote}
          className={`tap-safe inline-flex items-center gap-1.5 rounded-full border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
            voted
              ? "border-brand bg-brand/15 text-brand"
              : "border-border text-muted-foreground hover:border-brand/50 hover:text-brand"
          }`}
        >
          <Vote className="h-3.5 w-3.5" />
          {formatStat(submission.votes)}
        </button>
        <button
          type="button"
          onClick={onLike}
          className={`tap-safe inline-flex items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors ${
            liked ? "text-brand" : "text-muted-foreground hover:text-brand"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          {formatStat(submission.likes)}
        </button>
        <button
          type="button"
          onClick={toggleComments}
          className="tap-safe inline-flex items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:text-brand"
        >
          <MessageCircle className="h-4 w-4" />
          {formatStat(submission.comments)}
        </button>
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="tap-safe inline-flex items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:text-brand"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Play className="h-3 w-3" />
          {formatStat(submission.plays)}
        </span>
      </footer>

      {showComments && (
        <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
          {(comments ?? []).length === 0 && (
            <p className="text-xs italic text-muted-foreground">{at.commentsEmpty}</p>
          )}
          {(comments ?? []).map((c) => {
            const author = profiles[c.userId];
            return (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-cyan to-brand">
                  {author?.avatar && (
                    <img
                      src={author.avatar}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="truncate font-semibold">@{author?.username ?? "unknown"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {relativeTime(c.createdAt)}
                    </span>
                  </div>
                  <div className="text-foreground/90">
                    <SlangText
                      text={c.body}
                      onOpenTag={(t) =>
                        navigate({ to: "/slangtag/$name", params: { name: t.name } })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-2 pt-1">
            <div
              className="min-w-0 flex-1 cursor-text rounded-2xl border border-border bg-background px-3 py-1.5 focus-within:border-brand"
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                const el = e.currentTarget.querySelector("input");
                el?.focus();
                el?.setSelectionRange(el.value.length, el.value.length);
              }}
            >
              <SlangTagField
                value={draft}
                onChange={setDraft}
                onSubmit={() => void submitComment()}
                region={tag?.region ?? ""}
                keepFocus
                placeholder={at.commentPh}
                aria-label={at.commentAria}
              />
            </div>
            <button
              type="button"
              onClick={() => void submitComment()}
              disabled={!draft.trim()}
              className="tap-safe shrink-0 rounded-lg px-2 text-xs font-bold uppercase tracking-wider text-brand disabled:opacity-40"
            >
              {at.sendBtn}
            </button>
          </div>
        </div>
      )}

      {shareOpen && (
        <ShareSheet
          payload={{
            url: tag
              ? `${SHARE_BASE_URL}/slangtag/${encodeURIComponent(tag.name)}`
              : SHARE_BASE_URL,
            title: tag ? at.shareTitleWithTag(tag.name) : at.shareTitleFallback,
            author: creator?.displayName || creator?.username || at.creatorFallback,
          }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </article>
  );
}
