/**
 * Zentrale Scroll-Hilfen für den Feed.
 *
 * Der Feed scrollt je nach Layout im eigenen Container (Desktop / Feed-Modus)
 * oder mit der Seite (Mobile). Damit es keine konkurrierenden Scroll-Handler
 * und keine doppelten Höhenmessungen gibt, laufen alle Abfragen über diese
 * eine Stelle. Es existiert genau EIN globaler, rAF-gedrosselter Listener,
 * den sich alle Abonnenten teilen.
 */

/** Findet den tatsächlich scrollenden Vorfahren des Feeds (oder null = Seite). */
export function resolveFeedScroller(from: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = from;
  while (el) {
    const style = window.getComputedStyle(el);
    if (/(auto|scroll)/i.test(style.overflowY) && el.scrollHeight > el.clientHeight + 8) return el;
    el = el.parentElement;
  }
  return null;
}

/** Aktuelle Scrollposition des Feeds – Container oder Seite. */
export function feedScrollTop(scroller: HTMLElement | null): number {
  return Math.max(window.scrollY, scroller ? scroller.scrollTop : 0);
}

/** Sichtbare Höhe des Feeds – Container oder Viewport. */
export function feedViewportHeight(scroller: HTMLElement | null): number {
  return scroller ? scroller.clientHeight : window.innerHeight;
}

/** Steht der Feed praktisch am Anfang? */
export function isFeedAtTop(scroller: HTMLElement | null): boolean {
  return feedScrollTop(scroller) <= 8;
}

/** Sofort an den Anfang – ohne Reload und ohne neue Abfrage. */
export function scrollFeedToTop(scroller: HTMLElement | null, smooth = false): void {
  if (scroller) {
    if (smooth) scroller.scrollTo({ top: 0, behavior: "smooth" });
    else scroller.scrollTop = 0;
  }
  if (window.scrollY > 0) {
    if (smooth) window.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo(0, 0);
  }
}

type Listener = () => void;

const listeners = new Set<Listener>();
let attached = false;
let frame = 0;

function flush() {
  frame = 0;
  for (const fn of listeners) fn();
}

function schedule() {
  if (frame) return;
  frame = window.requestAnimationFrame(flush);
}

/**
 * Ein einziger Capture-Listener erfasst das Scrollen jedes Containers – egal
 * welches Element im aktuellen Layout wirklich scrollt. Wird beim letzten
 * Abmelden vollständig entfernt.
 */
export function subscribeFeedScroll(fn: Listener): () => void {
  listeners.add(fn);
  if (!attached) {
    attached = true;
    document.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && attached) {
      attached = false;
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
    }
  };
}
