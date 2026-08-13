import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  BadgeCheck,
  Globe,
  Menu,
  Megaphone,
  HelpCircle,
  FileText,
  ShieldCheck,
  Users,
  Lock,
  LayoutDashboard,
  UserRound,
  ShieldAlert,
  ChevronDown,
  Package,
} from "lucide-react";



import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangText } from "@/components/SlangTagInput";
import type { ProfileVisibility } from "@/lib/types";
import { ProfileEditDialog } from "@/components/ProfileEditDialog";
import { profileTexts } from "@/lib/i18n-profile";
import { DropdownPortal } from "@/components/DropdownPortal";
import { PresenceSlider } from "@/components/PresenceSlider";

import { AdFeedPanel } from "@/components/AdFeed";
import { adFeedLabel } from "@/lib/ad-feed-copy";

const VIS_OPTIONS = [
  {
    value: "public",
    icon: Globe,
    labelKey: "profVisPublic",
    hintKey: "profVisPublicHint",
  },
  {
    value: "connections",
    icon: Users,
    labelKey: "profVisConnections",
    hintKey: "profVisConnectionsHint",
  },
  {
    value: "private",
    icon: Lock,
    labelKey: "profVisPrivate",
    hintKey: "profVisPrivateHint",
  },
] as const satisfies readonly {
  value: ProfileVisibility;
  icon: typeof Globe;
  labelKey: "profVisPublic" | "profVisConnections" | "profVisPrivate";
  hintKey: "profVisPublicHint" | "profVisConnectionsHint" | "profVisPrivateHint";
}[];

export function ProfilePanel({ children }: { children?: ReactNode }) {
  const { me, updateMyProfile, isAdmin } = useData();
  const { t, lang } = useLang();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<"profile" | "details" | "security" | "account">("profile");
  const [menuOpen, setMenuOpen] = useState(false);
  const [adFeedOpen, setAdFeedOpen] = useState(false);
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const locRef = useRef<HTMLButtonElement | null>(null);

  const setProfileVisibility = async (value: ProfileVisibility) => {
    setLocMenuOpen(false);
    if (!me || me.profileVisibility === value) return;
    await updateMyProfile({ profileVisibility: value });
  };

  const [moreOpen, setMoreOpen] = useState(false);

  const navigateToProfile = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    openEdit("profile");
  };

  const navigateToArenaManager = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    void navigate({ to: "/arena", search: { tab: "mine", sub: "manager" } });
  };

  const openAdFeed = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    setAdFeedOpen(true);
  };

  const mainMenuItems: {
    icon: typeof UserRound;
    label: string;
    onClick: () => void;
  }[] = [
    { icon: UserRound, label: t.tabProfile, onClick: navigateToProfile },
    {
      icon: Settings,
      label: at.tabManagerLabel,
      onClick: navigateToArenaManager,
    },
    { icon: Megaphone, label: adFeedLabel(lang), onClick: openAdFeed },
  ];

  const moreItems: {
    icon: typeof HelpCircle;
    label: string;
    onClick: () => void;
  }[] = [
    { icon: HelpCircle, label: t.help, onClick: () => setMenuOpen(false) },
    {
      icon: FileText,
      label: t.imprint,
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        void navigate({ to: "/impressum" });
      },
    },
    {
      icon: ShieldCheck,
      label: t.privacy,
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        void navigate({ to: "/datenschutz" });
      },
    },
    {
      icon: FileText,
      label: "AGB",
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        void navigate({ to: "/agb" });
      },
    },
    {
      icon: FileText,
      label: t.communityGuidelines,
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        void navigate({ to: "/richtlinien" });
      },
    },
  ];

  /**
   * Administratorpunkte. Werden ausschliesslich fuer Nutzer mit
   * Adminrolle gerendert; alle Ziele sind zusaetzlich serverseitig geschuetzt.
   */
  const adminItems: { icon: typeof LayoutDashboard; label: string; href: string }[] = isAdmin
    ? [
        { icon: LayoutDashboard, label: t.adminDashboard, href: "/admin" },
        { icon: ShieldAlert, label: t.moderation, href: "/admin/moderation" },
      ]
    : [];


  if (!me) {
    return (
      <aside className="rounded-2xl border border-border bg-background p-5 text-sm text-muted-foreground">
        {t.profileLoading}
      </aside>
    );
  }

  return (
    <aside className="space-y-2">
      <section className="relative rounded-2xl border border-border bg-background">
        {/* Cover – kompakter (15 % weniger Gesamthöhe im Profilkopf) */}
        <div className="relative h-16 w-full overflow-hidden rounded-t-2xl bg-gradient-to-r from-brand/20 via-transparent to-brand-cyan/20">
          {me.cover && (
            <img
              src={me.coverMedium ?? me.cover}
              alt=""
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover opacity-70"
            />
          )}
        </div>

        {/* Hamburger-Menü – liegt über allen Profil- und Composer-Elementen */}
        <button
          ref={menuRef}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={t.menu}
          aria-expanded={menuOpen}
          title={t.menu}
          className="absolute right-2 top-2 z-[60] grid h-9 w-9 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground backdrop-blur transition-colors hover:border-brand/60 hover:text-brand"
        >
          <Menu className="h-4 w-4" />
        </button>
        <DropdownPortal
          anchorRef={menuRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          align="right"
          width={224}
        >
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
          {adminItems.length > 0 && (
            <>
              <div className="my-1 border-t border-border/60" />
              <div className="px-2.5 pb-1 pt-1 text-[10px] uppercase tracking-widest text-brand">
                Administration
              </div>
              {adminItems.map((a) => (
                <a
                  key={a.href}
                  href={a.href}
                  onClick={() => setMenuOpen(false)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                >
                  <a.icon className="h-4 w-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                </a>
              ))}
            </>
          )}
        </DropdownPortal>

        {/* Header */}
        <div className="-mt-9 px-5 pb-2 text-center">
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
                  src={me.avatarThumb ?? me.avatar}
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
            className="mt-1 block leading-tight transition-colors hover:text-brand"
          >
            {/* Verifizierungszeichen sitzt eng am Namen (kein eigener Block) */}
            <h2 className="inline-flex items-center gap-0.5 text-xl font-black leading-tight tracking-tight">
              {me.displayName}
              {me.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-brand-cyan" />}
            </h2>
            <div className="text-xs leading-tight text-muted-foreground">@{me.username}</div>
          </Link>

          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <button
              ref={locRef}
              onClick={() => setLocMenuOpen((v) => !v)}
              aria-label={t.profileVisibility}
              aria-expanded={locMenuOpen}
              title={t.profileVisibility}
              className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 transition-colors hover:bg-brand/10 hover:text-brand"
            >
              {(() => {
                const active = VIS_OPTIONS.find((o) => o.value === me.profileVisibility);
                const Icon = active?.icon ?? Globe;
                return (
                  <>
                    <Icon className="h-3 w-3 text-brand" />
                    <span className="max-w-[9rem] truncate">
                      {active ? t[active.labelKey] : t.profVisPublic}
                    </span>
                  </>
                );
              })()}
            </button>
            <DropdownPortal
              anchorRef={locRef}
              open={locMenuOpen}
              onClose={() => setLocMenuOpen(false)}
              align="center"
              width={224}
              className="text-left"
            >
              <div className="px-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {t.profileVisibility}
              </div>
              {VIS_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => void setProfileVisibility(o.value)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-brand/10 ${
                    me.profileVisibility === o.value ? "text-brand" : ""
                  }`}
                >
                  <o.icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{t[o.labelKey]}</span>
                    <span className="block text-[10px] text-muted-foreground">{t[o.hintKey]}</span>
                  </span>
                </button>
              ))}
            </DropdownPortal>

            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3 text-brand-cyan" /> {me.language}
            </span>

            <PresenceSlider
              value={me.presenceStatus}
              onChange={(v) => void updateMyProfile({ presenceStatus: v })}
            />

          </div>

          {me.bio && (
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              <SlangText text={me.bio} />
            </p>
          )}

          {/* Statistiken liegen ausschliesslich auf der vollstaendigen Profilseite. */}
        </div>

        {/* Composer – gehoert optisch zum Profil, klappt weich aus */}
        {children && (
          <div className="border-t border-border/60 px-4 pb-3 pt-2 text-left sm:px-5">
            {children}
          </div>
        )}
      </section>

      <ProfileEditDialog open={editOpen} initialTab={editTab} onClose={() => setEditOpen(false)} />
      {adFeedOpen && <AdFeedPanel onClose={() => setAdFeedOpen(false)} />}
    </aside>
  );
}
