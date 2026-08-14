/**
 * Scroll-Anker des Feeds (eine einzige Zuständigkeit).
 *
 * Der Feed wächst und schrumpft laufend: Bilder laden nach, Werbung rastet ein,
 * neue Beiträge rutschen oben nach. Damit der Nutzer dabei optisch stehen
 * bleibt, wird EIN konkreter Beitrag gemerkt (der oberste sichtbare) und nach
 * einer Layoutänderung genau dessen Verschiebung ausgeglichen.
 *
 * Wichtig: Der Ausgleich läuft immer ohne Animation ("instant"). Ein weiches
 * Scrollen würde die Korrektur in eine sichtbare Bewegung über mehrere
 * Beiträge verwandeln – genau der beobachtete "Sprung nach unten".
 */

export type FeedAnchor = {
  /** Aktuellen Anker merken (günstig, nur Messung). */
  record: () => void;
  /** Verschiebung des gemerkten Ankers ausgleichen. */
  restore: () => void;
};

type Snapshot = { id: string; top: number };

/**
 * @param getScroller Liefert den scrollenden Container (null = Seite scrollt).
 * @param getRoot     Wurzelelement des Feeds; die Ankersuche bleibt darin.
 */
export function createFeedAnchor(
  getScroller: () => HTMLElement | null,
  getRoot: () => HTMLElement | null,
): FeedAnchor {
  let snapshot: Snapshot | null = null;

  const scrollTopOf = (el: HTMLElement | null) => (el ? el.scrollTop : window.scrollY);

  const setScrollTop = (el: HTMLElement | null, top: number) => {
    if (el) el.scrollTo({ top, behavior: "instant" as ScrollBehavior });
    else window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
  };

  const record = () => {
    const root = getRoot();
    if (!root) {
      snapshot = null;
      return;
    }
    const el = getScroller();
    const scrollTop = scrollTopOf(el);
    const viewTop = el ? el.getBoundingClientRect().top : 0;
    const nodes = root.querySelectorAll<HTMLElement>("[data-post-id]");
    for (const node of Array.from(nodes)) {
      const id = node.dataset["postId"];
      if (!id) continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom > viewTop + 1) {
        snapshot = { id, top: rect.top + scrollTop };
        return;
      }
    }
    snapshot = null;
  };

  const restore = () => {
    const prev = snapshot;
    const root = getRoot();
    const el = getScroller();
    const scrollTop = scrollTopOf(el);
    // Ganz oben gibt es nichts zu stabilisieren – dort ist "oben" die Wahrheit.
    if (prev && root && scrollTop > 8) {
      const node = root.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(prev.id)}"]`);
      if (node) {
        const delta = Math.round(node.getBoundingClientRect().top + scrollTop - prev.top);
        if (delta !== 0) setScrollTop(el, scrollTop + delta);
      }
    }
    record();
  };

  return { record, restore };
}
