import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BrainCircuit } from "lucide-react";

import { BackButton } from "@/components/ui/nav-buttons";
import { adminCheckAccess } from "@/lib/admin.functions";
import { goBackOr } from "@/lib/back-nav";

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
  component: KnowledgeGraphPage,
});

function KnowledgeGraphPage() {
  const router = useRouter();
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
      {access.isLoading ? (
        <Fallback text="Zugriff wird geprüft …" />
      ) : access.data?.isAdmin ? (
        <ClientOnly fallback={<Fallback text="Graph wird geladen …" />}>
          <Suspense fallback={<Fallback text="Graph wird geladen …" />}>
            <KnowledgeGraphStage />
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
