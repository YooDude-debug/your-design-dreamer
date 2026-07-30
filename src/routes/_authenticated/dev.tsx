import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useMemo } from "react";
import { Waveform } from "@/components/Waveform";
import {
  Menu, Globe, MapPin, Flame, Users, Play, Heart, MessageCircle,
  Share2, Bookmark, TrendingUp, Star, AudioLines, Mail, ChevronRight, Check,
  BadgeCheck, ImageOff, PlusSquare,
} from "lucide-react";
import globe from "@/assets/globe.png";
import ydudeLogo from "@/assets/ydude-logo.png";
import { LanguageProvider, useLang } from "@/lib/i18n";
import { useData } from "@/lib/data";
import { formatStat, relativeTime, type Post } from "@/lib/types";
import { SlangTagCanvas } from "@/components/SlangTagCanvas";
import { SlangTagChip } from "@/components/SlangTagChip";
import { PostDetailOverlay } from "@/components/PostDetailOverlay";
import { PostComposer } from "@/components/CreatePostDialog";
import { useSocial } from "@/lib/social";
import { useSocialUI } from "@/components/SocialLayer";
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

type TabKey = "local" | "global" | "trending" | "following";

function IndexWrapper() {
  return (
    <LanguageProvider>
      <Index />
    </LanguageProvider>
  );
}

/** Ein echter Beitrag im Feed – alle Zahlen kommen aus der Datenbank. */
function FeedPost({ post, onOpen }: { post: Post; onOpen: (rect: DOMRect) => void }) {
  const navigate = useNavigate();
  const {
    getTag, likedPosts, savedPosts, sharedPosts, togglePostLike, togglePostSave, sharePost,
    commentsByPost, loadComments, addComment, profiles,
  } = useData();
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");

  const liked = likedPosts.includes(post.id);
  const saved = savedPosts.includes(post.id);
  const shared = sharedPosts.includes(post.id);
  const comments = commentsByPost[post.id] ?? [];
  const tags = post.slangTagIds.map((id) => getTag(id)).filter(Boolean);

  const openComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next) await loadComments(post.id);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await addComment(post.id, text);
  };

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-background/60">
      <header className="flex items-center justify-between px-3 py-2.5">
        <Link to="/profile/$username" params={{ username: post.author.username }} className="group flex items-center gap-2.5">
          <div className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-brand to-brand-cyan">
            {post.author.avatar && <img src={post.author.avatar} alt="" className="h-full w-full object-cover" />}
          </div>
          <div>
            <div className="flex items-center gap-1 text-sm font-semibold leading-tight group-hover:text-brand">
              @{post.author.username}
              {post.author.verified && <BadgeCheck className="h-3.5 w-3.5 text-brand-cyan" />}
            </div>
            <div className="text-xs text-muted-foreground">{post.region || "—"}</div>
          </div>
        </Link>
        <span className="text-xs text-muted-foreground">{relativeTime(post.createdAt)}</span>
      </header>

      {post.image ? (
        <button
          type="button"
          onClick={(e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="block w-full px-3 text-left"
        >
          <SlangTagCanvas
            image={post.image}
            placements={post.placements}
            onOpenTag={(n) => navigate({ to: "/slangtag/$name", params: { name: n } })}
          />
        </button>
      ) : (
        <div className="mx-3 grid h-24 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          <ImageOff className="h-4 w-4" />
        </div>
      )}

      <div className="px-3 pt-2">
        <button
          type="button"
          onClick={(e) => onOpen((e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="text-left text-base font-semibold leading-tight hover:text-brand"
        >
          {post.title}
        </button>
        {post.description && <p className="mt-1 text-sm text-muted-foreground">{post.description}</p>}
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((t) => (
              <SlangTagChip
                key={t!.id}
                tag={t!}
                variant="dot"
                onOpen={() => navigate({ to: "/slangtag/$name", params: { name: t!.name } })}
              />
            ))}
          </div>
        )}
        {post.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-brand-cyan">
            {post.hashtags.map((h) => (
              <span key={h}>#{h.replace(/^#/, "")}</span>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-2 flex items-center justify-between border-t border-border/60 px-3 py-2.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <button
            onClick={() => void togglePostLike(post.id)}
            aria-pressed={liked}
            className={`inline-flex items-center gap-1.5 transition-colors ${liked ? "text-brand" : "hover:text-foreground"}`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {formatStat(post.stats.likes)}
          </button>
          <button
            onClick={() => void openComments()}
            aria-expanded={showComments}
            className={`inline-flex items-center gap-1.5 transition-colors ${showComments ? "text-brand-cyan" : "hover:text-foreground"}`}
          >
            <MessageCircle className="h-4 w-4" /> {formatStat(post.stats.comments)}
          </button>
          <button
            onClick={() => void sharePost(post.id)}
            disabled={shared}
            className="inline-flex items-center gap-1.5 hover:text-foreground disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" /> {formatStat(post.stats.shares)}
          </button>
        </div>
        <button
          onClick={() => void togglePostSave(post.id)}
          aria-label="Speichern"
          className={saved ? "text-brand-cyan" : "hover:text-foreground"}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </footer>

      {showComments && (
        <div className="space-y-2 border-t border-border/60 bg-background/40 px-3 py-3">
          {comments.length === 0 && (
            <div className="text-xs italic text-muted-foreground">Noch keine Kommentare — sei der Erste.</div>
          )}
          {comments.map((c) => {
            const author = profiles[c.userId];
            return (
              <div key={c.id} className="flex items-start gap-2 text-sm">
                <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-brand-cyan to-brand">
                  {author?.avatar && <img src={author.avatar} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">@{author?.username ?? "unbekannt"}</span>
                    <span className="text-[10px] text-muted-foreground">{relativeTime(c.createdAt)}</span>
                  </div>
                  <div className="text-foreground/90">{c.body}</div>
                </div>
              </div>
            );
          })}
          <form onSubmit={(e) => void submit(e)} className="flex items-center gap-2 pt-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Kommentar schreiben…"
              className="flex-1 rounded-full border border-border bg-surface/60 px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button type="submit" disabled={!draft.trim()} className="text-xs font-bold tracking-wider text-brand disabled:opacity-40">
              SENDEN
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function LiveFeed({ onCreate }: { onCreate: () => void }) {
  const { posts, me, likedPosts, loading } = useData();
  const { t } = useLang();
  const [active, setActive] = useState<TabKey>("global");
  const [detail, setDetail] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** Alle Tabs nutzen dieselbe Datenbasis – nur die Filter unterscheiden sich. */
  const visible = useMemo(() => {
    const city = (me?.location ?? "").split(",")[0].trim().toLowerCase();
    switch (active) {
      case "local":
        return city ? posts.filter((p) => p.region.toLowerCase().includes(city)) : [];
      case "trending":
        return [...posts].sort(
          (a, b) =>
            b.stats.likes + b.stats.comments + b.stats.shares - (a.stats.likes + a.stats.comments + a.stats.shares),
        );
      case "following": {
        const authors = new Set(posts.filter((p) => likedPosts.includes(p.id)).map((p) => p.userId));
        return posts.filter((p) => authors.has(p.userId));
      }
      default:
        return posts;
    }
  }, [posts, active, me, likedPosts]);

  const tabs: { key: TabKey; label: string; Icon: typeof MapPin }[] = [
    { key: "local", label: t.local, Icon: MapPin },
    { key: "global", label: t.globalTab, Icon: Globe },
    { key: "trending", label: t.trendingTab, Icon: Flame },
    { key: "following", label: t.following, Icon: Users },
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-widest text-foreground">{t.feed}</h3>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-brand">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          LIVE
        </span>
      </div>
      <div className="flex items-center gap-4 overflow-x-auto border-b border-border pb-3 text-sm">
        {tabs.map(({ key, label, Icon }) => {
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => setActive(key)}
              className={`-mb-[13px] inline-flex items-center gap-1.5 whitespace-nowrap pb-2 transition-colors ${
                on ? "border-b-2 border-brand text-brand" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} className="mt-4 max-h-[720px] space-y-4 overflow-y-auto pr-1 scroll-smooth">
        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-background/40 px-4 py-10 text-center">
            <div className="text-3xl">🏜️</div>
            <p className="mt-2 text-sm font-semibold">Noch keine Beiträge vorhanden.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? "Beiträge werden geladen …" : "Sei der Erste und veröffentliche einen Beitrag mit einem SlangTag."}
            </p>
            <button
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <PlusSquare className="h-4 w-4" /> Ersten Beitrag erstellen
            </button>
          </div>
        ) : (
          visible.map((p, i) => (
            <FeedPost
              key={p.id}
              post={p}
              onOpen={(rect) => {
                setOriginRect(rect);
                setDetail(i);
              }}
            />
          ))
        )}
      </div>

      {detail !== null && (
        <PostDetailOverlay
          posts={visible}
          index={detail}
          originRect={originRect}
          onIndexChange={setDetail}
          onClose={() => setDetail(null)}
        />
      )}
    </section>
  );
}

/** Top-SlangTags nach echten Wiedergaben. */
function TrendingTags() {
  const { sortedTags, loading } = useData();
  const navigate = useNavigate();
  const { t } = useLang();
  const top = sortedTags("plays").slice(0, 4);

  return (
    <div className="px-6 py-10">
      <div className="text-center">
        <h2 className="text-3xl font-bold"><span className="text-gradient-green">Top SlangTags</span></h2>
        <p className="mt-2 inline-flex items-center gap-2 text-muted-foreground">
          {t.trending} <TrendingUp className="h-4 w-4 text-brand" />
        </p>
      </div>

      {top.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {loading ? "SlangTags werden geladen …" : "Noch keine SlangTags aufgenommen."}
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {top.map((tag) => (
            <div key={tag.id} className="overflow-hidden rounded-xl border border-border bg-surface p-3">
              <SlangTagChip
                tag={tag}
                variant="compact"
                onOpen={() => navigate({ to: "/slangtag/$name", params: { name: tag.name } })}
              />
              <div className="mt-2 truncate text-xs text-muted-foreground">{tag.region || "—"}</div>
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-brand">
                <Play className="h-3 w-3 fill-brand" /> {formatStat(tag.stats.plays)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
      .from("newsletter_subscribers")
      .insert({ email: value, language: lang });
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
    <form onSubmit={onSubmit} className="flex w-full items-center gap-2 md:w-auto">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t.emailPh}
        disabled={loading}
        className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-brand disabled:opacity-60 md:w-56"
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
  const { posts, tags } = useData();
  const { unreadNotifications, incoming, conversations } = useSocial();
  const { openMessenger, openConnections, openNotifications } = useSocialUI();
  const scrollToComposer = () =>
    document.getElementById("composer")?.scrollIntoView({ behavior: "smooth", block: "start" });

  const totalPlays = tags.reduce((s, x) => s + x.stats.plays, 0);
  const totalLikes = posts.reduce((s, p) => s + p.stats.likes, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_380px]">
          {/* PROFILE PANEL */}
          <ProfilePanel />

          {/* MITTE */}
          <div className="overflow-hidden rounded-2xl border border-border bg-surface/40">
            <div className="flex items-center justify-between px-6 py-5">
              <button className="text-foreground/80 hover:text-foreground"><Menu className="h-6 w-6" /></button>
              <img src={ydudeLogo} alt="Y-Dude" className="h-10 w-auto md:h-12" />
              <div className="flex items-center gap-1">
                {[
                  { Icon: Bell, label: "Benachrichtigungen", onClick: openNotifications, badge: unreadNotifications },
                  { Icon: Users, label: "Connections", onClick: openConnections, badge: incoming.length },
                  { Icon: MessageSquare, label: "Nachrichten", onClick: () => openMessenger(), badge: conversations.length ? 0 : 0 },
                ].map(({ Icon, label, onClick, badge }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    aria-label={label}
                    title={label}
                    className="relative grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
                  >
                    <Icon className="h-4 w-4" />
                    {!!badge && (
                      <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[9px] font-bold text-primary-foreground">
                        {badge}
                      </span>
                    )}
                  </button>
                ))}
                <LanguageSwitcher />
              </div>
            </div>

            {/* Hero */}
            <div className="relative overflow-hidden px-6 pb-10 pt-6 text-center">
              <img
                src={globe}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -left-24 top-16 h-[420px] w-[420px] opacity-60 blur-[0.3px]"
              />
              <h1 className="relative text-6xl font-black leading-none tracking-tight md:text-7xl">
                <span className="text-foreground">Y-</span>
                <span className="text-gradient-green drop-shadow-[0_0_30px_oklch(0.82_0.24_150/0.5)]">Dude</span>
              </h1>
              <p className="relative mt-5 text-xl font-medium md:text-2xl">
                {t.tagline_speak} <span className="text-gradient-green">{t.tagline_local}</span> {t.tagline_connect} <span className="text-gradient-cyan">{t.tagline_global}</span>
              </p>
              <p className="relative mt-8 text-lg leading-relaxed text-muted-foreground">
                {t.discover}<br />{t.feel}
              </p>
              <div className="relative mt-10 flex justify-center">
                <button
                  onClick={scrollToComposer}
                  className="group relative inline-flex items-center gap-3 rounded-full bg-gradient-brand px-10 py-4 text-lg font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                >
                  {t.enter}
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="divider-glow mx-6" />

            {/* Dauerhaft sichtbarer Beitrags-Editor */}
            <section id="composer" className="px-6 py-8">
              <h2 className="text-xl font-black tracking-tight">
                Beitrag mit <span className="text-gradient-green">SlangTags</span> erstellen
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Bild hochladen, SlangTags aus deiner Slang Box darauf ziehen und veröffentlichen.
              </p>
              <div className="mt-4">
                <PostComposer />
              </div>
            </section>

            <div className="divider-glow mx-6" />

            <div id="discover">
              <TrendingTags />
            </div>

            <div className="divider-glow mx-6" />

            {/* Features */}
            <div className="grid grid-cols-2 gap-6 px-6 py-8 md:grid-cols-4">
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
            <div className="mx-6 mb-6 flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-4 md:flex-row">
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand/40 text-brand">
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

          {/* RECHTS */}
          <aside className="space-y-6">
            <LiveFeed onCreate={scrollToComposer} />

            {/* Echte Gesamtwerte */}
            <section className="rounded-2xl border border-border bg-surface/40 p-4">
              <h3 className="mb-3 text-xs font-bold tracking-widest text-foreground">COMMUNITY</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Beiträge", v: posts.length },
                  { label: "SlangTags", v: tags.length },
                  { label: "Wiedergaben", v: totalPlays },
                  { label: "Likes", v: totalLikes },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-background/60 p-3">
                    <div className="text-lg font-black text-brand">{formatStat(s.v)}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              <Waveform bars={30} className="mt-3 h-6" />
            </section>
          </aside>
        </div>
      </div>

      
    </div>
  );
}
