/**
 * "Living Feed": sehr subtile Bildbewegung im Feed.
 *
 * Wird eine Beitragskarte laenger betrachtet, skaliert das Standbild langsam
 * von 1.00 auf maximal 1.03. Die Progression selbst macht ausschliesslich eine
 * lange CSS-Transition – hier gibt es weder State-Updates noch Scroll-Listener,
 * rAF oder Timer-Ticking. Der Hook setzt lediglich ein DOM-Attribut.
 *
 * Sticky-/Docking-Logik (`use-feed-mode.ts`) bleibt davon vollstaendig
 * unberuehrt: der Transform sitzt nur auf dem <img> im bereits geclippten
 * Medienrahmen.
 */
import { useEffect, type RefObject } from "react";

/** Startet erst ab dieser Sichtbarkeit. */
const START_RATIO = 0.6;
/** Unterhalb dieser Sichtbarkeit wird zurueckgesetzt. */
const STOP_RATIO = 0.25;
/** Schnelles Weiterscrollen loest den Effekt nicht aus. */
const START_DELAY_MS = 600;
/** Mehr gleichzeitig animierte Bilder bringen visuell nichts und kosten GPU. */
const MAX_ACTIVE = 3;

/** Kleiner Modulzaehler fuer die Obergrenze gleichzeitig aktiver Bilder. */
const active = new Set<Element>();

function deactivate(img: Element | null) {
  if (!img) return;
  active.delete(img);
  img.removeAttribute("data-living");
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useLivingMedia(
  cardRef: RefObject<HTMLElement | null>,
  { enabled, root }: { enabled: boolean; root?: HTMLElement | null },
) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (prefersReducedMotion()) return;
    const card = cardRef.current;
    if (!card) return;

    let timer: number | undefined;
    let current: Element | null = null;

    const clearTimer = () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= START_RATIO) {
          if (timer !== undefined || current) return;
          timer = window.setTimeout(() => {
            timer = undefined;
            // Erst hier suchen: das Bild ist dann sicher gerendert und dekodiert.
            const img = card.querySelector("img.yd-living-media:not(.yd-media-pending)");
            if (!img) return;
            if (active.size >= MAX_ACTIVE) return;
            active.add(img);
            current = img;
            img.setAttribute("data-living", "on");
          }, START_DELAY_MS);
        } else if (entry.intersectionRatio < STOP_RATIO) {
          clearTimer();
          deactivate(current);
          current = null;
        }
      },
      { root: root ?? null, threshold: [0, STOP_RATIO, START_RATIO] },
    );

    io.observe(card);
    return () => {
      io.disconnect();
      clearTimer();
      deactivate(current);
      current = null;
    };
  }, [cardRef, enabled, root]);
}
