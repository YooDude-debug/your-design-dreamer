import { BackButton } from "@/components/ui/nav-buttons";
import { lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly, Link } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";
import { useSlideInClass } from "@/lib/use-swipe-nav-gesture";
import { NavDragHandle } from "@/components/NavDragHandle";
import { useLang } from "@/lib/lang-context";
import { arenaTexts } from "@/lib/i18n-arena";
import { useGlobeDragReset } from "@/lib/globe/use-globe-drag-reset";

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
  const slideIn = useSlideInClass();
  const { lang } = useLang();
  const at = arenaTexts[lang];
  // Nur auf dieser Seite: hängengebliebene Drag-Transforms nach dem Loslassen lösen.
  useGlobeDragReset();

  return (
    <div
      data-page-root
      data-scroll-isolate=""
      className={`relative min-h-[100svh] overflow-hidden overscroll-none bg-background text-foreground ${slideIn}`}
      style={{ willChange: slideIn ? "transform" : undefined }}
    >
      <NavDragHandle to="/feed" side="right" />

      {/* Auf Mobile bewusst ausgeblendet: Navigation dort über Wischgesten. */}
      <BackButton
        to="/feed"
        label={at.backToFeed}
        className="absolute right-3 top-3 z-20 max-sm:hidden"
      />

      <ClientOnly fallback={<GlobeFallback />}>
        <Suspense fallback={<GlobeFallback />}>
          <GlobeStage />
        </Suspense>
      </ClientOnly>

      {/* Ganz unten: dezenter Zugang zum Y-Dude Mini-Game (eigene Ansicht). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          to="/minigame"
          className="tap-safe pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-border/60 bg-surface/70 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md transition-colors hover:border-brand/60 hover:text-brand"
        >
          <span aria-hidden>🎮</span>
          Mini Game – Hello World
          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-brand">Spielen</span>
        </Link>
      </div>
    </div>
  );
}

function GlobeFallback() {
  const { lang } = useLang();
  const at = arenaTexts[lang];
  return (
    <div className="grid h-[100svh] w-full place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Globe2 className="h-10 w-10 animate-pulse text-brand" />
        <p className="text-sm">{at.globeLoading}</p>
      </div>
    </div>
  );
}
