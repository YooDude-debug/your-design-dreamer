import { useCallback, useRef, useState } from "react";
import type { SlangTagPlacement } from "@/lib/types";
import { faceRelativeOffset, sampleFaceTrack } from "@/lib/video/face-track";
import { trackFaceInVideo } from "@/lib/video/face-tracking";

/**
 * Steuerung für den optionalen Modus "Gesicht folgen" (nur Videos).
 *
 * Ablauf: Modus wählen → Gesicht antippen → Tracking läuft im Browser →
 * die Tracking-Punkte werden an der Platzierung gespeichert. Das Video selbst
 * wird nie verändert. "Fixiert" entfernt nur das Zusatzfeld und stellt damit
 * exakt das bisherige Verhalten wieder her.
 */
export function useFaceFollow(
  videoSrc: string | null,
  placements: SlangTagPlacement[],
  onChange: (next: SlangTagPlacement[]) => void,
) {
  /** Platzierung, für die gerade ein Gesicht angetippt werden soll. */
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  const startPick = useCallback((id: string) => {
    setFailed(false);
    setPicking(id);
  }, []);

  const cancel = useCallback(() => setPicking(null), []);

  /** Zurück auf fixiert: Tracking-Daten verwerfen, Position bleibt stehen. */
  const setFixed = useCallback(
    (id: string) => {
      setPicking((p) => (p === id ? null : p));
      setFailed(false);
      onChange(placementsRef.current.map((p) => (p.id === id ? { ...p, follow: null } : p)));
    },
    [onChange],
  );

  /** Gesicht wurde angetippt (Anteile 0..1 des Videobildes). */
  const onPick = useCallback(
    async (x: number, y: number) => {
      const id = picking;
      if (!id || !videoSrc) return;
      setPicking(null);
      setBusy(id);
      setProgress(0);
      setFailed(false);
      try {
        const track = await trackFaceInVideo(videoSrc, {
          pick: { x, y },
          onProgress: setProgress,
        });
        if (!track) {
          setFailed(true);
          return;
        }
        const target = placementsRef.current.find((p) => p.id === id);
        if (!target) return;
        const face = sampleFaceTrack(track, 0);
        if (!face) {
          setFailed(true);
          return;
        }
        const off = faceRelativeOffset(target.x, target.y, face);
        onChange(
          placementsRef.current.map((p) =>
            p.id === id ? { ...p, follow: { mode: "face" as const, ...off, track } } : p,
          ),
        );
      } catch {
        setFailed(true);
      } finally {
        setBusy(null);
      }
    },
    [picking, videoSrc, onChange],
  );

  return { picking, startPick, cancel, setFixed, onPick, busy, progress, failed };
}
