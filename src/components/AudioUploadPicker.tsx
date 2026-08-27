import { CloseButton } from "@/components/ui/nav-buttons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Mic, Pause, Play, Scissors, Upload } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import { closeKeyboard, noKeyboardProps } from "@/lib/mobile-keyboard";

import {
  AUDIO_UPLOAD_ACCEPT,
  AudioProcessingError,
  SLANGTAG_MAX_SECONDS,
  SLANGTAG_MIN_SECONDS,
  convertToSlangTagAudio,
  decodeAudioFile,
  waveformPeaks,
  type ConvertedAudio,
} from "@/lib/audio-format";

export type AudioSourceMode = "record" | "upload";

/** Gut sichtbarer Umschalter zwischen Aufnahme und Datei-Upload. */
export function AudioSourceSwitch({
  mode,
  onChange,
  className = "",
}: {
  mode: AudioSourceMode;
  onChange: (mode: AudioSourceMode) => void;
  className?: string;
}) {
  const { t } = useLang();
  const options: { id: AudioSourceMode; label: string; icon: typeof Mic }[] = [
    { id: "record", label: t.audioSourceRecord, icon: Mic },
    { id: "upload", label: t.audioSourceUpload, icon: Upload },
  ];
  return (
    <div
      role="tablist"
      aria-label={t.audioSourceRecord}
      className={`flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-0.5 backdrop-blur-xl ${className}`}
    >
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          {...noKeyboardProps}
          onClick={() => onChange(id)}
          className={`inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
            mode === id
              ? "border border-brand/50 bg-brand/20 text-brand shadow-glow"
              : "border border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3 w-3" /> {label}
        </button>
      ))}
    </div>
  );
}

function errorMessage(err: unknown, t: ReturnType<typeof useLang>["t"]) {
  const reason = err instanceof AudioProcessingError ? err.reason : "decode-failed";
  if (reason === "too-large") return t.audioTooLarge;
  if (reason === "unsupported-format") return t.audioUnsupported;
  if (reason === "too-short") return t.audioTooShort;
  return t.audioDecodeFailed;
}

function fmt(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
}

/**
 * Audio-Editor: Wellenform, Wiedergabe/Pause, Zeitanzeige, zwei verschiebbare
 * Marker für Start und Ende sowie Live-Vorschau der Auswahl (1–5 Sekunden).
 * Erst mit „Übernehmen“ wird der Ausschnitt in das interne SlangTag-Format
 * konvertiert (Mono, 24 kHz, normalisiert, ohne Metadaten).
 */
function AudioTrimDialog({
  buffer,
  fileName,
  onCancel,
  onReady,
  maxSeconds = SLANGTAG_MAX_SECONDS,
}: {
  buffer: AudioBuffer;
  fileName: string;
  onCancel: () => void;
  onReady: (audio: ConvertedAudio) => void;
  maxSeconds?: number;
}) {
  const { t } = useLang();
  const peaks = useMemo(() => waveformPeaks(buffer, 480), [buffer]);
  const total = buffer.duration;
  const maxSpan = Math.min(maxSeconds, total);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(maxSpan, total));
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const beganRef = useRef(0);

  const stopPreview = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    try {
      srcRef.current?.stop();
    } catch {
      /* bereits gestoppt */
    }
    srcRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(
    () => () => {
      stopPreview();
      void ctxRef.current?.close();
    },
    [stopPreview],
  );

  const play = () => {
    stopPreview();
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = ctxRef.current ?? new Ctor();
    ctxRef.current = ctx;
    void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const span = Math.max(0.05, end - start);
    src.start(0, start, span);
    src.onended = () => stopPreview();
    srcRef.current = src;
    beganRef.current = ctx.currentTime;
    setPlaying(true);
    const tick = () => {
      const ctxNow = ctxRef.current;
      if (!ctxNow) return;
      setCursor(Math.min(end, start + (ctxNow.currentTime - beganRef.current)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const setStartClamped = (value: number) => {
    stopPreview();
    const next = Math.max(0, Math.min(value, total));
    setStart(next);
    setEnd((prev) => {
      const min = Math.min(total, next + Math.min(SLANGTAG_MIN_SECONDS, total - next));
      return Math.min(Math.max(prev, min), Math.min(total, next + maxSpan));
    });
    setCursor(next);
  };

  const setEndClamped = (value: number) => {
    stopPreview();
    const next = Math.min(total, Math.max(value, start + Math.min(0.2, total)));
    setEnd(next);
    setStart((prev) => Math.max(prev, next - maxSpan));
  };

  const span = end - start;
  const canApply = span >= Math.min(SLANGTAG_MIN_SECONDS, total) && span <= maxSeconds;

  const apply = async () => {
    setBusy(true);
    stopPreview();
    try {
      onReady(await convertToSlangTagAudio(buffer, start, end, maxSeconds));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-surface/95 p-4 shadow-glow backdrop-blur-xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground">
              <Scissors className="h-3.5 w-3.5 text-brand" /> {t.audioTrimTitle}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{fileName}</p>
          </div>
          <CloseButton onClick={onCancel} label={t.close} className="shrink-0" />
        </div>

        {/* Wellenform mit Auswahlbereich und Marker */}
        <div className="relative mt-3 h-24 w-full overflow-hidden rounded-xl border border-white/15 bg-black/40">
          <div className="absolute inset-0 flex items-center gap-px px-1">
            {peaks.map((p, i) => {
              const at = (i / peaks.length) * total;
              const inside = at >= start && at <= end;
              return (
                <span
                  key={i}
                  style={{ height: `${Math.max(4, p * 92)}%` }}
                  className={`flex-1 rounded-full ${inside ? "bg-brand" : "bg-white/20"}`}
                />
              );
            })}
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 border-x border-brand/70 bg-brand/10"
            style={{ left: `${(start / total) * 100}%`, width: `${(span / total) * 100}%` }}
          />
          {playing && (
            <div
              className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
              style={{ left: `${(cursor / total) * 100}%` }}
            />
          )}
        </div>

        {/* Zwei verschiebbare Marker */}
        <div className="mt-3 space-y-2">
          <label className="block text-[11px] font-semibold text-muted-foreground">
            {t.audioTrimStart}: {fmt(start)}
            <input
              type="range"
              min={0}
              max={Math.max(0, total - 0.2)}
              step={0.05}
              value={start}
              onChange={(e) => setStartClamped(Number(e.target.value))}
              className="mt-1 w-full accent-brand"
            />
          </label>
          <label className="block text-[11px] font-semibold text-muted-foreground">
            {t.audioTrimEnd}: {fmt(end)}
            <input
              type="range"
              min={0.2}
              max={total}
              step={0.05}
              value={end}
              onChange={(e) => setEndClamped(Number(e.target.value))}
              className="mt-1 w-full accent-brand"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (playing ? stopPreview() : play())}
            aria-label={playing ? t.pause : t.audioTrimPreview}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand/60 bg-black/40 px-3 py-1.5 text-xs font-semibold text-brand"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? t.pause : t.audioTrimPreview}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {t.audioTrimLength}: {span.toFixed(1)}s / {maxSeconds}s · {fmt(cursor)} / {fmt(total)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void apply()}
            disabled={!canApply || busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {busy ? t.audioConverting : t.audioTrimApply}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-muted-foreground"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Upload-Auswahl inkl. Editor. Nach der Dateiwahl wird die Datei niemals direkt
 * gespeichert – sie öffnet zuerst den Audio-Editor. Erst nach Bestätigung wird
 * der Ausschnitt konvertiert und per `onReady` an den bestehenden Workflow
 * (Storage-Upload, Speech-to-Text, Moderation) übergeben.
 */
export function AudioUploadPicker({
  onReady,
  className = "",
  compact = false,
  maxSeconds = SLANGTAG_MAX_SECONDS,
}: {
  onReady: (audio: ConvertedAudio) => void;
  className?: string;
  compact?: boolean;
  maxSeconds?: number;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ buffer: AudioBuffer; name: string } | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      setPending({ buffer: await decodeAudioFile(file), name: file.name });
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={AUDIO_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(e) => void pick(e.target.files?.[0])}
      />
      <button
        type="button"
        {...noKeyboardProps}
        onClick={() => {
          // Tastatur zuerst schliessen, damit der Dateidialog frei liegt.
          closeKeyboard();
          inputRef.current?.click();
        }}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand/60 px-3 py-1 text-xs font-semibold text-brand disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}{" "}
        {t.audioPickFile}
      </button>
      {!compact && <p className="mt-1 text-[10px] text-muted-foreground">{t.audioUploadHint}</p>}

      {pending && (
        <AudioTrimDialog
          buffer={pending.buffer}
          fileName={pending.name}
          maxSeconds={maxSeconds}
          onCancel={() => setPending(null)}
          onReady={(audio) => {
            setPending(null);
            onReady(audio);
            toast.success(t.audioConverted);
          }}
        />
      )}
    </div>
  );
}
