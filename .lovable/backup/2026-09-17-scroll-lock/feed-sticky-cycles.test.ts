import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression: DOWN -> DOCK -> UP -> RESET -> sofort DOWN -> DOCK muss beliebig
 * oft funktionieren. Vorher blockierte der 420-ms-Nachlauf von `exit()` das
 * naechste `enter()`, weil beide dieselbe `busy`-Sperre teilen.
 */
const src = readFileSync(path.join(process.cwd(), "src/lib/use-feed-mode.ts"), "utf8");

describe("feed sticky: wiederholte Andock-Zyklen", () => {
  it("enter() wird von einem laufenden Exit-Nachlauf nicht blockiert", () => {
    expect(src).toContain("const exitPending = exitTimer.current !== null;");
    expect(src).toContain("if (busy.current && !exitPending) return;");
  });

  it("enter() bricht den laufenden Exit-Timer ab", () => {
    const enterBlock = src.slice(
      src.indexOf("const enter = useCallback"),
      src.indexOf("const exit = useCallback"),
    );
    expect(enterBlock).toContain("clearExitTimer();");
  });

  it("exit() nutzt einen abbrechbaren Timer statt eines anonymen setTimeout", () => {
    expect(src).toContain("exitTimer.current = window.setTimeout(");
    expect(src).not.toMatch(/window\.setTimeout\(\(\)\s*=>\s*\(busy\.current = false\), 420\)/);
  });

  it("ein alter Nachlaeufer setzt einen neuen Zustand nicht zurueck", () => {
    expect(src).toContain("const phase = useRef(0);");
    expect(src).toMatch(/if \(phase\.current !== token\) return;/);
    expect(src.match(/if \(phase\.current !== token\) return;/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("der Exit-Timer wird beim Unmount aufgeraeumt", () => {
    expect(src).toContain("useEffect(() => clearExitTimer, [clearExitTimer]);");
  });
});

/**
 * Regression: Nach dem ersten Ausrasten darf die Andockhoehe nicht neu aus einem
 * beliebigen `<header>` gemessen werden. Sonst trifft die Messung die erste
 * Beitragskarten-Kopfzeile im Feed, `--yd-header-h` weicht von `headerH` ab und
 * der zweite Andockvorgang wird nie mehr erkannt.
 */
describe("feed sticky: Andockhoehe bleibt ueber Zyklen identisch", () => {
  it("misst ausschliesslich die gekennzeichnete globale Kopfleiste", () => {
    expect(src).toContain('document.querySelector<HTMLElement>("header[data-app-header]")');
    // Kommentare ausblenden: dort wird die alte Messung nur noch erklaert.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/querySelector\("header"\)/);
  });

  it("stellt beim Ausrasten genau den gemessenen Wert wieder her", () => {
    expect(src).toContain('root.style.setProperty("--yd-header-h", `${headerHRef.current}px`)');
  });

  it("setzt Root-Klasse und Andockhoehe vor dem ersten Paint des fixierten Layouts", () => {
    const layoutEffectStart = src.indexOf("useLayoutEffect(() => {");
    const layoutEffectEnd = src.indexOf("}, [enabled, feedMode, releaseEagerLock]);", layoutEffectStart);
    const layoutEffect = src.slice(layoutEffectStart, layoutEffectEnd);

    expect(layoutEffectStart).toBeGreaterThan(-1);
    expect(layoutEffect).toContain('root.classList.add("yd-feedmode")');
    expect(layoutEffect).toContain('root.style.setProperty("--yd-header-h", "0px")');
  });

  it("committet beim Andocken das fixe Layout vor Scroll-Sperre und Scroll-Reset", () => {
    const enterBlock = src.slice(
      src.indexOf("const enter = useCallback"),
      src.indexOf("const exit = useCallback"),
    );
    const commitAt = enterBlock.indexOf("flushSync(() => {");
    const lockAt = enterBlock.indexOf("eagerLock.current = lockScroll();");
    const resetAt = enterBlock.indexOf("window.scrollTo(0, 0);");

    expect(commitAt).toBeGreaterThan(-1);
    expect(enterBlock.slice(commitAt, lockAt)).toContain("setFeedMode(true);");
    expect(commitAt).toBeLessThan(lockAt);
    expect(commitAt).toBeLessThan(resetAt);
  });

  it("laesst den bereits korrigierten Abdock-Ablauf unveraendert asynchron", () => {
    const exitBlock = src.slice(src.indexOf("const exit = useCallback"), src.indexOf("/** Einrast-Zustand"));
    expect(exitBlock).not.toContain("flushSync");
    expect(exitBlock).toContain("setFeedMode(false);");
  });
});
