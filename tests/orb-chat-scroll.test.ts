import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isNearChatBottom, shouldAutoFocusInput, splitLiveText } from "@/components/orb/OrbChat";

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

describe("ORB Chat – Live-Text und Auto-Follow", () => {
  it("baut kurze Antworten in Wortblöcken exakt auf", () => {
    const text = "Ich glaube, dass du damit richtig liegst.";
    const chunks = splitLiveText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(text);
  });

  it("erhält lange Antworten inklusive Absätzen und Leerraum exakt", () => {
    const text = `${"Ein längerer Satz mit Kontext. ".repeat(80)}\n\nAbschluss.`;
    expect(splitLiveText(text).join("")).toBe(text);
  });

  it("erkennt das Ende auch bei überlangem Chatinhalt über die 80px-Nähe", () => {
    expect(isNearChatBottom({ scrollHeight: 2400, scrollTop: 1520, clientHeight: 800 })).toBe(true);
    expect(isNearChatBottom({ scrollHeight: 2400, scrollTop: 1519, clientHeight: 800 })).toBe(
      false,
    );
  });

  it("deaktiviert Follow beim Hochscrollen und aktiviert es nahe unten erneut", () => {
    expect(isNearChatBottom({ scrollHeight: 1800, scrollTop: 400, clientHeight: 600 })).toBe(false);
    expect(isNearChatBottom({ scrollHeight: 1800, scrollTop: 1125, clientHeight: 600 })).toBe(true);
  });

  it("verwendet einen gebündelten Frame statt scrollIntoView pro Render", () => {
    expect(chat).toContain("requestAnimationFrame");
    expect(chat).toContain("followFrameRef.current !== null");
    expect(chat).not.toContain("scrollIntoView");
  });

  it("lässt bestehende Nachrichten vollständig und animiert nur neue ORB-Antworten", () => {
    expect(chat).toContain("knownMessageIdsRef");
    expect(chat).toContain('shouldAnimate ? "" : body');
    expect(chat).toContain('m.role === "orb"');
    expect(chat).toContain("pendingCycleRef.current");
  });

  it("hängt jede neue ORB-Antwort an und respektiert danach manuelles Scrollen", () => {
    expect(chat).toContain("autoFollowRef.current = true");
    expect(chat).toContain("scheduleFollow(true)");
    expect(chat).toContain("autoFollowRef.current = isNearChatBottom(event.currentTarget)");
    expect(chat).toContain("if (!force && !autoFollowRef.current) return;");
  });

  it("bereinigt Timer und Frames zwischen mehreren Antworten", () => {
    expect(chat).toContain("window.clearTimeout(timer)");
    expect(chat).toContain("window.cancelAnimationFrame(followFrameRef.current)");
  });
});

describe("ORB Chat – Tastatur öffnet sich nicht bei Live-Antwort (Mobile)", () => {
  // Regression 2026-09-27: Der Re-Fokus nach eintreffender ORB-Antwort
  // (pending → false) öffnete auf Touch-Geräten die Bildschirmtastatur,
  // obwohl der Nutzer nie ins Eingabefeld tippte.
  it("fokussiert programmatisch nur über die Touch-Prüfung", () => {
    const focusCalls = chat.match(/inputRef\.current\?\.focus\(\{ preventScroll: true \}\)/g) ?? [];
    expect(focusCalls.length).toBe(2);
    // Jeder programmatische Fokus ist hinter shouldAutoFocusInput() gegated:
    const gates = chat.match(/shouldAutoFocusInput\(\)\) inputRef\.current\?\.focus/g) ?? [];
    expect(gates.length).toBe(2);
  });

  it("leitet den Auto-Fokus aus der Touch-Geräte-Erkennung ab", () => {
    expect(chat).toContain('import { isTouchDevice } from "@/lib/mobile-keyboard"');
    // Ohne Touch-Umgebung (Tests/Desktop) bleibt das bisherige Verhalten:
    expect(shouldAutoFocusInput()).toBe(true);
  });

  it("fokussiert weder im Live-Text-Rendering noch im Auto-Follow den Input", () => {
    // OrbMessageBody (Live-Text) und scheduleFollow enthalten keinen Fokus:
    const messageBody =
      chat.split("function OrbMessageBody")[1]?.split("export function OrbChat")[0] ?? "";
    expect(messageBody).not.toContain("focus(");
    const follow = chat.split("const scheduleFollow")[1]?.split("const handleLiveStart")[0] ?? "";
    expect(follow).not.toContain("focus(");
  });
});
