import { Loader2, Pin, ScanFace } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import type { SlangTagPlacement } from "@/lib/types";

/**
 * Umschalter "Fixiert" / "Gesicht folgen" für SlangTags auf Videos.
 * Nur Anzeige und Auswahl – die Tracking-Logik liegt in `useFaceFollow`.
 */
export function FaceFollowBar({
  placements,
  picking,
  busy,
  progress,
  failed,
  onFixed,
  onFollow,
  onCancel,
}: {
  placements: SlangTagPlacement[];
  picking: string | null;
  busy: string | null;
  progress: number;
  failed: boolean;
  onFixed: (id: string) => void;
  onFollow: (id: string) => void;
  onCancel: () => void;
}) {
  const { t } = useLang();
  if (!placements.length) return null;

  return (
    <div className="space-y-1.5">
      {placements.map((p) => {
        const following = p.follow?.mode === "face";
        const isBusy = busy === p.id;
        const isPicking = picking === p.id;
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => onFixed(p.id)}
                aria-pressed={!following}
                disabled={isBusy}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                  following ? "text-muted-foreground hover:text-brand" : "bg-brand/15 text-brand"
                }`}
              >
                <Pin className="h-3 w-3" /> {t.tagFixed}
              </button>
              <button
                type="button"
                onClick={() => (isPicking ? onCancel() : onFollow(p.id))}
                aria-pressed={following}
                disabled={isBusy}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                  following || isPicking
                    ? "bg-brand/15 text-brand"
                    : "text-muted-foreground hover:text-brand"
                }`}
              >
                <ScanFace className="h-3 w-3" /> {t.tagFollowFace}
              </button>
            </div>
            {isBusy ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-brand">
                <Loader2 className="h-3 w-3 animate-spin" /> {t.faceTracking}{" "}
                {Math.round(progress * 100)}%
              </span>
            ) : isPicking ? (
              <span className="text-[11px] text-brand">{t.faceTapHint}</span>
            ) : failed && !following ? (
              <span className="text-[11px] text-destructive">{t.faceTrackFailed}</span>
            ) : following ? (
              <span className="text-[11px] text-muted-foreground">{t.faceFollowActive}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
