import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { BackButton } from "@/components/ui/nav-buttons";
import { adminCheckAccess } from "@/lib/admin.functions";
import { goBackOr } from "@/lib/back-nav";
import { isOrbDataScope, type OrbDataScope } from "@/orb-core/scope-values";

const SynapticLab = lazy(() => import("@/components/orb-synaptic-lab/SynapticLab"));

export const Route = createFileRoute("/_authenticated/orb/synaptic-lab")({
  head: () => ({
    meta: [
      { title: "ORB Synaptic Lab (Experiment) — Y-Dude" },
      {
        name: "description",
        content: "Isoliertes Experiment: Wachstum, Verfall und Verstärkung eines Wissensgraphen im Vergleich.",
      },
      { property: "og:title", content: "ORB Synaptic Lab (Experiment) — Y-Dude" },
      { property: "og:description", content: "Synaptisches Wachstum und Pruning – Simulation A/B/C." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { scope: OrbDataScope } => ({
    scope: isOrbDataScope(s.scope) ? s.scope : "normal",
  }),
  component: SynapticLabPage,
});

function SynapticLabPage() {
  const router = useRouter();
  const { scope } = Route.useSearch();
  const check = useServerFn(adminCheckAccess);
  const access = useQuery({ queryKey: ["admin-check-access"], queryFn: () => check(), staleTime: 300_000 });
  return (
    <div className="relative min-h-[100svh] bg-background text-foreground">
      <BackButton
        onClick={() => goBackOr(router, "/orb/knowledge-graph")}
        label="Zurück"
        ariaLabel="Zurück zum Knowledge Graph"
        className="absolute right-3 top-3 z-20"
      />
      <div className="absolute left-3 top-3 z-20 rounded-full border border-border/60 bg-surface/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        ORB Synaptic Lab · Experiment · Simulation
      </div>
      {access.isLoading ? (
        <p className="p-6 pt-16 text-sm text-muted-foreground">Zugriff wird geprüft …</p>
      ) : access.data?.isAdmin ? (
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <SynapticLab key={scope} scope={scope} />
          </Suspense>
        </ClientOnly>
      ) : (
        <p className="p-6 pt-16 text-sm text-muted-foreground">Nur für Admins verfügbar.</p>
      )}
    </div>
  );
}
