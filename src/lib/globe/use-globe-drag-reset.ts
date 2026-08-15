import { useEffect } from "react";

/**
 * Sicherheitsnetz ausschließlich für die Slang-Globe-Seite.
 *
 * Bleibt nach einer Touch-/Pointer-Geste (z. B. vertikales Wischen mit
 * leichtem horizontalem Drift, abgebrochene Zieh-Geste, zweiter Finger)
 * ein temporärer `transform`-Wert am Seiten-Container hängen, wird er hier
 * nach dem Loslassen zuverlässig entfernt – die Seite kehrt also immer von
 * selbst in ihre normale Position zurück.
 *
 * Bewusst rein defensiv: es werden nur zurückgelassene Inline-Styles
 * aufgeräumt, keine Geste, Navigation oder Animation verändert.
 */

/** Wartezeit > Auslauf-Animation der Zieh-Geste (300ms). */
const SETTLE_MS = 420;

function isIdentity(transform: string): boolean {
  if (!transform || transform === "none") return true;
  // matrix(1, 0, 0, 1, 0, 0) bzw. translate3d(0px, 0, 0)
  return /^(matrix\(1,\s*0,\s*0,\s*1,\s*0,\s*0\)|translate3d\(0px?,\s*0(px)?,\s*0(px)?\))$/.test(
    transform.trim(),
  );
}

export function useGlobeDragReset() {
  useEffect(() => {
    let timer = 0;

    const settle = () => {
      const page = document.querySelector<HTMLElement>("[data-page-root]");
      if (!page) return;
      const inline = page.style.transform;
      if (!isIdentity(inline)) {
        page.style.transition = "";
        page.style.transform = "";
      }
      page.style.willChange = "";

      // Einlaufende Feed-Karte der Zieh-Geste sicher wieder ausblenden,
      // falls sie ohne Navigation sichtbar geblieben ist.
      document.querySelectorAll<HTMLElement>("[data-nav-incoming]").forEach((el) => {
        el.style.opacity = "0";
      });
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("touchend", schedule, opts);
    window.addEventListener("touchcancel", schedule, opts);
    window.addEventListener("pointerup", schedule, opts);
    window.addEventListener("pointercancel", schedule, opts);
    window.addEventListener("mouseup", schedule, opts);
    window.addEventListener("blur", schedule);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("touchend", schedule, opts);
      window.removeEventListener("touchcancel", schedule, opts);
      window.removeEventListener("pointerup", schedule, opts);
      window.removeEventListener("pointercancel", schedule, opts);
      window.removeEventListener("mouseup", schedule, opts);
      window.removeEventListener("blur", schedule);
    };
  }, []);
}
