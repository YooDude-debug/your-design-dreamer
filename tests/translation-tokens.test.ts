import { describe, expect, it } from "vitest";
import {
  enforceProtectedTokens,
  extractProtectedTokens,
  maskProtectedTokens,
  unmaskProtectedTokens,
} from "@/lib/translation-tokens";

const POST = "Heute unterwegs in Berlin #Berlin #Travel\nhttps://example.com\n$sgf @mario";

describe("translation tokens", () => {
  it("erkennt Hashtags, SlangTags, Mentions und URLs", () => {
    expect(extractProtectedTokens(POST)).toEqual([
      "#Berlin",
      "#Travel",
      "https://example.com",
      "$sgf",
      "@mario",
    ]);
  });

  it("maskiert und stellt Tokens exakt wieder her", () => {
    const { masked, tokens } = maskProtectedTokens(POST);
    expect(masked).not.toContain("#Berlin");
    expect(unmaskProtectedTokens(masked, tokens)).toBe(POST);
  });

  it("erkennt $$-SlangTags als eigenes Token", () => {
    expect(extractProtectedTokens("Business $$deal heute")).toEqual(["$$deal"]);
  });

  it("stellt veränderte Tokens im Übersetzungsergebnis wieder her", () => {
    const translated = "Out and about in Berlin #Berlinn #Trip\nhttps://example.com\n$sgf @mario";
    expect(enforceProtectedTokens(POST, translated)).toBe(
      "Out and about in Berlin #Berlin #Travel\nhttps://example.com\n$sgf @mario",
    );
  });

  it("fällt auf das Original zurück, wenn Tokens verloren gehen", () => {
    expect(enforceProtectedTokens(POST, "Out and about in Berlin")).toBe(POST);
  });

  it("lässt reinen Fließtext unverändert", () => {
    expect(enforceProtectedTokens("Guten Morgen", "Good morning")).toBe("Good morning");
  });

  it("übersetzt Hashtags nie mit", () => {
    const out = enforceProtectedTokens("Gruß aus #Berlin", "Greetings from #Bearlin");
    expect(out).toContain("#Berlin");
    expect(out).not.toContain("#Bearlin");
  });

  it("lässt leere Übersetzungen unangetastet", () => {
    expect(enforceProtectedTokens(POST, "")).toBe("");
  });
});
