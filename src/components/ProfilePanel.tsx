import { useMemo, useRef, useState } from "react";
import {
  BadgeCheck, MapPin, Globe, Pencil, Mic, PlusSquare, MessageSquare, Settings,
  Play, Pause, Trophy, Zap, Award, AudioLines,
} from "lucide-react";
import { Waveform } from "@/components/Waveform";
import { useData } from "@/lib/data";
import { formatCount, formatStat, type SlangTag, type SortKey } from "@/lib/types";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import { Link } from "@tanstack/react-router";

export function ProfilePanel() {
  const { me, posts, tags, savedTags } = useData();
  const [editOpen, setEditOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const myPosts = useMemo(() => posts.filter((p) => p.userId === me?.id), [posts, me]);
  const myTags = useMemo(() => tags.filter((t) => t.creatorId === me?.id), [tags, me]);
  const latest = myPosts[0];
  const totalLikes = myPosts.reduce((sum, p) => sum + p.stats.likes, 0);

  const togglePlay = () => {
    if (!latest?.audio) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(latest.audio);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  };

  const xpNext = ((me?.level ?? 1) + 1) * 1000;
  const xpPct = Math.min(100, Math.round(((me?.xp ?? 0) / xpNext) * 100));
  const collectedGoal = 100;
  const collected = savedTags.length;
  const collectedPct = Math.min(100, Math.round((collected / collectedGoal) * 100));

  const quickActions: { icon: typeof Pencil; label: string; onClick?: () => void; accent?: boolean }[] = [
    { icon: Pencil, label: "Profil bearbeiten", onClick: () => setEditOpen(true), accent: true },
    { icon: Mic, label: "SlangTag aufnehmen", onClick: () => setPostOpen(true), accent: true },
    { icon: PlusSquare, label: "Beitrag erstellen", onClick: () => setPostOpen(true) },
    { icon: MessageSquare, label: "Nachrichten" },
    { icon: Settings, label: "Einstellungen" },
  ];

  if (!me) {
    return (
      <aside className="rounded-2xl border border-border bg-surface/40 p-5 text-sm text-muted-foreground">
        Profil wird geladen …
      </aside>
    );
  }

  return (
    <aside className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface/40">
        {/* Cover */}
        <div className="relative h-20 w-full bg-gradient-to-r from-brand/20 via-transparent to-brand-cyan/20">
          {me.cover && <img src={me.cover} alt="" className="h-full w-full object-cover opacity-70" />}
        </div>

        {/* Header */}
        <div className="-mt-12 px-5 pb-5 text-center">
          <div className="relative mx-auto h-28 w-28">
            <div className="absolute -inset-1 rounded-full bg-gradient-brand opacity-60 blur-md" />
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-brand bg-background shadow-glow">
              {me.avatar ? (
                <img src={me.avatar} alt={me.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-brand">
                  {me.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => setEditOpen(true)}
              aria-label="Profil bearbeiten"
              className="absolute bottom-1 right-0 grid h-8 w-8 place-items-center rounded-full border border-brand/60 bg-background text-brand transition-colors hover:bg-brand hover:text-primary-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>

          <h2 className="mt-3 inline-flex items-center gap-1.5 text-xl font-black tracking-tight">
            {me.displayName}
            {me.verified && <BadgeCheck className="h-4 w-4 text-brand-cyan" />}
          </h2>
          <div className="text-sm text-muted-foreground">@{me.username}</div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-brand" /> {me.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3 text-brand-cyan" /> {me.language}
            </span>
          </div>

          {me.bio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{me.bio}</p>}

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl border border-border bg-background/50 py-3">
            {[
              { v: formatCount(myTags.length), l: "SlangTags" },
              { v: formatCount(0), l: "Follower" },
              { v: formatCount(0), l: "Folge ich" },
              { v: formatCount(totalLikes), l: "Likes" },
            ].map((s) => (
              <div key={s.l} className="min-w-0">
                <div className="text-base font-black text-brand">{s.v}</div>
                <div className="truncate text-[10px] text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="divider-glow mx-5" />

        {/* Last SlangTag */}
        <div className="px-5 py-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">Letzter SlangTag</h3>
          {latest ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-2">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-background">
                {latest.image && <img src={latest.image} alt={latest.title} className="h-full w-full object-cover" />}
                {latest.audio && (
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? "Pause" : "Abspielen"}
                    className="absolute inset-0 m-auto grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur"
                  >
                    {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  </button>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{latest.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">{latest.region}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Waveform bars={30} className="h-5 flex-1" animated={playing} />
                  <span className="shrink-0 text-[10px] text-muted-foreground">{latest.duration}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-3 text-[11px] text-muted-foreground">
              Noch kein Beitrag veröffentlicht.
            </p>
          )}
        </div>

        <div className="divider-glow mx-5" />

        {/* Quick access */}
        <div className="px-5 py-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">Schnellzugriff</h3>
          <div className="space-y-1 rounded-xl border border-border bg-background/50 p-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
              >
                <a.icon className={`h-4 w-4 shrink-0 ${a.accent ? "text-brand" : "text-muted-foreground"} group-hover:text-brand`} />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="divider-glow mx-5" />

        {/* Eigene SlangTags */}
        <div className="px-5 py-4">
          <MySlangTags tags={myTags} />
        </div>

        <div className="divider-glow mx-5" />

        {/* Progress */}
        <div className="px-5 pb-5 pt-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground">Fortschritt</h3>

          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand/50 text-brand">
              <Zap className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">Level {me.level}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-gradient-brand" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="mt-1 text-right text-[10px] text-muted-foreground">
                {me.xp.toLocaleString("de-DE")} / {xpNext.toLocaleString("de-DE")} XP
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-cyan/50 text-brand-cyan">
              <Trophy className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-semibold">SlangTags gesammelt</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {collected} / {collectedGoal}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full bg-gradient-brand" style={{ width: `${collectedPct}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Zukünftige Erfolge</div>
            <div className="grid grid-cols-4 gap-2">
              {[Mic, AudioLines, Award, Globe].map((Icon, i) => (
                <div
                  key={i}
                  className="grid aspect-square place-items-center rounded-xl border border-border bg-background/50 text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ProfileEditDialog open={editOpen} onClose={() => setEditOpen(false)} />
      <CreatePostDialog open={postOpen} onClose={() => setPostOpen(false)} />
    </aside>
  );
}

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Neueste" },
  { key: "uses", label: "Meist genutzt" },
  { key: "likes", label: "Likes" },
  { key: "plays", label: "Plays" },
];

function MySlangTags({ tags }: { tags: SlangTag[] }) {
  const [sort, setSort] = useState<SortKey>("newest");
  const mine = useMemo(() => {
    const cmp: Record<SortKey, (a: SlangTag, b: SlangTag) => number> = {
      newest: (a, b) => b.createdAt - a.createdAt,
      uses: (a, b) => b.stats.uses - a.stats.uses,
      likes: (a, b) => b.stats.likes - a.stats.likes,
      plays: (a, b) => b.stats.plays - a.stats.plays,
    };
    return [...tags].sort(cmp[sort]);
  }, [tags, sort]);

  return (
    <>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">Meine SlangTags</h3>
      <div className="mb-2 flex flex-wrap gap-1">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
              sort === s.key ? "border-brand bg-brand/15 text-brand" : "border-border text-muted-foreground hover:text-brand"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="space-y-1 rounded-xl border border-border bg-background/50 p-2">
        {mine.length === 0 && (
          <p className="px-1 py-1 text-[11px] text-muted-foreground">
            Noch keine eigenen SlangTags — nimm im Beitrags-Dialog einen auf.
          </p>
        )}
        {mine.map((t) => (
          <Link
            key={t.id}
            to="/slangtag/$name"
            params={{ name: t.name }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand/10"
          >
            <span className="truncate font-semibold text-brand">${t.name}</span>
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {formatStat(t.stats.plays)} Plays · {formatStat(t.stats.uses)} Uses
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
