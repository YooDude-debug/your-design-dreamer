import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useLang } from "@/lib/lang-context";
import { certainlySameLanguage, isTranslationLang, type TranslationLang } from "@/lib/lang-detect";
import { translatePostsBatch } from "@/lib/translate.functions";
import { enforceProtectedTokens } from "@/lib/translation-tokens";

type State = {
  status: "idle" | "loading" | "ready" | "same" | "error" | "quota";
  title: string;
  description: string;
  sourceLanguage: string | null;
};

type ServerResult = {
  status: "ready" | "same_language" | "unavailable" | "empty" | "quota";
  sourceLanguage: string | null;
  title: string;
  description: string;
};

type BatchRunner = (args: {
  data: { postIds: string[]; targetLang: TranslationLang };
}) => Promise<Record<string, ServerResult>>;

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

/**
 * Sammelfenster: alle Übersetzungswünsche eines Feed-Ladevorgangs werden je
 * Zielsprache gebündelt und in einem einzigen Serveraufruf beantwortet.
 * Die Berechtigungsprüfung bleibt serverseitig pro Beitrag bestehen.
 */
const BATCH_WINDOW_MS = 120;
const BATCH_MAX = 20;

type Pending = {
  ids: string[];
  resolve: Map<string, (r: ServerResult) => void>;
  reject: Map<string, (e: unknown) => void>;
  timer: ReturnType<typeof setTimeout> | null;
};

const pendingByLang = new Map<TranslationLang, Pending>();

function flushBatch(lang: TranslationLang, run: BatchRunner) {
  const pending = pendingByLang.get(lang);
  if (!pending) return;
  pendingByLang.delete(lang);
  if (pending.timer) clearTimeout(pending.timer);
  const ids = pending.ids.slice(0, BATCH_MAX);
  const rest = pending.ids.slice(BATCH_MAX);

  void run({ data: { postIds: ids, targetLang: lang } })
    .then((map) => {
      for (const id of ids) {
        const res = map[id];
        const resolve = pending.resolve.get(id);
        if (!resolve) continue;
        resolve(res ?? { status: "unavailable", sourceLanguage: null, title: "", description: "" });
      }
    })
    .catch((err) => {
      for (const id of ids) pending.reject.get(id)?.(err);
    })
    .finally(() => {
      // Überzählige IDs (> Batch-Limit) laufen im nächsten Fenster mit.
      for (const id of rest) {
        const resolve = pending.resolve.get(id);
        const reject = pending.reject.get(id);
        if (!resolve || !reject) continue;
        void enqueueTranslation(id, lang, run).then(resolve, reject);
      }
    });
}

function enqueueTranslation(
  postId: string,
  lang: TranslationLang,
  run: BatchRunner,
): Promise<ServerResult> {
  let pending = pendingByLang.get(lang);
  if (!pending) {
    pending = { ids: [], resolve: new Map(), reject: new Map(), timer: null };
    pendingByLang.set(lang, pending);
  }
  const entry = pending;
  return new Promise<ServerResult>((resolve, reject) => {
    if (!entry.resolve.has(postId)) entry.ids.push(postId);
    entry.resolve.set(postId, resolve);
    entry.reject.set(postId, reject);
    if (!entry.timer) {
      entry.timer = setTimeout(() => flushBatch(lang, run), BATCH_WINDOW_MS);
    }
  });
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
  /** true, wenn ein Umschalter sinnvoll ist (auch für eigene Beiträge). */
  canToggle: boolean;
  /** Beschriftung des Umschalters in der Sprache des Nutzers. */
  toggleLabel: string;
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
  /** true, wenn der Beitrag vom angemeldeten Nutzer stammt. */
  own?: boolean;
}): PostTranslation {
  const { lang, t } = useLang();
  const target: TranslationLang | null = isTranslationLang(lang) ? lang : null;
  const run = useServerFn(translatePostsBatch) as unknown as BatchRunner;

  const original = `${post.title}\n${post.description}`.trim();
  const skip = !target || !original || (target ? certainlySameLanguage(original, target) : true);

  const own = Boolean(post.own);
  const cached = target ? sessionCache.get(key(post.id, target)) : undefined;
  const [state, setState] = useState<State>(cached ?? IDLE);
  const [visible, setVisible] = useState(false);
  // Eigene Beiträge bleiben grundsätzlich in der Originalsprache: der Ersteller
  // sieht seinen Text unverändert und kann ihn bei Bedarf übersetzen lassen.
  const [wanted, setWanted] = useState(!own);
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
    if (skip || !target || !visible || !wanted) return;
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
      enqueueTranslation(post.id, target, run)
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
  }, [skip, target, visible, wanted, post.id, run]);

  const hasTranslation = state.status === "ready" && Boolean(state.title || state.description);
  const translated = hasTranslation && !showOriginal;

  return {
    // Fallback-Regel: niemals ein leerer Beitrag – immer Original, wenn die
    // Übersetzung fehlt oder ein Feld leer bleibt.
    // Sicherheitsnetz: Hashtags, SlangTags, @Mentions und URLs bleiben
    // garantiert im Original – auch wenn die KI sie veraendert haette.
    title: translated ? enforceProtectedTokens(post.title, state.title) || post.title : post.title,
    description: translated
      ? enforceProtectedTokens(post.description, state.description) || post.description
      : post.description,
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
    showOriginal,
    toggle: () => {
      if (own && !wanted) {
        setWanted(true);
        setShowOriginal(false);
        return;
      }
      setShowOriginal((v) => !v);
    },
    sourceLanguage: state.sourceLanguage,
    ref,
  };
}
