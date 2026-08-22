import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Mobile Sichtbarkeit des SlangShot-Video-Bereichs.
 *
 * Sobald der Video-Modus aktiv wird (oder sich die tatsaechlich sichtbare
 * Viewport-Hoehe aendert – Browser-UI, Tastatur, Rotation, Resize), wird der
 * Video-Bereich in den sichtbaren Bereich gescrollt und seine Hoehe an die
 * verfuegbare Flaeche angepasst. Es wird keine feste Pixelhoehe verwendet und
 * nur der Video-Bereich bewegt – der restliche Editor bleibt unveraendert.
 */

const MOBILE_MAX_WIDTH = 768;
/** Platz fuer Kopfzeile, SlangTag-Leiste und Bedienelemente unter dem Video. */
const RESERVED_RATIO = 0.42;
const RESERVED_RATIO_KEYBOARD = 0.55;
const MIN_HEIGHT = 168;
const MAX_HEIGHT = 560;

type Viewport = { height: number; offsetTop: number; keyboard: boolean };

const readViewport = (baseline: number): Viewport => {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const height = vv?.height ?? window.innerHeight;
  const offsetTop = vv?.offsetTop ?? 0;
  // Tastatur: sichtbare Flaeche deutlich kleiner als die groesste gemessene.
  const keyboard = baseline > 0 && height < baseline * 0.8;
  return { height, offsetTop, keyboard };
};

const safeAreaTop = () => {
  if (typeof window === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--safe-top");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const scrollableParent = (el: HTMLElement): HTMLElement | null => {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const scrolls = /(auto|scroll|overlay)/.test(`${style.overflowY}`);
    if (scrolls && node.scrollHeight > node.clientHeight + 4) return node;
    node = node.parentElement;
  }
  return null;
};

export function useVideoViewportFit(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const baseline = useRef(0);
  const lastAlign = useRef(0);

  const measure = () => {
    if (typeof window === "undefined") return null;
    if (window.innerWidth > MOBILE_MAX_WIDTH) {
      setHeight(null);
      return null;
    }
    const vp = readViewport(baseline.current);
    if (!vp.keyboard) baseline.current = Math.max(baseline.current, vp.height);
    const reserved = vp.keyboard ? RESERVED_RATIO_KEYBOARD : RESERVED_RATIO;
    const next = Math.round(
      Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, vp.height * (1 - reserved))),
    );
    setHeight(next);
    return vp;
  };

  /** Video-Bereich in die tatsaechlich sichtbare Flaeche schieben. */
  const align = () => {
    const el = ref.current;
    if (!el) return;
    const view = readViewport(baseline.current);

    const pad = 12 + safeAreaTop();
    const visibleTop = view.offsetTop + pad;
    const visibleBottom = view.offsetTop + view.height - 12;
    const rect = el.getBoundingClientRect();

    let delta = 0;
    if (rect.top < visibleTop) delta = rect.top - visibleTop;
    else if (rect.bottom > visibleBottom)
      delta = Math.min(rect.top - visibleTop, rect.bottom - visibleBottom);
    if (Math.abs(delta) < 8) return;

    const container = scrollableParent(el);
    if (container) container.scrollBy({ top: delta, behavior: "smooth" });
    else window.scrollBy({ top: delta, behavior: "smooth" });
  };

  /**
   * Mehrere Versuche, damit Layout, Hoehenwechsel und Tastatur-Animation
   * abgeschlossen sind, bevor endgueltig ausgerichtet wird.
   */
  const schedule = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [80, 260, 520, 900].map((ms) => window.setTimeout(align, ms));
  };

  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  // Eintritt in den Video-Modus: Hoehe berechnen und in den Blick holen.
  useLayoutEffect(() => {
    if (!active) {
      clearTimers();
      setHeight(null);
      return;
    }
    measure();
    schedule();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Nach jeder Hoehenanpassung erneut ausrichten (Layout ist dann fertig).
  useEffect(() => {
    if (!active || height === null) return;
    const raf = requestAnimationFrame(align);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, height]);

  // Aenderungen der sichtbaren Hoehe: Tastatur, Browser-UI, Rotation, Resize.
  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        measure();
        schedule();
      });
    };
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      cancelAnimationFrame(frame);
      clearTimers();
      vv?.removeEventListener("resize", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);


  return { ref, height };
}
