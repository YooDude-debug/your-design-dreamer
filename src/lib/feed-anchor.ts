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
  /** Letzter Anker-Knoten – Startpunkt der Suche (statt Scan über alle Karten). */
  let lastNode: HTMLElement | null = null;
  /** Zeitfenster der günstigen Messung: max. ~6 Messungen pro Sekunde. */
  let lastRecordAt = 0;
  const RECORD_MIN_MS = 160;

  const scrollTopOf = (el: HTMLElement | null) => (el ? el.scrollTop : window.scrollY);

  const setScrollTop = (el: HTMLElement | null, top: number) => {
    const next = Math.max(0, Math.round(top));
    if (el) el.scrollTo({ top: next, behavior: "instant" as ScrollBehavior });
    else window.scrollTo({ top: next, behavior: "instant" as ScrollBehavior });
  };

  const viewTopOf = (el: HTMLElement | null) => (el ? el.getBoundingClientRect().top : 0);

  const postId = (node: HTMLElement | null) => node?.dataset["postId"] ?? null;

  /** Nachbarkarte in Dokumentrichtung (nur echte Beitragsknoten). */
  const step = (node: HTMLElement, dir: 1 | -1): HTMLElement | null => {
    let el: Element | null = dir === 1 ? node.nextElementSibling : node.previousElementSibling;
    while (el && !(el instanceof HTMLElement && el.dataset["postId"])) {
      el = dir === 1 ? el.nextElementSibling : el.previousElementSibling;
    }
    return (el as HTMLElement | null) ?? null;
  };

  /**
   * Oberster (auch nur teilweise) sichtbarer Beitrag samt Abstand zur Kante.
   *
   * Beim Scrollen verschiebt sich der Anker meist nur um eine Karte. Deshalb
   * startet die Suche beim zuletzt gemerkten Knoten und geht nur so weit wie
   * nötig weiter – kein `getBoundingClientRect()` über alle Karten pro Frame.
   * Nur ohne bekannten Startpunkt wird einmalig gesucht.
   */
  const topVisible = (): { id: string; offset: number } | null => {
    const root = getRoot();
    if (!root) return null;
    const el = getScroller();
    const viewTop = viewTopOf(el);

    let node: HTMLElement | null =
      lastNode && lastNode.isConnected && root.contains(lastNode)
        ? lastNode
        : root.querySelector<HTMLElement>("[data-post-id]");

    if (!node) {
      lastNode = null;
      return null;
    }

    // Zu weit unten? Nach oben laufen, solange der Vorgänger noch sichtbar ist.
    for (let guard = 0; guard < 400; guard += 1) {
      const prev = step(node, -1);
      if (!prev || prev.getBoundingClientRect().bottom <= viewTop + 1) break;
      node = prev;
    }
    // Zu weit oben? Nach unten laufen, bis die Karte den Rand schneidet.
    for (let guard = 0; guard < 400; guard += 1) {
      if (node.getBoundingClientRect().bottom > viewTop + 1) break;
      const next = step(node, 1);
      if (!next) break;
      node = next;
    }

    const id = postId(node);
    if (!id) return null;
    lastNode = node;
    return { id, offset: node.getBoundingClientRect().top - viewTop };
  };
  /** Anker sofort messen (intern nach einem Ausgleich – muss exakt sein). */
  const measure = () => {
    if (held) return;
    const top = topVisible();
    const el = getScroller();
    snapshot = top ? { id: top.id, top: top.offset + scrollTopOf(el) } : null;
    lastRecordAt = Date.now();
  };

  /**
   * Öffentliche Messung (Scroll-Abo): zeitlich gedrosselt. Der Anker muss nur
   * grob aktuell sein – gemessen wird ohnehin erneut, bevor ausgeglichen wird.
   */
  const record = () => {
    if (held) return;
    const now = Date.now();
    if (now - lastRecordAt < RECORD_MIN_MS) return;
    measure();
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
        const delta = Math.round(
          node.getBoundingClientRect().top - viewTopOf(el) + scrollTop - prev.top,
        );
        if (delta !== 0) setScrollTop(el, scrollTop + delta);
      }
    }
    measure();
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
      measure();
    });
    measure();
  };

  return { record, restore, hold, release };
}
