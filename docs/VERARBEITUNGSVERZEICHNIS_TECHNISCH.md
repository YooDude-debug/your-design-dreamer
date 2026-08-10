# Y-Dude – Technische Übersicht der Verarbeitungsvorgänge

Stand: 2026-08-10. Grundlage für ein späteres Verzeichnis nach Art. 30 DSGVO
sowie für die technische Vorbereitung einer möglichen Datenschutz-Folgen-
abschätzung. **Keine rechtliche Bewertung, keine Rechtsgrundlagen, keine
erfundenen Fristen.** Rechtsgrundlagen und Fristen sind bewusst leer und mit
**OFFEN (rechtlich)** markiert.

Speicherort aller Anwendungsdaten: Datenbank und Medienspeicher der
Plattform (Lovable Cloud / Supabase). Alle Tabellen liegen im Schema `public`
mit aktiviertem Row Level Security.

---

## 1. Konto und Authentifizierung

- **Zweck:** Registrierung, Anmeldung, Sitzungsverwaltung, Passwort-Reset.
- **Datenkategorien:** E-Mail, Passwort-Hash, Geburtsdatum (Selbstauskunft,
  Jugendschutz), Bestätigungsstatus, Zeitstempel.
- **Betroffene:** registrierte Nutzer.
- **Speicherort:** Auth-Verwaltung der Plattform, Profil in `public.profiles`.
- **Externe Dienste:** Lovable (Betrieb, E-Mail-Versand), Supabase (Auth),
  Cloudflare (Turnstile beim Formularversand).
- **Datenfluss:** Formular → serverseitige Turnstile-Prüfung → Altersprüfung
  (`src/lib/age-policy.ts`) → Auth-Konto → Profilanlage (`ensureProfile`).
- **Löschmechanismus:** `deleteMyAccount` (`src/lib/account.server.ts`).
- **Schutzmaßnahmen:** HTTPS, Passwort-Hashing durch die Plattform, Turnstile,
  Ratenlimit, Protokollierung in `account_security_events`.

## 2. Profil und Sichtbarkeitseinstellungen

- **Zweck:** Darstellung des Nutzers, Steuerung der Sichtbarkeit.
- **Datenkategorien:** Benutzername, Anzeigename, ggf. Klarname, Biografie,
  Ort, Sprache, Avatar/Cover, Interessen, Links zu sozialen Profilen,
  Sichtbarkeits- und Präsenzangaben.
- **Speicherort:** `public.profiles`, Medien im Medienspeicher.
- **Datenfluss:** Eingabe im Profil → Speicherung → Anzeige nach
  Sichtbarkeitsregel (`can_view_profile`, `can_see_profile_field`,
  `profile_details`, `profile_locations`).
- **Löschmechanismus:** Kontolöschung; einzelne Felder jederzeit leerbar.
- **Schutzmaßnahmen:** feldbezogene Sichtbarkeit, RLS, Maskierung von
  Klarnamen bei privaten Profilen.

## 3. Beiträge, SlangTags, Kommentare

- **Zweck:** Bereitstellung der Kerninhalte der Plattform.
- **Datenkategorien:** Titel, Beschreibung, Hashtags, Bild, Audio,
  Platzierungen, Region, Sichtbarkeit, Zähler.
- **Speicherort:** `posts`, `slang_tags`, `comments`, `post_originals`,
  Medienspeicher.
- **Externe Dienste:** OpenAI/Google (Moderation, siehe 6).
- **Datenfluss:** Erstellung → Upload (Anzeigefassung + Original) →
  Moderationsjob → Sichtbarkeit gemäß `visibility` und RLS.
- **Löschmechanismus:** Einzellöschung durch Nutzer/Moderation,
  `delete_slang_tag`, Kontolöschung inkl. Originalmedien und Speicherobjekten.
- **Schutzmaßnahmen:** RLS (`can_view_post`, `can_read_media`), signierte bzw.
  geprüfte Medienzugriffe, Moderationsstatus.

## 4. Interaktionen und Reichweitenzähler

- **Zweck:** Soziale Funktionen und Anzeige von Kennzahlen.
- **Datenkategorien:** Likes, Saves, Shares, Views, Plays, Votes, Follows,
  jeweils mit Nutzer-ID und Zeitstempel.
- **Speicherort:** `post_likes`, `post_saves`, `post_shares`, `post_views`,
  `slang_tag_*`, `follows`, `arena_votes`, `arena_likes`, `arena_plays`,
  Aggregation über `counter_events` / `flush_counter_events()`.
- **Datenfluss:** Interaktion → Detailzeile → aggregierter Zähler am Inhalt.
- **Löschmechanismus:** Rücknahme der Interaktion, Kontolöschung.
- **Schutzmaßnahmen:** RLS pro Zeile; Arena-Engagement ist nur für Ersteller,
  ausschreibendes Unternehmen und Administration lesbar
  (`can_see_arena_engagement`); Liker-Listen nur bei sichtbarem Beitrag und
  unter Beachtung der Profileinstellung `likes_private`.

## 5. Connections, Chats und Nachrichten

- **Zweck:** Direkte Kommunikation zwischen Nutzern.
- **Datenkategorien:** Verbindungsanfragen und -status, Unterhaltungen,
  Mitgliedschaften, Nachrichteninhalte, Medien, Chat-SlangTags, Zeitstempel
  für Zustellung und Lesen.
- **Speicherort:** `connections`, `conversations`, `conversation_members`,
  `messages`, `chat_slang_tags`, Medienspeicher.
- **Datenfluss:** Senden → Speicherung → Abruf durch Mitglieder der
  Unterhaltung (Live-Aktualisierung).
- **Löschmechanismus:** Kontolöschung; einzelne Nachrichten durch den Absender.
- **Schutzmaßnahmen:** RLS über `is_conversation_member`, Trigger gegen
  Fremdbearbeitung (`guard_message_content_edits`,
  `guard_message_read_state_update`), Medienzugriff über `can_read_media`.
- **Hinweis:** **keine Ende-zu-Ende-Verschlüsselung**; Transport verschlüsselt
  (HTTPS). So auch in der Datenschutzerklärung (Abschnitt 10b) beschrieben.

## 6. Automatisierte Inhaltsmoderation (KI)

- **Zweck:** Erkennung unzulässiger Inhalte.
- **Datenkategorien:** Beitragstext, Kommentartext, Beitragsbild,
  SlangTag-Audio und dessen Transkript, Inhaltstyp.
- **Zeitpunkt:** bei Erstellung oder Änderung eines Inhalts (asynchron über
  `post_moderation_jobs` und den Worker `/api/public/moderation-run`).
- **Externe Dienste:** OpenAI und/oder Google.
- **Datenfluss:** Inhalt → Worker → externer KI-Dienst → Entscheidung
  (`approved` / `review` / `blocked`) → Protokoll in
  `content_moderation_log` bzw. `slang_tag_moderation_events` → ggf. manuelle
  Nachprüfung durch die Moderation.
- **Personenbezug:** möglich, da Inhalte Gesichter, Stimmen, Namen oder
  Ortsangaben enthalten können.
- **Löschmechanismus:** Inhalte mit Beitrag/Konto; Protokolle über die
  konfigurierbaren Löschläufe (`src/lib/retention.server.ts`).
- **Schutzmaßnahmen:** serverseitiger Aufruf mit Server-Secrets, keine
  Schlüssel im Frontend, Protokollierung der Entscheidungen.
- **OFFEN (rechtlich):** Auftragsverarbeitung und Drittlandtransfer.

## 7. Feed-Personalisierung und Interessenmodell

- **Zweck:** Reihenfolge und Auswahl der angezeigten Inhalte.
- **Datenkategorien:** Signale zu Ansichten, Verweildauer, Likes, Follows,
  Hashtag- und SlangTag-Bezügen, abgeleitete Interessen- und Vertrauenswerte.
- **Speicherort:** `feed_signals`, `feed_learned_weights`, `feed_score_cache`,
  `interaction_events`, `user_interests`, `interest_confidence`,
  `user_interest_scores`, `content_categories`.
- **Datenfluss:** Nutzung → Signal → gewichtetes Interessenprofil →
  Feed-Reihenfolge.
- **Löschmechanismus:** Reset der Personalisierung
  (`src/components/FeedResetSection.tsx`), Kontolöschung, konfigurierbare
  Löschläufe für Signale.
- **Schutzmaßnahmen:** RLS strikt auf `auth.uid()`; keine Weitergabe an Dritte.
- **Relevanz für eine DSFA:** Profiling.

## 8. Werbeausspielung

- **Zweck:** Einblendung von Bild- und Videowerbung im Feed.
- **Datenkategorien:** Interessenangaben (`ad_preferences`), Werbeschalter
  (`profiles.ads_enabled`), Werbepausen (`ad_pauses`), Kampagnen- und
  Testereignisse (`ad_campaigns`, `ad_test_events`).
- **Datenfluss:** Interessenmodell (siehe 7) → Auswahl der Werbemittel →
  Einblendung an definierten Positionen im Feed.
- **Löschmechanismus:** Reset der Personalisierung, Kontolöschung.
- **Schutzmaßnahmen:** RLS auf eigene Zeilen; Auslieferung ohne Weitergabe
  personenbezogener Daten an externe Werbenetzwerke (Werbemittel werden aus
  dem eigenen Bestand ausgeliefert).
- **Relevanz für eine DSFA:** personalisierte Werbung.

## 9. Standortauswahl / Reverse Geocoding

- **Zweck:** Ermittlung einer Ortsangabe für Profil und Beiträge.
- **Datenkategorien:** Koordinaten (nur bei ausdrücklicher Browser-Freigabe),
  zurückgelieferte Ortsangaben (Stadt, Region, Land).
- **Externer Dienst:** BigDataCloud (`api.bigdatacloud.net`,
  `src/components/LocationPicker.tsx`).
- **Datenfluss:** Klick auf Standortermittlung → Browser-Freigabe →
  Koordinaten an BigDataCloud → Ortsangabe → Speicherung der Ortsangabe.
- **Speicherung:** ausschliesslich die Ortsangabe (`profiles.location`,
  `posts.region`), **keine Koordinaten**.
- **Freiwilligkeit:** manuelle Eingabe ist gleichwertig möglich.
- **Schutzmaßnahmen:** Sichtbarkeitsstufe `location_visibility`,
  serverseitige Filterung über `profile_locations`.

## 10. Push-Benachrichtigungen

- **Zweck:** Zustellung von Hinweisen zu Interaktionen und Moderation.
- **Datenkategorien:** Push-Zustelladresse des Browseranbieters, Schlüssel,
  Angabe zum Browser, Fehlerzähler, Zeitstempel.
- **Speicherort:** `push_subscriptions`, Warteschlange `notification_jobs`,
  Inhalte in `notifications`.
- **Externe Dienste:** Push-Dienste der Browser-/Plattformanbieter
  (Google FCM, Mozilla, Apple, Microsoft).
- **Löschmechanismus:** Deaktivierung, `cleanup_push_data()`, Kontolöschung.
- **Schutzmaßnahmen:** Allowlist der Zustelldienste
  (`src/lib/push-endpoint.ts`), Worker nur mit Server-Secret erreichbar.

## 11. Missbrauchs-, Melde- und Administrationsvorgänge

- **Zweck:** Bearbeitung von Meldungen, Verwarnungen, Sperren.
- **Datenkategorien:** Meldegrund und -text, Melder- und Ziel-ID,
  Bearbeitungsstatus, administrative Eingriffe.
- **Speicherort:** `reports`, `user_warnings`, `user_bans`, `admin_audit_log`.
- **Löschmechanismus:** konfigurierbare Löschläufe; Bezug zu gelöschten Konten
  wird durch die Kontolöschung aufgelöst.
- **Schutzmaßnahmen:** RLS (Melder sieht eigene Meldungen, Bearbeitung nur
  Administration), Ratenlimit gegen Massenmeldungen
  (`enforce_report_rate_limit`).

## 12. Newsletter / Notify-Me

- **Zweck:** Benachrichtigung über den Start.
- **Datenkategorien:** E-Mail, Sprache, Zustimmungs- und
  Bestätigungszeitpunkt, Einmal-Token mit Ablauf, Versandzeitpunkt.
- **Speicherort:** `newsletter_subscribers`.
- **Externe Dienste:** Lovable (E-Mail-Versand), Cloudflare (Turnstile).
- **Datenfluss:** Eintragung → Turnstile-Prüfung → Bestätigungsmail →
  Bestätigung über Token → Status `verified`.
- **Schutzmaßnahmen:** Double Opt-in, Token-Ablauf, Cooldown, kein Lesezugriff
  über die Data API für Nutzer.

---

## Technische Vorbereitung einer Datenschutz-Folgenabschätzung

Zusammenstellung der Punkte mit erhöhter Prüfrelevanz. **Ob eine DSFA
erforderlich ist, wird hier ausdrücklich nicht entschieden.**

| Merkmal | Vorgang | Technische Fundstelle |
| --- | --- | --- |
| Profiling | Feed-Personalisierung, Interessenmodell | `src/lib/feed-ranking/`, `src/lib/interest-engine/` |
| Personalisierte Werbung | Auswahl der Werbemittel | `src/lib/ads/` |
| Automatisierte Entscheidungen | Sperren/Zurückhalten von Inhalten | Moderations-Worker, `moderation_status` |
| KI-Verarbeitung von Bild/Text | Inhaltsprüfung | siehe 6 |
| Audio-Transkription | SlangTag-Prüfung | `slang_tags.transcript` |
| Standortdaten | Reverse Geocoding | siehe 9 |
| Umfangreiche Interaktionsdaten | Signale und Zähler | siehe 4 und 7 |
| Minderjährigenschutz | Mindestalter 16 | `src/lib/age-policy.ts` |

Betroffenenrechte technisch vorhanden: Auskunft/Export, Löschung,
Sichtbarkeitssteuerung, Widerspruch gegen Personalisierung (Reset),
Werbeschalter.

**OFFEN (rechtlich):** Rechtsgrundlagen, Erforderlichkeits- und
Verhältnismäßigkeitsbewertung, Notwendigkeit einer DSFA, Fristen,
Auftragsverarbeitung und Drittlandtransfer.
