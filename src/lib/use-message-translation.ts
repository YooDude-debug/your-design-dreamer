import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useLang } from "@/lib/lang-context";
import { certainlySameLanguage, isTranslationLang, type TranslationLang } from "@/lib/lang-detect";
import { translateChatMessage } from "@/lib/translate.functions";
import { enforceProtectedTokens } from "@/lib/translation-tokens";
import type { ChatMessage } from "@/lib/social";

export type TranslationState = {
  status: "idle" | "loading" | "ready" | "same" | "empty" | "error" | "quota";
  sourceLanguage: string | null;
  transcript: string | null;
  text: string;
};

const IDLE: TranslationState = { status: "idle", sourceLanguage: null, transcript: null, text: "" };

/**
 * Prozessweiter Cache: verhindert doppelte Anfragen, wenn eine Nachricht
 * mehrfach gerendert oder der Chat neu geoeffnet wird. Der dauerhafte Cache
 * liegt in der Datenbank, dieser hier nur fuer die laufende Sitzung.
 */
const sessionCache = new Map<string, TranslationState>();
const inflight = new Map<string, Promise<TranslationState>>();

function cacheKey(messageId: string, lang: TranslationLang) {
  return `${messageId}:${lang}`;
}

/**
 * Sichtbarkeit einer Nachricht im Chat-Scroller.
 *
 * Übersetzt wird ausschließlich, was tatsächlich im sichtbaren Bereich
 * erscheint. Einmal gesehen bleibt gesehen – so entsteht beim Hin- und
 * Herscrollen keine erneute Anfrage und keine Request-Lawine.
 */
export function useSeenInViewport(enabled: boolean): {
  ref: (node: HTMLElement | null) => void;
  seen: boolean;
} {
  const [seen, setSeen] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (!enabled || seen) return;
    const node = nodeRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setSeen(true);
      },
      { rootMargin: "0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [enabled, seen]);

  return { ref, seen };
}

export function isVoiceMessage(msg: ChatMessage): boolean {
  return msg.kind === "audio" || msg.kind === "chat_slangtag";
}

/**
 * Uebersetzung einer empfangenen Nachricht in die Sprache des Nutzers.
 *
 * - Textnachrichten werden automatisch uebersetzt (ausser die Sprache stimmt
 *   erkennbar schon ueberein – dann faellt kein KI-Aufruf an).
 * - Sprachnachrichten werden erst auf Wunsch transkribiert und uebersetzt.
 *
 * `opts.target` überschreibt die Zielsprache (Chat-Einstellung „Meine Sprache").
 * `opts.assumedSource` ist eine manuell gewählte Sprache des Chatpartners: ist
 * sie gleich der Zielsprache, entfällt jeder KI-Aufruf.
 */
export function useMessageTranslation(
  msg: ChatMessage,
  active: boolean,
  opts?: { target?: TranslationLang; assumedSource?: TranslationLang | "auto" },
) {
  const { lang } = useLang();
  const fallback: TranslationLang = isTranslationLang(lang) ? lang : "de";
  const target: TranslationLang = opts?.target ?? fallback;
  const sameByChoice = opts?.assumedSource !== undefined && opts.assumedSource === target;
  const key = cacheKey(msg.id, target);

  const [state, setState] = useState<TranslationState>(() => sessionCache.get(key) ?? IDLE);
  const [showOriginal, setShowOriginal] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    setState(sessionCache.get(key) ?? IDLE);
    setShowOriginal(false);
  }, [key]);

  const call = useServerFn(translateChatMessage);

  const request = useCallback(async () => {
    const cached = sessionCache.get(key);
    if (cached && cached.status !== "error") {
      setState(cached);
      return cached;
    }
    setState((prev) => ({ ...prev, status: "loading" }));
    let pending = inflight.get(key);
    if (!pending) {
      pending = call({ data: { messageId: msg.id, targetLang: target } })
        .then((res): TranslationState => {
          const mapped: TranslationState = {
            status:
              res.status === "ready"
                ? "ready"
                : res.status === "same_language"
                  ? "same"
                  : res.status === "empty"
                    ? "empty"
                    : res.status === "quota"
                      ? "quota"
                      : "error",
            sourceLanguage: res.sourceLanguage ?? null,
            transcript: res.transcript ?? null,
            text: res.text ?? "",
          };
          if (mapped.status !== "error") sessionCache.set(key, mapped);
          return mapped;
        })
        .catch((): TranslationState => ({ ...IDLE, status: "error" }))
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    const done = await pending;
    if (mounted.current) setState(done);
    return done;
  }, [call, key, msg.id, target]);

  /**
   * Automatik: Text sofort, Sprachnachrichten ebenfalls (Transkript und
   * Uebersetzung werden dauerhaft zwischengespeichert, also einmalig je
   * Nachricht und Zielsprache).
   */
  const body = (msg.body ?? "").trim();
  const voice = isVoiceMessage(msg);
  const autoEligible =
    active &&
    !sameByChoice &&
    (voice
      ? Boolean(msg.media || msg.chatSlangTagId)
      : body.length > 1 && !certainlySameLanguage(body, target));

  useEffect(() => {
    if (!autoEligible) return;
    if (state.status !== "idle") return;
    void request();
  }, [autoEligible, request, state.status]);

  const effective: TranslationState = sameByChoice ? { ...IDLE, status: "same" } : state;
  const translation =
    effective.status === "ready" ? enforceProtectedTokens(body, effective.text) : "";
  const displayText = translation && !showOriginal ? translation : body;

  return {
    target,
    state: effective,
    translation,
    displayText,
    showOriginal,
    toggleOriginal: () => setShowOriginal((v) => !v),
    translate: sameByChoice ? async () => effective : request,
    hasTranslation: Boolean(translation),
  };
}

const TTS_LOCALE: Record<TranslationLang, string> = { de: "de-DE", en: "en-US", el: "el-GR" };

/** Spricht die Uebersetzung ueber die Sprachausgabe des Geraets aus. */
export function speakTranslation(text: string, lang: TranslationLang): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const value = text.trim();
  if (!value) return false;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(value);
  utter.lang = TTS_LOCALE[lang];
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
