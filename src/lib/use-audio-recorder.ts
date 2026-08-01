import { useCallback, useEffect, useRef, useState } from "react";

/** Maximale Länge einer SlangTag-Aufnahme in Sekunden. */
export const MAX_RECORD_SECONDS = 5;

/**
 * Einheitlicher Audio-Recorder für alle SlangTags in Y-Dude – öffentliche
 * SlangTags im Composer wie private Chat-SlangTags im Messenger nutzen
 * dieselbe Aufnahmelogik (1–5 Sekunden, WebM, Data-URL).
 */
export function useAudioRecorder(onDenied?: () => void) {
  const [audio, setAudio] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(
    () => () => {
      clearTimer();
      recorderRef.current?.stream?.getTracks().forEach((s) => s.stop());
    },
    [],
  );

  const stop = useCallback(() => {
    clearTimer();
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        const fr = new FileReader();
        fr.onload = () => setAudio(String(fr.result));
        fr.readAsDataURL(new Blob(chunks, { type: "audio/webm" }));
        stream.getTracks().forEach((s) => s.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_RECORD_SECONDS) stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      onDenied?.();
    }
  }, [onDenied, stop]);

  const reset = useCallback(() => {
    setAudio(null);
    setSeconds(0);
  }, []);

  /** Dauer im SlangTag-Format, z. B. `0:03`. */
  const duration = `0:0${Math.max(1, seconds)}`;

  return { audio, recording, seconds, duration, start, stop, reset };
}
