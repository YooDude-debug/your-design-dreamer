/**
 * Medien – Variantenkette der Bildauslieferung.
 *
 * Regression-Schutz für P-01 (Feed-Bildvarianten): Karten dürfen niemals
 * ungefragt das Original laden, solange eine Variante existiert.
 */

import { describe, expect, it } from "vitest";
import { postCardImage, postFullImage, postPreviewImage, variantPath } from "@/lib/media";

const base = {
  image: "https://cdn.test/o/full.jpg",
  imageThumb: "https://cdn.test/o/full__t.webp",
  imageMedium: "https://cdn.test/o/full__m.webp",
  imagePath: "user/full.jpg",
};

describe("variantPath", () => {
  it("bildet Varianten immer als WebP ab", () => {
    expect(variantPath("user/a.jpg", "thumb")).toBe("user/a__t.webp");
    expect(variantPath("user/a.jpg", "medium")).toBe("user/a__m.webp");
  });

  it("erzeugt keine Varianten von Varianten oder externen URLs", () => {
    expect(variantPath("user/a__m.webp", "medium")).toBeNull();
    expect(variantPath("https://cdn.test/a.jpg", "thumb")).toBeNull();
    expect(variantPath("data:image/png;base64,xxx", "thumb")).toBeNull();
    expect(variantPath("user/noext", "thumb")).toBeNull();
    expect(variantPath(null, "thumb")).toBeNull();
  });
});

describe("Bildauswahl je Fläche", () => {
  it("Feedkarte nimmt Medium, nie das Original", () => {
    expect(postCardImage(base)).toBe(base.imageMedium);
    expect(postCardImage({ ...base, imageMedium: null })).toBe(base.imageThumb);
  });

  it("Detailansicht nimmt niemals das quadratische Thumbnail", () => {
    expect(postFullImage(base)).toBe(base.imageMedium);
    expect(postFullImage({ ...base, imageMedium: null })).toBe(base.image);
  });

  it("Vorschau bevorzugt bei SlangTag-Platzierungen die größere Variante", () => {
    expect(postPreviewImage({ ...base, placements: [{}] })).toBe(base.imageMedium);
    expect(postPreviewImage(base)).toBe(base.imageThumb);
  });

  it("greift nur ohne jede Variante auf das Original zurück", () => {
    const noVariants = { ...base, imageThumb: null, imageMedium: null };
    expect(postCardImage(noVariants)).toBe(base.image);
    expect(postPreviewImage(noVariants)).toBe(base.image);
  });
});
