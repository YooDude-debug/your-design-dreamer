import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, SwitchCamera } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import {
  loadCameraFacing,
  otherFacing,
  saveCameraFacing,
  type CameraFacing,
} from "@/lib/video/camera-facing";

/**
 * Fotoaufnahme direkt im Composer-Medienbereich (kein separates Fenster).
 * Nutzt dieselbe gespeicherte Kameraeinstellung (Front/Rück) wie die
 * SlangShot-Aufnahme. Spiegelung betrifft nur die Vorschau der Frontkamera –
 * das gespeicherte Foto bleibt korrekt herum.
 */
export function PhotoCaptureOverlay({
  onClose,
  onCaptured,
  onDenied,
}: {
  onClose: () => void;
  onCaptured: (dataUrl: string) => void;
  onDenied?: () => void;
}) {
  const { t } = useLang();
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<CameraFacing>(() => loadCameraFacing());
  const [ready, setReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        onDenied?.();
        onClose();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        const el = previewRef.current;
        if (el) {
          el.srcObject = stream;
          el.muted = true;
          await el.play().catch(() => undefined);
        }
        if (cancelled) return; // Overlay wurde während des Starts geschlossen
        setReady(true);
      } catch {
        if (!cancelled) {
          onDenied?.();
          onClose();
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  const switchCamera = () => {
    const next = otherFacing(facing);
    saveCameraFacing(next);
    setFacing(next);
  };

  const shoot = () => {
    const el = previewRef.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.92);
    el.srcObject = null;
    stopStream();
    onCaptured(url);
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
          title={t.switchCamera}
          aria-label={t.switchCamera}
          className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full border border-border bg-black/70 text-foreground backdrop-blur-xl transition-colors hover:border-brand/60 hover:text-brand"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-black/80 px-3 py-2">
        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <Camera className="h-4 w-4 text-brand" /> {t.takePhoto}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={shoot}
            disabled={!ready}
            className="rounded-full bg-gradient-brand px-3 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-40"
          >
            {t.takePhoto}
          </button>
          <CloseButton
            onClick={() => {
              stopStream();
              onClose();
            }}
            label={t.close}
          />
        </div>
      </div>
    </div>
  );
}
