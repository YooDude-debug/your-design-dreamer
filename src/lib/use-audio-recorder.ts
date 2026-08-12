import { useCallback, useEffect, useRef, useState } from "react";
import {
  convertToSlangTagAudio,
  SLANGTAG_MAX_SECONDS,
  slangTagDurationLabel,
} from "@/lib/audio-format";
import { VAD_POST_ROLL_MS, VAD_PRE_ROLL_MS, VoiceActivityDetector } from "@/lib/vad";

/** Maximale Länge einer SlangTag-Aufnahme in Sekunden. */
export const MAX_RECORD_SECONDS = SLANGTAG_MAX_SECONDS;

type AudioCtor = typeof AudioContext;

function audioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/**
 * Einheitlicher Audio-Recorder für alle SlangTags in Y-Dude – öffentliche
 * SlangTags im Composer wie private Chat-SlangTags im Messenger nutzen
 * dieselbe Aufnahmelogik.
 *
 * Pipeline: Aufnahme startet sofort → Web-Audio-Puffer → lokale VAD
 * (src/lib/vad.ts) → Sprachbeginn erkannt → 250 ms Pre-Roll bleiben erhalten
 * → Sprache → ~400 ms Post-Roll → fertiges Audio im internen SlangTag-Format
 * (Mono, 24 kHz, 16-Bit-WAV, normalisiert).
 *
 * Es kommt kein Timeout-Trick zum Einsatz: Start und Ende der Sprache werden
 * anhand der tatsächlichen Samples erkannt. Die VAD läuft ausschließlich
 * lokal im Browser.
 */
export function useAudioRecorder(onDenied?: () => void, maxSeconds: number = MAX_RECORD_SECONDS) {
  const [audio, setAudio] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [resultSeconds, setResultSeconds] = useState(0);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const lengthRef = useRef(0);
  const vadRef = useRef<VoiceActivityDetector | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const teardown = useCallback(() => {
    clearTimer();
    try {
      nodeRef.current?.disconnect();
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  /** Beendet die Aufnahme, schneidet anhand der VAD zu und kodiert das Audio. */
  const finalize = useCallback(
    async (sampleRate: number) => {
      const total = lengthRef.current;
      const vad = vadRef.current;
      const merged = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunksRef.current) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      chunksRef.current = [];
      lengthRef.current = 0;
      teardown();
      setRecording(false);

      if (!vad || total === 0) return;
      const { startSample, endSample } = vad.result(total);
      const from = Math.max(0, Math.min(startSample, total - 1));
      const to = Math.max(from + 1, Math.min(endSample, total));
      const trimmed = merged.subarray(from, to);
      if (trimmed.length < sampleRate * 0.2) return;

      const Ctor = audioContextCtor();
      if (!Ctor) return;
      const ctx = new Ctor();
      try {
        const buffer = ctx.createBuffer(1, trimmed.length, sampleRate);
        buffer.getChannelData(0).set(trimmed);
        const converted = await convertToSlangTagAudio(buffer, 0, buffer.duration, maxSeconds);
        setAudio(converted.dataUrl);
        setResultSeconds(converted.seconds);
      } catch {
        /* Aufnahme unbrauchbar – bestehende UI zeigt weiterhin "erneut aufnehmen" */
      } finally {
        void ctx.close();
      }
    },
    [maxSeconds, teardown],
  );

  const stop = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const rate = ctxRef.current?.sampleRate ?? 48000;
    clearTimer();
    void finalize(rate).finally(() => {
      stoppingRef.current = false;
    });
  }, [finalize]);

  const start = useCallback(async () => {
    const Ctor = audioContextCtor();
    if (!Ctor) return onDenied?.();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const ctx = new Ctor();
      if (ctx.state === "suspended") await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(2048, 1, 1);
      const vad = new VoiceActivityDetector({
        sampleRate: ctx.sampleRate,
        preRollMs: VAD_PRE_ROLL_MS,
        postRollMs: VAD_POST_ROLL_MS,
      });

      chunksRef.current = [];
      lengthRef.current = 0;
      vadRef.current = vad;
      ctxRef.current = ctx;
      streamRef.current = stream;
      sourceRef.current = source;
      nodeRef.current = node;

      // Der maximale Aufnahmefenster-Zähler startet NICHT beim Klick, sondern
      // erst beim ersten zuverlässigen VAD-Speech-Event. Bis dahin wird das
      // Mikrofon lediglich überwacht (Wartephase darf länger als maxSeconds
      // dauern, begrenzt durch WAIT_LIMIT_SECONDS als Sicherheitsnetz).
      const WAIT_LIMIT_SECONDS = 30;
      const waitLimitSamples = Math.round(WAIT_LIMIT_SECONDS * ctx.sampleRate);
      // Nach Sprachbeginn: volle maxSeconds + Post-Roll-Reserve.
      const speechWindowSamples = Math.round(
        (maxSeconds + VAD_POST_ROLL_MS / 1000 + 0.2) * ctx.sampleRate,
      );
      let speechStartSample: number | null = null;

      node.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        chunksRef.current.push(copy);
        lengthRef.current += copy.length;
        vad.push(copy);

        if (speechStartSample === null && vad.speechStartSample !== null) {
          // Timer startet genau einmal – weitere VAD-Events setzen ihn nicht zurück.
          speechStartSample = vad.speechStartSample;
          startCountdown();
        }

        // VAD-basiertes Ende: Sprache erkannt und Stille + Post-Roll erreicht.
        if (vad.complete) return stop();
        if (speechStartSample !== null) {
          if (lengthRef.current - speechStartSample >= speechWindowSamples) stop();
        } else if (lengthRef.current >= waitLimitSamples) {
          // Keine Sprache in der Wartephase – Mikrofon nicht endlos offen halten.
          stop();
        }
      };

      source.connect(node);
      // Stiller Abschluss der Kette – ScriptProcessor braucht ein Ziel,
      // darf aber nichts hörbar ausgeben.
      const silent = ctx.createGain();
      silent.gain.value = 0;
      node.connect(silent);
      silent.connect(ctx.destination);

      setAudio(null);
      setResultSeconds(0);
      setRecording(true);
      setSeconds(0);
    } catch {
      teardown();
      onDenied?.();
    }
  }, [maxSeconds, onDenied, stop, teardown]);

  const reset = useCallback(() => {
    setAudio(null);
    setSeconds(0);
    setResultSeconds(0);
  }, []);

  /** Dauer im SlangTag-Format, z. B. `0:03`. */
  const duration = slangTagDurationLabel(resultSeconds || seconds || 1, maxSeconds);

  return { audio, recording, seconds, duration, start, stop, reset };
}
