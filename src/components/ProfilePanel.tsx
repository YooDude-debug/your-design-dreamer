import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  MapPin,
  Globe,
  Pencil,
  Settings,
  Menu,
  LayoutGrid,
  HelpCircle,
  FileText,
  ShieldCheck,
  LogOut,
} from "lucide-react";

import { useData } from "@/lib/data";
import { useLang } from "@/lib/i18n";
import { SlangText } from "@/components/SlangTagInput";
import { formatCount } from "@/lib/types";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { SlangBox } from "@/components/SlangBox";
import { useSocial } from "@/lib/social";
import { supabase } from "@/integrations/supabase/client";

export function ProfilePanel() {
  const { me, posts, tags } = useData();
  const { t } = useLang();
  const navigate = useNavigate();

  const { connectedIds } = useSocial();
  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<"profile" | "security">("profile");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const openEdit = (tab: "profile" | "security") => {
    setEditTab(tab);
    setEditOpen(true);
    setMenuOpen(false);
  };

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
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
    { icon: LogOut, label: t.logout, onClick: () => void signOut() },
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
          {me.cover && (
            <img
              src={me.cover}
              alt=""
              loading="lazy"
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
              onClick={() => openEdit("profile")}
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
          {(
            [
              { v: formatCount(myTags.length), l: t.statSlangTags, tab: "tags" },
              { v: formatCount(connectedIds.length), l: t.statConnections, tab: "connections" },
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

        <div className="divider-glow mx-5" />

        {/* Slang Box */}
        <div className="px-5 pb-5 pt-4">
          <SlangBox compact />
        </div>
      </section>

      <ProfileEditDialog open={editOpen} initialTab={editTab} onClose={() => setEditOpen(false)} />
    </aside>
  );
}
