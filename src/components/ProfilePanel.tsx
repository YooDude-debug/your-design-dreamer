import { useRef, useState, useEffect, type ReactNode } from "react";
import { ProfileAvatarLink } from "@/components/AvatarGlow";
import { Link, useNavigate } from "@tanstack/react-router";

import {
  BadgeCheck,
  Globe,
  Menu,
  Megaphone,
  MessageSquarePlus,
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
  BriefcaseBusiness,
  BarChart3,
  LayoutGrid,
  Sparkles,
  Gift,
  Info,
  Plus,
  Globe2,
  Swords,
  Scale,
  Settings,
  LogOut,
  Check,
} from "lucide-react";

import { useData } from "@/lib/data-context";
import { useLang } from "@/lib/lang-context";
import { SlangText } from "@/components/SlangTagInput";
import type { ProfileVisibility } from "@/lib/types";
import { LazyProfileEditDialog } from "@/components/lazy/LazyProfileEditDialog";
import { DropdownPortal } from "@/components/DropdownPortal";

import { PresenceSlider } from "@/components/PresenceSlider";

import { AdFeedPanel } from "@/components/AdFeed";
import { adFeedLabel } from "@/lib/ad-feed-copy";
import { SLANGTAG_INFO_DOC } from "@/lib/slangtag-docs";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { LANGS } from "@/lib/i18n-dict";
import type { Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { clearDeviceMediaCache } from "@/lib/media";
import { SlangTagInfoViewer } from "@/components/SlangTagInfoViewer";

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
  const { me, updateMyProfile, isAdmin, isModerator, isCreator, isBusiness } = useData();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();

  const [editOpen, setEditOpen] = useState(false);
  const [editTab, setEditTab] = useState<"profile" | "details" | "security" | "account">("profile");
  const [menuOpen, setMenuOpen] = useState(false);
  const [adFeedOpen, setAdFeedOpen] = useState(false);
  const [locMenuOpen, setLocMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const locRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onOpen = () => setComposerOpen(true);
    window.addEventListener("y-dude:open-composer", onOpen);
    return () => window.removeEventListener("y-dude:open-composer", onOpen);
  }, []);

  const setProfileVisibility = async (value: ProfileVisibility) => {
    setLocMenuOpen(false);
    if (!me || me.profileVisibility === value) return;
    await updateMyProfile({ profileVisibility: value });
  };

  const openEdit = (tab: "profile" | "details" | "security" | "account") => {
    setEditTab(tab);
    setEditOpen(true);
    setMenuOpen(false);
    setMoreOpen(false);
  };

  const [moreOpen, setMoreOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const [creatorInfoOpen, setCreatorInfoOpen] = useState(false);
  const [businessInfoOpen, setBusinessInfoOpen] = useState(false);
  const [infoDocOpen, setInfoDocOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  /** Bestehende Abmeldung – nur die Position hat sich geändert. */
  const doSignOut = async () => {
    setLogoutConfirmOpen(false);
    clearDeviceMediaCache();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    setCreatorOpen(false);
    setBusinessOpen(false);
    setCreatorInfoOpen(false);
    setBusinessInfoOpen(false);
    setLangOpen(false);
  };

  const navigateToProfile = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    openEdit("profile");
  };

  const navigateToArenaManager = () => {
    setMenuOpen(false);
    setMoreOpen(false);
    void navigate({ to: "/arena", search: { tab: "manager" } });
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
      icon: Package,
      label: t.slangBoxTabMine,
      onClick: navigateToArenaManager,
    },

    { icon: Megaphone, label: adFeedLabel(lang), onClick: openAdFeed },
    {
      icon: MessageSquarePlus,
      label: "Feedback & Verbesserung",
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        setFeedbackOpen(true);
      },
    },
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
    {
      icon: Scale,
      label: t.moderationCenter,
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        void navigate({ to: "/moderation" });
      },
    },
    {
      icon: BarChart3,
      label: t.transparencyReport,
      onClick: () => {
        setMenuOpen(false);
        setMoreOpen(false);
        void navigate({ to: "/transparenz" });
      },
    },
  ];

  /**
   * Creator-/Unternehmerpunkte. Grundlage ist ausschliesslich das bestehende
   * Badge „Creator / Unternehmer“ (Rollen `creator`/`business`) – nicht die
   * Adminrolle, kein Username und keine Benutzer-ID. Alle Ziele sind
   * zusaetzlich serverseitig geschuetzt.
   */
  const creatorItems: {
    icon: typeof LayoutGrid;
    label: string;
    onClick: () => void;
  }[] = isCreator
    ? [
        {
          icon: LayoutDashboard,
          label: "Creator Dashboard",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/creator", search: { view: "overview" } });
          },
        },
        {
          icon: Gift,
          label: "SlangTag Drops",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/creator", search: { view: "drops" } });
          },
        },
        {
          icon: LayoutGrid,
          label: "Meine Inhalte",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/posts" });
          },
        },
        {
          icon: UserRound,
          label: "Creator-Profil",
          onClick: () => {
            closeMenu();
            if (me) void navigate({ to: "/profile/$username", params: { username: me.username } });
          },
        },
        {
          icon: BarChart3,
          label: "Statistiken",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/creator", search: { view: "stats" } });
          },
        },
      ]
    : [];

  /**
   * Unternehmerpunkte – unabhaengig vom Creator-Bereich. Grundlage ist
   * ausschliesslich die Rolle `business`; beide Bereiche koennen gleichzeitig
   * sichtbar sein.
   */
  const businessItems: {
    icon: typeof LayoutGrid;
    label: string;
    onClick: () => void;
  }[] = isBusiness
    ? [
        {
          icon: LayoutDashboard,
          label: "Unternehmer Dashboard",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/creator", search: { view: "overview" } });
          },
        },
        {
          icon: Gift,
          label: "Unternehmer Drops",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/creator", search: { view: "bizdrops" } });
          },
        },
        {
          icon: BarChart3,
          label: "Statistiken",
          onClick: () => {
            closeMenu();
            void navigate({ to: "/creator", search: { view: "stats" } });
          },
        },
      ]
    : [];

  /**
   * Administratorpunkte. Werden ausschliesslich fuer Nutzer mit
   * Adminrolle gerendert; alle Ziele sind zusaetzlich serverseitig geschuetzt.
   */
  const adminItems: { icon: typeof LayoutDashboard; label: string; href: string }[] = isAdmin
    ? [
        { icon: LayoutDashboard, label: t.adminDashboard, href: "/admin" },
        { icon: ShieldAlert, label: t.moderation, href: "/admin/moderation" },
      ]
    : isModerator
      ? [{ icon: ShieldAlert, label: t.moderation, href: "/admin/moderation" }]
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
          onClose={closeMenu}
          align="right"
          width={224}
        >
          {mainMenuItems.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
            >
              <a.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand" />
              <span className="min-w-0 flex-1 truncate">{a.label}</span>
            </button>
          ))}

          <div className="my-1 border-t border-border/60" />

          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
          >
            <span className="flex items-center gap-3">
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-brand ${moreOpen ? "rotate-180" : ""}`}
              />
              <span className="min-w-0 flex-1 truncate">{t.more}</span>
            </span>
          </button>

          {moreOpen && (
            <div className="space-y-0.5 pl-2">
              {moreItems.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                >
                  <a.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground group-hover:text-foreground">
                    {a.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="my-1 border-t border-border/60" />

          {/* Slang Globe & Slang Arena – zuvor nur auf Desktop in der Kopfleiste */}
          <button
            onClick={() => {
              closeMenu();
              void navigate({ to: "/globe" });
            }}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
          >
            <Globe2 className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate">Slang Globe</span>
          </button>
          <button
            onClick={() => {
              closeMenu();
              void navigate({ to: "/arena", search: { tab: "box" } });
            }}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
          >
            <Swords className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0 flex-1 truncate">Slang Arena</span>
          </button>

          <div className="my-1 border-t border-border/60" />

          {/* Sprache – dieselbe Sprachlogik wie zuvor in der Kopfleiste */}
          <button
            onClick={() => setLangOpen((v) => !v)}
            aria-expanded={langOpen}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
          >
            <Globe className="h-4 w-4 shrink-0 text-brand-cyan" />
            <span className="min-w-0 flex-1 truncate">{t.langLabel}</span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${langOpen ? "rotate-180" : ""}`}
            />
          </button>
          {langOpen && (
            <div className="space-y-0.5 pl-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLang(l.code as Lang);
                    setLangOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                >
                  <span className="text-base">{l.flag}</span>
                  <span className="min-w-0 flex-1 truncate">{l.label}</span>
                  {lang === l.code && <Check className="h-4 w-4 shrink-0 text-brand" />}
                </button>
              ))}
            </div>
          )}

          {/* Einstellungen – ausschliesslich hier */}
          <button
            onClick={() => openEdit("security")}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand" />
            <span className="min-w-0 flex-1 truncate">{t.settings}</span>
          </button>

          {/* Logout – bestehende Abmeldung */}
          <button
            onClick={() => {
              closeMenu();
              setLogoutConfirmOpen(true);
            }}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
          >
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-brand" />
            <span className="min-w-0 flex-1 truncate">{t.logout}</span>
          </button>

          {creatorItems.length > 0 && (
            <>
              <div className="my-1 border-t border-border/60" />
              <button
                onClick={() => setCreatorOpen((v) => !v)}
                aria-expanded={creatorOpen}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors hover:bg-brand/10"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-brand" />
                <span className="min-w-0 flex-1 truncate">Creator</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:text-brand ${creatorOpen ? "rotate-180" : ""}`}
                />
              </button>
              {creatorOpen && (
                <div className="space-y-0.5 pl-2">
                  {creatorItems.map((a) => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                    >
                      <a.icon className="h-4 w-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    </button>
                  ))}

                  {/* Informationen – zentrale SlangTag-PDF */}
                  <button
                    onClick={() => setCreatorInfoOpen((v) => !v)}
                    aria-expanded={creatorInfoOpen}
                    className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                  >
                    <Info className="h-4 w-4 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1 truncate">Informationen</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${creatorInfoOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {creatorInfoOpen && (
                    <div className="space-y-0.5 pl-2">
                      <button
                        onClick={() => {
                          closeMenu();
                          setInfoDocOpen(true);
                        }}
                        className="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand/10"
                      >
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{SLANGTAG_INFO_DOC.title}</span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {SLANGTAG_INFO_DOC.subtitle}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {businessItems.length > 0 && (
            <>
              <div className="my-1 border-t border-border/60" />
              <button
                onClick={() => setBusinessOpen((v) => !v)}
                aria-expanded={businessOpen}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-bold transition-colors hover:bg-brand-cyan/10"
              >
                <BriefcaseBusiness className="h-4 w-4 shrink-0 text-brand-cyan" />
                <span className="min-w-0 flex-1 truncate">Unternehmer</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${businessOpen ? "rotate-180" : ""}`}
                />
              </button>
              {businessOpen && (
                <div className="space-y-0.5 pl-2">
                  {businessItems.map((a) => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand-cyan/10"
                    >
                      <a.icon className="h-4 w-4 shrink-0 text-brand-cyan" />
                      <span className="min-w-0 flex-1 truncate">{a.label}</span>
                    </button>
                  ))}

                  {/* Informationen – dieselbe zentrale SlangTag-PDF */}
                  <button
                    onClick={() => setBusinessInfoOpen((v) => !v)}
                    aria-expanded={businessInfoOpen}
                    className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand-cyan/10"
                  >
                    <Info className="h-4 w-4 shrink-0 text-brand-cyan" />
                    <span className="min-w-0 flex-1 truncate">Informationen</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${businessInfoOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {businessInfoOpen && (
                    <div className="space-y-0.5 pl-2">
                      <button
                        onClick={() => {
                          closeMenu();
                          setInfoDocOpen(true);
                        }}
                        className="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-brand-cyan/10"
                      >
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{SLANGTAG_INFO_DOC.title}</span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {SLANGTAG_INFO_DOC.subtitle}
                          </span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {adminItems.length > 0 && (
            <>
              <div className="my-1 border-t border-border/60" />
              <div className="px-2.5 pb-1 pt-1 text-[10px] uppercase tracking-widest text-brand">
                {t.administration}
              </div>
              {adminItems.map((a) => (
                <Link
                  key={a.href}
                  to={a.href as never}
                  onClick={() => setMenuOpen(false)}
                  className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-brand/10"
                >
                  <a.icon className="h-4 w-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 truncate">{a.label}</span>
                </Link>
              ))}
            </>
          )}
        </DropdownPortal>

        {/* Header */}
        <div className="-mt-9 px-5 pb-2 text-center">
          {/* Klick auf Profilbild oder Namen öffnet ausschliesslich die
              öffentliche Profilansicht. Bearbeiten nur über das Menü. */}
          <ProfileAvatarLink
            userId={me.id}
            username={me.username}
            displayName={me.displayName}
            avatar={me.avatarThumb ?? me.avatar}
            label={t.viewProfile}
          />

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
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3 text-brand-cyan" /> {me.language}
            </span>
          </div>

          {/* Status-Schieber + Beitrag-Button in einer gemeinsamen Reihe */}
          <div className="mt-2 flex w-full items-center justify-between gap-2">
            <PresenceSlider
              value={me.presenceStatus}
              onChange={(v) => void updateMyProfile({ presenceStatus: v })}
            />
            <button
              type="button"
              onClick={() => setComposerOpen((v) => !v)}
              aria-expanded={composerOpen}
              aria-controls="profile-composer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground shadow-[0_0_18px_oklch(0.82_0.24_150_/_0.25)] transition-all hover:bg-brand-glow hover:shadow-[0_0_24px_oklch(0.82_0.24_150_/_0.4)] active:scale-[0.98] xs:px-5 xs:text-sm"
            >
              <Plus className="h-4 w-4 shrink-0" />
              {composerOpen ? t.createPostPillClose : t.createPostPill}
            </button>
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
          <div
            id="profile-composer"
            className={`grid transition-all duration-300 ease-out ${
              composerOpen
                ? "grid-rows-[1fr] opacity-100"
                : "pointer-events-none grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-border/60 px-4 pb-3 pt-2 text-left sm:px-5">
                {children}
              </div>
            </div>
          </div>
        )}
      </section>

      <LazyProfileEditDialog
        open={editOpen}
        initialTab={editTab}
        onClose={() => setEditOpen(false)}
      />
      {adFeedOpen && <AdFeedPanel onClose={() => setAdFeedOpen(false)} />}
      <SlangTagInfoViewer open={infoDocOpen} onClose={() => setInfoDocOpen(false)} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Abmelden?"
        message="Möchtest du dich wirklich von Y-Dude abmelden?"
        confirmLabel="Abmelden"
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={doSignOut}
      />
    </aside>
  );
}
