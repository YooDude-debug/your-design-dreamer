/**
 * Video Upload V1 – Prüfung der Containeranalyse.
 *
 * Die Testdateien werden als echte ISO-BMFF/QuickTime-Strukturen erzeugt
 * (ftyp + moov/mvhd + moov/trak/tkhd), damit exakt der Weg getestet wird, den
 * der Server bei echten Uploads geht: Byte-Bereiche lesen, Boxen laufen,
 * Dauer/Maße/Rotation ableiten – ohne Dekodierung.
 */
import { describe, expect, it } from "vitest";
import {
  MAX_VIDEO_BYTES,
  checkVideoFile,
  readVideoMetadata,
  rangeReaderForBlob,
  videoDurationMs,
} from "@/lib/video/video-file";
import { frameStatsFromPixels, isWeakFrame } from "@/lib/video/video-thumbnail";
import { videoErrorMessage } from "@/lib/video/video-errors";
import { isOwnedVideoPath, videoThumbPath } from "@/lib/video/video-upload.shared";

const enc = new TextEncoder();

function box(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out.set(enc.encode(type), 4);
  out.set(payload, 8);
  return out;
}
function concat(parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
function u32be(values: number[]) {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint32(i * 4, v >>> 0));
  return out;
}

function ftyp(major: string, compatible: string[] = []) {
  return box("ftyp", concat([enc.encode(major), u32be([512]), enc.encode(compatible.join(""))]));
}

/** `mvhd` Version 0 mit Zeitskala 1000. */
function mvhd(durationSeconds: number) {
  const timescale = 1000;
  const payload = new Uint8Array(100);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0); // version + flags
  view.setUint32(12, timescale);
  view.setUint32(16, Math.round(durationSeconds * timescale));
  return box("mvhd", payload);
}

const ROTATION_MATRIX = {
  0: [0x00010000, 0],
  90: [0, 0x00010000],
  180: [-0x00010000, 0],
  270: [0, -0x00010000],
} as const;

function tkhd(width: number, height: number, rotation: 0 | 90 | 180 | 270) {
  const payload = new Uint8Array(84);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0); // version 0 + flags
  const matrixOffset = 20 + 16;
  const [a, b] = ROTATION_MATRIX[rotation];
  view.setInt32(matrixOffset, a);
  view.setInt32(matrixOffset + 4, b);
  view.setUint32(matrixOffset + 36, width * 65536);
  view.setUint32(matrixOffset + 40, height * 65536);
  return box("tkhd", payload);
}

/** Baut eine Datei; `moovAtEnd` bildet Smartphone-Aufnahmen ab. */
function makeVideo(opts: {
  brand: string;
  compatible?: string[];
  seconds: number;
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  moovAtEnd?: boolean;
  padding?: number;
}) {
  const moov = box(
    "moov",
    concat([mvhd(opts.seconds), box("trak", tkhd(opts.width, opts.height, opts.rotation ?? 0))]),
  );
  const mdat = box("mdat", new Uint8Array(opts.padding ?? 2048));
  const head = ftyp(opts.brand, opts.compatible);
  return new Blob([opts.moovAtEnd ? concat([head, mdat, moov]) : concat([head, moov, mdat])]);
}

async function check(blob: Blob, mimeType: string) {
  return checkVideoFile({ read: rangeReaderForBlob(blob), size: blob.size, mimeType });
}

describe("Videoprüfung – Container und Dauer", () => {
  it("akzeptiert MP4 im Hochformat 9:16", async () => {
    const blob = makeVideo({ brand: "isom", seconds: 12, width: 1080, height: 1920 });
    const result = await check(blob, "video/mp4");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.container).toBe("mp4");
    expect(result.metadata.aspectRatio).toBeCloseTo(0.5625, 3);
    expect(result.metadata.displayWidth).toBe(1080);
  });

  it("akzeptiert 16:9 und 1:1", async () => {
    const wide = await check(
      makeVideo({ brand: "mp42", seconds: 30, width: 1920, height: 1080 }),
      "video/mp4",
    );
    const square = await check(
      makeVideo({ brand: "mp42", seconds: 8, width: 1080, height: 1080 }),
      "video/mp4",
    );
    expect(wide.ok && wide.metadata.aspectRatio).toBeCloseTo(1.7778, 3);
    expect(square.ok && square.metadata.aspectRatio).toBe(1);
  });

  it("akzeptiert iPhone-MOV mit moov am Dateiende und Rotation 90°", async () => {
    const blob = makeVideo({
      brand: "qt  ",
      seconds: 20,
      width: 1920,
      height: 1080,
      rotation: 90,
      moovAtEnd: true,
      padding: 64 * 1024,
    });
    const result = await check(blob, "video/quicktime");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.container).toBe("mov");
    expect(result.metadata.rotation).toBe(90);
    // Rotation dreht die Darstellungsmaße: aus 1920x1080 wird 1080x1920.
    expect(result.metadata.displayWidth).toBe(1080);
    expect(result.metadata.displayHeight).toBe(1920);
  });

  it("erkennt QuickTime auch, wenn die Marke erst in den kompatiblen Marken steht", async () => {
    const blob = makeVideo({
      brand: "XXXX",
      compatible: ["qt  "],
      seconds: 5,
      width: 720,
      height: 1280,
    });
    const meta = await readVideoMetadata(rangeReaderForBlob(blob), blob.size);
    expect(meta?.container).toBe("mov");
  });

  it("akzeptiert exakt 60 Sekunden", async () => {
    const result = await check(
      makeVideo({ brand: "isom", seconds: 60, width: 720, height: 1280 }),
      "video/mp4",
    );
    expect(result.ok).toBe(true);
  });

  it("lehnt Videos über 60 Sekunden ab", async () => {
    const result = await check(
      makeVideo({ brand: "isom", seconds: 61.5, width: 720, height: 1280 }),
      "video/mp4",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("too_long");
  });

  it("lehnt fremde Formate ab, auch wenn die Datei gültig aussieht", async () => {
    const result = await check(
      makeVideo({ brand: "isom", seconds: 5, width: 720, height: 1280 }),
      "video/webm",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unsupported_format");
  });

  it("lehnt beschädigte Dateien ab", async () => {
    const result = await check(new Blob([new Uint8Array(4096)]), "video/mp4");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid_file");
  });

  it("lehnt zu große Dateien ohne Analyse ab", async () => {
    const result = await checkVideoFile({
      read: async () => new Uint8Array(0),
      size: MAX_VIDEO_BYTES + 1,
      mimeType: "video/mp4",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("too_large");
  });

  it("begrenzt die gespeicherte Dauer auf 60000 ms", () => {
    expect(videoDurationMs(60.12)).toBe(60000);
    expect(videoDurationMs(12.34)).toBe(12340);
  });
});

describe("Thumbnail-Auswahl", () => {
  it("erkennt schwarze und einfarbige Frames als untauglich", () => {
    const black = new Uint8ClampedArray(4 * 1000);
    expect(isWeakFrame(frameStatsFromPixels(black))).toBe(true);
  });

  it("akzeptiert Frames mit Bildinhalt", () => {
    const pixels = new Uint8ClampedArray(4 * 4000);
    for (let i = 0; i < pixels.length; i += 4) {
      const v = (i / 4) % 255;
      pixels[i] = v;
      pixels[i + 1] = 255 - v;
      pixels[i + 2] = 128;
      pixels[i + 3] = 255;
    }
    expect(isWeakFrame(frameStatsFromPixels(pixels))).toBe(false);
  });
});

describe("Pfade und Meldungen", () => {
  it("legt das Thumbnail neben das Video", () => {
    expect(videoThumbPath("u1/videos/abc.mov")).toBe("u1/videos/abc__t.webp");
    expect(videoThumbPath("kein-punkt")).toBeNull();
  });

  it("erlaubt nur eigene Videopfade", () => {
    expect(isOwnedVideoPath("u1/videos/a.mp4", "u1")).toBe(true);
    expect(isOwnedVideoPath("u2/videos/a.mp4", "u1")).toBe(false);
    expect(isOwnedVideoPath("u1/images/a.mp4", "u1")).toBe(false);
    expect(isOwnedVideoPath("u1/videos/../../x.mp4", "u1")).toBe(false);
  });

  it("liefert Meldungen in allen Sprachen", () => {
    for (const lang of ["de", "en", "el"] as const) {
      expect(videoErrorMessage("too_long", lang).length).toBeGreaterThan(5);
    }
  });
});
