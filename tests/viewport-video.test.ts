import { describe, it, expect, beforeEach, vi } from "vitest";

import { registerViewportVideo, __resetViewportVideos } from "@/lib/video/viewport-video";

/**
 * Viewport-basierte Videowiedergabe im Feed: nur sichtbare Videos laufen,
 * immer nur eines gleichzeitig, manuelle Bedienung hat Vorrang.
 */

type ObserverCb = (entries: IntersectionObserverEntry[]) => void;

const observers: { cb: ObserverCb; el: Element | null }[] = [];

class FakeIO {
  cb: ObserverCb;
  constructor(cb: ObserverCb) {
    this.cb = cb;
    observers.push({ cb, el: null });
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

function makeVideo() {
  const listeners = new Map<string, Set<(e?: unknown) => void>>();
  const el = {
    paused: true,
    ended: false,
    muted: true,
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
  const slot = observers.find((o) => o.el === el);
  slot?.cb([entryFor(el, ratio)]);
  vi.advanceTimersByTime(20);
}

describe("viewport video playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observers.length = 0;
    __resetViewportVideos();
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
