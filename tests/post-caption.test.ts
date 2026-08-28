import { describe, expect, it } from "vitest";
import { isRedundantTitle } from "../src/lib/post-caption";

describe("isRedundantTitle", () => {
  it("erkennt identischen Titel", () => {
    expect(isRedundantTitle("arbeiten, arbeiten", "arbeiten, arbeiten")).toBe(true);
  });

  it("erkennt abgeschnittenen Titel (40 Zeichen)", () => {
    const desc = "Το νησι της Κυρα Φροσύνης!!!! απλα υπέροχα!!!";
    expect(isRedundantTitle(desc.slice(0, 40), desc)).toBe(true);
  });

  it("erkennt reine Hashtag-Caption", () => {
    const desc = "#chillin #frei #musik #breakingbenjamin";
    expect(isRedundantTitle(desc.slice(0, 40), desc)).toBe(true);
  });

  it("behaelt echte SlangTag-Titel", () => {
    expect(isRedundantTitle("$moin", "Guten Morgen aus Hamburg")).toBe(false);
  });

  it("behaelt Titel ohne Beschreibung", () => {
    expect(isRedundantTitle("Beitrag", "")).toBe(false);
  });

  it("ignoriert Gross-/Kleinschreibung und Mehrfach-Leerzeichen", () => {
    expect(isRedundantTitle("Hallo   Welt", "hallo welt und mehr")).toBe(true);
  });
});
