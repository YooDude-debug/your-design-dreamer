import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit } from "lucide-react";

import { BackButton } from "@/components/ui/nav-buttons";
import { adminCheckAccess } from "@/lib/admin.functions";
import { goBackOr } from "@/lib/back-nav";
import type { OrbDataScope } from "@/orb-core/scope-values";

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
  // Nur der normale Chat: der Graph zeigt immer dessen Daten (keine Bereichswahl).
  validateSearch: (_s: Record<string, unknown>): { scope: OrbDataScope } => ({ scope: "normal" }),
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
      {/* Oberer Aktionsbereich: eine Zeile, die bei schmalen Viewports umbricht. */}
      <header className="relative z-20 flex flex-wrap items-center gap-2 p-3">
        <div className="hidden rounded-full border border-border/60 bg-surface/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md sm:block">
          ORB Knowledge Graph · Experiment · nur Lesen
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {access.data?.isAdmin && (
            <Link
              to="/orb/unassigned"
              className="rounded-full border border-border/60 bg-surface/80 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur-md"
            >
              Nicht zugeordnet – historische Daten
            </Link>
          )}
          {access.data?.isAdmin && (
            <Link
              to="/orb/synaptic-lab"
              search={{ scope }}
              className="rounded-full border border-border/60 bg-surface/80 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur-md"
            >
              Synaptic Lab (Experiment)
            </Link>
          )}
          <BackButton
            onClick={() => goBackOr(router, "/channels/orb")}
            label="Zurück zu ORB"
            ariaLabel="Zurück zu ORB"
          />
        </div>
      </header>
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
