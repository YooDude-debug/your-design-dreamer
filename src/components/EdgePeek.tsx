import { Trophy, Radio } from "lucide-react";
import { useEdgePeek } from "@/lib/use-edge-peek";

/**
 * Vorschau-Ebene für Edge Peek: schiebt die Zielseite als Teaser
 * vom Bildschirmrand ins Bild und folgt dabei dem Finger.
 * Rein additiv, blockiert keine bestehende Geste.
 */
export function EdgePeek({ to }: { to: "/arena" | "/dev" }) {
  const edge = to === "/arena" ? "right" : "left";
  const { progress, dragging, idle } = useEdgePeek(edge, to);
  if (idle) return null;

  const sign = edge === "right" ? 1 : -1;
  const translate = sign * (1 - progress) * 100;
  const arena = to === "/arena";

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
            {arena ? (
              <Trophy className="h-9 w-9 text-primary" />
            ) : (
              <Radio className="h-9 w-9 text-primary" />
            )}
          </div>
          <p className="text-xl font-semibold text-foreground">
            {arena ? "SlangTag Arena" : "Live Feed"}
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            {arena
              ? "Challenges, Einreichungen und Live-Ranking."
              : "Beiträge, SlangTags und Community."}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Weiterziehen zum Öffnen · loslassen zum Abbrechen
          </p>
        </div>
      </div>
    </div>
  );
}
