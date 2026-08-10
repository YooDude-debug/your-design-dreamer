# Y-Dude – Datenschutz-Technikdokumentation (Beta-Hardening)

Stand: 2026-08-10. Diese Datei dokumentiert **ausschliesslich den tatsächlich im
Code umgesetzten Datenfluss**. Sie enthält keine rechtliche Bewertung. Punkte,
die eine anwaltliche Klärung brauchen, sind als **OFFEN (rechtlich)** markiert.

## 1. Kontolöschung (DSGVO Art. 17)

- Server: `src/lib/account.functions.ts` → `deleteMyAccount`,
  Umsetzung in `src/lib/account.server.ts` → `deleteUserAccount`.
- Ablauf: Ratenlimit → Protokolleintrag → Passwortprüfung → Löschung.
- Gelöscht werden: Profil, Beiträge inkl. Originalmedien, Kommentare,
  Likes/Saves/Shares/Views, SlangTags und Freigaben, Connections, Chats und
  Nachrichten, Interessen-/Feedsignale, Push-Registrierungen, Benachrichtigungen,
  Arena-Daten, Medien im Storage sowie das Auth-Konto selbst.
- Reihenfolge: Anwendungsdaten → Speicherobjekte → Auth-Konto.
- Danach wird clientseitig abgemeldet und Local-/SessionStorage geleert
  (`src/components/AccountSection.tsx`).

## 2. Datenexport (DSGVO Art. 15/20)

- Server: `exportMyData` → `buildDataExport`.
- Format: ZIP mit maschinenlesbaren Datensätzen plus eigene Mediendateien.
- Zugriff über zeitlich befristeten Downloadlink (`EXPORT_TTL`).
- Absicherung: erneute Passworteingabe + Ratenlimit + Protokolleintrag.

## 3. Automatisierte Moderation

- Ablauf: Inhalt wird erstellt/geändert → Job in `post_moderation_jobs` bzw.
  SlangTag-Prüfung → Worker `/api/public/moderation-run`.
- Externe Dienste: OpenAI und/oder Google (Text, Bild, Audio/Transkript).
- Ergebnis: `moderation_status` = `pending` | `approved` | `review` | `blocked`.
- Menschliche Nachprüfung: Admin-Moderation (`src/routes/admin.moderation.tsx`),
  Meldungen über `reports`.
- Protokolle: `content_moderation_log`, `slang_tag_moderation_events`.
- Transparenz in der Datenschutzerklärung: Abschnitte 6b/6c.

## 4. Originalmedien

- Tabelle `post_originals` (Beitrags-ID, Eigentümer, Speicherpfad).
- Zugriff: eigener Nutzer bzw. Administration; RLS erlaubt kein Fremdlesen.
- Löschung: mit Beitrag bzw. Konto (siehe 1.).

## 5. Clientseitige Speicher

- Anmeldesitzung: LocalStorage-Schlüssel des Auth-Clients.
- Einstellungen: Sprache, Feed-Schalter, gesehene Hinweise.
- Zwischenspeicher: Inhalte und SlangTag-Audio.
- Push-Registrierung bei aktivierten Benachrichtigungen.
- Dokumentiert in Datenschutzerklärung Abschnitt 9b.

## 6. Drittdienste (technisch)

| Dienst | Zweck | Auslöser |
| --- | --- | --- |
| Lovable | Betrieb, Auslieferung, E-Mail-Versand | immer |
| Supabase | Datenbank, Auth, Medienspeicher | immer |
| Cloudflare | Auslieferung, Turnstile | Formulare |
| OpenAI / Google | Moderation | Inhaltserstellung |
| BigDataCloud | Reverse Geocoding | nur bei Standortfreigabe |
| Push-Dienste der Browserhersteller | Benachrichtigungen | nur bei Opt-in |

## 7. Cloudflare Turnstile

- Client: `src/components/Turnstile.tsx`; Server: `src/lib/turnstile.server.ts`.
- Serverseitige Token-Validierung ist aktiv; ohne gültiges Token bricht der
  Vorgang ab (Registrierung, Login, Passwort-Reset, Notify-Me).

## 8. Web Push

- Registrierung: `savePushDevice` (`src/lib/push.functions.ts`).
- SSRF-Schutz: strenge Allowlist in `src/lib/push-endpoint.ts`
  (FCM, Mozilla, Apple, WNS) – vor Speicherung und vor jedem Versand geprüft.
- Bereinigung: `cleanup_push_data()` entfernt inaktive bzw. dauerhaft
  fehlschlagende Registrierungen.

## 9. Mindestalter 16+

- Logik: `src/lib/age-policy.ts` (`MIN_AGE_YEARS = 16`).
- Client: Geburtsdatumsfeld im Registrierungsformular (`src/routes/auth.tsx`).
- Server: `signUpWithCaptcha` lehnt mit `status: "underage"` ab; das
  Geburtsdatum wird in den Signup-Metadaten geführt und beim Anlegen des
  Profils nach `profiles.birthday` übernommen (`ensureProfile`).
- Keine Ausweisprüfung.

## 10. Aufbewahrung / Löschläufe

- Regeln: `src/lib/retention.server.ts` (`RETENTION_RULES`).
- Steuerung über Umgebungswerte, z. B. `RETENTION_DAYS_ADMIN_AUDIT_LOG`.
  Ist ein Wert nicht gesetzt, wird für diese Tabelle **nichts** gelöscht.
- Ausführung: `POST /api/public/retention-run` (nur mit Server-Secret).
- **OFFEN (rechtlich):** konkrete Fristen je Protokolltyp.

## 11. Absicherung der Job-Endpunkte

Alle Endpunkte unter `/api/public/*` verlangen ein Server-Secret
(`x-worker-secret` oder `Authorization: Bearer`), timing-safe geprüft in
`src/lib/worker-auth.server.ts`:

- `moderation-run` → `MODERATION_CRON_TOKEN`
- `push-run` → `PUSH_CRON_TOKEN` / `MODERATION_CRON_TOKEN`
- `counters-run` → `COUNTERS_CRON_TOKEN` / `MODERATION_CRON_TOKEN`
- `bot-live-run` → `BOT_CRON_TOKEN` / `MODERATION_CRON_TOKEN`
- `retention-run` → `RETENTION_CRON_TOKEN` / `MODERATION_CRON_TOKEN`

## 12. E-Mail / Double Opt-in

- Absenderdomain `y-dude.com` ist verifiziert.
- Notify-Me: Bestätigungslink mit Einmal-Token und Ablaufzeit
  (`confirm_token`, `token_expires_at`), Cooldown gegen Mehrfachversand,
  Speicherung von `consent_at` und `confirmed_at`
  (`src/lib/newsletter.functions.ts`).

## 13. Personalisierung / Widerspruch

- Reset der Personalisierung: `src/components/FeedResetSection.tsx`
  (entfernt Feedsignale und Interessenwerte des eigenen Kontos).
- Werbeschalter: `profiles.ads_enabled` (`AdsMasterSwitch`).

## 14. Offene rechtliche Punkte

1. Rechtsgrundlagen und Speicherfristen je Verarbeitung.
2. Auftragsverarbeitung und Drittlandtransfer der unter 6. genannten Dienste.
3. Impressum: Telefon/unmittelbarer Kontaktweg, USt-IdNr., Streitbeilegung
   (technisch vorbereitet in `src/routes/impressum.tsx`).
4. Verbindliche Aufbewahrungsfristen für technische Protokolle.
