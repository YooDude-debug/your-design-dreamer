import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";

/** Mini-Game-Ansicht: laeuft nur im Browser (Canvas, Sprachausgabe). */
const HelloWorldGameView = lazy(() => import("@/components/minigame/HelloWorldGame"));

export const Route = createFileRoute("/_authenticated/minigame")({
  head: () => ({
    meta: [
      { title: "Mini Game – Hello World | Y-Dude" },
      {
        name: "description",
        content:
          "Kleines Y-Dude Jump'n'Run: Sammle echte Begrüßungen aus aller Welt ein, vermeide falsche Wörter und höre dir die richtige Aussprache an.",
      },
      { property: "og:title", content: "Mini Game – Hello World | Y-Dude" },
      {
        property: "og:description",
        content: "Springe, sammle echte Begrüßungen und lerne, wie die Welt Hallo sagt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MiniGamePage,
});

function MiniGamePage() {
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <HelloWorldGameView />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
