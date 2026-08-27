/**
 * Cache-Klassen der Medienauslieferung.
 *
 * Der Medienspeicher ist ein privater Bucket – Auslieferung nur über signierte
 * URLs. Die Cache-Vorgabe steuert daher den geräteeigenen Cache und muss
 * gemeinsam genutzte Caches (Proxy, CDN) ausdrücklich ausschließen.
 */
import { describe, expect, it } from "vitest";
import { cacheControlFor, mediaFolderOf } from "@/lib/media";

describe("Medien-Cache-Klassen", () => {
  it("unveränderliche öffentliche Medien werden lange gerätecacheeinbar ausgeliefert", () => {
    for (const folder of ["images", "avatars", "covers", "videos", "audio", "variants"] as const) {
      const cc = cacheControlFor(folder);
      expect(cc).toContain("immutable");
      expect(cc).toContain("max-age=31536000");
    }
  });

  it("unverpixelte Originale werden nirgends gespeichert", () => {
    const cc = cacheControlFor("originals");
    expect(cc).toBe("no-store");
  });

  // Der Speicher stellt jedem Wert `public, ` voran – ein eigenes `public`
  // würde daraus einen widersprüchlichen Header machen.
  it("keine Medienklasse setzt selbst public/private", () => {
    for (const folder of [
      "images",
      "avatars",
      "covers",
      "videos",
      "audio",
      "variants",
      "originals",
    ] as const) {
      expect(cacheControlFor(folder)).not.toMatch(/\b(public|private)\b/);
    }
  });

  it("erkennt den Ordner eines Speicherpfads", () => {
    expect(mediaFolderOf("uid/images/a.jpg")).toBe("images");
    expect(mediaFolderOf("uid/originals/a.jpg")).toBe("originals");
    expect(mediaFolderOf("a.jpg")).toBeNull();
  });
});
