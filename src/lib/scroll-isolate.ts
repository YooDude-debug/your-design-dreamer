/**
 * Isolierte Scrollbereiche (Overlays wie Messenger, Globe, Viewer).
 *
 * Die Feed-Gestenlogik lauscht bewusst global (Dokument/Fenster), damit Leiste
 * und Feed mit EINEM Listener-Set bedient werden. Damit Gesten innerhalb eines
 * Overlays nicht als Feed-Gesten gelten, markieren solche Bereiche sich mit
 * `data-scroll-isolate`. Jede globale Scroll-/Gestenauswertung fragt hier nach
 * und bricht bei einem Treffer sofort ab.
 */

export const SCROLL_ISOLATE_ATTR = "data-scroll-isolate";

const SELECTOR = `[${SCROLL_ISOLATE_ATTR}]`;

/** True, wenn das Ereignisziel in einem isolierten Scrollbereich liegt. */
export function isIsolatedTarget(target: EventTarget | null | undefined): boolean {
  if (!target) return false;
  const el =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  return !!el?.closest(SELECTOR);
}

/** Props fuer die Wurzel eines isolierten Overlays. */
export const scrollIsolateProps = { [SCROLL_ISOLATE_ATTR]: "" } as const;
