import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck, MapPin, Globe, Pencil, Mic, MessageSquare, Settings,
  Play, Pause, Bell, Users, Compass, LayoutGrid,
} from "lucide-react";

import { Waveform } from "@/components/Waveform";
import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangText } from "@/components/SlangTagInput";
import { formatCount } from "@/lib/types";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { SlangBox } from "@/components/SlangBox";
import { useSocial } from "@/lib/social";
import { useSocialUI } from "@/components/SocialLayer";

export function ProfilePanel() {
  const { me, posts, tags } = useData();
  const { t } = useLang();
  const navigate = useNavigate();

  const { connectedIds, unreadNotifications, incoming } = useSocial();
  const { openMessenger, openConnections, openNotifications } = useSocialUI();
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<"profile" | "security">("profile");
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

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  /** Schnellzugriff = nur Profilverwaltung und Navigation. */
  const quickActions: {
    icon: typeof Pencil; label: string; onClick?: () => void; accent?: boolean; badge?: number;
  }[] = [
    { icon: Pencil, label: t.editProfile, onClick: () => { setEditTab("profile"); setEditOpen(true); }, accent: true },
    { icon: Mic, label: t.recordSlangTag, onClick: () => scrollTo("composer"), accent: true },
    { icon: Bell, label: t.notifications, onClick: openNotifications, badge: unreadNotifications },
    { icon: Compass, label: t.discoverSlangTags, onClick: () => scrollTo("discover") },
    { icon: Users, label: t.connections, onClick: openConnections, badge: incoming.length },
    { icon: MessageSquare, label: t.messages, onClick: () => openMessenger() },
    { icon: Settings, label: t.settings, onClick: () => { setEditTab("security"); setEditOpen(true); } },
  ];

  if (!me) {
    return (
      <aside className="rounded-2xl border border-border bg-surface/40 p-5 text-sm text-muted-foreground">
        {t.profileLoading}
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
              onClick={() => { setEditTab("profile"); setEditOpen(true); }}
              aria-label={t.editProfile}
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

          {me.bio && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <SlangText text={me.bio} />
            </p>
          )}

          {/* Stats */}
          <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl border border-border bg-background/50 py-3">
            {[
              { v: formatCount(myTags.length), l: t.statSlangTags, to: null },
              { v: formatCount(connectedIds.length), l: t.statConnections, to: null },
              { v: formatCount(myPosts.length), l: t.statPosts, to: "/posts" as const },
              { v: formatCount(totalLikes), l: t.statLikes, to: null },
            ].map((s) =>
              s.to ? (
                <Link
                  key={s.l}
                  to={s.to}
                  className="min-w-0 rounded-lg transition-colors hover:bg-brand/10"
                  title={t.myPosts}
                >
                  <div className="text-base font-black text-brand">{s.v}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{s.l}</div>
                </Link>
              ) : (
                <div key={s.l} className="min-w-0">
                  <div className="text-base font-black text-brand">{s.v}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{s.l}</div>
                </div>
              ),
            )}
          </div>

        </div>

        <div className="divider-glow mx-5" />

        {/* Last SlangTag */}
        <div className="px-5 py-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">{t.lastSlangTag}</h3>
          {latest ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-2">
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-background">
                {latest.image && <img src={latest.image} alt={latest.title} className="h-full w-full object-cover" />}
                {latest.audio && (
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? t.pause : t.play}
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
              {t.noPostYet}
            </p>
          )}
        </div>

        <div className="divider-glow mx-5" />

        {/* Quick access */}
        <div className="px-5 py-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground">{t.quickAccess}</h3>
          <div className="space-y-1 rounded-xl border border-border bg-background/50 p-2">
            {quickActions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
              >
                <a.icon className={`h-4 w-4 shrink-0 ${a.accent ? "text-brand" : "text-muted-foreground"} group-hover:text-brand`} />
                <span className="min-w-0 flex-1 truncate">{a.label}</span>
                {!!a.badge && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-primary-foreground">
                    {a.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Slang Box */}
        <div className="px-5 pb-5 pt-4">
          <SlangBox compact />
        </div>

      </section>

      <ProfileEditDialog open={editOpen} initialTab={editTab} onClose={() => setEditOpen(false)} />
    </aside>
  );
}
