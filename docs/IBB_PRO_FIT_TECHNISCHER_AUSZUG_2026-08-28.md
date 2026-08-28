# Y-Dude – Technischer Auszug für einen Förderantrag (IBB / Pro FIT)

**Erstellt:** 28. August 2026, 07:25 UTC
**Messgrundlage:** aktueller Projektstand (Quellcode-Repository und produktiv genutzte Datenbank)
**Charakter:** technische Ist-Dokumentation, keine Marktaussagen, keine Prognosen

Alle Zahlen in diesem Dokument stammen aus direkten Messungen am Projekt (siehe Abschnitt „Datenbasis und Messzeitpunkt“). Wo keine belastbaren Daten vorliegen, ist dies ausdrücklich vermerkt.

---

## 1. Executive Summary

**Was ist Y-Dude?**
Y-Dude ist eine als Web-Anwendung (PWA) implementierte soziale Plattform, deren inhaltliches Kernelement ein „SlangTag“ ist: eine kurze Audioaufnahme, die als benennbares, wiederverwendbares Objekt an Bild-/Videobeiträge, Kommentare und Chats gebunden werden kann. Ergänzend existieren Feed, Profile, Connections, Messenger, Marktplatz, Channels sowie zwei Discovery-Oberflächen (Slang Globe, Slang Arena).

**Welche technische Plattform wurde bereits entwickelt?**
Eine vollständig lauffähige Full-Stack-Anwendung auf Basis von TanStack Start (React 19, SSR, Server Functions) mit PostgreSQL-Backend (Supabase-Stack: Auth, Storage, Realtime, Row Level Security). Frontend, Backend-Logik, Datenmodell, Moderation, Zahlungsanbindung und Betriebs-/Monitoring-Funktionen liegen in einer Codebasis.

**Zentrale technologische Komponenten (vorhanden):**

- Datenmodell mit 116 Tabellen, 285 RLS-Policies, 162 Datenbankfunktionen (davon 113 `SECURITY DEFINER`), 127 Trigger, 318 Indizes
- 234 Server-Function-Aufrufstellen (`createServerFn`) als typisierte RPC-Schicht plus 8 öffentliche HTTP-Endpunkte (Webhooks/Worker)
- Asynchrone KI-gestützte Inhaltsmoderation (Text, Bild, Audio-Transkript) über Jobtabellen und Worker-Endpunkt
- Feed-Ranking- und Interessenmodell als eigene Modulschichten (`src/lib/feed-ranking/`, `src/lib/interest-engine/`)
- Medienpipeline mit privatem Storage-Bucket, Bildvarianten, signierten URLs und mehrstufigem Cache
- Stripe-Anbindung inkl. signaturgeprüftem, idempotentem Webhook
- Web-Push (VAPID) mit gebündelten Benachrichtigungen
- DSGVO-Funktionen: Datenexport, Kontolöschung, Sichtbarkeitssteuerung, Personalisierungs-Reset, Retention-Läufe
- Betriebsschicht: Health-Checks, Alarmkanäle, Vorfallstabelle, Admin-Cockpit

**Technischer Reifegrad (aktuell erkennbar):**
Funktional weit ausgebaut; Build und Typecheck fehlerfrei; 480 automatisierte Unit-/Logiktests laufen vollständig durch. Nicht belegt sind bislang: Verhalten unter realer Nutzerlast, getrennte Staging-Infrastruktur, gemessene Zeilenabdeckung der Tests.

**Wichtigster technologischer Differenzierungsansatz:**
Der SlangTag ist – anders als ein Hashtag – kein reiner Textstring, sondern ein persistentes Datenbankobjekt mit Audio-Asset, Eigentümerschaft, Sprache, Region, Typ (Community/Creator/Business), Moderationsstatus, Nutzungs- und Reichweitenzählern sowie Beziehungen zu Beiträgen, Chats, Votings und Geodarstellung. Daraus ergibt sich eine referenzierbare, moderierbare und regional auswertbare Audio-Entität statt einer freien Zeichenkette.

---

## 2. Technischer Ist-Zustand (gemessen)

### 2.1 Code

Gezählt wurde der aktive Anwendungscode; ausgeschlossen sind Backupkopien (`.lovable/backup/`, `backups/`), der generierte Route-Tree, Videoproduktions-Assets (`remotion/`) und Build-Artefakte.

| Kategorie | Wert |
| --- | --- |
| TypeScript (`.ts`) | 60.089 Zeilen |
| React/TSX (`.tsx`) | 44.965 Zeilen |
| SQL (Migrationen) | 11.784 Zeilen |
| CSS | 628 Zeilen |
| JS (Service Worker u. a.) | 216 Zeilen |
| **Summe aktiver Code** | **117.682 Zeilen** |
| Dateien im aktiven Umfang | 755 |

Struktur:

| Bereich | Dateien |
| --- | --- |
| `src/lib` (Domänen-/Serverlogik) | 279 |
| `src/components` (UI) | 129 |
| `src/routes` (Routen inkl. API) | 69 (davon 8 unter `src/routes/api/public/`) |
| `supabase/migrations` | 226 |
| `tests` | 34 (24 Dateien Top-Level, 9 in `tests/e2e`) |

Fachliche Teilmodule in `src/lib`: `ads/`, `feed-ranking/`, `interest-engine/`, `globe/`, `video/`, `legal/`, `email-templates/`.

### 2.2 Datenbank (gemessen in der laufenden Instanz)

| Metrik | Wert |
| --- | --- |
| Tabellen (Schema `public`) | 116 |
| Tabellen mit aktivem Row Level Security | 116 (100 %) |
| RLS-Policies | 285 |
| Datenbankfunktionen | 162 |
| davon `SECURITY DEFINER` | 113 |
| Trigger (nicht-intern) | 127 |
| Indizes | 318 |
| Views | 0 |
| Migrationsdateien | 226 |
| Datenbankgröße | 78 MB |
| Auth-Konten | 22 |

Inhaltsbestand zum Messzeitpunkt (Entwicklungs-/Testdaten, **keine Marktzahlen**): 33 Beiträge, 11 SlangTags, 14 Profile, 120 Nachrichten, 2 Marktartikel, 2 Channels, 2 Arena-Challenges.

### 2.3 Backend-/API-Struktur

- Typisierte RPC-Schicht: 234 Verwendungen von `createServerFn` in 35 Modulen; Eingaben werden über Zod validiert.
- Authentifizierte Server Functions laufen über eine Middleware, die den Nutzerkontext setzt; RLS greift als zweite Ebene.
- Öffentliche HTTP-Endpunkte unter `src/routes/api/public/` (8 Dateien): Zahlungs-Webhook, Moderations-Worker, Push-Worker, Zählerabgleich, Retention-Lauf, Betriebs-Health-Lauf, Cache-Metriken, Beta-Launch-Lauf. Alle mit eigener Authentifizierung (Signaturprüfung bzw. Server-Secret).
- Privilegierte Datenbankzugriffe erfolgen ausschließlich serverseitig (39 Module referenzieren den Admin-Client).

### 2.4 Frontend

React 19 mit TanStack Router (dateibasiertes Routing, SSR), TanStack Query für Datenzugriff, Tailwind CSS v4 mit semantischen Design-Tokens, Three.js für die 3D-Globusdarstellung, Lazy Loading für schwere Dialoge und Ansichten, PWA mit Service Worker und Push.

### 2.5 Build, Typecheck, Tests

| Prüfung | Ergebnis (28.08.2026) |
| --- | --- |
| Produktionsbuild | erfolgreich („build OK“) |
| `tsc --noEmit` | fehlerfrei |
| `vitest run` | 21 Dateien, 480 Tests, 480 bestanden, 0 fehlgeschlagen |
| DB-Integrationstests | vorhanden (`tests/integration/`), laufen nur mit gesetztem Datenbankzugang |
| E2E-Tests (Playwright) | vorhanden (9 Dateien), laufen gegen lokal laufende Anwendung |
| Freigabe-Skript | `scripts/verify.sh` (Typecheck → Lint → Tests → optional DB/E2E) |

### 2.6 Sicherheit, Authentifizierung, Rollen (vorhanden)

- Authentifizierung über den Supabase-Auth-Dienst (E-Mail/Passwort, Passwort-Reset, Bestätigungsmails); Altersprüfung ab 16 (`src/lib/age-policy.ts`).
- Bot-Abwehr per Cloudflare Turnstile mit serverseitiger Verifikation.
- Rollen in separater Tabelle `user_roles` mit Enum `app_role` und `SECURITY DEFINER`-Funktion `has_role()`; keine Rollenfelder auf Profil-/Nutzertabellen.
- Zugriffskontrolle durchgängig über RLS (116 von 116 Tabellen aktiv) plus explizite `GRANT`-Vergabe je Rolle.
- Schreibpfade für Beiträge sind für den Browser gesperrt; Änderungen laufen über serverseitige Moderationsprüfung.
- Rate-Limits u. a. für Meldungen (`enforce_report_rate_limit`) und Registrierungs-/Newsletterpfade.
- Sicherheitsereignisse in `account_security_events`, administrative Eingriffe in `admin_audit_log`.

---

## 3. Bestehende Produkt- und Technologiekomponenten

| Bereich | Was existiert | Technische Funktion | Backend-/DB-Komponenten |
| --- | --- | --- | --- |
| Social Feed | Endlos-Feed mit Tabs (Lokal, Global, Trending, Folge ich), Keyset-Pagination, AutoPlay-Schalter, Scroll-Restore | Auslieferung und Rangfolge der Inhalte, Diversitätslogik gegen Monokultur im Feed | `posts`, `feed_signals`, `feed_learned_weights`, `feed_score_cache`, `src/lib/feed-ranking/` |
| Profile | Profilseiten mit Sichtbarkeitsstufen, Präsenzstatus, Feldsichtbarkeit, Follower-/Like-Dialoge, Profil-Teilen | Darstellung und feldgenaue Freigabe personenbezogener Angaben | `profiles`, `profile_details`, `profile_locations`, `can_view_profile`, `can_see_profile_field` |
| Connections | Anfragen, Bestätigung, Vorschläge, Suche, Tab-gesteuerter Einstieg | Aufbau des sozialen Graphen | `connections`, `follows`, Vorschlagslogik in `src/lib/connection-suggestions.ts` |
| Messenger | 1:1-Chats, Bild-/Audioversand, Chat-SlangTags, Lesestatus, Tippen-Anzeige, getrennte Connections-/Market-Listen | Echtzeitkommunikation über kanalgebundene Realtime-Topics | `conversations`, `conversation_members`, `messages`, `chat_slang_tags`, `is_conversation_member`, Trigger gegen Fremdbearbeitung |
| Übersetzung | Beitrags- und Kommentarübersetzung mit Erhalt der Originalsprache, Kontingentbehandlung, Persistenz | Sprachübergreifende Lesbarkeit ohne Verlust des Originals | `posts.source_language`, Übersetzungs-Server-Functions, KI-Gateway |
| Market | Inserate, Kategorien, Suche (tsvector), Favoriten, Promotion, Transaktionen, Checkout, Bestellungen, „Mein Market“ | Marktplatz mit Transaktions- und Statuslogik | `market_items`, `market_transactions`, `market_fee_settings`, `market_seller_profiles`, Stripe-Webhook |
| Channels | Öffentliche Channels, Kategorien, Folgen, eigene Verwaltungsseite, Beitragszuordnung | Thematische Bündelung von Inhalten | `channels`, `channel_follows`, `channel_categories`, Beitragsfelder `channel_id`, `channel_approved_at` |
| SlangTags | Aufnahme (1–5 s), Trimmen, Platzierung/Skalierung/Rotation auf Medien, Typen Community/Creator/Business, Detailseiten, Suche | Audio-Entität als referenzierbares Inhaltsobjekt | `slang_tags`, `post_slang_tags`, `chat_slang_tags`, `slang_tag_votes`, Moderations- und Zählertabellen |
| Slang Globe | 3D-Weltkugel (Three.js) mit Regionen-Overlay, Heatmap, LOD, Inertia-Steuerung | Geografische Discovery regionaler Sprachvarianten | `slang_tags.region`, Geodaten in `src/data/`, `src/lib/globe/` |
| Slang Arena | Voting-Oberfläche, Challenges durch Creator-/Business-Konten, Engagement-Auswertung | Kuratierung und Wettbewerb um SlangTags | `arena_challenges`, `arena_votes`, `arena_likes`, `arena_plays`, `can_see_arena_engagement` |
| Moderation | Asynchrone KI-Prüfung von Text, Bild und Audio-Transkript; Status `approved`/`review`/`blocked`; manuelle Nachprüfung im Admin-Bereich; Einspruchsverfahren | Rechtssichere Inhaltsfreigabe und Nachvollziehbarkeit | `post_moderation_jobs`, `content_moderation_log`, `slang_tag_moderation_events`, Worker `/api/public/moderation-run` |
| Werbung | Adapter-Architektur mit Provider-Registry, eigener Werbebestand, Testmodus, Werbepausen, TCF-v2.2-Gating; AdSense-ID hinterlegt, aber nicht aktiv | Einblendung an definierten Feed-Positionen ohne Datenweitergabe an externe Netze | `ad_campaigns`, `ad_preferences`, `ad_pauses`, `ad_test_events`, `src/lib/ads/` |
| Admin-System | Cockpit mit Moderation, Statistiken, Health, Logs, Nutzer-/Beitragsverwaltung, Livetest, Werbeverwaltung (ca. 20 Admin-Routen) | Betriebs- und Moderationssteuerung | `admin_audit_log`, `ops_incidents`, Admin-Server-Functions |
| DSGVO/Datenschutz | Datenexport, Kontolöschung inkl. Medien, Personalisierungs-Reset, Sichtbarkeitssteuerung, Werbeschalter, Transparenzbericht, Double-Opt-in-Newsletter | Umsetzung der Betroffenenrechte im Produkt | `src/lib/account.server.ts`, `src/lib/retention.server.ts`, `newsletter_subscribers`, Route `/transparenz` |
| Zahlung/Monetarisierung | Stripe-Integration für Market-Transaktionen und Promotion-Pakete, signaturgeprüfter idempotenter Webhook, Gebühreneinstellungen | Abwicklung entgeltlicher Vorgänge | `stripe`-SDK, `src/routes/api/public/payments/webhook.ts`, `market_fee_settings` |

---

## 4. SlangTag als technologischer Innovationskern

### 4.1 Datenmodell (tatsächliche Spalten in `slang_tags`)

Die Tabelle enthält u. a.:

- **Identität/Inhalt:** `id`, `name`, `normalized_name`, `audio_url`, `duration`, `description`, `meaning`, `examples[]`, `transcript`
- **Sprache/Region:** `language`, `region`, `location`
- **Eigentümerschaft/Typ:** `creator_id`, `owner_id`, `owner_type`, `kind`, `company`, `verification_status`, `community_shared`
- **Verfügbarkeit/Jahrgang:** `released_at`, `drop_release_date`, `drop_limit`, `drop_expires`, `drop_rarity`, `unlock_type`, `follow_required`, `deleted_at`
- **Nutzung/Reichweite:** `uses_count`, `video_uses_count`, `plays_count`, `likes_count`, `saves_count`, `shares_count`, `comments_count`, `reach_count`, `clicks_count`, `conversion_count`
- **Business-Verknüpfung:** `sponsored`, `logo_url`, `cta_type`, `cta_url`, `discount_code`, `voucher`, `company_url`, `opening_hours`, `phone`
- **Moderation:** `moderation_status`, `moderation_reason`, `moderation_labels[]`, `moderation_is_music`, `moderation_confidence`, `moderation_ai`, `moderated_at`, `moderated_by`

### 4.2 Beziehungen

- `posts.slang_tag_ids[]` und `posts.placements` (JSONB) verbinden einen SlangTag mit einem Beitrag **inklusive Position, Skalierung und Rotation auf dem Medium**; maximal 5 pro Beitrag.
- `chat_slang_tags` bindet Audio-Tags an Konversationen.
- `slang_tag_votes` (Tag, Nutzer, Wert) trägt die Arena-Bewertung.
- Zählerpflege erfolgt über Trigger und eine Ereignis-Aggregation (`counter_events`, `flush_counter_events()`), nicht über Einzelupdates aus dem Client.

### 4.3 Technische Besonderheit gegenüber einem Hashtag

Ein Hashtag ist ein aus Text abgeleiteter Suchbegriff ohne Eigentümer, ohne Medieninhalt und ohne Moderationszustand. Der SlangTag ist demgegenüber:

1. **ein persistentes Objekt mit Primärschlüssel** – referenzierbar, versionierbar, löschbar, mit eigener Detailseite;
2. **an ein Medienobjekt gebunden** (Audio im privaten Storage, Zugriff über geprüfte/signierte URLs);
3. **eigentumsbehaftet** (`owner_id`/`owner_type`), wodurch persönliche Varianten, Creator- und Business-Tags unterscheidbar bleiben;
4. **moderierbar** – inklusive Audio-Transkription und maschineller Bewertung; ein Tag kann zurückgehalten werden, ohne dass alle Beiträge gelöscht werden;
5. **regional und sprachlich attribuiert**, wodurch Auswertungen nach Region (Slang Globe) und Sprache technisch möglich sind;
6. **positionsbehaftet** – die Platzierung auf dem Bild ist Teil des Beitragsdatensatzes;
7. **verwertbar** – Business-Felder und Reichweitenzähler ermöglichen die spätere Zuordnung von Werbewirkung zu einem Audioobjekt.

Es wird ausdrücklich keine Aussage über Schutzrechte, Neuheit im patentrechtlichen Sinn oder Alleinstellung getroffen.

---

## 5. Technische Architektur

```text
Browser (PWA, React 19)
  |  UI: TanStack Router (SSR), TanStack Query, Tailwind v4, Three.js (Globe)
  |  Service Worker: Push, Cache
  v
TanStack Start Server (Edge/Worker-Laufzeit)
  |  234 typisierte Server Functions (Zod-Validierung, Auth-Middleware)
  |  8 öffentliche HTTP-Endpunkte (Webhooks, Worker, Health)
  v
PostgreSQL (Supabase-Stack)
     116 Tabellen | 285 RLS-Policies | 162 Funktionen | 127 Trigger | 318 Indizes
     Auth (Konten, Sessions) | Storage (privater Bucket "media") | Realtime (scoped Topics)
        ^
        |  externe Dienste (ausschließlich serverseitig aufgerufen)
        +-- KI-Gateway (Moderation von Text/Bild/Transkript, Übersetzung)
        +-- Stripe (Zahlungen, signaturgeprüfter Webhook)
        +-- Cloudflare Turnstile (Bot-Abwehr)
        +-- Web-Push-Dienste der Browserhersteller (VAPID)
        +-- BigDataCloud (Reverse Geocoding, nur auf Nutzerfreigabe)
        +-- E-Mail-Versand der Plattform (Transaktions-/Auth-Mails)
```

**Medienverarbeitung:** Upload in einen nicht-öffentlichen Bucket; Bildvarianten für Feed-Auslieferung; Zugriff über die Datenbankfunktion `can_read_media` bzw. signierte URLs; mehrstufiger Cache mit persistenter Ablage nicht-sensibler URLs im Browser.

**Realtime:** nutzer- bzw. konversationsbezogene Topics (`presence-u-<userId>`, `chat-<conversationId>`) statt globaler Kanäle, um Metadatenabfluss zu vermeiden (abgesichert durch `tests/realtime-topic-scoping.test.ts`).

---

## 6. Sicherheit und Datenschutz (vorhandene Mechanismen)

| Mechanismus | Umsetzung |
| --- | --- |
| Row Level Security | auf allen 116 Tabellen aktiv, 285 Policies |
| Rechtevergabe | explizite `GRANT`s je Rolle (`anon`, `authenticated`, `service_role`) |
| Rollenmodell | separate Tabelle `user_roles`, Enum `app_role`, `has_role()` als `SECURITY DEFINER` |
| Authentifizierung | Supabase Auth, Passwort-Reset, Bestätigungsmails, Mindestalter 16 |
| Bot-Abwehr | Cloudflare Turnstile mit serverseitiger Prüfung |
| Schreibschutz | Beitragsschreibpfade für den Browser entzogen, Änderungen nur über Server-Functions mit Moderationsprüfung |
| Moderation | asynchrone KI-Prüfung + manuelle Nachprüfung + Einspruch, protokolliert |
| Rate Limits | u. a. Meldungen, Newsletter-Cooldown, Registrierungspfade |
| Löschung | Kontolöschung inkl. Medien und Speicherobjekten (`deleteMyAccount`), konfigurierbare Retention-Läufe |
| Export | DSGVO-Datenexport für Nutzer |
| Einwilligungen | AGB-Zustimmung bei Registrierung, Double-Opt-in für Newsletter, TCF-v2.2-Gate vor Werbeauslieferung, Werbeschalter im Profil |
| Protokollierung | `admin_audit_log`, `account_security_events`, Moderationsprotokolle, `ops_incidents` |
| Transparenz | öffentliche Route `/transparenz` mit Moderationskennzahlen |
| Geheimnisse | Server-Secrets ausschließlich in Server-Functions gelesen, keine Schlüssel im Client-Bundle (durch Test `tests/environment-separation.test.ts` abgesichert) |

Explizit **nicht** vorhanden: Ende-zu-Ende-Verschlüsselung der Nachrichten (Transportverschlüsselung per HTTPS; so auch in der Datenschutzerklärung beschrieben).

---

## 7. Test- und Qualitätsstatus

| Ebene | Status |
| --- | --- |
| Unit-/Logiktests | 480 Tests in 21 Dateien, **480 bestanden**, Laufzeit 7,9 s |
| Datenbank-Integrationstests | vorhanden (`tests/integration/db-anon-access.test.ts`, `db-security.test.ts`); laufen nur mit gesetzter Datenbankumgebung, nicht Teil des Standardlaufs |
| E2E-Tests (Playwright) | 9 Spezifikationen (Feed, Market, Messenger, Navigation, öffentliche/geschützte Routen); laufen gegen eine lokal gestartete Instanz |
| Vertragstests | RLS-Policy-Contract, Auth-Guard-Contract, Realtime-Topic-Scoping, Payment-Webhook-Signatur/Idempotenz |
| Typecheck | `tsc --noEmit` fehlerfrei |
| Build | erfolgreich |
| Lint/Format | ESLint + Prettier, im Freigabe-Skript verankert |
| CI | GitHub-Actions-Workflow vorhanden (`.github/workflows/ci.yml`) |

**Bekannte Restrisiken im Qualitätsbereich:**

- Es liegt **keine gemessene Codeabdeckung** vor; die Testanzahl sagt nichts über die abgedeckten Pfade aus.
- DB- und E2E-Tests laufen nicht automatisch in jedem Durchlauf (umgebungsabhängig).
- Es existiert **kein Lasttest-Nachweis** unter realer Nutzung.
- Es existiert **keine getrennte Staging-Infrastruktur**; Trennung erfolgt derzeit logisch (Umgebungsvariablen, Host-Prüfung).

---

## 8. Aktueller technischer Reifegrad

Bewertung ausschließlich auf Basis der gemessenen Werte; keine Punktzahl, wo Daten fehlen.

| Dimension | Einschätzung | Begründung aus den Messwerten |
| --- | --- | --- |
| Funktionsreife | hoch | 15 abgegrenzte Produktbereiche implementiert und über Routen erreichbar; 116 Tabellen mit realem Datenfluss |
| Technische Reife | hoch | Typecheck und Build fehlerfrei, konsistente Server-Function-Schicht, 226 nachvollziehbare Migrationen |
| Sicherheitsreife | hoch im Zugriffsmodell | RLS auf 100 % der Tabellen, separates Rollenmodell, serverseitige Schreibpfade, Audit-Logs; unabhängige externe Prüfung liegt nicht vor |
| Produktionsreife | eingeschränkt | Betriebsfunktionen (Health, Alarm, Runbooks) vorhanden, aber ohne getrennte Staging-Umgebung und ohne Lastnachweis |
| Skalierbarkeit | nicht belegt | Datenbank aktuell 78 MB, 22 Konten, 33 Beiträge – das Verhalten bei hohen Datenmengen ist unbelegt |
| Testabdeckung | teilweise belegt | 480 bestandene Tests, aber keine Coverage-Messung und keine durchgängige E2E-Automatisierung |

---

## 9. Noch offene technische Entwicklung

Alle folgenden Punkte sind **noch nicht vollständig umgesetzt**:

1. **Skalierungsnachweis** – kein Lasttest gegen die reale Architektur; Verhalten von Feed-Ranking und Zähleraggregation bei hohen Datenmengen unbekannt.
2. **Datenbanklast** – 285 Policies und 113 `SECURITY DEFINER`-Funktionen liegen im Abfragepfad; Kostenanalyse (Query-Pläne, Policy-Overhead) steht aus.
3. **Feed-Ranking bei wachsender Datenmenge** – `feed_score_cache` existiert, eine Strategie für Invalidierung und Vorberechnung unter Last ist nicht validiert.
4. **Medienauslieferung** – signierte URLs und Browser-Cache vorhanden; eine CDN-Ebene mit langfristigem Edge-Caching für nicht-sensible Varianten fehlt.
5. **Medienverarbeitung** – Bildvarianten vorhanden; serverseitige Audio-/Video-Verarbeitung (Normalisierung, Transkodierung) ist in der Worker-Laufzeit nicht möglich und derzeit nicht ausgelagert.
6. **Regionale Discovery** – Region ist als Textfeld modelliert; es fehlt eine normalisierte Geo-/Regionshierarchie mit räumlichen Indizes für belastbare regionale Auswertung.
7. **Sprach-/Regionszuordnung** – Sprache wird gespeichert, aber nicht automatisch aus dem Audio abgeleitet; die Zuordnung beruht auf Nutzerangaben.
8. **Moderationsdurchsatz** – Worker-basiert und synchron zum Jobtakt; Rückstauverhalten bei Lastspitzen ist nicht gemessen.
9. **Übersetzung** – kontingentabhängig, ohne persistente Zwischenspeicherung aller Sprachpaare.
10. **Echtzeit** – Topics sind pro Nutzer/Chat isoliert; die Verbindungsanzahl pro Instanz ist nicht limitiert oder gemessen.
11. **Infrastruktur** – keine getrennte Staging-Umgebung, kein automatisierter Restore-Test im Regelbetrieb (Skript `scripts/restore-test.sh` vorhanden, aber nicht in CI erzwungen).
12. **Qualität** – keine Coverage-Messung, DB-/E2E-Tests nicht verpflichtend in der Pipeline.

---

## 10. Vorschlag für das IBB-Ankerprojekt

**Arbeitstitel:** Skalierbare Audio-Tag-Infrastruktur mit regionaler Sprach- und Content-Zuordnung

Schwerpunkt sind nicht Produktfeatures, sondern die technische Tragfähigkeit des SlangTag-Systems unter realer Nutzung.

| Arbeitspaket | Bereits vorhanden | Geplante Entwicklung |
| --- | --- | --- |
| AP1 – Skalierung der Datenzugriffsschicht | 116 Tabellen mit RLS, 318 Indizes, Server-Function-Schicht | Messung des Policy-/Funktions-Overheads, Umbau kritischer Lesepfade (Feed, Discovery) auf vorberechnete bzw. materialisierte Strukturen, definierte Lastprofile |
| AP2 – SlangTag-Datenmodell | `slang_tags` mit Sprache, Region, Eigentümer, Moderation, Zählern | Normalisierung von Region und Sprache in eigene Referenzstrukturen, Versionierung von Varianten, referenzsichere Wiederverwendung über Beitrag/Chat/Arena hinweg |
| AP3 – Regionale Discovery | Slang Globe (Three.js), Regionsfeld, Geodaten im Client | Serverseitiger regionaler Index mit räumlichen Abfragen, aggregierte Regionskennzahlen statt Client-seitiger Auswertung, LOD-fähige Datenlieferung |
| AP4 – Medien-/Content-Pipeline | privater Bucket, Bildvarianten, signierte URLs, mehrstufiger Cache | Ausgelagerte Verarbeitung für Audio/Video (Normalisierung, Formatvarianten), Edge-Cache-Ebene, messbare Verarbeitungszeiten |
| AP5 – Sprach-/Regionszuordnung | Transkript aus der Moderationspipeline, manuelle Sprachangabe | Automatisierte Ableitung von Sprache und regionaler Zuordnung aus Transkript und Kontext, Qualitätsmessung gegen manuell gepflegte Referenzdaten |
| AP6 – Sicherheit und Datenschutz unter Last | RLS, Rollen, Audit-Logs, Retention-Läufe | Nachweis, dass Zugriffsregeln auch bei vorberechneten/aggregierten Strukturen vollständig greifen; automatisierte Policy-Regressionstests |
| AP7 – Validierung unter realer Nutzung | 480 Unit-Tests, E2E- und DB-Tests, Health-/Alarmschicht | Lasttests mit definierten Szenarien, Staging-Umgebung, verpflichtende Test-Pipeline, Coverage-Messung |

---

## 11. Technische Risiken des Ankerprojekts

| Risiko | Technische Ursache | Geplanter Lösungsansatz | Messbare Validierung |
| --- | --- | --- | --- |
| Antwortzeiten des Feeds brechen bei wachsender Datenmenge ein | Ranking- und Diversitätslogik über mehrere Tabellen, zusätzlich RLS-Auswertung je Zeile | Vorberechnete Ranking-Strukturen, gezielte Indizes, Reduktion der Policy-Auswertung im heißen Pfad | p95-Antwortzeit der Feed-Abfrage bei definierten Datenmengen und Parallelnutzern |
| Datenbanklast durch 285 Policies und 113 `SECURITY DEFINER`-Funktionen | Zugriffsregeln liegen im Abfragepfad | Analyse der Ausführungspläne, Zusammenfassung redundanter Policies, Auslagerung teurer Prüfungen | Vergleich der Ausführungszeiten vor/nach Umbau bei identischem Lastprofil |
| Medienauslieferung wird zum Engpass | signierte URLs sind pro Nutzer verschieden und damit schlecht Edge-cachebar | Trennung sensibler und nicht-sensibler Varianten, Edge-Cache für nicht-sensible Medien | Cache-Trefferquote und Auslieferungszeit je Medienvariante |
| Echtzeitkommunikation skaliert nicht | Verbindungs- und Topic-Anzahl wächst linear mit aktiven Nutzern | Messung der Verbindungsgrenzen, Bündelung von Ereignissen, Rückfallpfad auf Abfragen | Anzahl gleichzeitiger Verbindungen bis zur ersten Verschlechterung, Zustellverzögerung |
| Regionale Discovery liefert unscharfe Ergebnisse | Region ist ein freies Textfeld ohne Hierarchie | Normalisierte Regionsreferenz mit räumlichem Index | Trefferquote gegen einen manuell geprüften Referenzdatensatz |
| Automatische Sprach-/Regionszuordnung ist fehlerhaft | Ableitung aus kurzen Audioaufnahmen (1–5 s) mit Dialektanteil | Kombination aus Transkript, Nutzerkontext und Schwellenwert mit Rückfall auf manuelle Angabe | Genauigkeit gegen Referenzdatensatz, Anteil der Fälle mit Rückfall |
| Moderationsrückstau bei Lastspitzen | Worker verarbeitet Jobs getaktet | Parallelisierung, Priorisierung, Rückstauüberwachung | Wartezeit von Job-Erstellung bis Entscheidung unter definierter Last |
| Übersetzungskosten/-kontingente begrenzen die Funktion | externe KI-Aufrufe je Anfrage | Persistente Speicherung je Sprachpaar, Vermeidung von Wiederholungen | Anteil der aus dem Bestand bedienten Übersetzungen |
| Datenschutzverletzung durch vorberechnete Strukturen | aggregierte Daten umgehen ggf. die Zeilenlogik | Zugriffsregeln auch auf Aggregate anwenden, automatisierte Policy-Tests | Anzahl bestandener Policy-Regressionstests, Ergebnis von Zugriffstests mit unberechtigten Konten |
| Fehlende Staging-Umgebung führt zu Produktionsfehlern | derzeit nur logische Trennung | eigene Staging-Instanz mit eigener Datenbank | Anteil der Releases, die vollständig über Staging laufen |

---

## 12. Messbare Entwicklungsziele

Die folgenden Zielwerte sind Vorschläge für das Projekt; sie beschreiben **nicht** den heutigen Zustand (heute liegen keine Lastmessungen vor).

1. **Feed-Antwortzeit:** p95 der serverseitigen Feed-Abfrage unter definiertem Lastprofil messbar erfassen und ein Ziel unterhalb von 300 ms bei 1 Mio. Beiträgen festlegen.
2. **Lasttest:** reproduzierbares Szenario mit definierter Anzahl gleichzeitiger Nutzer, Ergebnis dokumentiert (Antwortzeiten, Fehlerquote, Datenbankauslastung).
3. **Medienverarbeitung:** definierte Obergrenze für die Zeit von Upload bis Verfügbarkeit aller Varianten, gemessen je Medientyp.
4. **Cache-Trefferquote** für nicht-sensible Medienvarianten messen und Zielwert festlegen.
5. **Moderationsdurchlaufzeit:** Zeit von Inhaltserstellung bis Moderationsentscheidung unter Last messen und Obergrenze festlegen.
6. **Testabdeckung:** Coverage-Messung einführen (heute: nicht gemessen) und einen verbindlichen Mindestwert für die Kernmodule (`src/lib/feed-ranking`, `src/lib/interest-engine`, Zahlungs- und Moderationspfade) festlegen.
7. **Pipeline:** DB-Integrations- und E2E-Tests verpflichtend in jedem Durchlauf (heute: umgebungsabhängig).
8. **Verfügbarkeit:** Verfügbarkeitsziel definieren und über die bestehende Health-/Alarmschicht messen.
9. **Zuordnungsgenauigkeit:** Genauigkeit der automatischen Sprach-/Regionszuordnung gegen einen manuell geprüften Referenzdatensatz.

---

## 13. Abschließende technische Bewertung (für externe Gutachter)

**Was wurde bereits entwickelt?**
Eine vollständige, lauffähige Social-Plattform mit 117.682 Zeilen aktivem Anwendungscode in 755 Dateien, gestützt auf eine PostgreSQL-Datenbank mit 116 Tabellen, 285 RLS-Policies, 162 Datenbankfunktionen, 127 Triggern und 226 nachvollziehbaren Migrationen. Implementiert sind Feed, Profile, Connections, Messenger, Übersetzung, Marktplatz mit Zahlungsanbindung, Channels, SlangTags, Slang Globe, Slang Arena, KI-gestützte Moderation, Werbeausspielung, Admin-Cockpit und DSGVO-Funktionen. Build und Typecheck sind fehlerfrei, 480 automatisierte Tests laufen vollständig durch.

**Was ist daran technologisch relevant?**
Der SlangTag ist als eigenständige Datenbank-Entität modelliert: Audio-Asset mit Eigentümerschaft, Sprache, Region, Typ, Freigabe-/Jahrgangssteuerung, Moderationsstatus und Reichweitenzählern, positionsgenau an Medien gebunden und über Beiträge, Chats, Voting und Geodarstellung hinweg wiederverwendbar. Damit unterscheidet sich das System strukturell von textbasierten Hashtags. Ergänzend relevant sind die durchgängige Zugriffskontrolle auf Datenbankebene (RLS auf allen Tabellen) und die asynchrone Moderationspipeline für Text, Bild und Audio-Transkript.

**Was ist noch ungelöst?**
Die Tragfähigkeit unter realer Last ist nicht belegt: kein Lasttest, keine getrennte Staging-Umgebung, keine gemessene Testabdeckung. Regionale Zuordnung beruht auf Textfeldern ohne räumlichen Index; Sprache wird nicht automatisch abgeleitet. Medien werden ohne Edge-Cache-Ebene ausgeliefert; serverseitige Audio-/Videoverarbeitung fehlt. Der Overhead der umfangreichen Zugriffsregeln im Abfragepfad ist nicht quantifiziert.

**Warum ist weitere technische Entwicklung erforderlich?**
Die vorhandene Architektur ist funktional vollständig, aber auf einem Datenbestand von derzeit 78 MB und 22 Konten entstanden. Der Schritt zu einem belastbaren Mehrnutzerbetrieb erfordert Umbauten in Datenzugriff, Discovery-Indizierung, Medienpipeline und Qualitätssicherung, die über gewöhnliche Feature-Entwicklung hinausgehen.

**Welche technischen Risiken bestehen?**
Antwortzeiteinbruch des Feeds bei wachsender Datenmenge, Datenbanklast durch die Zugriffsregeln, schlecht cachebare Medienauslieferung, Skalierungsgrenzen der Echtzeitkommunikation, Unschärfe der regionalen Zuordnung, Fehlerquote der automatischen Sprachbestimmung, Moderationsrückstau, Übersetzungskontingente sowie das Risiko, dass vorberechnete Strukturen die Zugriffsregeln umgehen.

**Welche Ergebnisse soll das geplante Entwicklungsprojekt erreichen?**
Messbar belegte Antwortzeiten und Lastgrenzen, ein normalisiertes und räumlich indiziertes Regions-/Sprachmodell für den SlangTag, eine ausgelagerte Medienverarbeitung mit definierten Verarbeitungszeiten, eine automatisierte Sprach-/Regionszuordnung mit gemessener Genauigkeit, nachweislich unter Last wirksame Zugriffsregeln sowie eine verbindliche Test- und Staging-Pipeline mit gemessener Abdeckung.

---

## Gesamtübersicht

| Bereits implementiert | Technischer Nutzen | Noch zu entwickeln | Technisches Risiko |
| --- | --- | --- | --- |
| SlangTag-Datenmodell (Audio, Eigentümer, Sprache, Region, Moderation, Zähler) | referenzierbare, moderierbare Audio-Entität statt Textstring | Normalisierung von Region/Sprache, Versionierung, räumlicher Index | unscharfe regionale Auswertung, Migrationsaufwand am Kerndatenmodell |
| Feed mit Ranking, Diversität und Keyset-Pagination | stabile Auslieferung großer Listen | Vorberechnung/Materialisierung der Ranking-Daten | Antwortzeiteinbruch bei wachsender Datenmenge |
| RLS auf allen 116 Tabellen, 285 Policies, Rollenmodell | durchgängige Zugriffskontrolle auf Datenebene | Overhead-Analyse, Policy-Regressionstests, Schutz von Aggregaten | Datenbanklast; Umgehung durch vorberechnete Strukturen |
| Asynchrone KI-Moderation (Text, Bild, Transkript) | rechtlich nachvollziehbare Inhaltsfreigabe | Parallelisierung, Priorisierung, Rückstauüberwachung | Moderationsrückstau bei Lastspitzen |
| Messenger mit isolierten Realtime-Topics | Echtzeitkommunikation ohne Metadatenabfluss | Messung und Begrenzung der Verbindungslast | Skalierungsgrenze der Echtzeitschicht |
| Medienpipeline mit privatem Bucket, Bildvarianten, Cache | kontrollierter Medienzugriff | Edge-Cache-Ebene, ausgelagerte Audio-/Videoverarbeitung | Auslieferung als Engpass, fehlende Serververarbeitung |
| Slang Globe (3D, LOD) und Slang Arena (Voting) | geografische und kuratierende Discovery | serverseitige Regionsaggregation | Client-seitige Datenmenge, Genauigkeit der Regionsdaten |
| Market mit Stripe, signiertem idempotentem Webhook | belastbare Zahlungsabwicklung | Lastverhalten der Transaktionspfade | Konsistenz bei parallelen Transaktionen |
| Übersetzung mit Erhalt der Originalsprache | sprachübergreifende Nutzung | persistente Ablage je Sprachpaar | Kontingent-/Kostenabhängigkeit |
| DSGVO-Funktionen (Export, Löschung, Reset, Transparenz) | Umsetzung der Betroffenenrechte | Nachweis der Wirksamkeit auf Aggregaten | Datenschutzrisiko bei neuen Datenstrukturen |
| 480 bestandene Tests, Typecheck und Build grün, CI, Health-/Alarmschicht | reproduzierbarer Freigabeprozess | Coverage-Messung, verpflichtende DB-/E2E-Läufe, Staging | unbelegte Abdeckung, Produktionsfehler ohne Staging |

---

## Datenbasis und Messzeitpunkt

**Messzeitpunkt:** 28. August 2026, 07:25–07:30 UTC.

| Messwert | Wert | Quelle/Methode |
| --- | --- | --- |
| Aktiver Code gesamt | 117.682 Zeilen | `rg --files` + `wc -l`, ohne `.lovable/backup/`, `backups/`, `remotion/`, `src/routeTree.gen.ts`, Geo-JSON, Build-Ordner |
| davon `.ts` / `.tsx` / SQL / CSS / JS | 60.089 / 44.965 / 11.784 / 628 / 216 | wie oben |
| Dateien im aktiven Umfang | 755 | `rg --files` |
| Dateien `src/lib` / `src/components` / `src/routes` | 279 / 129 / 69 | `find` |
| Migrationsdateien | 226 | `ls supabase/migrations` |
| Testdateien | 24 Top-Level + 9 E2E | `ls tests`, `ls tests/e2e` |
| `createServerFn`-Verwendungen | 234 in 35 Modulen | `rg 'createServerFn' src` |
| Öffentliche API-Endpunkte | 8 | `find src/routes/api` |
| Tabellen (public) | 116 | `pg_tables` |
| Tabellen mit RLS aktiv | 116 | `pg_class.relrowsecurity` |
| RLS-Policies | 285 | `pg_policies` |
| Datenbankfunktionen | 162 (113 `SECURITY DEFINER`) | `pg_proc` |
| Trigger (nicht-intern) | 127 | `pg_trigger` |
| Indizes | 318 | `pg_indexes` |
| Views | 0 | `pg_views` |
| Datenbankgröße | 78 MB | `pg_database_size()` |
| Auth-Konten | 22 | `auth.users` |
| Inhaltsbestand | 33 Beiträge, 11 SlangTags, 14 Profile, 120 Nachrichten, 2 Marktartikel, 2 Channels, 2 Challenges | `count(*)` je Tabelle |
| Storage-Buckets | 1 (`media`, nicht öffentlich) | `storage.buckets` |
| Unit-/Logiktests | 21 Dateien, 480 Tests, 480 bestanden, 7,86 s | `bun run test` (vitest) |
| Typecheck | fehlerfrei | `bunx tsc --noEmit` |
| Build | erfolgreich | Build-Protokoll `build OK`, 07:25 UTC |
| Externe Dienste | KI-Gateway (Moderation/Übersetzung), Stripe, Cloudflare Turnstile, Web-Push-Dienste, BigDataCloud, Plattform-E-Mail | Quellcode-Analyse `src/lib`, `src/routes/api/public` |

**Nicht gemessen / nicht belegt:** Codeabdeckung, Lastverhalten, Verfügbarkeit im Dauerbetrieb, Nutzerzahlen im Echtbetrieb, Umsätze. Diese Größen werden in diesem Bericht bewusst nicht angegeben.
