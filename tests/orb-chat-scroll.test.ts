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

  // Regression 2026-09-21: Die 80px-Näheprüfung greift beim ersten Rendern
  // nie (scrollTop=0, Historie bereits gerendert → distance > 80). Das
  // initiale Nach-unten-Scrollen muss daher EINMALIG und unabhängig von der
  // 80px-Schwelle erfolgen (CASE A), ohne die laufende Prüfung zu ändern
  // (CASE B/C) und ohne Fehlverhalten bei leerem Verlauf (CASE D).
  it("scrollt beim ersten Befüllen des Verlaufs einmalig ans Ende (CASE A)", () => {
    expect(chat).toContain("initialScrollDone");
    // Initialer Scroll ohne distance-Bedingung:
    expect(chat).toMatch(/if \(!initialScrollDone\.current\)/);
    // Nur einmalig:
    expect(chat).toContain("initialScrollDone.current = true");
  });

  it("behält die 80px-Näheprüfung für spätere Nachrichten bei (CASE B/C)", () => {
    const ongoing = chat.split("initialScrollDone.current = true")[1] ?? "";
    expect(ongoing).toContain("pane.scrollHeight - pane.scrollTop - pane.clientHeight");
    expect(ongoing).toContain("distance <= 80");
  });

  it("scrollt bei leerem Verlauf nicht und ohne Fehler (CASE D)", () => {
    expect(chat).toMatch(/if \(messages\.length > 0\)/);
  });

  it("setzt den Fokus ohne Scrollen", () => {
    expect(chat).toContain("focus({ preventScroll: true })");
    expect(chat).not.toMatch(/focus\(\)/);
  });
});
