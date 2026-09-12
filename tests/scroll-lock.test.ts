import { beforeEach, describe, expect, it } from "vitest";

/**
 * Zentrale Scroll-Sperre: nur der LETZTE Release darf entsperren – unabhaengig
 * von der Reihenfolge. Genau hier entstand vorher der Feed-Freeze.
 *
 * Der Testlauf ist bewusst reines Node (siehe vitest.config.ts). Deshalb wird
 * ein minimales Dokument mit `style`-Objekten bereitgestellt – geprueft wird
 * die Zaehlerlogik und was sie an `html`/`body` schreibt.
 */

const style = () => ({ overflow: "", overscrollBehaviorY: "", touchAction: "" });
const fakeDocument = {
  documentElement: { style: style() },
  body: { style: style() },
};

(globalThis as unknown as { document: unknown }).document = fakeDocument;

const { isScrollLocked, lockScroll, resetScrollLockForTests, scrollLockCount } =
  await import("../src/lib/scroll-lock");

const body = () => fakeDocument.body.style.overflow;
const root = () => fakeDocument.documentElement.style.overflow;
const touch = () => fakeDocument.body.style.touchAction;

describe("scroll-lock", () => {
  beforeEach(() => {
    resetScrollLockForTests();
  });

  it("sperrt und entsperrt einen einzelnen Lock", () => {
    const release = lockScroll();
    expect(isScrollLocked()).toBe(true);
    expect(body()).toBe("hidden");
    expect(root()).toBe("hidden");
    expect(fakeDocument.body.style.overscrollBehaviorY).toBe("none");
    release();
    expect(isScrollLocked()).toBe(false);
    expect(body()).toBe("");
    expect(root()).toBe("");
    expect(fakeDocument.body.style.overscrollBehaviorY).toBe("");
  });

  it("haelt die Sperre, solange ein weiterer Lock offen ist", () => {
    const a = lockScroll();
    const b = lockScroll();
    b();
    expect(isScrollLocked()).toBe(true);
    expect(body()).toBe("hidden");
    a();
    expect(isScrollLocked()).toBe(false);
    expect(body()).toBe("");
  });

  it("funktioniert bei beliebiger Release-Reihenfolge (A,B,C -> B,A,C)", () => {
    const a = lockScroll();
    const b = lockScroll();
    const c = lockScroll();
    b();
    a();
    expect(isScrollLocked()).toBe(true);
    c();
    expect(isScrollLocked()).toBe(false);
    expect(body()).toBe("");
  });

  it("ignoriert doppeltes Release und wird nie negativ", () => {
    const a = lockScroll();
    const b = lockScroll();
    a();
    a();
    a();
    expect(scrollLockCount()).toBe(1);
    expect(isScrollLocked()).toBe(true);
    b();
    expect(scrollLockCount()).toBe(0);
    expect(body()).toBe("");
  });

  it("Touch-Sperre gilt nur fuer ihren eigenen Lock", () => {
    const feed = lockScroll();
    const ad = lockScroll({ touch: true });
    expect(touch()).toBe("none");
    ad();
    expect(touch()).toBe("");
    expect(body()).toBe("hidden");
    feed();
    expect(body()).toBe("");
  });

  it("kein overflow:hidden bleibt nach dem letzten Release haengen", () => {
    const locks = [lockScroll(), lockScroll({ touch: true }), lockScroll()];
    for (const release of locks.reverse()) release();
    expect(body()).toBe("");
    expect(root()).toBe("");
    expect(touch()).toBe("");
    expect(scrollLockCount()).toBe(0);
  });
});
