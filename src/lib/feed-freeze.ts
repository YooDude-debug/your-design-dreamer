/**
 * Feed einfrieren, ohne ihn neu zu laden.
 *
 * Wird gebraucht, solange eine Vollbild-Videowerbung laeuft: der Feed bleibt
 * im Speicher (kein Reload, kein erneutes Abrufen), aber es darf nicht
 * weitergescrollt werden. Beim Freigeben wird die exakte Scrollposition
 * wiederhergestellt – von Container UND Seite, weil der Feed je nach Layout
 * im eigenen Container oder mit der Seite scrollt.
 *
 * Die globale Scroll-/Touch-Sperre laeuft ueber die zentrale, zaehlerbasierte
 * Sperre (`scroll-lock.ts`). Fremde Zustaende – etwa ein gleichzeitig aktiver
 * Feed-Modus – werden dadurch nie ueberschrieben oder faelschlich
 * wiederhergestellt. Die Rad-/Touch-Blockade gehoert ausschliesslich diesem
 * Aufruf und wird beim eigenen `release()` sicher entfernt.
 */

import { resolveFeedScroller } from "@/lib/feed-scroll";
import { lockScroll } from "@/lib/scroll-lock";

type Frozen = {
  scroller: HTMLElement | null;
  scrollerTop: number;
  pageTop: number;
  scrollerOverflow: string;
  scrollerTouch: string;
};

/**
 * Friert den Feed ein. Der Rueckgabewert gibt ihn frei und stellt die
 * vorherige Position exakt wieder her.
 */
export function freezeFeed(from: HTMLElement | null): () => void {
  if (typeof document === "undefined") return () => undefined;

  const scroller = resolveFeedScroller(from);
  const state: Frozen = {
    scroller,
    scrollerTop: scroller ? scroller.scrollTop : 0,
    pageTop: window.scrollY,
    scrollerOverflow: scroller ? scroller.style.overflowY : "",
    scrollerTouch: scroller ? scroller.style.touchAction : "",
  };

  if (scroller) {
    scroller.style.overflowY = "hidden";
    scroller.style.touchAction = "none";
  }
  const releaseLock = lockScroll({ touch: true });

  // Zusaetzlich Rad-/Touch-Scrollen unterdruecken (iOS ignoriert overflow
  // teils). Eigene Funktionsinstanz -> ein zweiter Freeze entfernt sie nicht.
  const stop = (e: Event) => {
    e.preventDefault();
  };
  document.addEventListener("wheel", stop, { passive: false });
  document.addEventListener("touchmove", stop, { passive: false });

  let released = false;
  return () => {
    if (released) return;
    released = true;
    document.removeEventListener("wheel", stop);
    document.removeEventListener("touchmove", stop);
    if (state.scroller) {
      state.scroller.style.overflowY = state.scrollerOverflow;
      state.scroller.style.touchAction = state.scrollerTouch;
    }
    releaseLock();

    // Exakt zurueck – ohne Animation, damit nichts springt oder flackert.
    const restore = () => {
      if (state.scroller && state.scroller.scrollTop !== state.scrollerTop) {
        state.scroller.scrollTop = state.scrollerTop;
      }
      if (window.scrollY !== state.pageTop) window.scrollTo(0, state.pageTop);
    };
    restore();
    requestAnimationFrame(restore);
  };
}
