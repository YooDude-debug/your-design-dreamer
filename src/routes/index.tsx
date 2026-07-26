import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Waveform } from "@/components/Waveform";
import {
  Menu, Globe, MapPin, Flame, Users, Play, Heart, MessageCircle,
  Share2, Bookmark, MoreVertical, Volume2, TrendingUp, Star,
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
import { LanguageProvider, useLang, LANGS, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YooDude — Speak Local. Connect Global." },
      { name: "description", content: "Discover slang, feel the vibe. Local voices, global connections through short audio SlangTags." },
      { property: "og:title", content: "YooDude — Speak Local. Connect Global." },
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

const feed = [
  { user: "berlin.vibes", place: "Berlin, Germany", time: "2m", tag: "#berlin", title: "Ick dit dit", img: berlin, likes: 128, comments: 24, shares: 12, duration: "00:03", color: "var(--brand)" },
  { user: "taverna.express", place: "Thessaloniki, Greece", time: "5m", tag: "#greek", title: "Έλα ρε!", img: thessaloniki, likes: 98, comments: 16, shares: 7, duration: "00:02", color: "var(--brand)" },
  { user: "tokyo.vibes", place: "Tokyo, Japan", time: "8m", tag: "#japanese", title: "ヤバい!", img: tokyo, likes: 156, comments: 31, shares: 9, duration: "00:02", color: "oklch(0.72 0.2 300)" },
  { user: "carioca_021", place: "Rio de Janeiro, Brazil", time: "12m", tag: "#brazilian", title: "Valeu demais!", img: rio, likes: 112, comments: 23, shares: 8, duration: "00:03", color: "oklch(0.85 0.2 100)" },
];

function IndexWrapper() {
  return (
    <LanguageProvider>
      <Index />
    </LanguageProvider>
  );
}

function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.langLabel}
        aria-expanded={open}
        className="text-brand-cyan hover:opacity-80 inline-flex items-center gap-1.5"
      >
        <Globe className="h-6 w-6" />
        <span className="text-xs font-semibold uppercase tracking-wider">{lang}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-border bg-surface-2 shadow-card overflow-hidden z-50">
          <div className="px-3 py-2 text-[10px] font-bold tracking-widest text-muted-foreground border-b border-border">
            {t.langLabel}
          </div>
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-brand/10 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-base">{l.flag}</span>
                <span>{l.label}</span>
              </span>
              {lang === l.code && <Check className="h-4 w-4 text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
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
}: SlangTagShowcaseCardProps) {
  const isPartner = type === "partner";
  const accent = isPartner ? "var(--brand-cyan)" : "var(--brand)";
  const accentClass = isPartner ? "text-brand-cyan" : "text-brand";
  const borderClass = isPartner ? "border-brand-cyan" : "border-brand";
  const bgClass = isPartner ? "bg-brand-cyan/10" : "bg-brand/10";

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
            <button className={`h-10 w-10 rounded-full ${bgClass} flex items-center justify-center ${accentClass}`}>
              <Play className="h-5 w-5 fill-current" />
            </button>
            <div>
              <div className={`text-lg font-bold ${accentClass} flex items-center gap-1.5`}>
                {tag}
                {isPartner && <BadgeCheck className="h-4 w-4" />}
              </div>
              <Waveform bars={24} color={accent} className="h-5 w-32 mt-1" />
              <div className="text-right text-xs text-muted-foreground mt-1">{duration}</div>
            </div>
          </div>
          <div className={`mt-2 flex items-center gap-4 text-sm font-semibold ${accentClass}`}>
            <span className="inline-flex items-center gap-1"><Play className="h-3.5 w-3.5 fill-current" /> {plays}</span>
            <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5 fill-current" /> {likes}</span>
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between px-4 py-3 border-t border-border/60 text-muted-foreground">
        <div className="flex items-center gap-5">
          <button className={`inline-flex items-center gap-1.5 hover:text-foreground ${accentClass}`}><Heart className="h-5 w-5" /> {comments}</button>
          <button className="inline-flex items-center gap-1.5 hover:text-foreground"><MessageCircle className="h-5 w-5" /> {shares}</button>
          <button className="inline-flex items-center gap-1.5 hover:text-foreground"><Share2 className="h-5 w-5" /> {bookmarks}</button>
        </div>
        <button className={`hover:text-foreground ${accentClass}`}><Bookmark className="h-5 w-5" /></button>
      </footer>
    </article>
  );
}

function Index() {
  const { t } = useLang();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* LEFT COLUMN */}
          <div className="rounded-2xl border border-border bg-surface/40 overflow-hidden">
            {/* Nav */}
            <div className="flex items-center justify-between px-6 py-5">
              <button className="text-foreground/80 hover:text-foreground"><Menu className="h-6 w-6" /></button>
              <div className="text-2xl font-bold tracking-tight">
                <span className="text-gradient-green">Yoo</span><span>Dude</span>
              </div>
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
                <span className="text-gradient-green drop-shadow-[0_0_30px_oklch(0.82_0.24_150/0.5)]">Yoo</span>
                <span className="text-foreground">Dude</span>
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
              <button className="relative mt-8 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Volume2 className="h-5 w-5 text-brand" />
                <span>{t.hearTag}</span>
              </button>
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
              <div className="flex items-center gap-2 w-full md:w-auto">
                <input
                  type="email"
                  placeholder={t.emailPh}
                  className="flex-1 md:w-56 rounded-full bg-background border border-border px-4 py-2 text-sm outline-none focus:border-brand"
                />
                <button className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground">{t.join}</button>
              </div>
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
              <p className="mt-4 text-xs text-muted-foreground">© 2025 YooDude. {t.rights}</p>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <aside className="space-y-6">
            {/* Feed */}
            <section className="rounded-2xl border border-border bg-surface/40 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold tracking-widest text-foreground">{t.feed}</h3>
              </div>
              <div className="flex items-center gap-4 border-b border-border pb-3 text-sm">
                <button className="inline-flex items-center gap-1.5 text-brand border-b-2 border-brand pb-2 -mb-[13px]">
                  <MapPin className="h-4 w-4" /> {t.local}
                </button>
                <button className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Globe className="h-4 w-4" /> {t.globalTab}
                </button>
                <button className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Flame className="h-4 w-4" /> {t.trendingTab}
                </button>
                <button className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                  <Users className="h-4 w-4" /> {t.following}
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {feed.map((p) => (
                  <article key={p.user} className="rounded-xl bg-background/60 border border-border overflow-hidden">
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
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground"><Heart className="h-4 w-4" /> {p.likes}</button>
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground"><MessageCircle className="h-4 w-4" /> {p.comments}</button>
                        <button className="inline-flex items-center gap-1.5 hover:text-foreground"><Share2 className="h-4 w-4" /> {p.shares}</button>
                      </div>
                      <button className="hover:text-foreground"><Bookmark className="h-4 w-4" /></button>
                    </footer>
                  </article>
                ))}
              </div>
            </section>

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
