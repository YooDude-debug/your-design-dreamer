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
  /**
   * Position einfrieren (Detailansicht öffnet sich). Solange der Anker hält,
   * wird nichts neu gemessen und nichts ausgeglichen – so kann die Sperre des
   * Seiten-Scrollens die gemerkte Stelle nicht überschreiben.
   */
  hold: () => void;
  /** Eingefrorene Stelle EINMAL exakt wiederherstellen und wieder freigeben. */
  release: () => void;
};

type Snapshot = { id: string; top: number };
/** Eingefrorener Zustand: Beitrag + sein Abstand zur Oberkante + Rohposition. */
type Held = { id: string | null; offset: number; scrollTop: number };

/**
 * @param getScroller Liefert den scrollenden Container (null = Seite scrollt).
 * @param getRoot     Wurzelelement des Feeds; die Ankersuche bleibt darin.
 */
export function createFeedAnchor(
  getScroller: () => HTMLElement | null,
  getRoot: () => HTMLElement | null,
): FeedAnchor {
  let snapshot: Snapshot | null = null;
  let held: Held | null = null;

  const scrollTopOf = (el: HTMLElement | null) => (el ? el.scrollTop : window.scrollY);

  const setScrollTop = (el: HTMLElement | null, top: number) => {
    const next = Math.max(0, Math.round(top));
    if (el) el.scrollTo({ top: next, behavior: "instant" as ScrollBehavior });
    else window.scrollTo({ top: next, behavior: "instant" as ScrollBehavior });
  };

  const viewTopOf = (el: HTMLElement | null) => (el ? el.getBoundingClientRect().top : 0);

  /** Oberster (auch nur teilweise) sichtbarer Beitrag samt Abstand zur Kante. */
  const topVisible = (): { id: string; offset: number } | null => {
    const root = getRoot();
    if (!root) return null;
    const el = getScroller();
    const viewTop = viewTopOf(el);
    const nodes = root.querySelectorAll<HTMLElement>("[data-post-id]");
    for (const node of Array.from(nodes)) {
      const id = node.dataset["postId"];
      if (!id) continue;
      const rect = node.getBoundingClientRect();
      if (rect.bottom > viewTop + 1) return { id, offset: rect.top - viewTop };
    }
    return null;
  };

  const record = () => {
    // Eingefroren: keine neue Messung, damit die gemerkte Stelle exakt bleibt.
    if (held) return;
    const top = topVisible();
    const el = getScroller();
    snapshot = top ? { id: top.id, top: top.offset + scrollTopOf(el) } : null;
  };

  const restore = () => {
    if (held) return;
    const prev = snapshot;
    const root = getRoot();
    const el = getScroller();
    const scrollTop = scrollTopOf(el);
    // Ganz oben gibt es nichts zu stabilisieren – dort ist "oben" die Wahrheit.
    if (prev && root && scrollTop > 8) {
      const node = root.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(prev.id)}"]`);
      if (node) {
        const delta = Math.round(node.getBoundingClientRect().top - viewTopOf(el) + scrollTop - prev.top);
        if (delta !== 0) setScrollTop(el, scrollTop + delta);
      }
    }
    record();
  };

  const hold = () => {
    if (held) return;
    const top = topVisible();
    held = {
      id: top?.id ?? null,
      offset: top?.offset ?? 0,
      scrollTop: scrollTopOf(getScroller()),
    };
  };

  const release = () => {
    const prev = held;
    held = null;
    if (!prev) return;
    const el = getScroller();
    const root = getRoot();
    const node =
      prev.id && root
        ? root.querySelector<HTMLElement>(`[data-post-id="${CSS.escape(prev.id)}"]`)
        : null;
    // Genau EIN Sprung: bevorzugt über den gemerkten Beitrag (Kartenhöhen
    // können sich geändert haben), sonst über die rohe Scrollposition.
    let target: number | null = null;
    if (node) {
      const cur = node.getBoundingClientRect().top - viewTopOf(el);
      const scrollTop = scrollTopOf(el);
      target = scrollTop + (cur - prev.offset);
    } else {
      target = prev.scrollTop;
    }
    if (Math.abs(target - scrollTopOf(el)) > 1) setScrollTop(el, target);
    /**
     * Hebt die Detailansicht die Scroll-Sperre auf, klemmt der Browser die
     * Position teils erst im naechsten Frame zurecht. Genau EINE stille
     * Nachkorrektur (ohne Animation) faengt das ab – danach wird nicht mehr
     * gescrollt.
     */
    const fixed = target;
    window.requestAnimationFrame(() => {
      if (held) return;
      if (Math.abs(fixed - scrollTopOf(getScroller())) > 1) setScrollTop(getScroller(), fixed);
      record();
    });
    record();
  };

  return { record, restore, hold, release };
}

