/**
 * Werbefunktion – vorerst deaktiviert.
 *
 * Dieser Schalter ist bewusst als einfacher Feature-Flag angelegt:
 * - `false` = aktuell wird keine Werbekarte im Feed gerendert.
 * - Der Werbefeed-Balken bleibt sichtbar und zeigt "Werbepause".
 * - Alle Datenmodelle, Planungs- und Tracking-Logiken bleiben erhalten.
 *
 * Um Werbung später wieder zu aktivieren, reicht es, diesen Wert auf `true`
 * zu setzen. Dann greifen der bestehende Admin-Schalter, die Werbepause und
 * der Feed-Werbeplan wieder wie bisher.
 */
export const ADS_IN_FEED_ENABLED = false;
