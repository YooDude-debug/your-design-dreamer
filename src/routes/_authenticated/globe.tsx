import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly, Link } from "@tanstack/react-router";
import { ArrowLeft, Globe2 } from "lucide-react";
import { useSlideInClass, useSwipeNavGesture } from "@/lib/use-swipe-nav-gesture";
import { EdgePeek } from "@/components/EdgePeek";

/**
 * Slang Globe – eigenständige Seite.
 *
 * Bewusst ohne Verbindung zu Feed, Arena oder Datenbank. Die 3D-Engine wird
 * erst im Browser geladen (Lazy Loading, kein SSR-Import von three.js).
 */
const GlobeStage = lazy(() => import("@/components/globe/GlobeStage"));

export const Route = createFileRoute("/_authenticated/globe")({
  head: () => ({
    meta: [
      { title: "Slang Globe – Weltkarte für Slang & Dialekte | Y-Dude" },
      {
        name: "description",
        content:
          "Interaktive 3D-Weltkugel mit animierter Heatmap: entdecke Slang, Dialekte und Trends nach Land, Stadt, Sprache und Zeitraum.",
      },
      { property: "og:title", content: "Slang Globe – Weltkarte für Slang & Dialekte | Y-Dude" },
      {
        property: "og:description",
        content:
          "3D-Globus mit pulsierender Heatmap, Regionsdetails, Filtern und Suche – der weltweite Slang-Kompass von Y-Dude.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlangGlobePage,
});

function SlangGlobePage() {
  // Spiegelverkehrte Rückgeste zum Feed (analog zur Arena, nur andere Seite).
  useSwipeNavGesture("left-then-right", "/dev");
  const slideIn = useSlideInClass();

  return (
    <div
      className={`relative min-h-[100svh] overflow-hidden bg-background text-foreground ${slideIn}`}
      style={{ willChange: slideIn ? "transform" : undefined }}
    >
      <EdgePeek to="/dev" edge="right" />

      <Link
        to="/dev"
        className="absolute right-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/70 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md hover:text-brand"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Feed
      </Link>

      <ClientOnly fallback={<GlobeFallback />}>
        <Suspense fallback={<GlobeFallback />}>
          <GlobeStage />
        </Suspense>
      </ClientOnly>
    </div>
  );
}

function GlobeFallback() {
  return (
    <div className="grid h-[100svh] w-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Globe2 className="h-10 w-10 animate-pulse text-brand" />
        <p className="text-sm">Slang Globe wird geladen …</p>
      </div>
    </div>
  );
}
