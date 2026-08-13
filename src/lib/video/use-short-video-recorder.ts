import { useCallback, useEffect, useRef, useState } from "react";
import { SHORT_VIDEO_MAX_SECONDS } from "@/lib/video/short-video";

/**
 * Direkte Videoaufnahme fuer SlangShots.
 *
 * - Kamera MIT Mikrofon: der aufgenommene Ton wird anschliessend zur
 *   Grundlage des SlangTags (`extractShotAudio`). Das veroeffentlichte Video
 *   ist danach stumm (`prepareSilentShort`) – der Ton bleibt der SlangTag.
 * - stoppt automatisch nach 5 Sekunden.
 * - Hochformat wird bevorzugt angefragt (9:16), notfalls liefert das Gerät
 *   sein Standardformat.
 */

export function useShortVideoRecorder(onDenied?: () => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    timerRef.current = null;
    stopTimeoutRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  /** Startet die Aufnahme und liefert das fertige (stumme) Video zurueck. */
  const record = useCallback(
    async (preview?: HTMLVideoElement | null): Promise<{ blob: Blob; seconds: number } | null> => {
      if (typeof navigator === "undefined" || typeof MediaRecorder === "undefined") {
        onDenied?.();
        return null;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });
        streamRef.current = stream;
        if (preview) {
          preview.srcObject = stream;
          preview.muted = true;
          await preview.play().catch(() => undefined);
        }

        const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m),
        );
        const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorderRef.current = recorder;
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        const started = Date.now();
        setSeconds(0);
        setRecording(true);
        timerRef.current = setInterval(() => {
          setSeconds(Math.min(SHORT_VIDEO_MAX_SECONDS, (Date.now() - started) / 1000));
        }, 100);
        // Harte Grenze: nach 5 Sekunden endet die Aufnahme automatisch.
        stopTimeoutRef.current = setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, SHORT_VIDEO_MAX_SECONDS * 1000);

        const result = await new Promise<Blob | null>((resolve) => {
          recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: recorder.mimeType || "video/webm" }) : null);
          recorder.start(100);
        });

        const elapsed = Math.min(SHORT_VIDEO_MAX_SECONDS, (Date.now() - started) / 1000);
        if (preview) preview.srcObject = null;
        teardown();
        if (!result) return null;
        return { blob: result, seconds: Math.max(0.5, elapsed) };
      } catch {
        teardown();
        onDenied?.();
        return null;
      }
    },
    [onDenied, teardown],
  );

  return { record, stop, recording, seconds };
}
