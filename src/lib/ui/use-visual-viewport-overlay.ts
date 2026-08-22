import { useEffect, useState } from "react";

/**
 * Liefert Inline-Styles, die ein Overlay exakt auf die aktuell *sichtbare*
 * Fläche legen (visualViewport). Damit landet ein Bestätigungsdialog auf
 * Mobilgeräten nie hinter Adressleiste, Tastatur oder Safe Area.
 *
 * Fällt auf reines `position: fixed` zurück, wenn visualViewport fehlt.
 */
export type ViewportOverlay = {
  /** Style für den Backdrop (voll sichtbare Fläche). */
  style: React.CSSProperties;
  /** true, sobald echte visualViewport-Werte vorliegen. */
  ready: boolean;
};

const BASE: React.CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
};

export function useVisualViewportOverlay(active: boolean): ViewportOverlay {
  const [style, setStyle] = useState<React.CSSProperties>(BASE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) {
      setStyle(BASE);
      setReady(true);
      return;
    }

    const measure = () => {
      // offsetLeft/offsetTop sind relativ zum Layout-Viewport; pageTop/pageLeft
      // schließen die Scrollposition mit ein. `position: fixed` orientiert sich
      // am Layout-Viewport, deshalb genügen offsetTop/offsetLeft.
      setStyle({
        position: "fixed",
        top: Math.max(0, Math.round(vv.offsetTop)),
        left: Math.max(0, Math.round(vv.offsetLeft)),
        width: Math.round(vv.width),
        height: Math.round(vv.height),
      });
      setReady(true);
    };

    measure();
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    window.addEventListener("orientationchange", measure);
    const timers = [60, 200, 420].map((ms) => window.setTimeout(measure, ms));

    return () => {
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
      window.removeEventListener("orientationchange", measure);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [active]);

  return { style, ready };
}
