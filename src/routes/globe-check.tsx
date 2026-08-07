import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
const GlobeStage = lazy(() => import("@/components/globe/GlobeStage"));
export const Route = createFileRoute("/globe-check")({
  component: () => (
    <ClientOnly fallback={null}>
      <Suspense fallback={null}>
        <GlobeStage />
      </Suspense>
    </ClientOnly>
  ),
});
