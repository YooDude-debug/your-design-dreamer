# Y-Dude – Technische Architektur, Deployment, Datenbank, Betrieb, Recovery

Stand: 2026-08-27. Zentrales Einstiegsdokument („Bus-Faktor-Dokument“).
Ziel: Ein technisch versierter Entwickler soll ohne Vorwissen über Y-Dude
verstehen, wie das System aufgebaut ist, wie es veröffentlicht wird und wie
kritische Fehler untersucht und behoben werden.

Keine Secrets, keine Passwörter, keine Zugangsdaten in diesem Dokument –
ausschließlich Namen von Variablen und deren Zweck.

Weiterführend:

- Notfälle, Schritt für Schritt: `docs/RUNBOOK_CRITICAL_OPS.md`
- Vorfallsablauf inkl. Datenschutz: `docs/RUNBOOK_INCIDENT.md`
- Route-Architektur und Modularisierungsstand: `docs/ROUTE_ARCHITEKTUR_2026-08-27.md`
- Betrieb/Alerting im Detail: `docs/PHASE6_BETRIEB_AUSFALLSICHERHEIT_2026-08-27.md`
- Umgebungstrennung: `docs/PHASE2_ENVIRONMENT_TRENNUNG_2026-08-26.md`

---

## 1. Architektur in einem Bild

```text
Browser (PWA, React 19)
  │  TanStack Router (src/routes) · TanStack Query · Kontexte in src/lib
  │
  ├── direkt zu Lovable Cloud (Supabase JS, RLS als angemeldeter Nutzer)
  │      Auth, Lesen/Schreiben der Nutzerdaten, Realtime, Storage-Signaturen
  │
  └── Server-Funktionen (createServerFn, Cloudflare-Worker-Laufzeit)
         Rechte-/Rollenprüfung, Market-Transaktionen, Moderation, KI,
         Push-Versand, Monitoring, Admin-Funktionen
              │
              ├── Lovable Cloud (Postgres + Storage, teils mit Adminrechten)
              ├── Lovable AI Gateway (Moderation, Übersetzung)
              ├── Zahlungsanbieter (Checkout, Webhook)
              └── Web Push (VAPID)

Öffentliche HTTP-Endpunkte: src/routes/api/public/*
  Zahlungs-Webhook (Signaturprüfung) + Cron-Endpunkte (Bearer-Token)
```

### Schichten und Verantwortlichkeiten

| Schicht                 | Ort                                        | Aufgabe                                                  |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Routen / Seiten         | `src/routes/**`                            | Seitenaufbau, Navigation, Metadaten (`head()`)           |
| UI-Komponenten          | `src/components/**`                        | Darstellung, wiederverwendbare Bausteine                 |
| Zustand / Datenkontexte | `src/lib/data.tsx`, `src/lib/social.tsx`   | Feed, Profil, Connections, Messenger, Benachrichtigungen |
| Reine Logik             | `src/lib/*.shared.ts`, `src/lib/feed-*`    | Regeln ohne IO – testbar (Vitest)                        |
| Server-Funktionen       | `src/lib/*.functions.ts`                   | RPC-Einstiegspunkte für den Client                       |
| Server-Logik            | `src/lib/*.server.ts`                      | Nur Server: Adminrechte, externe Dienste, Geheimnisse    |
| Öffentliche Endpunkte   | `src/routes/api/public/**`                 | Webhook + Cron (eigene Absicherung im Handler)           |
| Datenbank               | `supabase/migrations/**` (222 Migrationen) | Schema, RLS, Funktionen, Trigger, Zeitpläne              |

**Regel:** `*.server.ts` darf niemals direkt aus einer Route oder Komponente
importiert werden – nur über `*.functions.ts`. Der Build blockiert das sonst.

### Wichtige Datenflüsse

1. **Feed:** Bootstrap über `src/lib/data.tsx` (Keyset-Pagination) →
   Reiterauswahl `src/lib/feed-tabs.ts` → Ranking `src/lib/feed-ranking/*` →
   Darstellung `src/components/feed/FeedPost.tsx`. Bildvarianten und
   signierte URLs: `src/lib/media.ts` (Bucket `media`).
2. **Messenger:** `src/components/Messenger.tsx` + `src/lib/social.tsx`,
   Realtime-Abos auf `messages`; Lesestatus über RPC
   `mark_conversation_read`; Übersetzung über AI Gateway mit Kontingent-Fallback.
3. **Market:** Anlegen/Suche über `src/lib/market-*.ts`, Transaktionen
   ausschließlich serverseitig (`src/lib/market-tx.server.ts`), Zahlungsstatus
   nur über den signierten Webhook.
4. **Moderation:** Beitrag → `post_moderation_jobs` → Cron
   `/api/public/moderation-run` → KI-Bewertung → Status am Beitrag.
5. **Monitoring:** Fehler → `src/lib/ops-monitor.server.ts` → `ops_events` /
   `ops_incidents` → Alarmzustellung → Anzeige unter `/admin/health`.

---

## 2. Deployment

### Umgebungen

| Umgebung        | Hostnamen                                                         | Zahlungsmodus |
| --------------- | ----------------------------------------------------------------- | ------------- |
| **development** | `localhost`, `127.0.0.1`, `*.local`                               | Sandbox       |
| **staging**     | Vorschauadressen (`id-preview--*`, `*-dev.lovable.app`, sonstige) | Sandbox       |
| **production**  | `y-dude.com`, `www.y-dude.com`, `y-dude.lovable.app`              | Live          |

Einzige Quelle der Wahrheit: `src/lib/environment.shared.ts`. Unbekannte Hosts
gelten immer als Staging, niemals als Production. `APP_ENV` (Server) hat
Vorrang. Eine neue Produktionsdomain **muss** in `PRODUCTION_HOSTS` ergänzt
werden, sonst läuft die Domain im Sandbox-Zahlungsmodus.

### Prozess

1. Änderung in der Vorschau (Preview = Staging) prüfen.
2. Freigabe-Gate lokal/CI: `bun run verify` → Typprüfung (`tsc --noEmit`),
   Lint (`eslint .`, 0 Fehler gefordert), Tests (`vitest run`).
   CI: `.github/workflows/ci.yml` auf jedem Push/PR.
3. Veröffentlichen über Lovable (Publish). Production serviert den
   veröffentlichten Stand, Preview den letzten Build.
4. Nach der Veröffentlichung Rauchtest fahren (Abschnitt 6 in
   `docs/RUNBOOK_INCIDENT.md`).

Datenbank und Storage sind zwischen Staging und Production **geteilt**. Ein
Schemafehler wirkt in beiden Umgebungen. Migrationen deshalb immer additiv
denken (neue Spalten nullable, keine Blind-Drops).

### Environment-Variablen (nur Namen, keine Werte)

Client (Build-Zeit, `import.meta.env`, dürfen öffentlich sein):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PAYMENTS_CLIENT_TOKEN`.

Server (`process.env`, nur in Handlern lesen):

| Name                                                                                                                | Zweck                                        | Fehlt er, dann …                            |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------- |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`                                                                          | Serverseitige Datenbankzugriffe              | Server-Funktionen scheitern                 |
| `APP_ENV`                                                                                                           | Umgebung erzwingen                           | Erkennung nur über Hostnamen                |
| `LOVABLE_API_KEY`                                                                                                   | KI (Moderation, Übersetzung)                 | Moderation/Übersetzung fällt zurück         |
| `STRIPE_LIVE_API_KEY`                                                                                               | Zahlungen im Livemodus                       | Live-Checkout nicht möglich                 |
| `MODERATION_CRON_TOKEN`                                                                                             | Sammel-Token für Cron-Endpunkte              | Alle Cron-Läufe antworten 401               |
| `PUSH_CRON_TOKEN`, `COUNTERS_CRON_TOKEN`, `RETENTION_CRON_TOKEN`, `OPS_HEALTH_CRON_TOKEN`, `BETA_LAUNCH_CRON_TOKEN` | Optionale Einzel-Token je Endpunkt           | Ausweichpfad `MODERATION_CRON_TOKEN` greift |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`                                                            | Web Push                                     | Keine Push-Nachrichten                      |
| `CLOUDFLARE_TURNSTILE_SITE_KEY` / `_SECRET_KEY`                                                                     | Bot-Schutz bei Registrierung                 | Turnstile-Prüfung inaktiv                   |
| `OPS_ALERT_WEBHOOK_URL`                                                                                             | Externe Alarmzustellung                      | Alarme nur in Protokoll und `/admin/health` |
| `OPS_HEARTBEAT_URL`                                                                                                 | Externer Totmannschalter                     | Kein Alarm bei komplettem Ausfall           |
| `MASTER_ADMIN_PASSWORD`                                                                                             | Notzugang Adminbereich                       | Nur regulärer Rollenweg                     |
| `ALLOW_TEST_FEATURES_IN_PRODUCTION`                                                                                 | Testfunktionen in Production (Standard: aus) | –                                           |

Secrets werden ausschließlich über die Lovable-Secret-Verwaltung gesetzt,
niemals im Repository. `SUPABASE_SERVICE_ROLE_KEY` und das Datenbankpasswort
sind auf Lovable Cloud nicht zugänglich – der privilegierte Zugriff läuft über
`src/integrations/supabase/client.server.ts`.

### Typische Fehlerquellen beim Deployment

- Server-Funktion importiert `*.server.ts` aus einer Route → Build bricht ab.
- Geschützte Server-Funktion in einem Loader einer öffentlichen Route →
  `Unauthorized` beim Prerender.
- Laufzeitcode auf Modulebene in einer `*.functions.ts` → `ReferenceError`
  erst zur Laufzeit (Code-Splitting entfernt die Geschwister).
- Node-only-Paket im Worker (`__dirname`, `[unenv] … not implemented`).
- Neue Tabelle ohne `GRANT` → „permission denied“ trotz RLS-Policy.
- Neue Produktionsdomain nicht in `PRODUCTION_HOSTS`.

---

## 3. Datenbank

### Tabellenbereiche (Auswahl)

| Bereich         | Tabellen (Kern)                                                             |
| --------------- | --------------------------------------------------------------------------- |
| Identität       | `profiles`, `user_roles`, `admin_owners`, `reserved_usernames`, `user_bans` |
| Inhalte         | `posts`, `comments`, `post_likes/saves/shares/views`, `hashtags`            |
| SlangTags       | `slang_tags`, `slang_definitions`, `slang_tag_grants`, `slang_tag_*`        |
| Sozial          | `follows`, `connections`, `connection_suggestions`, `notifications`         |
| Messenger       | `conversations`, `conversation_members`, `messages`, `message_translations` |
| Channels        | `channels`, `channel_members`, `channel_follows`, `channel_bans`            |
| Market          | `market_items`, `market_transactions`, `market_offers`, `market_payment_*`  |
| Werbung         | `ad_campaigns`, `ad_test_*`, `ad_pauses`, `ad_preferences`                  |
| Feed/Interessen | `feed_signals`, `feed_score_cache`, `interest_*`, `user_interest_scores`    |
| Betrieb         | `ops_events`, `ops_incidents`, `admin_audit_log`, `account_security_events` |

### RLS-Konzept

- Jede Tabelle im Schema `public` hat RLS aktiv **und** explizite `GRANT`s.
  Ohne `GRANT` ist die Tabelle für die App unerreichbar.
- Rollen liegen ausschließlich in `user_roles` (Enum `app_role`), niemals am
  Profil. Prüfung immer über `public.has_role(auth.uid(), 'admin')`.
  Zusätzliche Eigentümerstufe: `admin_owners` / `is_admin_owner()`.
- Sichtbarkeit von Inhalten läuft über SECURITY-DEFINER-Helfer statt
  verschachtelter Policies: `can_view_post`, `can_view_profile`,
  `can_see_profile_field`, `can_read_media`, `is_channel_moderator`,
  `is_conversation_member`, `are_connected`, `can_see_arena_submission`.
- Diese Helfer sind die sensibelste Stelle des Projekts: eine Änderung wirkt
  auf viele Policies gleichzeitig. Änderungen nur mit anschließendem
  `bunx vitest run tests/rls-policy-contract.test.ts` und Sicherheits-Scan.

### Migrationen

- Ort: `supabase/migrations/` (chronologisch, 222 Dateien). Nie nachträglich
  bearbeiten – immer neue Migration.
- Reihenfolge bei neuen Tabellen: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL
SECURITY` → `CREATE POLICY`.
- Zeitpläne (`cron.job`, aktiv): `post-moderation-worker` (1 min),
  `y-dude-counter-flush` (1 min), `y-dude-push-run` (1 min),
  `refresh-connection-suggestions` (10 min), `y-dude-ops-health` (5 min),
  `y-dude-retention-run` (täglich 03:17 UTC).

### Backup / Restore

- Datenbank-Backups verwaltet die Plattform (Lovable Cloud). Kein eigenes
  Backup-Skript, keine eigenen Dumps im Repository.
- Codestände: Git-Historie plus manuelle Sicherungen unter `.lovable/backup/*`
  (jeweils datiert, Zweck im Ordnernamen).
- Wiederherstellungsprobe: `scripts/restore-test.sh`.
- Zielwerte, Umfang und Grenzen: `docs/PHASE6_BETRIEB_AUSFALLSICHERHEIT_2026-08-27.md`
  und `docs/BETRIEB_LOGS_BACKUPS_VORFALL.md`.

---

## 4. Auth

- Anbieter: Lovable Cloud Auth (E-Mail/Passwort + Google). Keine anonymen
  Anmeldungen.
- Client: `src/integrations/supabase/client.ts` (generiert, nicht ändern).
- Geschützte Routen: `src/routes/_authenticated/route.tsx` prüft die
  persistierte Session in `beforeLoad` und leitet sonst nach `/auth`.
- Geschützte Server-Funktionen: Middleware `requireSupabaseAuth`; der Client
  hängt das Bearer-Token über `attachSupabaseAuth` an (registriert in
  `src/start.ts`). Fehlt diese Registrierung, antworten alle geschützten
  Server-Funktionen mit 401.
- Adminzugang: Rolle in `user_roles` (+ optional `admin_owners`). Alle
  Adminaktionen landen in `admin_audit_log`.

---

## 5. Betrieb

| Thema           | Ort                                                           |
| --------------- | ------------------------------------------------------------- |
| Cockpit         | `/admin/health` – Ereignisse (24 h), Vorfälle, Alarmtest      |
| Ereignisse      | `ops_events` (Bereich, Severity, Environment)                 |
| Vorfälle        | `ops_incidents` (Bündelung, Notiz, Status)                    |
| Erfassung       | `src/lib/ops-monitor.server.ts`, global in `src/start.ts`     |
| Health-Lauf     | `/api/public/ops-health-run` (Cron, alle 5 Minuten)           |
| Serverlogs      | Lovable-Projekt → Serverlogs (Preview und Published getrennt) |
| Datenbank       | Lovable Cloud → Backend (Logs, Auth, Tabellen)                |
| Zahlungen       | Anbieter-Dashboard (Ereignisse, Webhook-Zustellversuche)      |
| Nutzermeldungen | `/admin/feedback`, `/admin/reports`                           |

Diagnoseweg bei einem Fehlerbericht: `/admin/health` → Serverlogs des
betroffenen Deployments → betroffene Tabelle/Policy → Reproduktion in Preview.
Niemals in Production experimentieren.

---

## 6. Recovery (Kurzfassung)

| Situation                | Erster Schritt                                       | Details                            |
| ------------------------ | ---------------------------------------------------- | ---------------------------------- |
| Backend antwortet nicht  | `/admin/health` + Serverlogs, externe Dienste prüfen | Runbook §2                         |
| Datenbankproblem         | Zugriff und Policies prüfen, keine Blindänderungen   | Runbook §3                         |
| Fehlerhaftes Deployment  | CI-Ergebnis und Buildlog prüfen, nicht erzwingen     | Runbook §1                         |
| Sicherheitsvorfall       | Isolieren, Logs sichern, Secrets rotieren            | Runbook §4 + `RUNBOOK_INCIDENT.md` |
| Alter Codestand nötig    | Git-Historie oder `.lovable/backup/<datum>-<zweck>/` | Runbook §1                         |
| Datenverlust in Tabellen | Plattform-Backup (Lovable Cloud), kein eigener Dump  | `PHASE6_…`                         |

Vollständige Schrittfolgen: `docs/RUNBOOK_CRITICAL_OPS.md`.

---

## 7. Besonders sensible Bereiche

1. RLS-Helferfunktionen (SECURITY DEFINER) – wirken auf viele Policies.
2. Zahlungs-Webhook (`src/routes/api/public/payments/webhook.ts`) –
   Signaturprüfung und Idempotenz nicht anfassen ohne Tests.
3. `src/lib/market-tx.server.ts` – Geldflüsse und Statuswechsel.
4. `src/lib/data.tsx` / `src/lib/social.tsx` – Feed- und Messenger-Zustand für
   die gesamte App.
5. `src/start.ts` – Auth-Anhang, Fehlererfassung, CSRF.
6. Generierte Dateien: `src/integrations/supabase/*` (außer eigenen Modulen),
   `src/routeTree.gen.ts` – nie manuell bearbeiten.
