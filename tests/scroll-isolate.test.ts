import { describe, expect, it } from "vitest";

/**
 * Overlay-Gesten (Messenger, Globe) duerfen nie als Feed-Gesten gelten.
 *
 * Node-Testlauf ohne DOM: `Element`/`Node` werden minimal nachgebildet, weil
 * `isIsolatedTarget` nur `instanceof` und `closest()` benutzt.
 */

class FakeNode {
  parentElement: FakeElement | null = null;
}

class FakeElement extends FakeNode {
  constructor(private readonly isolated = false) {
    super();
  }
  closest(selector: string): FakeElement | null {
    if (selector.includes("data-scroll-isolate") && this.isolated) return this;
    return this.parentElement ? this.parentElement.closest(selector) : null;
  }
}

const g = globalThis as unknown as { Element: unknown; Node: unknown };
g.Element = FakeElement;
g.Node = FakeNode;

const { isIsolatedTarget, SCROLL_ISOLATE_ATTR } = await import("../src/lib/scroll-isolate");

describe("scroll-isolate", () => {
  it("nutzt das vereinbarte Attribut", () => {
    expect(SCROLL_ISOLATE_ATTR).toBe("data-scroll-isolate");
  });

  it("erkennt Ziele innerhalb eines isolierten Overlays", () => {
    const overlay = new FakeElement(true);
    const list = new FakeElement();
    const item = new FakeElement();
    list.parentElement = overlay;
    item.parentElement = list;

    expect(isIsolatedTarget(overlay as unknown as EventTarget)).toBe(true);
    expect(isIsolatedTarget(item as unknown as EventTarget)).toBe(true);
  });

  it("laesst normale Feed-Ziele durch", () => {
    const feed = new FakeElement();
    const child = new FakeElement();
    child.parentElement = feed;

    expect(isIsolatedTarget(child as unknown as EventTarget)).toBe(false);
    expect(isIsolatedTarget(null)).toBe(false);
    expect(isIsolatedTarget(undefined)).toBe(false);
  });
});
