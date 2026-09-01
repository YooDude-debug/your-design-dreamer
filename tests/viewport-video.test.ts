import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  registerViewportVideo,
  __resetViewportVideos,
  RESET_DISTANCE_CARDS,
} from "@/lib/video/viewport-video";
import {
  __resetVideoSound,
  __setUserGestureForTests,
  isVideoSoundPreferred,
} from "@/lib/video/video-sound";

/**
 * Viewport-basierte Videowiedergabe im Feed: nur sichtbare Videos laufen,
 * immer nur eines gleichzeitig, manuelle Bedienung hat Vorrang.
 */

type ObserverCb = (entries: IntersectionObserverEntry[]) => void;

const observers: { cb: ObserverCb; el: Element | null; rootMargin: string }[] = [];

class FakeIO {
  cb: ObserverCb;
  rootMargin: string;
  constructor(cb: ObserverCb, opts?: IntersectionObserverInit) {
    this.cb = cb;
    this.rootMargin = String(opts?.rootMargin ?? "0px");
    observers.push({ cb, el: null, rootMargin: this.rootMargin });
  }
  observe(el: Element) {
    const slot = observers.find((o) => o.cb === this.cb);
    if (slot) slot.el = el;
  }
  disconnect() {
    const i = observers.findIndex((o) => o.cb === this.cb);
    if (i >= 0) observers.splice(i, 1);
  }
}

function makeCard(height = 500) {
  return { offsetHeight: height } as unknown as HTMLElement;
}

function makeVideo() {
  const listeners = new Map<string, Set<(e?: unknown) => void>>();
  const el = {
    paused: true,
    ended: false,
    currentTime: 0,
    _muted: true,
    get muted() {
      return el._muted;
    },
    set muted(v: boolean) {
      if (el._muted === v) return;
      el._muted = v;
      el.emit("volumechange");
    },
    playsInline: false,
    preload: "auto",
    play: vi.fn(() => {
      el.paused = false;
      el.emit("play");
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      el.paused = true;
      el.emit("pause");
    }),
    addEventListener: (t: string, fn: (e?: unknown) => void) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(fn);
    },
    removeEventListener: (t: string, fn: (e?: unknown) => void) => {
      listeners.get(t)?.delete(fn);
    },
    getBoundingClientRect: () => ({ height: 500, top: 0, bottom: 500 }) as DOMRect,
    emit: (t: string) => listeners.get(t)?.forEach((fn) => fn()),
  };
  return el as unknown as HTMLVideoElement & { emit: (t: string) => void };
}

function entryFor(el: HTMLVideoElement, ratio: number): IntersectionObserverEntry {
  return {
    target: el,
    isIntersecting: ratio > 0,
    intersectionRatio: ratio,
    intersectionRect: { height: 100 } as DOMRectReadOnly,
    rootBounds: { height: 800 } as DOMRectReadOnly,
  } as unknown as IntersectionObserverEntry;
}

/** Sichtbarkeit melden und den gebuendelten Abgleich ausfuehren. */
function report(el: HTMLVideoElement, ratio: number) {
  const slot = observers.find((o) => o.el === el && o.rootMargin === "0px");
  slot?.cb([entryFor(el, ratio)]);
  vi.advanceTimersByTime(20);
}

/** Den Abstands-Observer (~5 Karten) der Karte ausloesen. */
function reportFar(el: HTMLElement, intersecting: boolean) {
  const slot = observers.find((o) => o.el === el && o.rootMargin !== "0px");
  slot?.cb([
    {
      target: el,
      isIntersecting: intersecting,
      intersectionRatio: 0,
    } as unknown as IntersectionObserverEntry,
  ]);
  vi.advanceTimersByTime(20);
}

describe("viewport video playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observers.length = 0;
    __resetViewportVideos();
    __resetVideoSound();
    vi.stubGlobal("IntersectionObserver", FakeIO);
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("document", { hidden: false, addEventListener() {}, removeEventListener() {} });
  });

  it("startet ein ausreichend sichtbares Video automatisch", () => {
    const v = makeVideo();
    registerViewportVideo(v, null);
    report(v, 0.8);
    expect(v.paused).toBe(false);
    expect(v.playsInline).toBe(true);
  });

  it("startet nicht bei nur kleinem sichtbaren Rand", () => {
    const v = makeVideo();
    registerViewportVideo(v, null);
    report(v, 0.1);
    expect(v.paused).toBe(true);
  });

  it("pausiert beim Verlassen des sichtbaren Bereichs", () => {
    const v = makeVideo();
    registerViewportVideo(v, null);
    report(v, 0.9);
    expect(v.paused).toBe(false);
    report(v, 0);
    expect(v.paused).toBe(true);
  });

  it("spielt nie zwei Videos gleichzeitig", () => {
    const a = makeVideo();
    const b = makeVideo();
    registerViewportVideo(a, null);
    registerViewportVideo(b, null);
    report(a, 0.9);
    expect(a.paused).toBe(false);
    report(b, 0.95);
    expect(b.paused).toBe(false);
    expect(a.paused).toBe(true);
  });

  it("startet ein manuell pausiertes Video nicht erneut", () => {
    const v = makeVideo();
    registerViewportVideo(v, null);
    report(v, 0.9);
    v.pause(); // Nutzeraktion
    expect(v.paused).toBe(true);
    report(v, 0.85);
    expect(v.paused).toBe(true);
  });

  it("erlaubt Autostart erneut, nachdem das Video den Viewport verlassen hat", () => {
    const v = makeVideo();
    registerViewportVideo(v, null);
    report(v, 0.9);
    v.pause();
    report(v, 0); // komplett ausgescrollt
    report(v, 0.9); // zurueckgescrollt
    expect(v.paused).toBe(false);
  });

  it("pausiert das automatische Video, wenn der Nutzer ein anderes startet", () => {
    const a = makeVideo();
    const b = makeVideo();
    registerViewportVideo(a, null);
    registerViewportVideo(b, null);
    report(a, 0.9);
    void b.play(); // manueller Start
    expect(a.paused).toBe(true);
    expect(b.paused).toBe(false);
  });

  it("setzt beim kurzen Wegscrollen NICHT zurueck (nur Pause)", () => {
    const v = makeVideo();
    const card = makeCard();
    registerViewportVideo(v, null, { card, index: 3 });
    report(v, 0.9);
    v.currentTime = 7;
    report(v, 0.1); // eine Karte weiter
    expect(v.paused).toBe(true);
    expect(v.currentTime).toBe(7);
    report(v, 0); // zwei bis vier Karten weiter, weiterhin im Abstands-Fenster
    reportFar(card, true);
    expect(v.currentTime).toBe(7);
  });

  it("setzt nach ca. 5 Karten Abstand auf 0:00 zurueck", () => {
    const v = makeVideo();
    const card = makeCard();
    registerViewportVideo(v, null, { card, index: 3 });
    report(v, 0.9);
    v.currentTime = 12;
    report(v, 0);
    reportFar(card, false); // ~5 Karten entfernt
    expect(v.currentTime).toBe(0);
    expect(v.paused).toBe(true);
  });

  it("baut den Abstands-Observer aus der Kartenhoehe auf (keine festen Pixel)", () => {
    const v = makeVideo();
    const card = makeCard(400);
    registerViewportVideo(v, null, { card, index: 1 });
    report(v, 0.9);
    const far = observers.find((o) => o.el === card && o.rootMargin !== "0px");
    expect(far?.rootMargin).toBe(`${400 * (RESET_DISTANCE_CARDS - 1)}px 0px`);
  });

  it("startet nach einem Reset beim Zurueckscrollen wieder bei 0:00", () => {
    const v = makeVideo();
    const card = makeCard();
    registerViewportVideo(v, null, { card, index: 3 });
    report(v, 0.9);
    v.currentTime = 20;
    v.pause(); // Nutzer pausiert
    report(v, 0);
    reportFar(card, false);
    expect(v.currentTime).toBe(0);
    report(v, 0.9); // zurueckgescrollt
    expect(v.paused).toBe(false);
    expect(v.currentTime).toBe(0);
  });

  it("setzt ein weit entferntes Video anhand des Kartenabstands zurueck", () => {
    const a = makeVideo();
    const b = makeVideo();
    registerViewportVideo(a, null, { card: makeCard(), index: 2 });
    registerViewportVideo(b, null, { card: makeCard(), index: 2 + RESET_DISTANCE_CARDS });
    report(a, 0.9);
    a.currentTime = 5;
    report(a, 0);
    report(b, 0.9); // 5 Karten weiter unten
    expect(b.paused).toBe(false);
    expect(a.paused).toBe(true);
    expect(a.currentTime).toBe(0);
  });

  it("startet automatisch stumm, solange keine Ton-Praeferenz gesetzt ist", () => {
    const v = makeVideo();
    v.muted = false;
    registerViewportVideo(v, null, { card: makeCard(), index: 0 });
    report(v, 0.9);
    expect(v.muted).toBe(true);
    expect(v.paused).toBe(false);
  });

  it("merkt die Ton-Praeferenz und startet das naechste Video mit Ton", async () => {
    const a = makeVideo();
    const off = registerViewportVideo(a, null, { card: makeCard(), index: 0 });
    report(a, 0.9);
    await vi.advanceTimersByTimeAsync(20);
    a.muted = false; // Nutzer schaltet Ton per Videosteuerung ein
    expect(isVideoSoundPreferred()).toBe(true);
    off();

    __setUserGestureForTests(true);
    const b = makeVideo();
    registerViewportVideo(b, null, { card: makeCard(), index: 1 });
    report(b, 0.9);
    expect(b.muted).toBe(false);
    expect(b.paused).toBe(false);
  });

  it("faellt auf stumm zurueck, wenn der Browser Ton-Autoplay ablehnt", async () => {
    __setUserGestureForTests(true);
    const v = makeVideo();
    let first = true;
    (
      v.play as unknown as { mockImplementation: (f: () => Promise<void>) => void }
    ).mockImplementation(() => {
      if (first && !v.muted) {
        first = false;
        return Promise.reject(new Error("NotAllowedError"));
      }
      v.paused = false;
      return Promise.resolve();
    });
    registerViewportVideo(v, null, { card: makeCard(), index: 0 });
    v.muted = false; // Praeferenz: Ton
    report(v, 0.9);
    await vi.advanceTimersByTimeAsync(20);
    expect(v.muted).toBe(true);
    expect(v.paused).toBe(false);
  });

  it("laedt nur das sichtbare Video vor und pausiert beim Abmelden", () => {
    const v = makeVideo();
    const off = registerViewportVideo(v, null);
    expect(v.preload).toBe("metadata");
    report(v, 0.9);
    expect(v.preload).toBe("auto");
    off();
    expect(v.paused).toBe(true);
  });
});
