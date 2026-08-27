import { CloseButton } from "@/components/ui/nav-buttons";
import { useEffect, useRef, useState } from "react";
import { SwitchCamera, Video } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useShortVideoRecorder } from "@/lib/video/use-short-video-recorder";
import { SHORT_VIDEO_MAX_SECONDS } from "@/lib/video/short-video";
import {
  loadCameraFacing,
  otherFacing,
  saveCameraFacing,
  type CameraFacing,
} from "@/lib/video/camera-facing";

/**
 * Videoaufnahme in der bestehenden Kamera-Funktion.
 * Regeln bleiben unverändert: max. 5 Sekunden (automatischer Stopp), VAD
 * startet die Aufnahme erst bei Sprache, keine Tonspur im Beitrag – der Ton
 * eines Beitrags ist immer der SlangTag.
 *
 * Kamera: es startet immer die zuletzt verwendete Kamera (lokal gespeichert).
 * Der Wechsel Front/Rück ist jederzeit sichtbar und nur während der laufenden
 * Aufnahme deaktiviert, damit eine Aufnahme nie beschädigt wird.
 * Spiegelung: nur die Vorschau der Frontkamera wird gespiegelt dargestellt –
 * das gespeicherte Video bleibt unverändert korrekt herum.
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
  const { record, stop, recording, waitingForSpeech, seconds } = useShortVideoRecorder(onDenied);
  const startedRef = useRef(false);
  const [facing, setFacing] = useState<CameraFacing>(() => loadCameraFacing());
  const facingRef = useRef(facing);
  facingRef.current = facing;
  /** true = laufender Vorgang wurde nur für den Kamerawechsel beendet. */
  const switchingRef = useRef(false);

  const begin = async (f: CameraFacing) => {
    if (startedRef.current) return;
    startedRef.current = true;
    const result = await record(previewRef.current, f);
    startedRef.current = false;
    if (result) {
      onCaptured(result);
      return;
    }
    if (switchingRef.current) {
      switchingRef.current = false;
      void begin(facingRef.current);
      return;
    }
    onClose();
  };

  // Aufnahme startet direkt beim Öffnen – ein Schritt weniger für den Nutzer.
  useEffect(() => {
    void begin(facingRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Kamera wechseln: nur außerhalb der laufenden Aufnahme. */
  const switchCamera = () => {
    if (recording) return;
    const next = otherFacing(facingRef.current);
    facingRef.current = next;
    setFacing(next);
    saveCameraFacing(next);
    switchingRef.current = true;
    stop();
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col overflow-hidden rounded-xl border border-brand/50 bg-black">
      <div className="relative min-h-0 flex-1">
        <video
          ref={previewRef}
          muted
          playsInline
          style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
          className="h-full w-full object-cover"
        />
        <button
          type="button"
          onClick={switchCamera}
          disabled={recording}
          title={t.switchCamera}
          aria-label={t.switchCamera}
          className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border border-border bg-black/70 text-foreground backdrop-blur-xl transition-colors hover:border-brand/60 hover:text-brand disabled:opacity-40"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-black/80 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Video className="h-4 w-4 text-brand" />
          {waitingForSpeech ? (
            <>🎙️ {t.waitingForSpeech}</>
          ) : (
            <>
              {recording ? t.recordingVideo : t.videoBusy}{" "}
              {Math.min(SHORT_VIDEO_MAX_SECONDS, seconds).toFixed(1)}s / {SHORT_VIDEO_MAX_SECONDS}s
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stop()}
            disabled={!recording && !waitingForSpeech}
            className="rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t.recordStop}
          </button>
          <CloseButton onClick={() => {
              switchingRef.current = false;
              stop();
              onClose();
            }} label={t.close} />
        </div>
      </div>
    </div>
  );
}
