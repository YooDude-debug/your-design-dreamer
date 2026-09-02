# Y-Dude – Production → Staging Sync-Plan (2026-09-02)

Status: 🟠 **BLOCKED – STAGING SCHEMA ACCESS REQUIRED**

Alle inhaltlichen Konflikte sind durch verbindliche Entscheidungen vom 2026-09-02 aufgelöst
(siehe Abschnitt G). Verbleibender Blocker ist ausschließlich der fehlende Lesezugriff auf das
Staging-Schema.

Dieses Dokument ist ein Plan. Es wurde **nichts** synchronisiert: keine Migration,
kein Deployment, keine Datenänderung, keine Secrets, kein Schreibzugriff auf Staging.
Der Production-Code ist unverändert.


## A. Production-Baseline

- Projekt: Y-Dude Production (`https://y-dude.lovable.app`, `www.y-dude.com`)
- Arbeitsbaum-Commit: `b2cabf1fb653dd7e30cdffc8117433d77b8eb4ed`
- Quelldateien: 587
- Routen: 69
- DB: 122 öffentliche Tabellen mit RLS, 285 Policies, 325 Indizes
- `bun run verify` zuletzt erfolgreich; 587 Unit-Tests grün
- Environment: `production`, Stripe Live, eigene Secrets

## B. Staging-Baseline

- Projekt: **Y-Dude Launchpad** (`4a5bd367-098d-4501-b206-9e1696fcc09c`, `https://y-dude-staging.lovable.app`)
- Read-only Snapshot-Commit: `67b925bbcdbf3023b07bbecc85ed5e6c306774c6`
- Quelldateien: 632, Routen: 69
- Migrationen: 257 eindeutige SQL-Dateien (davon 229 byteidentisch zu Production)
- Environment: `staging`, Stripe Sandbox, eigene DB/Auth/Storage, Production-Cron deaktiviert
- Live-Schema und angewandte Migrationshistorie sind aus dem Production-Workspace **nicht** abfragbar

## C. Production-only Änderungen (nach Staging zu übertragen)

| Datei | Inhalt | Übernahme |
|---|---|---|
| `src/lib/ip-rate-limit.server.ts` | IP-Rate-Limiting | Ja (Security) |
| `src/lib/role-guard.server.ts` | `requireCreatorRole`/`requireBusinessRole` | Ja (Security) |
| `src/lib/role-scope.ts` | Rollen-Labels | Entscheidung nötig (siehe G1) |
| `src/lib/video/video-sound.ts` | Zentrale Tonpräferenz | Ja |
| `src/lib/video/viewport-video.ts` | Viewport-Autoplay, 5-Karten-Reset | Ja |
| `src/lib/turnstile.server.ts` | fail-closed CAPTCHA | Ja (kritisch) |
| `src/lib/public-transcribe.functions.ts` | CAPTCHA + 8 Req/600 s pro IP + Payload-Limits | Ja (kritisch) |
| `src/lib/ad-plan.server.ts` | Environment aus `getRequest()` | Ja (Bugfix) |
| `src/lib/business-campaigns.server.ts` | privilegierter `business_plan_tier`-RPC + `isBusinessAccount`-Guard | Ja (Security) |
| `src/lib/post-moderation.functions.ts` | Titel weich auf 300 Zeichen kürzen | Ja (Bugfix) |
| `src/components/CreatePostDialog.tsx` | Video-Draft-Cleanup | Ja |
| `src/lib/video/video-file.ts` | `tkhd`-Offsets v0=24 / v1=36 | Erst nach Spezifikationsprüfung (G4) |
| `src/components/ProfilePanel.tsx` | Globe/Arena-Buttons, iPhone-Responsivität | Ja |
| `src/routes/_authenticated/dev.tsx` | Feed-Kanäle ohne AutoFeed/Redundanz | Ja |
| `vite.config.ts` | Cloudflare Worker-first Static-Cache | Ja |

## D. Staging-only Änderungen (erhalten, nicht löschen)

| Datei/Bereich | Bewertung |
|---|---|
| `src/lib/role-visibility.ts` | Neues Rollen-Sichtbarkeitsmodul, derzeit nicht verdrahtet – erhalten, Entscheidung G1 |
| `variant`-Prop in `CreatorSlangTagsDialog.tsx`, `profile.$username.tsx`, `creator.tsx` | Getrennte Creator-/Unternehmer-SlangTag-Darstellung – erhalten, Entscheidung G1 |
| Kontotyp-Auswahlschritt in `auth.tsx` (`accountTypeCopy`, Tarifpreise) | Erhalten, aber Preisangaben blockiert (G2) |
| `test_accounts`, `test_bot_settings`, `profiles.is_test_bot` | Staging-Testinfrastruktur – **bleibt Staging-only** |
| `src/components/ui/*`, `src/lib/utils.ts`, `src/hooks/use-mobile.tsx` | shadcn-Scaffolding, teils intern referenziert – nicht löschen |
| `src/integrations/supabase/cron-auth.ts` | Zweck nicht abschließend geklärt – erhalten |

## E. Konflikte (Übersicht)

44 gemeinsame Dateien weichen ab. Davon:
- **11 echte funktionale Konflikte** (Abschnitte F/G)
- ca. 15 rein kosmetische Differenzen (Union-Typ-Formatierung, Prettier-Varianten) in
  `admin.shared.ts`, `business-campaigns.shared.ts`, `business-role.functions.ts`,
  `content-moderation.server.ts`, `moderation-dsa.server.ts`, `market.new.tsx`,
  `creator-eligibility.functions.ts`, Supabase-Clients u. a. → vor Merge normalisieren
- generierte Dateien (`routeTree.gen.ts`, `server.ts`, `integrations/supabase/types.ts`) → **nicht mergen**, neu generieren
- `supabase/config.toml` (unterschiedliche Projekt-Refs) → **nie mergen**

## F. Eindeutig auflösbare Konflikte (Production gewinnt, Staging-Logik erhalten)

| Datei | Staging-Stand | Zielstand |
|---|---|---|
| `turnstile.server.ts` | Weichere Prüfpfade | Production fail-closed übernehmen |
| `public-transcribe.functions.ts` | Ohne IP-/Payload-Schutz | Production-Schutz übernehmen |
| `business-campaigns.server.ts` | Ohne `isBusinessAccount`-Guard, RPC über Normalclient | Production-Fassung übernehmen |
| `ad-plan.server.ts` | `appEnvironment()` ohne Request | Request-basierte Ermittlung übernehmen |
| `post-moderation.functions.ts` | Harte `max(300)`-Ablehnung | Weiche Kürzung übernehmen |
| `CreatePostDialog.tsx` (Video-Reset) | Kein `clearPostVideo()` | Production-Cleanup übernehmen |
| `FeedPost.tsx` + Video-Module | Kein `useViewportVideo` für Post-Videos | Production-Autoplay übernehmen |
| `ProfilePanel.tsx` | Ohne Globe/Arena + ohne Truncation | Production-UI übernehmen |
| `dev.tsx` | Altes AutoFeed/Dropdown | Production-Kanalleiste übernehmen; Staging-Feed-States prüfen |
| `vite.config.ts` | Ohne Static-Cache-Whitelist | Production-Konfiguration übernehmen |

## G. Nicht auflösbare Konflikte (Entscheidung erforderlich)

**G1 – Rollenarchitektur**
- Datei: `src/lib/role-scope.ts` (Production) vs. `src/lib/role-visibility.ts` (Staging)
- Production: zentrale Label-Helper, aktiv in `creator.tsx` / `CreatorSlangTagsDialog.tsx`
- Staging: `roleVisibility()` inkl. `slangTagVariant`, plus `variant`-Prop-Architektur und Inline-`onlyBusiness`
- Konflikt: zwei parallele, gegenseitig ersetzende Rollenmodelle
- Warum nicht automatisch lösbar: Merge ändert, ob die Rolle im Dialog serverseitig nachgeladen (Production) oder vom Aufrufer übergeben wird (Staging) – sicherheitsrelevant
- Empfehlung: ein kanonisches Modul (Labels aus `role-scope.ts` + `slangTagVariant` aus `role-visibility.ts`), `variant` ausschließlich aus serverseitig ermittelten Rollen

**G2 – Kontotyp-Auswahl mit Tarifpreisen in `auth.tsx`**
- Production: `signupEntryCopy` ohne Preise
- Staging: zusätzlicher Auswahlschritt mit 14,90 € / 39,00 €
- Warum nicht lösbar: Preisangaben nicht gegen aktuelles Pricing verifizierbar
- Empfehlung: Production-Flow als Basis, Staging-Schritt nur nach Preisfreigabe

**G3 – Titelkürzung auf 40 Zeichen ohne SlangTag (`CreatePostDialog.tsx`)**
- Warum nicht lösbar: unklar, ob Staging die Kürzung bewusst nicht hat
- Empfehlung: Production-Verhalten übernehmen (verhindert lange Auto-Titel)

**G4 – `tkhd`-Offsets in `video-file.ts`**
- Production v0=24 / v1=36 gegen Staging v0=20 / v1=32
- Warum nicht lösbar: Werte müssen gegen ISO/IEC 14496-12 verifiziert werden
- Empfehlung: Spezifikationsprüfung mit echten MP4-Testdateien vor Übernahme

**G5 – `package.json` / `bun.lock`**
- Staging hat viele Radix/shadcn-/Form-/Chart-Abhängigkeiten, Production Drizzle/Postgres und neuere Supabase-Version
- Warum nicht lösbar: automatischer Merge kann Staging-Builds brechen
- Empfehlung: manueller Merge (Staging-UI-Abhängigkeiten behalten, Production-Versionen anheben), danach Install + `bun run verify`

**G6 – Live-Staging-Schema unbekannt**
- Warum nicht lösbar: kein Lesezugriff auf die Staging-Datenbank aus diesem Projekt
- Empfehlung: Sync-Ausführung im Launchpad-Projekt mit `pg_catalog`-Abgleich

## H. Erforderliche DB-Migrationen

Zum Ausführungszeitpunkt **keine Production→Staging-Migration freigegeben**, weil das Live-Staging-Schema nicht verifizierbar ist.

Dateibasierter Befund:
- 229 Migrationen byteidentisch → nicht erneut anwenden
- Creator Subscription V1, Business Campaigns V1, Video V1 (`media_video_assets`, `posts.video_kind`, `REVOKE anon`), `business_plan_tier`, Rollen-Trennung: im Staging-Bestand bereits vorhanden → **nicht erneut migrieren**
- Staging enthält zusätzlich ca. 29 spätere Migrationen (u. a. Testbot) → bleiben Staging-only
- Production-eigene Funktionen `globe_vote_ensure_round` / `globe_vote_week_end`: im Staging-Snapshot nicht als Migrationsdatei nachweisbar → **einzige Kandidatenlücke**, vor Migration live gegen Staging prüfen
- `src/integrations/supabase/types.ts`: nach Schemaabgleich neu generieren, niemals manuell mergen

## I. Nicht zu übernehmende Daten

Users, Profile, Posts, Kommentare, Nachrichten, Kampagnen, Abonnements, Videos, Medien/Buckets,
Transaktionen, Arena-Daten, Notifications, Push-Subscriptions, Ops-/Audit-Daten, personenbezogene Daten.

## J. Environment-, Secret- und Stripe-Trennung

- Production bleibt `production`, Staging bleibt `staging`
- Nicht übernehmen: Live-Stripe-Keys, Webhook-Secrets, Service-Role-Keys, Production-Env-Variablen
- Ausgeschlossene Dateien: `.env`, `.env.development`, `.env.production`, `supabase/config.toml`
- Staging behält Sandbox-Payments, eigene Auth/Storage-Buckets und deaktivierten Production-Cron

## K. Finaler erwarteter Staging-Stand

- Alle Production-Security-Fixes aktiv (fail-closed Turnstile, Transkriptionslimits, Rollen-Guards, privilegierter `business_plan_tier`-Zugriff)
- Alle Production-Bugfixes aktiv (Environment-Auflösung, Titel-Kürzung, Video-Draft-Cleanup)
- Production-UI-Stand für Feed-Kanäle, Profil (Globe/Arena, iPhone-Responsivität), Video-Autoplay mit Ton-Schalter
- Staging-only erhalten: Testbot-Infrastruktur, shadcn-UI-Schicht, Kontotyp-/SlangTag-Rollentrennung (nach G1/G2)
- Ein einziges konsolidiertes Rollenmodul
- Schema identisch, ausgenommen bewusste Staging-Testtabellen
- Vollständige Environment-/Secret-/Stripe-/Storage-Trennung
- Abschluss erst nach `bun run verify`, DB-Integrationstests sowie E2E-/Video-/Campaign-Smoke-Tests im Staging-Projekt

## Freigabebedarf

Zur Fortsetzung werden Entscheidungen zu **G1–G5** und Lesezugriff auf das Staging-Schema (**G6**) benötigt.
