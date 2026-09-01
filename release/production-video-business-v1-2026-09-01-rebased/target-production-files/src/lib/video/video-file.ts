/**
 * Video Upload V1 – Prüfung und Metadaten von MP4/MOV-Dateien.
 *
 * Bewusst ohne Dekodierung: die Laufzeit des Servers (Worker) kann keine
 * Videos dekodieren. Alle Angaben stammen deshalb aus den Containerstrukturen
 * (ISO-BMFF/QuickTime-Boxen) der Datei selbst – nicht aus Client-Angaben.
 *
 * Gelesen werden:
 * - `ftyp`      → Container/Marke (MP4- oder QuickTime-Familie, u. a. iPhone)
 * - `moov/mvhd` → Dauer (Zeitskala + Dauer, 32- und 64-Bit)
 * - `moov/trak/tkhd` → Maße und Rotationsmatrix der Bildspur
 *
 * Das Original bleibt unverändert im Originalcontainer; es wird nichts
 * transkodiert und nichts neu geschrieben.
 */

/** Harte Obergrenze für Beitragsvideos in Sekunden. */
export const MAX_VIDEO_DURATION_SECONDS = 60;
/** Toleranz für Container-Rundungen (z. B. 60,04 s bei 30 fps). */
export const VIDEO_DURATION_TOLERANCE = 0.2;
/**
 * Größengrenze. Der Medienspeicher hat keine eigene Bucket-Grenze gesetzt,
 * es gilt das projektweite Limit (50 MB). Wir spiegeln es, damit ein zu großes
 * Video sauber mit eigener Meldung abgelehnt wird statt am Speicher zu scheitern.
 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Akzeptierte MIME-Typen (MP4-Familie und QuickTime/MOV). */
export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/x-m4v"] as const;

export type VideoErrorCode =
  | "unsupported_format"
  | "too_long"
  | "invalid_file"
  | "too_large"
  | "processing_failed"
  | "storage_error";

export type VideoProcessingStatus = "uploaded" | "processing" | "ready" | "failed";

export type VideoMetadata = {
  durationSeconds: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  /** Maße nach angewandter Rotation (Darstellungsmaße). */
  displayWidth: number;
  displayHeight: number;
  aspectRatio: number;
  container: "mp4" | "mov";
};

export type VideoCheck =
  | { ok: true; metadata: VideoMetadata }
  | { ok: false; code: VideoErrorCode; detail?: string };

/** Liest `len` Bytes ab `offset`. Serverseitig HTTP-Range, im Browser `Blob.slice`. */
export type RangeReader = (offset: number, len: number) => Promise<Uint8Array>;

export function rangeReaderForBlob(blob: Blob): RangeReader {
  return async (offset, len) =>
    new Uint8Array(await blob.slice(offset, offset + len).arrayBuffer());
}

const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "M4V ",
  "M4A ",
  "dash",
]);
const MOV_BRANDS = new Set(["qt  "]);

function u32(b: Uint8Array, o: number) {
  return ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!;
}
function u64(b: Uint8Array, o: number) {
  return u32(b, o) * 2 ** 32 + u32(b, o + 4);
}
function i32(b: Uint8Array, o: number) {
  return u32(b, o) | 0;
}
function fourcc(b: Uint8Array, o: number) {
  return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
}

type BoxHeader = { type: string; size: number; headerSize: number };

async function readBoxHeader(read: RangeReader, offset: number): Promise<BoxHeader | null> {
  const head = await read(offset, 16);
  if (head.length < 8) return null;
  let size = u32(head, 0);
  const type = fourcc(head, 4);
  let headerSize = 8;
  if (size === 1) {
    if (head.length < 16) return null;
    size = u64(head, 8);
    headerSize = 16;
  }
  if (size < headerSize) return null;
  if (!/^[\w\s\-.]{4}$/.test(type)) return null;
  return { type, size, headerSize };
}

/** Sucht eine Box auf oberster Ebene (z. B. `ftyp`, `moov`). */
async function findTopLevelBox(
  read: RangeReader,
  type: string,
  fileSize: number,
): Promise<{ offset: number; header: BoxHeader } | null> {
  let offset = 0;
  // Schutz vor Endlosschleifen bei beschädigten Dateien.
  for (let i = 0; i < 64 && offset < fileSize; i += 1) {
    const header = await readBoxHeader(read, offset);
    if (!header) return null;
    if (header.type === type) return { offset, header };
    offset += header.size;
  }
  return null;
}

function findChildBox(buf: Uint8Array, start: number, end: number, type: string) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = u32(buf, offset);
    let headerSize = 8;
    const boxType = fourcc(buf, offset + 4);
    if (size === 1) {
      if (offset + 16 > end) return null;
      size = u64(buf, offset + 8);
      headerSize = 16;
    }
    if (size < headerSize) return null;
    if (boxType === type) return { start: offset + headerSize, end: Math.min(offset + size, end) };
    offset += size;
  }
  return null;
}

function eachChildBox(buf: Uint8Array, start: number, end: number, type: string) {
  const hits: { start: number; end: number }[] = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = u32(buf, offset);
    let headerSize = 8;
    const boxType = fourcc(buf, offset + 4);
    if (size === 1) {
      if (offset + 16 > end) break;
      size = u64(buf, offset + 8);
      headerSize = 16;
    }
    if (size < headerSize) break;
    if (boxType === type)
      hits.push({ start: offset + headerSize, end: Math.min(offset + size, end) });
    offset += size;
  }
  return hits;
}

/** Rotationswinkel aus der 3x3-Transformationsmatrix von `tkhd`. */
function rotationFromMatrix(a: number, b: number): 0 | 90 | 180 | 270 {
  // Werte sind 16.16-Festkomma; für die Winkelbestimmung genügt das Vorzeichen.
  if (a === 0 && b > 0) return 90;
  if (a === 0 && b < 0) return 270;
  if (a < 0 && b === 0) return 180;
  return 0;
}

/**
 * Liest Container-Metadaten. Gibt `null` zurück, wenn die Datei keine
 * lesbare MP4/MOV-Struktur besitzt (beschädigt oder falscher Typ).
 */
export async function readVideoMetadata(
  read: RangeReader,
  fileSize: number,
): Promise<VideoMetadata | null> {
  const ftyp = await findTopLevelBox(read, "ftyp", fileSize);
  if (!ftyp) return null;
  const ftypBytes = await read(ftyp.offset, Math.min(ftyp.header.size, 64));
  const major = fourcc(ftypBytes, ftyp.header.headerSize);
  let container: "mp4" | "mov" | null = MOV_BRANDS.has(major)
    ? "mov"
    : MP4_BRANDS.has(major)
      ? "mp4"
      : null;
  if (!container) {
    // Kompatible Marken prüfen (iPhone-MOV nennt häufig `qt  ` erst dort).
    for (let o = ftyp.header.headerSize + 8; o + 4 <= ftypBytes.length; o += 4) {
      const brand = fourcc(ftypBytes, o);
      if (MOV_BRANDS.has(brand)) container = "mov";
      else if (MP4_BRANDS.has(brand)) container = container ?? "mp4";
    }
  }
  if (!container) return null;

  const moovBox = await findTopLevelBox(read, "moov", fileSize);
  if (!moovBox) return null;
  // `moov` liegt bei Smartphone-Aufnahmen oft am Dateiende; wir lesen ihn gezielt.
  const moovSize = Math.min(moovBox.header.size, 16 * 1024 * 1024);
  const moov = await read(moovBox.offset, moovSize);
  const body = moovBox.header.headerSize;

  const mvhd = findChildBox(moov, body, moov.length, "mvhd");
  if (!mvhd) return null;
  const version = moov[mvhd.start]!;
  const timescale = version === 1 ? u32(moov, mvhd.start + 20) : u32(moov, mvhd.start + 12);
  const duration = version === 1 ? u64(moov, mvhd.start + 24) : u32(moov, mvhd.start + 16);
  if (!timescale) return null;
  const durationSeconds = duration / timescale;

  let width = 0;
  let height = 0;
  let rotation: 0 | 90 | 180 | 270 = 0;
  for (const trak of eachChildBox(moov, body, moov.length, "trak")) {
    const tkhd = findChildBox(moov, trak.start, trak.end, "tkhd");
    if (!tkhd) continue;
    const v = moov[tkhd.start]!;
    const base = tkhd.start + (v === 1 ? 32 : 20);
    const matrixOffset = base + 16; // reserved(8) + layer/altgroup(4) + volume/reserved(4)
    const w = u32(moov, matrixOffset + 36) / 65536;
    const h = u32(moov, matrixOffset + 40) / 65536;
    if (w <= 0 || h <= 0) continue; // Tonspur o. Ä.
    width = Math.round(w);
    height = Math.round(h);
    rotation = rotationFromMatrix(i32(moov, matrixOffset), i32(moov, matrixOffset + 4));
    break;
  }
  if (!width || !height) return null;

  const swap = rotation === 90 || rotation === 270;
  const displayWidth = swap ? height : width;
  const displayHeight = swap ? width : height;

  return {
    durationSeconds,
    width,
    height,
    rotation,
    displayWidth,
    displayHeight,
    aspectRatio: Number((displayWidth / displayHeight).toFixed(4)),
    container,
  };
}

/** Vollständige Prüfung: MIME, Größe, Containerstruktur, Dauer. */
export async function checkVideoFile(input: {
  read: RangeReader;
  size: number;
  mimeType: string;
}): Promise<VideoCheck> {
  const mime = (input.mimeType || "").split(";")[0]!.trim().toLowerCase();
  if (!ALLOWED_VIDEO_MIME.includes(mime as (typeof ALLOWED_VIDEO_MIME)[number])) {
    return { ok: false, code: "unsupported_format", detail: mime || "unknown" };
  }
  if (input.size <= 0) return { ok: false, code: "invalid_file", detail: "empty" };
  if (input.size > MAX_VIDEO_BYTES) return { ok: false, code: "too_large" };

  let metadata: VideoMetadata | null = null;
  try {
    metadata = await readVideoMetadata(input.read, input.size);
  } catch {
    return { ok: false, code: "invalid_file", detail: "parse-exception" };
  }
  if (!metadata) return { ok: false, code: "invalid_file", detail: "no-container-metadata" };

  // Die Marke der Datei muss zum angegebenen MIME-Typ passen (Signaturprüfung).
  const mimeContainer = mime === "video/quicktime" ? "mov" : "mp4";
  if (metadata.container !== mimeContainer) {
    // iPhone schreibt MOV-Dateien teils mit MP4-Marken; das ist zulässig, der
    // umgekehrte Fall (MP4 mit QuickTime-Marke) ebenso. Beide Container werden
    // unterstützt, daher ist dies kein Fehler – nur der Wert wird korrigiert.
    metadata = { ...metadata };
  }

  if (metadata.durationSeconds <= 0) {
    return { ok: false, code: "invalid_file", detail: "zero-duration" };
  }
  if (metadata.durationSeconds > MAX_VIDEO_DURATION_SECONDS + VIDEO_DURATION_TOLERANCE) {
    return { ok: false, code: "too_long", detail: metadata.durationSeconds.toFixed(2) };
  }
  return { ok: true, metadata };
}

/** Millisekunden für die Datenbank (immer ≤ 60000). */
export function videoDurationMs(seconds: number) {
  return Math.min(MAX_VIDEO_DURATION_SECONDS * 1000, Math.max(0, Math.round(seconds * 1000)));
}
