import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // R1 (CDN/Cache-Audit): globale Defaults – reduziert Refetch-Wellen bei
  // Tab-Fokus, Remount und Navigation. Query-spezifische staleTime-Werte
  // überschreiben diese Defaults weiterhin.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // R5 (CDN/Cache-Audit): Preloads werden innerhalb von 30 s wiederverwendet.
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
