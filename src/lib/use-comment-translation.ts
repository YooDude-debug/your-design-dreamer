import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useLang } from "@/lib/lang-context";
import { certainlySameLanguage, isTranslationLang, type TranslationLang } from "@/lib/lang-detect";
import { translateComment } from "@/lib/translate.functions";

type State = {
  status: "idle" | "loading" | "ready" | "same" | "error" | "quota";
  body: string;
  sourceLanguage: string | null;
};

const IDLE: State = { status: "idle", body: "", sourceLanguage: null };

/** Sitzungs-Cache je Kommentar + Zielsprache (dauerhaft: `comment_translations`). */
const sessionCache = new Map<string, State>();
const inflight = new Map<string, Promise<State>>();

export type CommentTranslation = {
  /** Anzuzeigender Text (Übersetzung, sonst immer das Original). */
  body: string;
  /** true, wenn gerade die Übersetzung gezeigt wird. */
  translated: boolean;
  /** true, wenn ein Umschalter sinnvoll ist. */
  canToggle: boolean;
  /** Beschriftung des Umschalters in der Sprache des Nutzers. */
  toggleLabel: string;
  toggle: () => void;
};

/**
 * Übersetzung eines Kommentars in die Sprache des Nutzers.
 *
 * - Eigene Kommentare bleiben immer im Original (auf Wunsch übersetzbar).
 * - Das Original ist immer der Fallback: ohne Übersetzung wird es unverändert
 *   angezeigt.
 * - Ist der Text erkennbar bereits in der Zielsprache, entsteht kein KI-Aufruf.
 */
export function useCommentTranslation(comment: {
  id: string;
  body: string;
  /** true, wenn der Kommentar vom angemeldeten Nutzer stammt. */
  own?: boolean;
}): CommentTranslation {
  const { lang, t } = useLang();
  const target: TranslationLang | null = isTranslationLang(lang) ? lang : null;
  const run = useServerFn(translateComment);

  const original = comment.body.trim();
  const skip = !target || !original || certainlySameLanguage(original, target);
  const own = Boolean(comment.own);

  const k = target ? `${comment.id}:${target}` : "";
  const [state, setState] = useState<State>(() => (k ? (sessionCache.get(k) ?? IDLE) : IDLE));
  // Eigene Kommentare werden nur auf ausdrücklichen Wunsch übersetzt.
  const [wanted, setWanted] = useState(!own);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    if (skip || !target || !wanted) return;
    const hit = sessionCache.get(k);
    if (hit) {
      setState(hit);
      return;
    }
    let cancelled = false;
    setState((prev) => (prev.status === "idle" ? { ...prev, status: "loading" } : prev));

    const pending =
      inflight.get(k) ??
      run({ data: { commentId: comment.id, targetLang: target } })
        .then((res): State => {
          const next: State =
            res.status === "ready"
              ? { status: "ready", body: res.body, sourceLanguage: res.sourceLanguage }
              : res.status === "same_language"
                ? { ...IDLE, status: "same", sourceLanguage: res.sourceLanguage }
                : res.status === "quota"
                  ? { ...IDLE, status: "quota" }
                  : { ...IDLE, status: "error" };
          if (next.status !== "error" && next.status !== "quota") sessionCache.set(k, next);
          return next;
        })
        .catch((): State => ({ ...IDLE, status: "error" }))
        .finally(() => inflight.delete(k));
    inflight.set(k, pending);

    void pending.then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [skip, target, wanted, k, comment.id, run]);

  const hasTranslation = state.status === "ready" && Boolean(state.body);
  const translated = hasTranslation && !showOriginal;

  return {
    body: translated ? state.body : comment.body,
    translated,
    canToggle: !skip && (hasTranslation || (own && !wanted)),
    toggleLabel:
      state.status === "loading"
        ? t.trTranslating
        : translated
          ? t.trShowOriginal
          : hasTranslation
            ? t.trShowTranslation
            : t.trTranslate,
    toggle: () => {
      if (own && !wanted) {
        setWanted(true);
        setShowOriginal(false);
        return;
      }
      setShowOriginal((v) => !v);
    },
  };
}
