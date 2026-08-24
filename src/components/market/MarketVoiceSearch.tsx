/**
 * Sprachsuche für Y-Dude Market.
 *
 * Nutzt exakt dieselbe Aufnahme-Pipeline wie SlangTags (useAudioRecorder) und
 * dieselbe Speech-to-Text-Serverfunktion wie der Messenger. Die Aufnahme wird
 * nicht gespeichert – nur der erkannte Text landet in der Suchleiste.
 */

import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Mic, Square } from "lucide-react";

import { useAudioRecorder } from "@/lib/use-audio-recorder";
import { transcribeChatRecording } from "@/lib/translate.functions";
import { marketTexts } from "@/lib/i18n-market";
import type { Lang } from "@/lib/i18n-dict";

export function MarketVoiceSearch({
  lang,
  onText,
}: {
  lang: Lang;
  onText: (text: string) => void;
}) {
  const m = marketTexts[lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handled = useRef<string | null>(null);

  const transcribe = useServerFn(transcribeChatRecording);
  const { audio, recording, seconds, start, stop, reset } = useAudioRecorder(
    () => setError(m.voiceSearchFailed),
    8,
  );

  useEffect(() => {
    if (!audio || handled.current === audio) return;
    handled.current = audio;
    setBusy(true);
    setError(null);
    void transcribe({ data: { audioDataUrl: audio } })
      .then((res) => {
        const text = (res?.text ?? "").trim();
        if (text) onText(text);
        else setError(m.voiceSearchFailed);
      })
      .catch(() => setError(m.voiceSearchFailed))
      .finally(() => {
        setBusy(false);
        reset();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (recording ? stop() : start())}
        disabled={busy}
        aria-label={m.voiceSearch}
        title={recording ? m.voiceSearchHint : m.voiceSearch}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${
          recording
            ? "border-brand bg-brand/15 text-brand"
            : "border-border text-muted-foreground hover:border-brand/60 hover:text-brand"
        } disabled:opacity-50`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-3.5 w-3.5" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {(recording || error) && (
        <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-full border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">
          {error ?? `${m.voiceSearchHint} ${seconds}s`}
        </span>
      )}
    </div>
  );
}
