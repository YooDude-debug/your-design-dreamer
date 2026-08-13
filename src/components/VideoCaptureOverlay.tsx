import { useEffect, useRef } from "react";
import { Video, X } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useShortVideoRecorder } from "@/lib/video/use-short-video-recorder";
import { SHORT_VIDEO_MAX_SECONDS } from "@/lib/video/short-video";

/**
 * Videoaufnahme in der bestehenden Kamera-Funktion.
 * Regeln bleiben unverändert: max. 5 Sekunden (automatischer Stopp),
 * keine Tonspur – der Ton eines Beitrags ist immer der SlangTag.
 */
export function VideoCaptureOverlay({
  onClose,
  onCaptured,
  onDenied,
}: {
  onClose: () => void;
  onCaptured: (result: { blob: Blob; seconds: number }) => void;
  onDenied?: () => void;
}) {
  const { t } = useLang();
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const { record, stop, recording, seconds } = useShortVideoRecorder(onDenied);
  const startedRef = useRef(false);

  const begin = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const result = await record(previewRef.current);
    if (result) onCaptured(result);
    else onClose();
  };

  // Aufnahme startet direkt beim Öffnen – ein Schritt weniger für den Nutzer.
  useEffect(() => {
    void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-xl border border-brand/50 bg-black">
      <video ref={previewRef} muted playsInline className="min-h-0 w-full flex-1 object-cover" />
      <div className="flex items-center justify-between gap-2 border-t border-border bg-black/80 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Video className="h-4 w-4 text-brand" />
          {recording ? t.recordingVideo : t.videoBusy}{" "}
          {Math.min(SHORT_VIDEO_MAX_SECONDS, seconds).toFixed(1)}s / {SHORT_VIDEO_MAX_SECONDS}s
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stop()}
            disabled={!recording}
            className="rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t.recordStop}
          </button>
          <button
            type="button"
            aria-label={t.close}
            onClick={() => {
              stop();
              onClose();
            }}
            className="rounded-full border border-border p-1 text-muted-foreground hover:text-brand"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
