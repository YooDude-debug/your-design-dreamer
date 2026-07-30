import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Waveform } from "@/components/Waveform";
import {
  Menu, Globe, MapPin, Flame, Users, Play, Heart, MessageCircle,
  Share2, Bookmark, MoreVertical, TrendingUp, Star,
  AudioLines, Mail, ChevronRight, Check, BadgeCheck,
} from "lucide-react";
import berlin from "@/assets/berlin.jpg";
import rostock from "@/assets/rostock.jpg";
import athens from "@/assets/athens.jpg";
import rio from "@/assets/rio.jpg";
import tokyo from "@/assets/tokyo.jpg";
import thessaloniki from "@/assets/thessaloniki.jpg";
import burger from "@/assets/burger.jpg";
import globe from "@/assets/globe.png";
import ydudeLogo from "@/assets/ydude-logo.png";
import moinAudio from "@/assets/moinmoin.m4a.asset.json";
import { LanguageProvider, useLang } from "@/lib/i18n";
import { ProfileProvider, useProfile } from "@/lib/profile";
import { ProfilePanel } from "@/components/ProfilePanel";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dev")({
  head: () => ({
    meta: [
      { title: "Interner Bereich — Y-Dude" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Discover slang, feel the vibe. Local voices, global connections through short audio SlangTags." },
      { property: "og:title", content: "Y-Dude — Speak Local. Connect Global." },
      { property: "og:description", content: "Discover slang, feel the vibe. Short sounds, big meaning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexWrapper,
});

const trending = [
  { title: "Ick dit dit", city: "Berlin", plays: "12.4K", img: berlin },
  { title: "Moin Moin", city: "Rostock", plays: "8.7K", img: rostock },
  { title: "Re file", city: "Athens", plays: "6.1K", img: athens },
  { title: "Valeu demais", city: "Rio de Janeiro", plays: "9.3K", img: rio },
];

type FeedItem = { id: string; user: string; place: string; time: string; tag: string; title: string; img: string; likes: number; comments: number; shares: number; duration: string; color: string };

const feedsByTab: Record<"local" | "global" | "trending" | "following", FeedItem[]> = {
  local: [
    { id: "l1", user: "berlin.vibes", place: "Berlin, Germany", time: "2m", tag: "#berlin", title: "Ick dit dit", img: berlin, likes: 128, comments: 24, shares: 12, duration: "00:03", color: "var(--brand)" },
    { id: "l2", user: "rostock.hafen", place: "Rostock, Germany", time: "6m", tag: "#moin", title: "Moin Moin", img: rostock, likes: 84, comments: 12, shares: 6, duration: "00:02", color: "var(--brand)" },
    { id: "l3", user: "kiez.talk", place: "Berlin, Germany", time: "14m", tag: "#kiez", title: "Alter Schwede", img: berlin, likes: 61, comments: 9, shares: 4, duration: "00:02", color: "var(--brand)" },
  ],
  global: [
    { id: "g1", user: "tokyo.vibes", place: "Tokyo, Japan", time: "1m", tag: "#japanese", title: "ヤバい!", img: tokyo, likes: 156, comments: 31, shares: 9, duration: "00:02", color: "oklch(0.72 0.2 300)" },
    { id: "g2", user: "carioca_021", place: "Rio de Janeiro, Brazil", time: "4m", tag: "#brazilian", title: "Valeu demais!", img: rio, likes: 212, comments: 43, shares: 18, duration: "00:03", color: "oklch(0.85 0.2 100)" },
    { id: "g3", user: "taverna.express", place: "Thessaloniki, Greece", time: "9m", tag: "#greek", title: "Έλα ρε!", img: thessaloniki, likes: 98, comments: 16, shares: 7, duration: "00:02", color: "var(--brand-cyan)" },
  ],
  trending: [
    { id: "t1", user: "carioca_021", place: "Rio de Janeiro, Brazil", time: "just now", tag: "#viral", title: "Valeu demais!", img: rio, likes: 1240, comments: 231, shares: 118, duration: "00:03", color: "oklch(0.85 0.2 100)" },
    { id: "t2", user: "tokyo.vibes", place: "Tokyo, Japan", time: "3m", tag: "#viral", title: "ヤバい!", img: tokyo, likes: 980, comments: 154, shares: 76, duration: "00:02", color: "oklch(0.72 0.2 300)" },
    { id: "t3", user: "berlin.vibes", place: "Berlin, Germany", time: "7m", tag: "#hot", title: "Ick dit dit", img: berlin, likes: 720, comments: 132, shares: 55, duration: "00:03", color: "var(--brand)" },
  ],
  following: [
    { id: "f1", user: "taverna.express", place: "Thessaloniki, Greece", time: "3m", tag: "#greek", title: "Έλα ρε!", img: thessaloniki, likes: 98, comments: 16, shares: 7, duration: "00:02", color: "var(--brand-cyan)" },
    { id: "f2", user: "rostock.hafen", place: "Rostock, Germany", time: "11m", tag: "#moin", title: "Moin Moin", img: rostock, likes: 54, comments: 8, shares: 3, duration: "00:02", color: "var(--brand)" },
  ],
};

const liveSamplesByTab: Record<"local" | "global" | "trending" | "following", Omit<FeedItem, "id" | "time">[]> = {
  local: [
    { user: "berlin.beats", place: "Berlin, Germany", tag: "#kreuzberg", title: "Diggi was geht", img: berlin, likes: 12, comments: 2, shares: 1, duration: "00:02", color: "var(--brand)" },
    { user: "rostock.hafen", place: "Rostock, Germany", tag: "#moin", title: "Moin zusammen", img: rostock, likes: 7, comments: 1, shares: 0, duration: "00:02", color: "var(--brand)" },
  ],
  global: [
    { user: "athens.live", place: "Athens, Greece", tag: "#greek", title: "Ρε φίλε!", img: athens, likes: 22, comments: 4, shares: 2, duration: "00:02", color: "var(--brand-cyan)" },
    { user: "tokyo.night", place: "Tokyo, Japan", tag: "#japanese", title: "マジで!", img: tokyo, likes: 31, comments: 6, shares: 3, duration: "00:02", color: "oklch(0.72 0.2 300)" },
    { user: "rio.samba", place: "Rio de Janeiro, Brazil", tag: "#brazil", title: "Caraca!", img: rio, likes: 44, comments: 7, shares: 4, duration: "00:03", color: "oklch(0.85 0.2 100)" },
  ],
  trending: [
    { user: "viral.sound", place: "Worldwide", tag: "#viral", title: "$noway", img: tokyo, likes: 1520, comments: 240, shares: 180, duration: "00:02", color: "oklch(0.85 0.2 100)" },
    { user: "hot.tags", place: "Worldwide", tag: "#hot", title: "$letsgo", img: rio, likes: 980, comments: 145, shares: 88, duration: "00:03", color: "var(--brand)" },
  ],
  following: [
    { user: "taverna.express", place: "Thessaloniki, Greece", tag: "#greek", title: "Καλημέρα!", img: thessaloniki, likes: 14, comments: 3, shares: 1, duration: "00:02", color: "var(--brand-cyan)" },
  ],
};

type TabKey = "local" | "global" | "trending" | "following";

function IndexWrapper() {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <Index />
      </ProfileProvider>
    </LanguageProvider>
  );
}


type SlangTagShowcaseCardProps = {
  type: "community" | "partner";
  user: string;
  place: string;
  time: string;
  tag: string;
  img: string;
  plays: string;
  overlayLikes: string;
  bottomLikes: number;
  bottomComments: number;
  bottomShares: number;
  duration: string;
  audioSrc?: string;
};

function SlangTagShowcaseCard({
  type,
  user,
  place,
  time,
  tag,
  img,
  plays,
  overlayLikes,
  bottomLikes,
  bottomComments,
  bottomShares,
  duration,
  audioSrc,
}: SlangTagShowcaseCardProps) {
  const isPartner = type === "partner";
  const accent = isPartner ? "var(--brand-cyan)" : "var(--brand)";
  const accentClass = isPartner ? "text-brand-cyan" : "text-brand";
  const borderClass = isPartner ? "border-brand-cyan" : "border-brand";
  const bgClass = isPartner ? "bg-brand-cyan/10" : "bg-brand/10";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); } else { a.pause(); }
  };

  return (
    <article className={`rounded-2xl border ${borderClass} bg-surface/60 overflow-hidden shadow-card`}>
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-background font-bold text-sm ${isPartner ? "bg-gradient-to-br from-brand-cyan to-cyan-300" : "bg-gradient-to-br from-brand to-lime-300"}`}>
            {user[0].toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight flex items-center gap-1.5">
              {user}
              {isPartner && <BadgeCheck className={`h-4 w-4 ${accentClass}`} />}
            </div>
            <div className="text-xs text-muted-foreground">{place}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{time}</span>
          <MoreVertical className="h-4 w-4" />
        </div>
      </header>

      <div className="relative mx-4 mb-3 rounded-xl overflow-hidden aspect-[4/3]">
        <img src={img} alt={tag} loading="lazy" className="h-full w-full object-cover" />
        <div className={`absolute left-3 top-3 rounded-xl border ${borderClass} bg-black/70 backdrop-blur-md p-3`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              disabled={!audioSrc}
              aria-label={playing ? "Pause" : "Play"}
              className={`h-10 w-10 rounded-full ${bgClass} flex items-center justify-center ${accentClass} ${audioSrc ? "hover:scale-105 transition" : "opacity-70 cursor-not-allowed"}`}
            >
              <Play className="h-5 w-5 fill-current" />
            </button>
            <div>
              <div className={`text-lg font-bold ${accentClass} flex items-center gap-1.5`}>
                {tag}
                {isPartner && <BadgeCheck className="h-4 w-4" />}
              </div>
              <Waveform bars={24} color={accent} animated={playing} className="h-5 w-32 mt-1" />
              <div className="text-right text-xs text-muted-foreground mt-1">{duration}</div>
            </div>
          </div>
          <div className={`mt-2 flex items-center gap-4 text-sm font-semibold ${accentClass}`}>
            <span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5 fill-current" /> {plays}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 fill-current" /> {overlayLikes}</span>
          </div>
        </div>
      </div>

      <footer className={`flex items-center justify-between px-4 py-3 border-t border-border/60 ${accentClass}`}>
        <div className="flex items-center gap-5">
          <button className="inline-flex items-center gap-1.5 hover:text-foreground"><Heart className="h-5 w-5" /> {bottomLikes}</button>
          <button className="inline-flex items-center gap-1.5 hover:text-foreground"><MessageCircle className="h-5 w-5" /> {bottomComments}</button>
          <button className="inline-flex items-center gap-1.5 hover:text-foreground"><Share2 className="h-5 w-5" /> {bottomShares}</button>
        </div>
        <button className="hover:text-foreground"><Bookmark className="h-5 w-5" /></button>
      </footer>
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </article>
  );
}

type Comment = { id: string; user: string; text: string; time: string };

function FeedPost({ p, isNew }: { p: FeedItem; isNew: boolean }) {
  const { profile } = useProfile();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(p.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  const toggleLike = () => {
    setLiked((l) => {
      setLikes((n) => n + (l ? -1 : 1));
      return !l;
    });
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setComments((c) => [
      ...c,
      { id: `${Date.now()}`, user: `@${profile.username}`, text, time: "now" },
    ]);
    setDraft("");
  };

  return (
    <article
      className={`rounded-xl bg-background/60 border border-border overflow-hidden ${
        isNew ? "animate-fade-in ring-1 ring-brand/60" : ""
      }`}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand to-brand-cyan" />
          <div>
            <div className="text-sm font-semibold leading-tight">{p.user}</div>
            <div className="text-xs text-muted-foreground">{p.place}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{p.time}</span>
          <MoreVertical className="h-4 w-4" />
        </div>
      </header>
      <div className="grid grid-cols-[45%_1fr] gap-2 px-3">
        <div className="relative aspect-square rounded-lg overflow-hidden">
          <img src={p.img} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
          <button className="absolute inset-0 m-auto h-10 w-10 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center">
            <Play className="h-4 w-4 fill-white text-white" />
          </button>
        </div>
        <div className="flex flex-col justify-between py-1">
          <div className="flex items-start justify-between gap-2">
            <div className="text-base font-semibold leading-tight">{p.title}</div>
            <div className="text-xs font-medium" style={{ color: p.color }}>{p.tag}</div>
          </div>
          <div>
            <Waveform bars={38} color={p.color} className="h-6" />
            <div className="text-right text-xs text-muted-foreground mt-1">{p.duration}</div>
          </div>
        </div>
      </div>
      <footer className="mt-2 flex items-center justify-between px-3 py-2.5 border-t border-border/60 text-muted-foreground text-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLike}
            aria-pressed={liked}
            className={`inline-flex items-center gap-1.5 transition-colors ${
              liked ? "text-brand" : "hover:text-foreground"
            }`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likes}
          </button>
          <button
            onClick={() => setShowComments((s) => !s)}
            aria-expanded={showComments}
            className={`inline-flex items-center gap-1.5 transition-colors ${
              showComments ? "text-brand-cyan" : "hover:text-foreground"
            }`}
          >
            <MessageCircle className="h-4 w-4" /> {p.comments + comments.length}
          </button>
          <button className="inline-flex items-center gap-1.5 hover:text-foreground"><Share2 className="h-4 w-4" /> {p.shares}</button>
        </div>
        <button className="hover:text-foreground"><Bookmark className="h-4 w-4" /></button>
      </footer>
      {showComments && (
        <div className="border-t border-border/60 bg-background/40 px-3 py-3 space-y-2">
          {comments.length === 0 && (
            <div className="text-xs text-muted-foreground italic">No comments yet — be the first.</div>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-sm">
              <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-cyan to-brand">
                {profile.avatar && <img src={profile.avatar} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.user}</span>
                  <span className="text-[10px] text-muted-foreground">{c.time}</span>
                </div>
                <div className="text-foreground/90">{c.text}</div>
              </div>
            </div>
          ))}
          <form onSubmit={submitComment} className="flex items-center gap-2 pt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-surface/60 border border-border rounded-full px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="text-xs font-bold tracking-wider text-brand disabled:opacity-40"
            >
              POST
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function LiveFeed() {
  const { profile, posts } = useProfile();
  const { t } = useLang();
  const [active, setActive] = useState<TabKey>("local");
  const [items, setItems] = useState<Record<TabKey, FeedItem[]>>(feedsByTab);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const paused = scrollTop > 300;

  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current && scrollRef.current.scrollTop > 300) return;
      setItems((prev) => {
        const samples = liveSamplesByTab[active];
        const sample = samples[Math.floor(Math.random() * samples.length)];
        const id = `${active}-${Date.now()}`;
        const next: FeedItem = { ...sample, id, time: "now" };
        setNewIds((s) => new Set(s).add(id));
        setTimeout(() => {
          setNewIds((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        }, 1200);
        return { ...prev, [active]: [next, ...prev[active]].slice(0, 40) };
      });
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    }, 5000);
    return () => clearInterval(interval);
  }, [active]);

  const tabs: { key: TabKey; label: string; Icon: typeof MapPin }[] = [
    { key: "local", label: t.local, Icon: MapPin },
    { key: "global", label: t.globalTab, Icon: Globe },
    { key: "trending", label: t.trendingTab, Icon: Flame },
    { key: "following", label: t.following, Icon: Users },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold tracking-widest text-foreground">{t.feed}</h3>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest transition-colors ${paused ? "text-muted-foreground" : "text-brand"}`}>
          <span className="relative flex h-2 w-2">
            {!paused && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${paused ? "bg-muted-foreground" : "bg-brand"}`} />
          </span>
          {paused ? "PAUSED" : "LIVE"}
        </span>
      </div>
      <div className="flex items-center gap-4 border-b border-border pb-3 text-sm overflow-x-auto">
        {tabs.map(({ key, label, Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`inline-flex items-center gap-1.5 pb-2 -mb-[13px] whitespace-nowrap transition-colors ${
                on ? "text-brand border-b-2 border-brand" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
        className="mt-4 space-y-4 max-h-[720px] overflow-y-auto pr-1 scroll-smooth"
      >
        {items[active].map((p) => (
          <FeedPost key={p.id} p={p} isNew={newIds.has(p.id)} />
        ))}
      </div>
    </section>
  );
}

function NewsletterForm() {
  const { t, lang } = useLang();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error(lang === "de" ? "Bitte gib eine gültige E-Mail ein." : lang === "el" ? "Δώσε ένα έγκυρο email." : "Please enter a valid email.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers" as never)
      .insert({ email: value, language: lang } as never);
    setLoading(false);
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        toast.success(lang === "de" ? "Du bist bereits dabei ✌️" : lang === "el" ? "Είσαι ήδη μέσα ✌️" : "You're already in ✌️");
        setDone(true);
        setEmail("");
        return;
      }
      toast.error(lang === "de" ? "Etwas ist schiefgelaufen. Versuch's nochmal." : lang === "el" ? "Κάτι πήγε στραβά. Δοκίμασε ξανά." : "Something went wrong. Try again.");
      return;
    }
    toast.success(lang === "de" ? "Willkommen im Vibe! 🎧" : lang === "el" ? "Καλωσόρισες στο vibe! 🎧" : "Welcome to the vibe! 🎧");
    setDone(true);
    setEmail("");
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 w-full md:w-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t.emailPh}
        disabled={loading}
        className="flex-1 md:w-56 rounded-full bg-background border border-border px-4 py-2 text-sm outline-none focus:border-brand disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "…" : done ? <Check className="h-4 w-4" /> : t.join}
      </button>
    </form>
  );
}

function Index() {
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_380px]">
          {/* PROFILE PANEL */}
          <ProfilePanel />
          {/* LEFT COLUMN */}
          <div className="rounded-2xl border border-border bg-surface/40 overflow-hidden">
            {/* Nav */}
            <div className="flex items-center justify-between px-6 py-5">
              <button className="text-foreground/80 hover:text-foreground"><Menu className="h-6 w-6" /></button>
              <img src={ydudeLogo} alt="Y-Dude" className="h-10 md:h-12 w-auto" />
              <LanguageSwitcher />
            </div>

            {/* Hero */}
            <div className="relative px-6 pt-6 pb-10 text-center overflow-hidden">
              <img
                src={globe}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -left-24 top-16 h-[420px] w-[420px] opacity-60 blur-[0.3px]"
              />
              <h1 className="relative text-6xl md:text-7xl font-black tracking-tight leading-none">
                <span className="text-foreground">Y-</span>
                <span className="text-gradient-green drop-shadow-[0_0_30px_oklch(0.82_0.24_150/0.5)]">Dude</span>
              </h1>
              <p className="relative mt-5 text-xl md:text-2xl font-medium">
                {t.tagline_speak} <span className="text-gradient-green">{t.tagline_local}</span> {t.tagline_connect} <span className="text-gradient-cyan">{t.tagline_global}</span>
              </p>
              <p className="relative mt-8 text-lg text-muted-foreground leading-relaxed">
                {t.discover}<br />{t.feel}
              </p>
              <div className="relative mt-10 flex justify-center">
                <button className="group relative inline-flex items-center gap-3 rounded-full bg-gradient-brand px-10 py-4 text-lg font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
                  {t.enter}
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="divider-glow mx-6" />

            {/* Trending */}
            <div className="px-6 py-10">
              <div className="text-center">
                <h2 className="text-3xl font-bold"><span className="text-gradient-green">$MoinMoin</span></h2>
                <p className="mt-2 text-muted-foreground inline-flex items-center gap-2">
                  {t.trending} <TrendingUp className="h-4 w-4 text-brand" />
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {trending.map((tr) => (
                  <div key={tr.title} className="rounded-xl bg-surface border border-border overflow-hidden group">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img src={tr.img} alt={tr.city} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <button className="absolute inset-0 m-auto h-10 w-10 rounded-full bg-black/50 backdrop-blur border border-white/20 flex items-center justify-center">
                        <Play className="h-4 w-4 fill-white text-white" />
                      </button>
                    </div>
                    <div className="p-3">
                      <Waveform bars={28} className="h-5 mb-2" />
                      <div className="text-sm font-semibold truncate">{tr.title}</div>
                      <div className="text-xs text-muted-foreground">{tr.city}</div>
                      <div className="mt-1 text-xs text-brand inline-flex items-center gap-1">
                        <Play className="h-3 w-3 fill-brand" /> {tr.plays}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="divider-glow mx-6" />

            {/* SlangTag Showcase */}
            <div className="px-6 py-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <h2 className="text-2xl font-black tracking-tight text-brand">{t.communitySlangTag}</h2>
                  <p className="mt-1 text-muted-foreground">{t.communityDesc}</p>
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-black tracking-tight text-brand-cyan">{t.partnerSlangTag}</h2>
                  <p className="mt-1 text-muted-foreground">{t.partnerDesc}</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <SlangTagShowcaseCard
                  type="community"
                  user="berlin.vibes"
                  place="Berlin, Germany"
                  time="2h"
                  tag="$moin"
                  img={berlin}
                  plays="24.5K"
                  overlayLikes="1.2K"
                  bottomLikes={128}
                  bottomComments={24}
                  bottomShares={12}
                  duration="0:03"
                  audioSrc={moinAudio.url}
                />
                <SlangTagShowcaseCard
                  type="partner"
                  user="foodie.travels"
                  place="Miami, USA"
                  time="5h"
                  tag="$crispyburger"
                  img={burger}
                  plays="125K"
                  overlayLikes="6.9K"
                  bottomLikes={256}
                  bottomComments={31}
                  bottomShares={18}
                  duration="0:04"
                />
              </div>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                <p className="text-lg font-semibold text-brand">{t.communityLabel}</p>
                <p className="text-lg font-semibold text-brand-cyan inline-flex items-center justify-center gap-1">{t.partnerLabel} <BadgeCheck className="h-5 w-5" /></p>
              </div>
            </div>

            {/* Features */}
            <div className="px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[Globe, AudioLines, Users, Star].map((Icon, i) => (
                <div key={i} className="text-center">
                  <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg text-brand">
                    <Icon className="h-8 w-8" strokeWidth={1.5} />
                  </div>
                  <div className="font-semibold">{t.features[i].title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{t.features[i].a}</div>
                  <div className="text-sm text-muted-foreground">{t.features[i].b}</div>
                </div>
              ))}
            </div>

            {/* Newsletter */}
            <div className="mx-6 mb-6 rounded-xl border border-border bg-surface p-4 flex flex-col md:flex-row items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-10 w-10 rounded-lg border border-brand/40 flex items-center justify-center text-brand">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">{t.stayTitle}</div>
                  <div className="text-xs text-muted-foreground">{t.stayDesc}</div>
                </div>
              </div>
              <NewsletterForm />

            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-6 text-center">
              <div className="flex justify-center gap-6 text-brand">
                {["TikTok", "Instagram", "X", "YouTube"].map((s) => (
                  <a key={s} href="#" aria-label={s} className="hover:opacity-80">
                    <div className="h-5 w-5 rounded-sm bg-brand/80" />
                  </a>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">© 2025 Y-Dude. {t.rights}</p>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="space-y-6">
            {/* Feed */}
            <LiveFeed />


            {/* UI Elements */}
            <section className="rounded-2xl border border-border bg-surface/40 p-4">
              <h3 className="text-xs font-bold tracking-widest text-foreground mb-3">{t.cardsUi}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background/60 border border-border p-3">
                  <div className="text-sm font-semibold mb-2">{t.slangTag}</div>
                  <Waveform bars={30} className="h-8" />
                  <button className="mt-2 h-6 w-6 rounded-full bg-brand/20 flex items-center justify-center text-brand">
                    <Play className="h-3 w-3 fill-brand" />
                  </button>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-medium">Heast oida</span>
                    <span className="text-muted-foreground">Vienna</span>
                  </div>
                  <div className="text-xs text-brand inline-flex items-center gap-1 mt-0.5">
                    <Play className="h-3 w-3 fill-brand" /> 7.2K
                  </div>
                </div>
                <div className="rounded-xl bg-background/60 border border-border p-3">
                  <div className="text-sm font-semibold mb-2">{t.topRegion}</div>
                  <div className="aspect-video rounded-md bg-gradient-to-br from-brand/20 to-transparent border border-border relative overflow-hidden">
                    <svg viewBox="0 0 200 100" className="h-full w-full opacity-70" fill="none">
                      <circle cx="60" cy="40" r="2" fill="oklch(0.82 0.24 150)" />
                      <circle cx="100" cy="50" r="3" fill="oklch(0.82 0.24 150)" />
                      <circle cx="140" cy="45" r="2" fill="oklch(0.82 0.24 150)" />
                      <circle cx="90" cy="30" r="1.5" fill="oklch(0.82 0.24 150)" />
                      <circle cx="120" cy="60" r="1.5" fill="oklch(0.82 0.24 150)" />
                    </svg>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-medium">Greece</span>
                    <span className="text-brand inline-flex items-center gap-1">
                      <Play className="h-3 w-3 fill-brand" /> 12.8K
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Progress */}
            <section className="rounded-2xl border border-border bg-surface/40 p-4">
              <h3 className="text-xs font-bold tracking-widest text-foreground mb-4">{t.progressAccents}</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{t.loading}</span>
                    <span>75%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-brand" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{t.premium}</span>
                    <span>100%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full w-full bg-gradient-brand" />
                  </div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
