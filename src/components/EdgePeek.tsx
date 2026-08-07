import { Trophy, Radio, Globe2 } from "lucide-react";
import { useEdgePeek } from "@/lib/use-edge-peek";
import type { NavTarget } from "@/lib/use-swipe-nav-gesture";

/**
 * Vorschau-Ebene für Edge Peek: schiebt die Zielseite als Teaser
 * vom Bildschirmrand ins Bild und folgt dabei dem Finger.
 * Rein additiv, blockiert keine bestehende Geste.
 */
export function EdgePeek({ to, edge: edgeProp }: { to: NavTarget; edge?: "left" | "right" }) {
  const edge = edgeProp ?? (to === "/arena" ? "right" : "left");
  const { progress, dragging, idle } = useEdgePeek(edge, to);
  if (idle) return null;

  const sign = edge === "right" ? 1 : -1;
  const translate = sign * (1 - progress) * 100;
  const teaser = TEASER[to];

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none">
      <div
        className="absolute inset-0 bg-background/60"
        style={{ opacity: progress, willChange: "opacity" }}
      />
      <div
        className="absolute inset-0 border-border/60 bg-card shadow-2xl"
        style={{
          transform: `translate3d(${translate}%,0,0)`,
          transition: dragging ? "none" : "transform 280ms cubic-bezier(0.22,1,0.36,1)",
          willChange: "transform",
          borderLeftWidth: edge === "right" ? 1 : 0,
          borderRightWidth: edge === "left" ? 1 : 0,
        }}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
            <teaser.Icon className="h-9 w-9 text-primary" />
          </div>
          <p className="text-xl font-semibold text-foreground">{teaser.title}</p>
          <p className="max-w-xs text-sm text-muted-foreground">{teaser.text}</p>
          <p className="text-xs text-muted-foreground/70">
            Weiterziehen zum Öffnen · loslassen zum Abbrechen
          </p>
        </div>
      </div>
    </div>
  );
}

/** Teaser-Inhalte je Zielseite. */
const TEASER: Record<NavTarget, { Icon: typeof Trophy; title: string; text: string }> = {
  "/arena": {
    Icon: Trophy,
    title: "SlangTag Arena",
    text: "Challenges, Einreichungen und Live-Ranking.",
  },
  "/dev": {
    Icon: Radio,
    title: "Live Feed",
    text: "Beiträge, SlangTags und Community.",
  },
  "/globe": {
    Icon: Globe2,
    title: "Slang Globe",
    text: "Slang, Dialekte und Trends weltweit auf der 3D-Weltkugel.",
  },
};
