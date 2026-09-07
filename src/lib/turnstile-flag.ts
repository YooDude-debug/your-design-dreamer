/**
 * Zentraler Schalter für Cloudflare Turnstile in Registrierung, Login,
 * Passwort-Reset und Bestätigungs-E-Mail.
 *
 * TEMPORÄR DEAKTIVIERT (2026-09-07) auf Wunsch des Betreibers, um den
 * Registrierungs- und Login-Funnel ohne CAPTCHA-Hürde zu messen.
 *
 * Wieder aktivieren: hier auf `true` setzen. Es ist nichts weiter nötig –
 * Widget, Client-Gate, Server-Prüfung (fail-closed) und die Secrets
 * `CLOUDFLARE_TURNSTILE_SITE_KEY` / `CLOUDFLARE_TURNSTILE_SECRET_KEY`
 * bleiben vollständig erhalten.
 */
export const TURNSTILE_ENABLED = false;
