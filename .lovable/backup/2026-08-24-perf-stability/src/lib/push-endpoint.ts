/**
 * Serverseitige Pruefung von Web-Push-Adressen (SSRF-Schutz).
 *
 * Nur die Adressen der tatsaechlich genutzten Push-Dienste der Browser sind
 * erlaubt (Chrome/Edge = Google FCM, Firefox = Mozilla, Safari = Apple,
 * Windows = WNS). Alles andere – insbesondere interne Adressen, localhost,
 * private Netze oder abweichende Ports – wird abgelehnt, damit der Server
 * niemals an frei waehlbare Ziele sendet.
 */

/** Erlaubte Hosts (exakt) der offiziellen Push-Dienste. */
const EXACT_HOSTS = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

/** Erlaubte Host-Endungen der offiziellen Push-Dienste. */
const HOST_SUFFIXES = [
  ".push.apple.com",
  ".notify.windows.com",
  ".push.services.mozilla.com",
  ".push.services.microsoft.com",
];

/** true = Adresse gehoert zu einem unterstuetzten Push-Dienst. */
export function isAllowedPushEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // Nur verschluesselte Verbindungen, kein Benutzer/Passwort im Ziel.
  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  // Kein frei waehlbarer Port – nur der Standard-Port 443.
  if (url.port !== "") return false;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.includes("_")) return false;

  // Keine IP-Adressen (schliesst localhost, private, Loopback, Link-Local aus).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.startsWith("[") || host.includes(":")) return false;
  // Keine internen Hostnamen.
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (host === "localhost" || host.endsWith(".localhost")) return false;

  if (EXACT_HOSTS.has(host)) return true;
  return HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}
