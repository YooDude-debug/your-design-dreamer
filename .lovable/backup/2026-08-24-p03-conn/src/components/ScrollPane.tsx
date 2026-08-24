import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";

/**
 * Scrollbarer Container mit fester Hoehe.
 * - weiches, mobil-freundliches Scrollen (`overscroll-contain` verhindert,
 *   dass die aeussere Seite mitscrollt)
 * - Design bleibt unveraendert: nur Hoehe + Overflow werden gesetzt
 */
export function ScrollPane({
  maxHeight,
  className = "",
  children,
  paneRef,
}: {
  maxHeight: string;
  className?: string;
  children: ReactNode;
  paneRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={paneRef}
      style={{ maxHeight, WebkitOverflowScrolling: "touch", scrollbarGutter: "stable" }}
      className={`yd-scrollpane overflow-y-auto overscroll-contain scroll-smooth pr-1 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Inkrementelles Rendern: es werden nur `chunk` Einträge gerendert; weitere
 * folgen erst, wenn der Sentinel im Container sichtbar wird.
 */
export function useIncrementalList<T>(items: T[], chunk: number, rootEl: HTMLElement | null) {
  const [count, setCount] = useState(chunk);
  const sentinel = useRef<HTMLDivElement | null>(null);

  // Bei Sortier-/Datenwechsel zurücksetzen (kein Speicher-/DOM-Wachstum).
  useEffect(() => {
    setCount(chunk);
  }, [items, chunk]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= items.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setCount((c) => Math.min(items.length, c + chunk));
        }
      },
      { root: rootEl ?? null, rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count, items.length, chunk, rootEl]);

  const visible = useMemo(() => items.slice(0, count), [items, count]);
  return { visible, sentinelRef: sentinel, hasMore: count < items.length };
}

/**
 * Rendert Inhalte erst, wenn sie (nahezu) im Scroll-Container sichtbar sind.
 * Vorher wird ein Platzhalter mit identischer Mindesthoehe gezeigt – dadurch
 * entstehen keine Layoutspruenge.
 */
export const LazyItem = memo(function LazyItem({
  minHeight,
  root,
  className = "",
  children,
}: {
  minHeight: number;
  root: HTMLElement | null;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  const style = useMemo<CSSProperties>(() => (shown ? {} : { minHeight }), [shown, minHeight]);

  const observe = useCallback((el: HTMLDivElement | null) => {
    ref.current = el;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { root: root ?? null, rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [root, shown]);

  return (
    <div ref={observe} style={style} className={className}>
      {shown ? children : null}
    </div>
  );
});
