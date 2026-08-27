/**
 * Zentrale AdSense-Konfiguration – die EINZIGE Stelle mit Publisher-ID und
 * Aktivierungsschalter.
 *
 * Die Publisher-ID (`ca-pub-…`) ist kein Geheimnis: Google liefert sie in jedem
 * Anzeigen-Script an den Browser aus. Sie wird deshalb als öffentliche
 * Build-Konfiguration (`VITE_ADSENSE_CLIENT_ID`) geführt, nicht als Secret.
 *
 * `VITE_ADSENSE_ENABLED` ist der bewusste Scharfschalter. Er bleibt aus, bis
 * Consent/CMP, Datenschutztexte, Google-Websiteprüfung und ads.txt abgeschlossen
 * sind. Ohne ihn wird kein AdSense-Script geladen und kein Platz vergeben.
 */

const readEnv = (key: string): string | undefined => {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

/** Publisher-ID aus der Build-Konfiguration ("ca-pub-…"). */
export const ADSENSE_CLIENT_ID = readEnv("VITE_ADSENSE_CLIENT_ID");

/** Ausdrückliche Scharfschaltung (Standard: aus). */
export const ADSENSE_ENABLED = readEnv("VITE_ADSENSE_ENABLED") === "true";

/** Script-URL – wird ausschließlich vom zentralen Loader verwendet. */
export function adsenseScriptUrl(clientId: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
}

/** Formal gültige Publisher-ID? */
export function isValidAdsenseClientId(id: string | undefined): id is string {
  return typeof id === "string" && /^ca-pub-\d{10,20}$/.test(id);
}

/** Erforderliche ads.txt-Zeile für eine Publisher-ID (Google-Vorgabe). */
export function adsTxtLine(clientId: string): string {
  // Google AdSense: "google.com, pub-<ID>, DIRECT, f08c47fec0942fa0"
  // (f08c47fec0942fa0 = TAG-ID von Google, identisch für alle AdSense-Konten).
  return `google.com, ${clientId.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0`;
}

/** Ist AdSense konfiguriert UND scharfgeschaltet? */
export function isAdsenseConfigured(): boolean {
  return ADSENSE_ENABLED && isValidAdsenseClientId(ADSENSE_CLIENT_ID);
}
