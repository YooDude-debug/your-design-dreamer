import { BackButton } from "@/components/ui/nav-buttons";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,
  LayoutGrid,
  Package,
  UserRound,
  Gift,
  Sparkles,
} from "lucide-react";

import { useData } from "@/lib/data-context";
import { getCreatorAccess, getCreatorStats, type CreatorStats } from "@/lib/creator.functions";
import { CreatorStatsPanel } from "@/components/CreatorStatsPanel";
import { CreatorSlangTagsDialog } from "@/components/CreatorSlangTagsDialog";
import { roleAreaLabel, roleSlangTagLabel } from "@/lib/role-scope";

/**
 * Creator-/Unternehmer-Bereich.
 *
 * Zugang ausschliesslich über den bestehenden Creator-/Unternehmer-Status
 * (`user_roles`: `creator` oder `business`). Die Prüfung findet zusätzlich
 * serverseitig in `getCreatorAccess`/`getCreatorStats` statt – der direkte
 * Aufruf der Adresse nützt Nutzern ohne Badge daher nichts.
 */
export const Route = createFileRoute("/_authenticated/creator")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    view: "overview" | "stats" | "drops" | "bizdrops";
    scope?: "creator" | "business";
  } => {
    const raw = search["view"];
    const rawScope = search["scope"];
    const view =
      raw === "stats" || raw === "drops" || raw === "bizdrops"
        ? (raw as "stats" | "drops" | "bizdrops")
        : ("overview" as const);
    // Reiner Anzeigekontext: welcher Bereich wurde geöffnet? Die echten
    // Rollen bleiben unberührt und werden weiterhin serverseitig geprüft.
    return rawScope === "creator" || rawScope === "business" ? { view, scope: rawScope } : { view };
  },
  beforeLoad: async ({ search }) => {
    // Netzwerk-Aussetzer (z. B. HMR-Reload) dürfen die Seite nicht leeren:
    // einmal kurz erneut versuchen, sonst neutral weiterlaufen lassen.
    let access: Awaited<ReturnType<typeof getCreatorAccess>> | null = null;
    for (let attempt = 0; attempt < 2 && !access; attempt++) {
      try {
        access = await getCreatorAccess();
      } catch (err) {
        if (attempt === 1) {
          console.warn("[creator] Zugriffsprüfung fehlgeschlagen", err);
          return { creatorAccess: { isCreator: false, isBusiness: false, allowed: true } };
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    if (!access || !access.allowed) throw redirect({ to: "/dev" });

    // Drops sind rollengebunden: Creator-Drops nur mit Creator-Status,
    // Unternehmer-Drops nur mit Unternehmer-Status.
    if (search.view === "drops" && !access.isCreator) {
      throw redirect({ to: "/creator", search: { view: "overview" } });
    }
    if (search.view === "bizdrops" && !access.isBusiness) {
      throw redirect({ to: "/creator", search: { view: "overview" } });
    }
    return { creatorAccess: access };
  },
  head: () => ({
    meta: [
      { title: "Creator / Unternehmer — Y-Dude" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Creator- und Unternehmerbereich von Y-Dude: Inhalte, Profil und Kennzahlen.",
      },
      { property: "og:title", content: "Creator / Unternehmer — Y-Dude" },
      { property: "og:description", content: "Creator-Dashboard mit Inhalten und Kennzahlen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatorPage,
});

function CreatorPage() {
  const { view, scope } = Route.useSearch();
  const { creatorAccess } = Route.useRouteContext();
  const { me } = useData();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [error, setError] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  /**
   * Rollenreine Beschriftung: die Bereichsbezeichnung folgt ausschliesslich
   * den echten Rollen aus `user_roles` (serverseitig in `getCreatorAccess`
   * ermittelt) – kein gemischtes Label ohne die jeweilige Rolle.
   */
  const onlyBusiness = creatorAccess.isBusiness && !creatorAccess.isCreator;
  /**
   * Angezeigter Kontext: der geöffnete Bereich entscheidet, nicht die Summe
   * der Rollen. Ein Kontext wird nur übernommen, wenn die passende Rolle
   * tatsächlich vorhanden ist; sonst greift die reine Rollenlage.
   */
  const requestedScope =
    view === "drops" ? "creator" : view === "bizdrops" ? "business" : (scope ?? null);
  const activeScope: "creator" | "business" | null =
    requestedScope === "creator" && creatorAccess.isCreator
      ? "creator"
      : requestedScope === "business" && creatorAccess.isBusiness
        ? "business"
        : creatorAccess.isCreator && !creatorAccess.isBusiness
          ? "creator"
          : creatorAccess.isBusiness && !creatorAccess.isCreator
            ? "business"
            : null;
  /**
   * Ohne eindeutigen Kontext (echte Mehrfachrolle, kein `scope`) gelten die
   * zentralen, rollenreinen Bezeichnungen aus `role-scope` – dieselbe Quelle,
   * die auch der Rest der Anwendung verwendet.
   */
  const areaLabel =
    activeScope === "creator"
      ? "Creator"
      : activeScope === "business"
        ? "Unternehmer"
        : roleAreaLabel(creatorAccess);
  const tagLabel =
    activeScope === "creator"
      ? "Creator SlangTags"
      : activeScope === "business"
        ? "Unternehmer SlangTags"
        : roleSlangTagLabel(creatorAccess);
  const businessContext = activeScope === "business";

  useEffect(() => {
    let alive = true;
    setError(false);
    void getCreatorStats()
      .then((s) => {
        if (alive) setStats(s);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const nav = [
    { view: "overview" as const, icon: LayoutGrid, label: "Dashboard" },
    // Kontextrein: im Creator-Bereich nur Creator-Drops, im Unternehmer-
    // Bereich nur Unternehmer-Drops. Die Rollen selbst bleiben unverändert.
    ...(creatorAccess.isCreator && activeScope !== "business"
      ? [{ view: "drops" as const, icon: Gift, label: "SlangTag Drops" }]
      : []),
    ...(creatorAccess.isBusiness && activeScope !== "creator"
      ? [{ view: "bizdrops" as const, icon: Gift, label: "Unternehmer Drops" }]
      : []),
    { view: "stats" as const, icon: BarChart3, label: "Statistiken" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <BackButton
          onClick={() => {
            // Definiertes Ziel je Navigationsebene – bewusst kein history.back():
            // Unterseite -> Haupt-Dashboard des aktuellen Bereichs, Haupt-Dashboard -> Profil.
            if (view !== "overview") {
              void navigate({
                to: "/creator",
                search: { view: "overview", ...(activeScope ? { scope: activeScope } : {}) },
              });
              return;
            }
            if (me?.username) {
              void navigate({ to: "/profile/$username", params: { username: me.username } });
              return;
            }
            void navigate({ to: "/" });
          }}
          ariaLabel="Zurück"
        />

        <h1 className="flex items-center gap-2 text-lg font-black tracking-tight">
          <BriefcaseBusiness className="h-4 w-4 text-brand" />
          {areaLabel}
        </h1>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {nav.map((n) => (
          <Link
            key={n.view}
            to="/creator"
            search={{ view: n.view, ...(activeScope ? { scope: activeScope } : {}) }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
              view === n.view
                ? "border-brand/60 bg-brand/10 text-brand"
                : "border-border text-muted-foreground hover:border-brand/40 hover:text-brand"
            }`}
          >
            <n.icon className="h-3.5 w-3.5" />
            {n.label}
          </Link>
        ))}
      </div>

      {view === "drops" || view === "bizdrops" ? (
        <section className="mt-4 space-y-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              {view === "drops" ? (
                <Sparkles className="h-4 w-4 text-brand" />
              ) : (
                <BriefcaseBusiness className="h-4 w-4 text-brand-cyan" />
              )}
              {view === "drops" ? "SlangTag Drops" : "Unternehmer Drops"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {view === "drops"
                ? "Drops sind für deine eigenen Follower vorgesehen: Du veröffentlichst einen SlangTag exklusiv für Personen, die dir folgen."
                : "Unternehmer-Drops sind für die Follower deines Unternehmens vorgesehen: exklusive Aktionen und SlangTags für deine Community."}
            </p>
            <p className="mt-3 rounded-xl border border-border bg-accent/40 p-3 text-xs text-muted-foreground">
              Struktur vorbereitet – die Drop-Logik wird im nächsten Schritt festgelegt. Bereits
              nutzbar: Community-SlangTags und
              <span className="font-bold text-brand"> $$ Creator-SlangTags</span> in der
              SlangTag-Verwaltung.
            </p>
          </div>

          <Link
            to="/arena"
            search={{ tab: "manager" }}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-colors hover:border-brand/50"
          >
            <Package className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">SlangTags verwalten</span>
              <span className="block text-xs text-muted-foreground">
                Community- und $$ Creator-SlangTags anlegen
              </span>
            </span>
          </Link>
        </section>
      ) : view === "overview" ? (
        <section className="mt-4 space-y-2">
          <Link
            to="/posts"
            className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-colors hover:border-brand/50"
          >
            <LayoutGrid className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">Meine Inhalte</span>
              <span className="block text-xs text-muted-foreground">
                Eigene Beiträge öffnen, bearbeiten und löschen
              </span>
            </span>
          </Link>

          <Link
            to="/arena"
            search={{ tab: "manager" }}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-colors hover:border-brand/50"
          >
            <Package className="h-4 w-4 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-sm font-bold">Meine SlangTags</span>
              <span className="block text-xs text-muted-foreground">
                Bestehende SlangTag-Verwaltung
              </span>
            </span>
          </Link>

          {me && (
            <Link
              to="/profile/$username"
              params={{ username: me.username }}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-background p-4 transition-colors hover:border-brand/50"
            >
              <UserRound className="h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  {businessContext || onlyBusiness ? "Unternehmensprofil" : "Creator-Profil"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {businessContext || onlyBusiness
                    ? "Öffentliche Ansicht mit deinen Unternehmer-SlangTags"
                    : "Öffentliche Ansicht mit Creator-SlangTags"}
                </span>
              </span>
            </Link>
          )}

          {me && (
            <button
              type="button"
              onClick={() => setTagsOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-brand-cyan/50"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-brand-cyan" />
              <span className="min-w-0">
                <span className="block text-sm font-bold">{tagLabel}</span>
                <span className="block text-xs text-muted-foreground">
                  {businessContext || onlyBusiness
                    ? "Eigene SlangTags deines Unternehmens einstufen"
                    : "Kostenlos, für Follower oder für Abonnenten einstufen"}
                </span>
              </span>
            </button>
          )}

          {tagsOpen && me && (
            <CreatorSlangTagsDialog
              creatorId={me.id}
              isSelf
              variant={businessContext || onlyBusiness ? "business" : "creator"}
              onClose={() => setTagsOpen(false)}
            />
          )}
        </section>
      ) : (
        <section className="mt-4">
          {error && (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              Kennzahlen konnten nicht geladen werden.
            </p>
          )}
          {!error && !stats && (
            <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
              Kennzahlen werden geladen …
            </p>
          )}
          {stats && <CreatorStatsPanel stats={stats} />}
        </section>
      )}
    </div>
  );
}
