import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Regression: Der ORB-Chat darf niemals den globalen Seiten-Viewport bewegen.
 * Ursache des Sprungs war scrollIntoView, das ALLE Vorfahren mitscrollt.
 */
const chat = readFileSync("src/components/orb/OrbChat.tsx", "utf8");

describe("ORB Chat – kein Sprung der Seite", () => {
  it("nutzt kein scrollIntoView mehr", () => {
    expect(chat).not.toContain("scrollIntoView");
  });

  it("scrollt nur den eigenen Verlaufsbereich", () => {
    expect(chat).toContain("ref={paneRef}");
    expect(chat).toContain("pane.scrollTop = pane.scrollHeight");
  });

  it("führt nur nach, wenn der Verlauf nahe am Ende steht", () => {
    expect(chat).toContain("pane.scrollHeight - pane.scrollTop - pane.clientHeight");
    expect(chat).toContain("distance <= 80");
  });

  it("setzt den Fokus ohne Scrollen", () => {
    expect(chat).toContain("focus({ preventScroll: true })");
    expect(chat).not.toMatch(/focus\(\)/);
  });
});
