import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  LayoutGrid,
  Package,
  UserRound,
} from "lucide-react";

import { useData } from "@/lib/data-context";
import { getCreatorAccess, getCreatorStats, type CreatorStats } from "@/lib/creator.functions";

/**
 * Creator-/Unternehmer-Bereich.
 *
 * Zugang ausschliesslich über den bestehenden Creator-/Unternehmer-Status
 * (`user_roles`: `creator` oder `business`). Die Prüfung findet zusätzlich
 * serverseitig in `getCreatorAccess`/`getCreatorStats` statt – der direkte
 * Aufruf der Adresse nützt Nutzern ohne Badge daher nichts.
 */
export const Route = createFileRoute("/_authenticated/creator")({
  validateSearch: (search: Record<string, unknown>): { view: "overview" | "stats" } => ({
    view: search["view"] === "stats" ? "stats" : "overview",
  }),
  beforeLoad: async () => {
    const access = await getCreatorAccess();
    if (!access.allowed) throw redirect({ to: "/dev" });
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-black text-foreground">{value}</div>
    </div>
  );
}

function CreatorPage() {
  const { view } = Route.useSearch();
  const { me } = useData();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [error, setError] = useState(false);

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
    { view: "overview" as const, icon: LayoutGrid, label: "Creator Dashboard" },
    { view: "stats" as const, icon: BarChart3, label: "Statistiken" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => void navigate({ to: "/dev" })}
          aria-label="Zurück"
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-brand/60 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex items-center gap-2 text-lg font-black tracking-tight">
          <BriefcaseBusiness className="h-4 w-4 text-brand" />
          Creator / Unternehmer
        </h1>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {nav.map((n) => (
          <Link
            key={n.view}
            to="/creator"
            search={{ view: n.view }}
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

      {view === "overview" ? (
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
            search={{ tab: "mine", sub: "manager" }}
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
                <span className="block text-sm font-bold">Creator-Profil</span>
                <span className="block text-xs text-muted-foreground">
                  Öffentliche Ansicht mit Creator-Kennzeichnung
                </span>
              </span>
            </Link>
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
          {stats && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard label="Beiträge" value={String(stats.posts)} />
              <StatCard label="Likes erhalten" value={String(stats.likesReceived)} />
              <StatCard label="Kommentare" value={String(stats.comments)} />
              <StatCard label="Follower" value={String(stats.followers)} />
              <StatCard label="SlangTags" value={String(stats.slangTags)} />
              <StatCard label="SlangTag-Nutzungen" value={String(stats.slangTagUses)} />
              <StatCard label="SlangTag-Rang" value={String(stats.slangTagRank)} />
              <StatCard
                label="Mitglied seit"
                value={
                  stats.memberSince ? new Date(stats.memberSince).toLocaleDateString() : "–"
                }
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
