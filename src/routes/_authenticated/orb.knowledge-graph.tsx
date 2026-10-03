import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit } from "lucide-react";

import { BackButton } from "@/components/ui/nav-buttons";
import { adminCheckAccess } from "@/lib/admin.functions";
import { goBackOr } from "@/lib/back-nav";
import { ORB_DATA_SCOPES, isOrbDataScope, type OrbDataScope } from "@/orb-core/scope-values";

const SCOPE_LABEL: Record<OrbDataScope, string> = {
  normal: "Normal",
  orb_core: "ORB Core",
  y_dude: "Y-Dude",
  unassigned: "Nicht zugeordnet",
};

/**
 * ORB Knowledge Graph – isolierte Experiment-/Debug-Ansicht (nur Admins).
 * three.js wird wie beim Slang Globe erst im Browser geladen.
 */
const KnowledgeGraphStage = lazy(
  () => import("@/components/orb-knowledge-graph/KnowledgeGraphStage"),
);

export const Route = createFileRoute("/_authenticated/orb/knowledge-graph")({
  head: () => ({
    meta: [
      { title: "ORB Knowledge Graph (Experiment) — Y-Dude" },
      {
        name: "description",
        content:
          "Experimentelle 3D-Ansicht des ORB-Wissensgraphen mit gespeicherter Aktivitäts-Telemetrie.",
      },
      { property: "og:title", content: "ORB Knowledge Graph (Experiment) — Y-Dude" },
      { property: "og:description", content: "3D-Wissensgraph des ORB Core – Debug-Ansicht." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  // Bereich sichtbar in der Adresse; ungültig/fehlend → "normal" (immer genau ein Bereich).
  validateSearch: (s: Record<string, unknown>): { scope: OrbDataScope } => ({
    scope: isOrbDataScope(s.scope) ? s.scope : "normal",
  }),
  component: KnowledgeGraphPage,
});

function KnowledgeGraphPage() {
  const router = useRouter();
  const { scope } = Route.useSearch();
  const check = useServerFn(adminCheckAccess);
  const access = useQuery({
    queryKey: ["admin-check-access"],
    queryFn: () => check(),
    staleTime: 300_000,
  });

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-background text-foreground">
      <BackButton
        onClick={() => goBackOr(router, "/channels/orb")}
        label="Zurück zu ORB"
        ariaLabel="Zurück zu ORB"
        className="absolute right-3 top-3 z-20"
      />
      <div className="absolute left-3 top-3 z-20 hidden rounded-full border border-border/60 sm:block bg-surface/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md">
        ORB Knowledge Graph · Experiment · nur Lesen
      </div>
      {access.data?.isAdmin && (
        <Link
          to="/orb/unassigned"
          className="absolute right-3 top-14 z-20 rounded-full border border-border/60 bg-surface/80 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur-md"
        >
          Nicht zugeordnet – historische Daten
        </Link>
      )}
      {access.data?.isAdmin && (
        <nav
          aria-label="Bereich"
          className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1 rounded-full border border-border/60 bg-surface/80 p-1 backdrop-blur-md"
        >
          {ORB_DATA_SCOPES.map((s) => (
            <Link
              key={s}
              to="/orb/knowledge-graph"
              search={{ scope: s }}
              aria-current={s === scope ? "page" : undefined}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                s === scope ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {SCOPE_LABEL[s]}
            </Link>
          ))}
        </nav>
      )}
      {/* Rein erklärend: Cognitive-Daten sind transient (nur Live-Broadcast). */}
      <p className="pointer-events-none absolute inset-x-3 top-[10rem] z-10 text-center text-[11px] leading-snug text-muted-foreground lg:inset-x-auto lg:left-3 lg:top-12 lg:text-left">
        <span className="font-semibold text-foreground/80">Cognitive-Ebenen</span> erscheinen live
        während eines ORB-Chats.
      </p>
      {access.isLoading ? (
        <Fallback text="Zugriff wird geprüft …" />
      ) : access.data?.isAdmin ? (
        <ClientOnly fallback={<Fallback text="Graph wird geladen …" />}>
          <Suspense fallback={<Fallback text="Graph wird geladen …" />}>
            <KnowledgeGraphStage key={scope} scope={scope} />
          </Suspense>
        </ClientOnly>
      ) : (
        <Fallback text="Diese Experiment-Ansicht ist nur für Admins verfügbar." />
      )}
    </div>
  );
}

function Fallback({ text }: { text: string }) {
  return (
    <div className="grid h-[100svh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <BrainCircuit className="h-10 w-10 animate-pulse text-brand" />
        <p className="text-sm">{text}</p>
      </div>
    </div>
  );
}
