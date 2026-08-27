import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useLang } from "@/lib/lang-context";
import { certainlySameLanguage, isTranslationLang, type TranslationLang } from "@/lib/lang-detect";
import { translatePost } from "@/lib/translate.functions";

type State = {
  status: "idle" | "loading" | "ready" | "same" | "error" | "quota";
  title: string;
  description: string;
  sourceLanguage: string | null;
};

const IDLE: State = { status: "idle", title: "", description: "", sourceLanguage: null };

/**
 * Sitzungs-Cache: verhindert doppelte Anfragen, wenn derselbe Beitrag im Feed,
 * in der Detailansicht oder nach dem Zurückscrollen erneut gerendert wird.
 * Der dauerhafte Cache liegt in der Datenbank (`post_translations`).
 */
const sessionCache = new Map<string, State>();
const inflight = new Map<string, Promise<State>>();

function key(postId: string, lang: TranslationLang) {
  return `${postId}:${lang}`;
}

export type PostTranslation = {
  /** Anzuzeigender Titel (Übersetzung, sonst Original). */
  title: string;
  /** Anzuzeigende Beschreibung (Übersetzung, sonst Original). */
  description: string;
  /** true, wenn gerade eine Übersetzung statt des Originals gezeigt wird. */
  translated: boolean;
  /** Umschalten zwischen Übersetzung und Original. */
  toggle: () => void;
  /** true, wenn der Nutzer das Original sehen möchte. */
  showOriginal: boolean;
  /** Erkannte Ausgangssprache (falls bekannt). */
  sourceLanguage: string | null;
  /** An das Textelement hängen: übersetzt wird erst bei Sichtbarkeit. */
  ref: (node: HTMLElement | null) => void;
};

/**
 * Automatische Übersetzung eines Beitrags in die Sprache des Nutzers.
 *
 * - Der Originaltext bleibt immer der Fallback: solange keine Übersetzung
 *   vorliegt (oder sie fehlschlägt), wird unverändert das Original gezeigt.
 * - Übersetzt wird erst, wenn der Beitrag tatsächlich sichtbar ist.
 * - Ist der Text erkennbar bereits in der Zielsprache, entsteht kein KI-Aufruf.
 * - SlangTags, Hashtags und Mentions bleiben unverändert (serverseitige Regel).
 */
export function usePostTranslation(post: {
  id: string;
  title: string;
  description: string;
}): PostTranslation {
  const { lang } = useLang();
  const target: TranslationLang | null = isTranslationLang(lang) ? lang : null;
  const run = useServerFn(translatePost);

  const original = `${post.title}\n${post.description}`.trim();
  const skip = !target || !original || (target ? certainlySameLanguage(original, target) : true);

  const cached = target ? sessionCache.get(key(post.id, target)) : undefined;
  const [state, setState] = useState<State>(cached ?? IDLE);
  const [visible, setVisible] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const nodeRef = useRef<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
    if (!node || typeof IntersectionObserver === "undefined") {
      if (node) setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(node);
  }, []);

  useEffect(() => {
    if (skip || !target || !visible) return;
    const k = key(post.id, target);
    const hit = sessionCache.get(k);
    if (hit) {
      setState(hit);
      return;
    }
    let cancelled = false;
    setState((prev) => (prev.status === "idle" ? { ...prev, status: "loading" } : prev));

    const pending =
      inflight.get(k) ??
      run({ data: { postId: post.id, targetLang: target } })
        .then((res): State => {
          const next: State =
            res.status === "ready"
              ? {
                  status: "ready",
                  title: res.title,
                  description: res.description,
                  sourceLanguage: res.sourceLanguage,
                }
              : res.status === "same_language"
                ? { ...IDLE, status: "same", sourceLanguage: res.sourceLanguage }
                : res.status === "quota"
                  ? { ...IDLE, status: "quota" }
                  : { ...IDLE, status: "error" };
          // Nur verwertbare Ergebnisse dauerhaft merken – Fehler dürfen
          // später erneut versucht werden.
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
  }, [skip, target, visible, post.id, run]);

  const hasTranslation = state.status === "ready" && Boolean(state.title || state.description);
  const translated = hasTranslation && !showOriginal;

  return {
    // Fallback-Regel: niemals ein leerer Beitrag – immer Original, wenn die
    // Übersetzung fehlt oder ein Feld leer bleibt.
    title: translated ? state.title || post.title : post.title,
    description: translated ? state.description || post.description : post.description,
    translated,
    showOriginal,
    toggle: () => setShowOriginal((v) => !v),
    sourceLanguage: state.sourceLanguage,
    ref,
  };
}
