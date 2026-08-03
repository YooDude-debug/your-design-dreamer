import { useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  MapPin,
  Globe,
  Pencil,
  Settings,
  Menu,
  LayoutGrid,
  Megaphone,
  HelpCircle,
  FileText,
  ShieldCheck,
  ChevronDown,
  Users,
  Lock,
} from "lucide-react";

import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangText } from "@/components/SlangTagInput";
import { formatCount, type LocationVisibility } from "@/lib/types";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { DropdownPortal } from "@/components/DropdownPortal";

import { ProfileStatsModal, type StatsTab } from "@/components/ProfileStatsModal";
import { useSocial } from "@/lib/social-context";
import { AdFeedPanel } from "@/components/AdFeed";
import { adFeedLabel } from "@/lib/ad-feed-copy";


const LOC_OPTIONS = [
  {
    value: "public",
    icon: Globe,
    labelKey: "locVisPublic",
    hintKey: "locVisPublicHint",
  },
  {
    value: "connections",
    icon: Users,
    labelKey: "locVisConnections",
    hintKey: "locVisConnectionsHint",
  },
  {
    value: "private",
    icon: Lock,
    labelKey: "locVisPrivate",
    hintKey: "locVisPrivateHint",
  },
] as const satisfies readonly {
  value: LocationVisibility;
  icon: typeof Globe;
  labelKey: "locVisPublic" | "locVisConnections" | "locVisPrivate";
  hintKey: "locVisPublicHint" | "locVisConnectionsHint" | "locVisPrivateHint";
}[];

export function ProfilePanel() {
  const { me, posts, tags, updateMyProfile } = useData();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const { connectedIds } = useSocial();
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<"profile" | "security">("profile");
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsTab, setStatsTab] = useState<StatsTab | null>(null);
  const [adFeedOpen, setAdFeedOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const locRef = useRef<HTMLDivElement | null>(null);

  const myPosts = useMemo(() => posts.filter((p) => p.userId === me?.id), [posts, me]);
  const myTags = useMemo(() => tags.filter((t) => t.creatorId === me?.id), [tags, me]);
  const totalLikes = myPosts.reduce((sum, p) => sum + p.stats.likes, 0);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!locMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!locRef.current?.contains(e.target as Node)) setLocMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [locMenuOpen]);

  const setLocationVisibility = async (value: LocationVisibility) => {
    setLocMenuOpen(false);
    if (!me || me.locationVisibility === value) return;
    await updateMyProfile({ locationVisibility: value });
  };

  const openEdit = (tab: "profile" | "security") => {
    setEditTab(tab);
    setEditOpen(true);
    setMenuOpen(false);
  };

  const menuItems: {
    icon: typeof Pencil;
    label: string;
    onClick: () => void;
    accent?: boolean;
  }[] = [
    { icon: Pencil, label: t.editProfile, onClick: () => openEdit("profile"), accent: true },
    {
      icon: LayoutGrid,
      label: t.myPosts,
      onClick: () => {
        setMenuOpen(false);
        void navigate({ to: "/posts" });
      },
    },
    {
      icon: Megaphone,
      label: adFeedLabel(lang),
      onClick: () => {
        setMenuOpen(false);
        setAdFeedOpen(true);
      },
    },
    { icon: Settings, label: t.settings, onClick: () => openEdit("security") },
    { icon: HelpCircle, label: t.help, onClick: () => setMenuOpen(false) },
    {
      icon: FileText,
      label: t.imprint,
      onClick: () => {
        setMenuOpen(false);
        void navigate({ to: "/impressum" });
      },
    },
    {
      icon: ShieldCheck,
      label: t.privacy,
      onClick: () => {
        setMenuOpen(false);
        void navigate({ to: "/datenschutz" });
      },
    },
  ];

  if (!me) {
    return (
      <aside className="rounded-2xl border border-border bg-surface/40 p-5 text-sm text-muted-foreground">
        {t.profileLoading}
      </aside>
    );
  }

  return (
    <aside className="space-y-3">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface/40">
        {/* Cover */}
        <div className="relative h-20 w-full bg-gradient-to-r from-brand/20 via-transparent to-brand-cyan/20">
          {me.cover && (
            <img
              src={me.cover}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover opacity-70"
            />
          )}

          {/* Hamburger-Menü */}
          <div ref={menuRef} className="absolute right-2 top-2 z-20">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t.menu}
              aria-expanded={menuOpen}
              title={t.menu}
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:border-brand/60 hover:text-brand"
            >
              <Menu className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 w-56 overflow-hidden rounded-xl border border-border bg-background/95 p-1.5 shadow-glow backdrop-blur">
                {menuItems.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.onClick}
                    className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                  >
                    <a.icon
                      className={`h-4 w-4 shrink-0 ${a.accent ? "text-brand" : "text-muted-foreground"} group-hover:text-brand`}
                    />
                    <span className="min-w-0 flex-1 truncate">{a.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Header */}
        <div className="-mt-10 px-5 pb-3 text-center">
          {/* Klick auf Profilbild oder Namen öffnet ausschliesslich die
              öffentliche Profilansicht. Bearbeiten nur über das Menü. */}
          <Link
            to="/profile/$username"
            params={{ username: me.username }}
            aria-label={t.viewProfile}
            className="relative mx-auto block h-24 w-24"
          >
            <div className="absolute -inset-1 rounded-full bg-gradient-brand opacity-60 blur-md" />
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-2 border-brand bg-background shadow-glow">
              {me.avatar ? (
                <img
                  src={me.avatar}
                  alt={me.displayName}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-brand">
                  {me.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </Link>

          <Link
            to="/profile/$username"
            params={{ username: me.username }}
            className="mt-1.5 block transition-colors hover:text-brand"
          >
            <h2 className="inline-flex items-center gap-1.5 text-xl font-black tracking-tight">
              {me.displayName}
              {me.verified && <BadgeCheck className="h-4 w-4 text-brand-cyan" />}
            </h2>
            <div className="text-xs text-muted-foreground">@{me.username}</div>
          </Link>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <div ref={locRef} className="relative">
              <button
                onClick={() => setLocMenuOpen((v) => !v)}
                aria-label={t.locationVisibility}
                aria-expanded={locMenuOpen}
                title={t.locationVisibility}
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-brand/10 hover:text-brand"
              >
                <MapPin className="h-3 w-3 text-brand" />
                <span className="max-w-[9rem] truncate">{me.location || t.location}</span>
                {(() => {
                  const Icon =
                    LOC_OPTIONS.find((o) => o.value === me.locationVisibility)?.icon ?? Globe;
                  return <Icon className="h-3 w-3 text-muted-foreground" />;
                })()}
              </button>

              {locMenuOpen && (
                <div className="absolute left-1/2 top-7 z-30 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background/95 p-1.5 text-left shadow-glow backdrop-blur">
                  <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t.locationVisibility}
                  </div>
                  {LOC_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => void setLocationVisibility(o.value)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-brand/10 ${
                        me.locationVisibility === o.value ? "text-brand" : ""
                      }`}
                    >
                      <o.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold">{t[o.labelKey]}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {t[o.hintKey]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3 text-brand-cyan" /> {me.language}
            </span>
          </div>

          {me.locationVisibility !== "public" && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {me.locationVisibility === "connections"
                ? `(${t.locVisFriendsOnly})`
                : t.locVisHiddenNote}
            </p>
          )}

          {me.bio && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              <SlangText text={me.bio} />
            </p>
          )}

          {/* Stats – standardmaessig eingeklappt, gleiche Animation wie der Composer */}
          <button
            onClick={() => setStatsOpen((v) => !v)}
            aria-expanded={statsOpen}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:text-brand"
          >
            {t.showStats}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-300 ${statsOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`grid transition-all duration-300 ease-out ${
              statsOpen
                ? "grid-rows-[1fr] opacity-100"
                : "pointer-events-none grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl border border-border bg-background/50 py-3">
                {(
                  [
                    { v: formatCount(myTags.length), l: t.statSlangTags, tab: "tags" },
                    {
                      v: formatCount(connectedIds.length),
                      l: t.statConnections,
                      tab: "connections",
                    },
                    { v: formatCount(myPosts.length), l: t.statPosts, tab: "posts" },
                    { v: formatCount(totalLikes), l: t.statLikes, tab: "likes" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.l}
                    onClick={() => setStatsTab(s.tab)}
                    title={t.statsDetails}
                    className="min-w-0 rounded-lg transition-colors hover:bg-brand/10"
                  >
                    <div className="text-base font-black text-brand">{s.v}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{s.l}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProfileEditDialog open={editOpen} initialTab={editTab} onClose={() => setEditOpen(false)} />
      <ProfileStatsModal
        open={statsTab !== null}
        tab={statsTab ?? "tags"}
        onTabChange={setStatsTab}
        onClose={() => setStatsTab(null)}
      />
      {adFeedOpen && <AdFeedPanel onClose={() => setAdFeedOpen(false)} />}
    </aside>
  );
}
