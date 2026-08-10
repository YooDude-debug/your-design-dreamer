/**
 * Feed einfrieren, ohne ihn neu zu laden.
 *
 * Wird gebraucht, solange eine Vollbild-Videowerbung laeuft: der Feed bleibt
 * im Speicher (kein Reload, kein erneutes Abrufen), aber es darf nicht
 * weitergescrollt werden. Beim Freigeben wird die exakte Scrollposition
 * wiederhergestellt – von Container UND Seite, weil der Feed je nach Layout
 * im eigenen Container oder mit der Seite scrollt.
 */

import { resolveFeedScroller } from "@/lib/feed-scroll";

type Frozen = {
  scroller: HTMLElement | null;
  scrollerTop: number;
  pageTop: number;
  scrollerOverflow: string;
  scrollerTouch: string;
  bodyOverflow: string;
  bodyTouch: string;
};

const stop = (e: Event) => {
  e.preventDefault();
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
    bodyOverflow: document.body.style.overflow,
    bodyTouch: document.body.style.touchAction,
  };

  if (scroller) {
    scroller.style.overflowY = "hidden";
    scroller.style.touchAction = "none";
  }
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
  // Zusaetzlich Rad-/Touch-Scrollen unterdruecken (iOS ignoriert overflow teils).
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
    document.body.style.overflow = state.bodyOverflow;
    document.body.style.touchAction = state.bodyTouch;

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
