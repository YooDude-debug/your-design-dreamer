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
