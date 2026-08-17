import QRCode from "qrcode";

/**
 * QR-Codes für SlangTags: Deep Link + deterministische Erzeugung.
 * Es wird nichts in der Datenbank oder im Storage gespeichert – der QR-Code
 * wird jederzeit aus der stabilen SlangTag-ID neu berechnet. Persistiert wird
 * nur die Info, dass der QR-Code in der Karte sichtbar bleiben soll.
 */

const REVEAL_KEY = "ydude.slangtag.qr.revealed";
const PUBLIC_ORIGIN = "https://y-dude.com";

/** Eindeutiger Deep Link auf einen SlangTag (immer per ID, nie per Name). */
export function slangTagDeepLink(tagId: string): string {
  const origin =
    typeof window !== "undefined" && window.location.origin.includes("y-dude.com")
      ? window.location.origin
      : PUBLIC_ORIGIN;
  return `${origin}/?slangtag=${encodeURIComponent(tagId)}`;
}

/** PNG-Data-URL in Druckqualität (scharf für Display, Flyer und Sticker). */
export async function renderSlangTagQr(tagId: string): Promise<string> {
  return QRCode.toDataURL(slangTagDeepLink(tagId), {
    width: 768,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}

function readRevealed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVEAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Bleibt ein QR-Code nach Reload sichtbar? */
export function isQrRevealed(tagId: string): boolean {
  return readRevealed().includes(tagId);
}

export function setQrRevealed(tagId: string, on: boolean): void {
  if (typeof window === "undefined") return;
  const next = on
    ? Array.from(new Set([...readRevealed(), tagId]))
    : readRevealed().filter((id) => id !== tagId);
  try {
    window.localStorage.setItem(REVEAL_KEY, JSON.stringify(next.slice(-200)));
  } catch {
    /* Speicher voll oder blockiert – QR bleibt nur für diese Sitzung sichtbar. */
  }
}

/** Data-URL als Datei-Blob (für Download und Web Share). */
export async function qrDataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], fileName, { type: "image/png" });
}
