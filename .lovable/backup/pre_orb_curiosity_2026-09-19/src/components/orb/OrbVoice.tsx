/**
 * Sprachein- und -ausgabe des ORB (nur nach ausdrücklicher Benutzeraktion).
 *
 * Das Mikrofon ist niemals dauerhaft aktiv: es wird beim Klick geöffnet und
 * beim Stoppen sofort wieder freigegeben. Die Aufnahme wird als vollständige
 * WAV-Datei erzeugt (jede Aufnahme ist damit für sich abspielbar).
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  /** Erkannten Text weitergeben (der ORB verarbeitet ihn wie eine Eingabe). */
  onTranscript: (text: string) => void;
  /** Aufnahme (WAV, base64) an die Spracherkennung senden. */
  transcribe: (audioBase64: string) => Promise<{ text: string; status: string }>;
  /** Letzte ORB-Antwort vorlesen. */
  speak: (text: string) => Promise<{ audioBase64: string; status: string }>;
  lastReply: string | null;
  busy?: boolean;
  /** Zuhören (Aufnahme läuft) – für die Avatar-Animation. */
  onListeningChange?: (listening: boolean) => void;
  /** Sprechen (Wiedergabe läuft) – für die Avatar-Animation. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Lautstärke der Wiedergabe 0–1 für die Lippenbewegung. */
  onSpeechLevel?: (level: number) => void;
};

/** PCM-Blöcke zu einer 16-Bit-Mono-WAV-Datei (16 kHz) zusammenfassen. */
function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const target = 16000;
  const ratio = Math.max(1, Math.round(sampleRate / target));
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const downsampled = new Float32Array(Math.floor(total / ratio));
  let write = 0;
  let index = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1, index += 1) {
      if (index % ratio === 0 && write < downsampled.length) {
        downsampled[write] = chunk[i] ?? 0;
        write += 1;
      }
    }
  }

  const buffer = new ArrayBuffer(44 + downsampled.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  const rate = Math.round(sampleRate / ratio);
  text(0, "RIFF");
  view.setUint32(4, 36 + downsampled.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, downsampled.length * 2, true);
  let offset = 44;
  for (const sample of downsampled) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function OrbVoice({
  onTranscript,
  transcribe,
  speak,
  lastReply,
  busy = false,
  onListeningChange,
  onSpeakingChange,
  onSpeechLevel,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmRef = useRef<Float32Array[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  /** Lautstärke der Wiedergabe messen (nur während des Vorlesens). */
  const trackLevel = () => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) {
        const d = (v - 128) / 128;
        sum += d * d;
      }
      const rms = Math.sqrt(sum / data.length);
      onSpeechLevel?.(Math.min(1, rms * 4.5));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stopLevel = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    onSpeechLevel?.(0);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      pcmRef.current = [];
      node.onaudioprocess = (e) => {
        pcmRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setRecording(true);
      onListeningChange?.(true);
    } catch {
      toast.error("Ohne Mikrofonzugriff kann der ORB nicht zuhören.");
    }
  };

  const stop = async () => {
    setRecording(false);
    onListeningChange?.(false);
    const ctx = ctxRef.current;
    // Mikrofon sofort wieder freigeben – kein dauerhaftes Mithören.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    const chunks = pcmRef.current;
    pcmRef.current = [];
    const rate = ctx?.sampleRate ?? 48000;
    await ctx?.close();
    ctxRef.current = null;
    streamRef.current = null;

    const blob = encodeWav(chunks, rate);
    if (blob.size < 4096) {
      toast.error("Die Aufnahme war zu kurz – bitte noch einmal sprechen.");
      return;
    }

    setWorking(true);
    try {
      const result = await transcribe(await toBase64(blob));
      if (result.status !== "ok" || !result.text) {
        toast.error("Es war keine verständliche Sprache zu hören.");
        return;
      }
      setHeard(result.text);
      onTranscript(result.text);
    } catch {
      toast.error("Die Spracherkennung ist gerade nicht erreichbar.");
    } finally {
      setWorking(false);
    }
  };

  const readAloud = async () => {
    if (!lastReply) return;
    setSpeaking(true);
    try {
      const result = await speak(lastReply.slice(0, 600));
      if (result.status !== "ok" || !result.audioBase64) {
        toast.error("Die Sprachausgabe ist gerade nicht verfügbar.");
        setSpeaking(false);
        return;
      }
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = `data:audio/mpeg;base64,${result.audioBase64}`;
      audio.onended = () => {
        setSpeaking(false);
        onSpeakingChange?.(false);
        stopLevel();
      };

      // Lautstärke nur für die Lippenbewegung auslesen (rein clientseitig).
      if (onSpeechLevel) {
        try {
          const ctx = playCtxRef.current ?? new AudioContext();
          playCtxRef.current = ctx;
          if (!analyserRef.current) {
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            const src = ctx.createMediaElementSource(audio);
            src.connect(analyser);
            analyser.connect(ctx.destination);
            analyserRef.current = analyser;
          }
          if (ctx.state === "suspended") await ctx.resume();
        } catch {
          /* Ohne Analyse bleibt der Mund ruhig. */
        }
      }

      onSpeakingChange?.(true);
      await audio.play();
      trackLevel();
    } catch {
      toast.error("Die Sprachausgabe konnte nicht gestartet werden.");
      setSpeaking(false);
      onSpeakingChange?.(false);
      stopLevel();
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      void playCtxRef.current?.close();
    };
  }, []);

  return (
    <section className="rounded-xl border border-border bg-background p-3">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Sprache
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => (recording ? void stop() : void start())}
          disabled={busy || working}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
        >
          {working ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : recording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          {recording ? "Aufnahme beenden" : "Mit ORB sprechen"}
        </button>

        <button
          onClick={() => void readAloud()}
          disabled={!lastReply || speaking}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-bold disabled:opacity-40"
        >
          {speaking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          Vorlesen
        </button>

        {recording && (
          <span className="text-[11px] font-semibold text-destructive">Mikrofon aktiv …</span>
        )}
      </div>

      {heard && (
        <p className="mt-2 rounded-lg border border-dashed border-border p-2 text-xs text-muted-foreground">
          Erkannter Text: <span className="text-foreground">{heard}</span>
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Das Mikrofon ist nur während der Aufnahme aktiv und wird danach sofort freigegeben.
      </p>
    </section>
  );
}
