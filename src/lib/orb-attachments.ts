/**
 * ORB Multimodal Composer – gemeinsame Prüfregeln für Bildanhänge.
 *
 * Diese Datei enthält KEINE ORB-Core-Logik: nur Validierung von Bilddaten
 * (Typ, Grösse, echte Signatur). Sie wird im Browser (vor dem Senden) und
 * serverseitig (erneute Prüfung) verwendet. Kein Datenbankzugriff, kein
 * Gedächtnis, keine Bildgenerierung.
 */

/** Formate, die die bestehende OpenAI-Sprachschicht tatsächlich verarbeitet. */
export const ORB_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

export type OrbImageMime = (typeof ORB_IMAGE_MIME_TYPES)[number];

/** Obergrenze je Bild (Kosten- und Missbrauchsschutz). */
export const ORB_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Bilder pro Nachricht. Die bestehende OpenAI-Chat-Schnittstelle nimmt mehrere
 * Bilder in einer Anfrage an; die Zahl bleibt trotzdem klein.
 */
export const ORB_IMAGE_MAX_COUNT = 3;

/** Ein Bild als flüchtiger Anfragekontext (niemals dauerhaft gespeichert). */
export type OrbImageAttachment = {
  mimeType: OrbImageMime;
  /** Reines Base64 ohne `data:`-Präfix. */
  dataBase64: string;
};

export const ORB_IMAGE_ACCEPT = ORB_IMAGE_MIME_TYPES.join(",");

export function isOrbImageMime(value: string): value is OrbImageMime {
  return (ORB_IMAGE_MIME_TYPES as readonly string[]).includes(value);
}

/** Echte Signatur der ersten Bytes – Dateiendungen werden nicht vertraut. */
export function sniffImageMime(bytes: Uint8Array): OrbImageMime | null {
  const at = (i: number) => bytes[i] ?? -1;
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "image/png";
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "image/jpeg";
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) return "image/gif";
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** Ungefähre Bytegrösse eines Base64-Strings (ohne Dekodierung). */
export function base64ByteLength(dataBase64: string): number {
  const clean = dataBase64.replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
}

export type OrbImageCheck = { ok: true; mimeType: OrbImageMime } | { ok: false; reason: string };

/** Erste Prüfung im Browser: gemeldeter Typ und Grösse. */
export function checkImageFile(file: { type: string; size: number }): OrbImageCheck {
  if (!isOrbImageMime(file.type)) {
    return { ok: false, reason: "Nur PNG, JPEG, WEBP oder GIF sind erlaubt." };
  }
  if (file.size > ORB_IMAGE_MAX_BYTES) {
    return { ok: false, reason: "Das Bild ist zu gross (höchstens 5 MB)." };
  }
  if (file.size <= 0) return { ok: false, reason: "Die Datei ist leer." };
  return { ok: true, mimeType: file.type };
}

/** Bytes aus Base64 lesen – ohne Node-spezifische Abhängigkeiten. */
export function base64Head(dataBase64: string, bytes = 16): Uint8Array {
  const chunk = dataBase64.slice(0, Math.ceil((bytes * 4) / 3) + 4);
  try {
    const binary = atob(chunk);
    const out = new Uint8Array(Math.min(binary.length, bytes));
    for (let i = 0; i < out.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array();
  }
}

/**
 * Zweite, verbindliche Prüfung (serverseitig): Grösse und echte Signatur.
 * Der gemeldete Typ muss mit der Signatur übereinstimmen.
 */
export function validateImageAttachment(input: {
  mimeType: string;
  dataBase64: string;
}): OrbImageCheck {
  if (!isOrbImageMime(input.mimeType)) {
    return { ok: false, reason: "Nicht unterstützter Bildtyp." };
  }
  if (!input.dataBase64 || /[^A-Za-z0-9+/=]/.test(input.dataBase64)) {
    return { ok: false, reason: "Ungültige Bilddaten." };
  }
  if (base64ByteLength(input.dataBase64) > ORB_IMAGE_MAX_BYTES) {
    return { ok: false, reason: "Das Bild ist zu gross (höchstens 5 MB)." };
  }
  const sniffed = sniffImageMime(base64Head(input.dataBase64));
  if (!sniffed) return { ok: false, reason: "Die Datei ist kein erlaubtes Bild." };
  if (sniffed !== input.mimeType) {
    return { ok: false, reason: "Dateityp und Bildinhalt stimmen nicht überein." };
  }
  return { ok: true, mimeType: sniffed };
}

/** Liste prüfen und auf die erlaubte Anzahl begrenzen. */
export function validateImageAttachments(
  items: { mimeType: string; dataBase64: string }[],
): { ok: true; images: OrbImageAttachment[] } | { ok: false; reason: string } {
  if (items.length > ORB_IMAGE_MAX_COUNT) {
    return { ok: false, reason: `Höchstens ${ORB_IMAGE_MAX_COUNT} Bilder pro Nachricht.` };
  }
  const images: OrbImageAttachment[] = [];
  for (const item of items) {
    const check = validateImageAttachment(item);
    if (!check.ok) return { ok: false, reason: check.reason };
    images.push({ mimeType: check.mimeType, dataBase64: item.dataBase64 });
  }
  return { ok: true, images };
}

/** Data-URL für den OpenAI-Bildblock bzw. die Vorschau. */
export function toImageDataUrl(image: OrbImageAttachment): string {
  return `data:${image.mimeType};base64,${image.dataBase64}`;
}
