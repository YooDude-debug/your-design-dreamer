import { useEffect, useState } from "react";
import { Languages, Loader2, Volume2, VolumeX } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { languageName, type TranslationLang } from "@/lib/lang-detect";
import {
  speakTranslation,
  stopSpeaking,
  type TranslationState,
} from "@/lib/use-message-translation";

/**
 * Dezente Übersetzungszeile unterhalb einer empfangenen Nachricht.
 * Design und Layout der Blase bleiben unverändert – nur eine kleine
 * Fußzeile mit Status und Umschalter.
 */
export function MessageTranslationBar({
  state,
  target,
  showOriginal,
  onToggleOriginal,
  onTranslate,
  isVoice,
}: {
  state: TranslationState;
  target: TranslationLang;
  showOriginal: boolean;
  onToggleOriginal: () => void;
  onTranslate: () => void;
  isVoice: boolean;
}) {
  const { t, locale } = useLang();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopSpeaking(), []);

  const btn =
    "inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground";

  if (state.status === "loading") {
    return (
      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> {t.trTranslating}
      </p>
    );
  }

  if (state.status === "idle") {
    if (!isVoice) return null;
    return (
      <button type="button" onClick={onTranslate} className={`mt-1 ${btn}`}>
        <Languages className="h-3 w-3" /> {t.trTranslateVoice}
      </button>
    );
  }

  if (state.status === "error") {
    return (
      <button type="button" onClick={onTranslate} className={`mt-1 ${btn}`}>
        <Languages className="h-3 w-3" /> {t.trTranslationFailed}
      </button>
    );
  }

  // Guthaben/Kontingent des KI-Anbieters erschoepft: klarer Hinweis ohne
  // Wiederholungs-Schaltflaeche – ein erneuter Aufruf wuerde erneut scheitern.
  if (state.status === "quota") {
    return <p className="mt-1 text-[10px] text-muted-foreground">{t.trQuotaExhausted}</p>;
  }

  if (state.status === "empty") {
    return <p className="mt-1 text-[10px] text-muted-foreground">{t.trNoSpeech}</p>;
  }

  if (state.status === "same") {
    return null;
  }

  const source =
    state.sourceLanguage && state.sourceLanguage !== "unknown" ? state.sourceLanguage : null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <span className="text-[10px] text-muted-foreground">
        {source
          ? t.trTranslatedFrom.replace("{lang}", languageName(source, locale))
          : t.trShowTranslation}
      </span>
      <button type="button" onClick={onToggleOriginal} className={btn}>
        <Languages className="h-3 w-3" />
        {showOriginal ? t.trShowTranslation : t.trShowOriginal}
      </button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          if (speaking) {
            stopSpeaking();
            setSpeaking(false);
            return;
          }
          if (speakTranslation(state.text, target)) setSpeaking(true);
        }}
        aria-label={speaking ? t.trStopListening : t.trListenTranslation}
      >
        {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
        {speaking ? t.trStopListening : t.trListenTranslation}
      </button>
    </div>
  );
}
