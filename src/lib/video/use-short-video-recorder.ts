import { useCallback, useEffect, useRef, useState } from "react";
import { SHORT_VIDEO_MAX_SECONDS } from "@/lib/video/short-video";
import { VAD_POST_ROLL_MS, VAD_PRE_ROLL_MS, VoiceActivityDetector } from "@/lib/vad";

/**
 * Direkte Videoaufnahme fuer SlangShots.
 *
 * - Kamera MIT Mikrofon: der aufgenommene Ton wird anschliessend zur
 *   Grundlage des SlangTags (`extractShotAudio`). Das veroeffentlichte Video
 *   ist danach stumm (`prepareSilentShort`) – der Ton bleibt der SlangTag.
 * - Der Start der Aufnahme wird von derselben VAD gesteuert, die auch die
 *   normale SlangTag-Aufnahme benutzt (`src/lib/vad.ts`,
 *   `useAudioRecorder`): Kamera + Mikrofon laufen bereits, aufgenommen wird
 *   aber erst ab dem ersten zuverlässigen Speech-Event.
 * - Ende: VAD erkennt Sprachende (Stille + Post-Roll) oder harte Grenze von
 *   5 Sekunden ab Sprachbeginn. Es wird also nicht künstlich auf 5 Sekunden
 *   verlängert.
 * - Hochformat wird bevorzugt angefragt (9:16), notfalls liefert das Gerät
 *   sein Standardformat.
 */

/** Sicherheitsnetz: so lange wird maximal auf Sprache gewartet. */
const WAIT_LIMIT_SECONDS = 30;

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function useShortVideoRecorder(onDenied?: () => void) {
  const [recording, setRecording] = useState(false);
  /** true, solange Kamera/Mikrofon laufen und die VAD auf Sprache wartet. */
  const [waitingForSpeech, setWaitingForSpeech] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const cancelRef = useRef(false);
  /** Löst die Wartephase (VAD) sofort auf, z. B. bei Abbruch/Kamerawechsel. */
  const waitResolveRef = useRef<((v: null) => void) | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    timerRef.current = null;
    stopTimeoutRef.current = null;
    try {
      nodeRef.current?.disconnect();
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    nodeRef.current = null;
    sourceRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setWaitingForSpeech(false);
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    else {
      // Noch in der Wartephase: Vorgang abbrechen (Promise sicher auflösen).
      cancelRef.current = true;
      waitResolveRef.current?.(null);
      teardown();
    }
  }, [teardown]);

  /**
   * Startet die Aufnahme und liefert das fertige Video (mit Ton) zurueck.
   * `facing` waehlt Front- ("user") oder Rueckkamera ("environment").
   * Die Pixel werden NICHT gespiegelt – nur die Live-Vorschau darf gespiegelt
   * dargestellt werden, das gespeicherte Video bleibt korrekt herum.
   */
  const record = useCallback(
    async (
      preview?: HTMLVideoElement | null,
      facing: CameraFacing = "user",
    ): Promise<{ blob: Blob; seconds: number } | null> => {
      if (typeof navigator === "undefined" || typeof MediaRecorder === "undefined") {
        onDenied?.();
        return null;
      }
      cancelRef.current = false;
      try {
        const video = {
          facingMode: { ideal: facing },
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        } as MediaTrackConstraints;
        // Mikrofon aktiv: der Originalton wird spaeter zum SlangTag.
        const stream = await navigator.mediaDevices.getUserMedia({
          video,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        streamRef.current = stream;
        if (preview) {
          preview.srcObject = stream;
          preview.muted = true;
          await preview.play().catch(() => undefined);
        }

        // ---- Wartephase: bestehende SlangTag-VAD ueberwacht das Mikrofon ----
        const Ctor = audioContextCtor();
        const vad = await new Promise<VoiceActivityDetector | null>((resolve) => {
          if (!Ctor || stream.getAudioTracks().length === 0) return resolve(null);
          const ctx = new Ctor();
          void ctx.resume().catch(() => undefined);
          const source = ctx.createMediaStreamSource(stream);
          const node = ctx.createScriptProcessor(2048, 1, 1);
          const detector = new VoiceActivityDetector({
            sampleRate: ctx.sampleRate,
            preRollMs: VAD_PRE_ROLL_MS,
            postRollMs: VAD_POST_ROLL_MS,
          });
          ctxRef.current = ctx;
          sourceRef.current = source;
          nodeRef.current = node;
          let total = 0;
          const waitLimitSamples = Math.round(WAIT_LIMIT_SECONDS * ctx.sampleRate);
          let settled = false;
          const finish = (value: VoiceActivityDetector | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          node.onaudioprocess = (e) => {
            if (cancelRef.current) return finish(null);
            const input = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(input.length);
            copy.set(input);
            total += copy.length;
            detector.push(copy);
            if (detector.speechStartSample !== null) finish(detector);
            else if (total >= waitLimitSamples) finish(null);
          };
          source.connect(node);
          const silent = ctx.createGain();
          silent.gain.value = 0;
          node.connect(silent);
          silent.connect(ctx.destination);
          setWaitingForSpeech(true);
        });

        setWaitingForSpeech(false);
        if (cancelRef.current) {
          if (preview) preview.srcObject = null;
          teardown();
          return null;
        }
        if (!vad && stream.getAudioTracks().length > 0 && Ctor) {
          // Keine Sprache erkannt (Timeout oder Abbruch) – nichts aufnehmen.
          if (preview) preview.srcObject = null;
          teardown();
          return null;
        }

        // ---- Aufnahme ab erkanntem Sprachbeginn ----
        const mime = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ].find((m) => MediaRecorder.isTypeSupported(m));
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
          // Sprachende erkennt weiterhin die bestehende VAD.
          if (vad?.complete && recorder.state !== "inactive") recorder.stop();
        }, 100);
        // Harte Grenze: nach 5 Sekunden endet die Aufnahme automatisch.
        stopTimeoutRef.current = setTimeout(() => {
          if (recorder.state !== "inactive") recorder.stop();
        }, SHORT_VIDEO_MAX_SECONDS * 1000);

        const result = await new Promise<Blob | null>((resolve) => {
          recorder.onstop = () =>
            resolve(
              chunks.length ? new Blob(chunks, { type: recorder.mimeType || "video/webm" }) : null,
            );
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

  return { record, stop, recording, waitingForSpeech, seconds };
}
