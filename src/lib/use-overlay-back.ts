import { useEffect, useRef } from "react";

/**
 * Zurück-Schutz für Overlays (z. B. die Beitrags-Detailansicht).
 *
 * Ein Overlay ist keine eigene Seite. Ohne Schutz läuft der Zurück-Knopf des
 * Browsers/Systems den kompletten Seitenverlauf zurück – aus dem Feed heraus
 * landete man dann bei zuvor besuchten Bereichen (Globe, Arena) statt einfach
 * das Overlay zu schliessen.
 *
 * Deshalb legt das Overlay beim Öffnen genau EINEN eigenen Verlaufseintrag an:
 * - Zurück schliesst nur das Overlay (der Eintrag wird verbraucht).
 * - Wird das Overlay über X/Escape geschlossen, wird der Eintrag still entfernt.
 * - Echte Navigationen (z. B. zu einem SlangTag) bleiben unangetastet.
 *
 * Das Aufräumen läuft bewusst über einen Mikro-Timer: React ruft Effekte in der
 * Entwicklung doppelt auf (mount → cleanup → mount). Ohne diesen Aufschub würde
 * der Aufräumschritt den gerade neu angelegten Eintrag entfernen und das Overlay
 * sofort wieder schliessen.
 */

const MARKER = "ydOverlay";

/** Offener Aufräumauftrag – wird bei sofortigem Neu-Mount wiederverwendet. */
let pendingCleanup: ReturnType<typeof setTimeout> | null = null;

export function useOverlayBackGuard(onBack: () => void): void {
  const cb = useRef(onBack);
  cb.current = onBack;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (pendingCleanup !== null) {
      // Direkter Neu-Mount: der vorhandene Eintrag wird weiterverwendet.
      clearTimeout(pendingCleanup);
      pendingCleanup = null;
    } else {
      const base = (window.history.state ?? {}) as Record<string, unknown>;
      window.history.pushState({ ...base, [MARKER]: true }, "");
    }

    const onPop = () => cb.current();
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      pendingCleanup = setTimeout(() => {
        pendingCleanup = null;
        const state = (window.history.state ?? {}) as { [MARKER]?: boolean };
        // Nur den EIGENEN Eintrag entfernen – nie eine echte Navigation zurücknehmen.
        if (state[MARKER]) window.history.back();
      }, 0);
    };
  }, []);
}
