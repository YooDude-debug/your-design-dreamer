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

- Projekt: **Y-Dude Staging** (`4a5bd367-098d-4501-b206-9e1696fcc09c`, `https://y-dude-staging.lovable.app`)
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

**G1 – Rollenarchitektur → ✅ ENTSCHIEDEN (2026-09-02)**
- Zielstand: **Production-Rollenstand mit `src/lib/role-scope.ts`**.
- Rollen: Community, Creator, Unternehmer, Admin. Mehrfachrolle Creator + Unternehmer sieht weiterhin beide Bereiche.
- `public.user_roles` und `has_role()` bleiben die autoritative Rollenquelle; keine neue Rollenarchitektur.
- Staging-`role-visibility.ts` wird **nicht** als Zielarchitektur verwendet und darf keinen Production-Stand zurücksetzen. Die Datei bleibt im Staging-Baum liegen, wird aber nicht verdrahtet (toter Code, spätere Entfernung optional).
- Konsequenz für `CreatorSlangTagsDialog.tsx` / `creator.tsx` / `profile.$username.tsx`: Production-Fassung mit serverseitig ermittelten Rollenflags ist Ziel; ein clientseitig übergebenes `variant` darf keine Sichtbarkeits- oder Monetarisierungsentscheidung treffen.

**G2 – Business-Tarife → ✅ ENTSCHIEDEN (2026-09-02)**
- Maßgeblich sind die aktuellen Production-Tarife: **Business 14,90 €/Monat**, **Business Pro 39,00 €/Monat**; bereits vorhandene Jahresvarianten bleiben erhalten.
- Keine neuen Preise, keine Preisänderung, keine Änderung der bestehenden Stripe-Preislogik.
- Unternehmer-Konten dürfen weiterhin ohne aktives Abo existieren; die Option „Später entscheiden“ bleibt erhalten.
- `auth.tsx`: Production-`signupEntryCopy` und der Production-Registrierungs-/CAPTCHA-Fluss bleiben Ziel. Tarifhinweise dürfen nur mit exakt diesen Preisen dargestellt werden.

**G3 – Titelkürzung → ✅ ENTSCHIEDEN (2026-09-02)**
- Production bleibt erhalten: `slice(0, 40)` für automatisch erzeugte Titel ohne SlangTag in `CreatePostDialog.tsx` **und** die aktuelle `titleField`-Validierung (weiche Kürzung auf 300 Zeichen) in `post-moderation.functions.ts`.
- Die älteren Staging-Implementierungen (`z.string().max(300)` mit Ablehnung, keine 40-Zeichen-Kürzung) werden **nicht** übernommen.

**G4 – Video-Offsets → ✅ GEPRÜFT, KONFLIKT DOKUMENTIERT, PRODUCTION IST ZIEL**
- Bezug geklärt: Es geht **nicht** um Video V1-Schema, sondern um den `tkhd`-Body-Offset im MP4-Metadatenparser `src/lib/video/video-file.ts` (Auslesen von Breite/Höhe/Rotation).
- Production (`src/lib/video/video-file.ts:223-228`):
  ```ts
  const v = moov[tkhd.start]!;
  // v0 = 4×4+4 = 20 Byte → 24, v1 nutzt 64-Bit-Zeiten und -Dauer (8+8+4+4+8 = 32) → 36.
  const base = tkhd.start + (v === 1 ? 36 : 24);
  const matrixOffset = base + 16;
  ```
- Staging (`src/lib/video/video-file.ts:222-223`):
  ```ts
  const v = moov[tkhd.start]!;
  const base = tkhd.start + (v === 1 ? 32 : 20);
  ```
- Differenz: Staging rechnet um 4 Byte zu klein, weil das `version`/`flags`-Wort am Body-Anfang nicht mitgezählt wird. Nach ISO/IEC 14496-12 gilt für `tkhd`: version(1)+flags(3)+creation(4)+modification(4)+track_id(4)+reserved(4)+duration(4) = 24 Byte (v0) bzw. 8+8+4+4+8 = 36 Byte inkl. version/flags (v1).
- Ergebnis: Production ist der spezifikationskonforme, bereits live ausgelieferte Bugfix (korrekte Größe/Rotation) → **Production-Stand ist Zielstand**. Es wird nichts neu entworfen und nichts geraten; die Staging-Werte werden ausschließlich durch den Production-Fix ersetzt.

**G5 – Dependencies → ✅ ENTSCHIEDEN (2026-09-02): keine Upgrades**
- Staging behält seine bestehenden Dependency-Versionen. Keine allgemeine `package.json`-Bereinigung, kein Lockfile-Upgrade, keine Versionsanhebung „auf neueste“.
- Prüfung der zu übernehmenden Production-Codepfade: `role-scope.ts`, `role-guard.server.ts`, `ip-rate-limit.server.ts`, `turnstile.server.ts`, `public-transcribe.functions.ts`, `ad-plan.server.ts`, `business-campaigns.server.ts`, `post-moderation.functions.ts`, `CreatePostDialog.tsx`, `FeedPost.tsx`, `video/viewport-video.ts`, `video/video-sound.ts`, `video/video-file.ts`, `ProfilePanel.tsx`, `dev.tsx` nutzen ausschließlich bereits im Staging vorhandene Bausteine (React, TanStack Start/Router/Query, `zod`, `lucide-react`, `sonner`, Supabase-Client, Tailwind).
- **Ergebnis: keine zwingend erforderliche neue Dependency und keine erforderliche Version identifiziert.** `vite.config.ts` (Cloudflare Static-Cache) benötigt kein neues Paket.
- Production-Drizzle/Postgres-Devtools werden **nicht** nach Staging übertragen (Production-only Tooling).

**G6 – Live-Staging-Schema → 🟠 BLOCKED (verbleibender Blocker)**
- Aus dem Production-Workspace besteht kein Lesezugriff auf die Staging-Datenbank. Der Punkt wird nicht umgangen, nicht angenommen und nicht durch blinde Migration ersetzt.
- Fehlende Informationen:
  - angewandte Migrationshistorie der Staging-DB (`supabase_migrations.schema_migrations`)
  - tatsächliche Tabellen-/Spaltenliste (`information_schema.tables`, `information_schema.columns`)
  - vorhandene Functions inkl. `SECURITY DEFINER`-Flags (`pg_proc` / `pg_catalog`)
  - Trigger (`pg_trigger`), Constraints, Enums (`pg_type`)
  - RLS-Status und Policies (`pg_policies`, `pg_class.relrowsecurity`)
  - Grants (`information_schema.role_table_grants`, `has_function_privilege`)
- Zu verifizierende Objekte vor jeder Migrationsentscheidung:
  - `media_video_assets` (inkl. `video_processing_status`, Constraints, `REVOKE ALL … FROM anon`) und `posts.video_kind`
  - Creator Subscription V1: `creator_subscription_prices`, `creator_subscriptions`, `slang_tag_library`, `slang_tag_drops`, `has_active_creator_subscription`, `owns_slang_tag_permanently`, `claim_creator_slang_tag`, `run_exclusive_drop_maturation`, `lapse_pending_drops_on_subscription_change`, Cron-Job zur Drop-Reifung
  - Business Campaigns V1: `ad_campaigns` (8 Policies), `ad_campaign_event_guard`, `increment_campaign_metric`, `business_campaign_limit`, `enforce_business_campaign_limit`
  - `business_plan_tier` inkl. `EXECUTE`-Grants (Ziel: nur `postgres` + `service_role`)
  - Rollen: `app_role`-Enum, `user_roles`-Grants, `has_role`
  - `can_view_post`, `can_view_profile` Grants
  - `globe_vote_ensure_round` / `globe_vote_week_end` – einzige erkennbare Kandidatenlücke im Staging-Migrationsbestand
- Benötigter Zugriff: **read-only SQL-Zugriff auf die Staging-Datenbank des Projekts „Y-Dude Staging“** (`4a5bd367-098d-4501-b206-9e1696fcc09c`) bzw. Ausführung des Sync im Y-Dude-Staging-Projekt selbst, wo diese Abfragen möglich sind.


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

## Entscheidungsstatus (2026-09-02)

| Blocker | Status |
|---|---|
| G1 Rollenmodell | ✅ ENTSCHIEDEN – Production `role-scope.ts` |
| G2 Business-Tarife | ✅ ENTSCHIEDEN – 14,90 € / 39,00 €, keine Preisänderung |
| G3 Titelkürzung | ✅ ENTSCHIEDEN – Production `slice(0, 40)` + `titleField` |
| G4 Video-Offsets | ✅ GEPRÜFT – Production `tkhd` v0=24 / v1=36 ist Ziel, Diff dokumentiert |
| G5 Dependencies | ✅ ENTSCHIEDEN – keine Upgrades, keine neue Dependency erforderlich |
| G6 Staging-Schema | 🟠 BLOCKED – Lesezugriff fehlt (Audit: `docs/STAGING_SCHEMA_AUDIT_2026-09-02.md`) |

## Zu erhaltende Production-Fixes (nicht zurücksetzen)

Long-Post-Fix, `titleField`, `slice(0, 40)`, `role-scope.ts` und aktuelle Rollentrennung,
iPhone-`min-w-0`/`truncate`, `signupEntryCopy`, `getRequest()`-Environment-Fix, privilegierter
`business_plan_tier`-Pfad, Video V1, optionales Business-Abo, Business Campaigns,
Campaign-Environment-Fix, fail-closed Turnstile, Transkriptions-Rate-Limit,
Video-Draft-Cleanup, Viewport-Video-Autoplay.

## Abschluss

**🟠 BLOCKED – STAGING SCHEMA ACCESS REQUIRED**

Der Source-Sync-Plan ist vollständig und entscheidungsfrei ausführbar. Es fehlt ausschließlich
read-only SQL-Zugriff auf die Staging-Datenbank (Abschnitt G6), um Migrationen, Tabellen,
Functions, Trigger, Policies, Grants, Constraints und Enums zu verifizieren.

Es wurde kein Sync, keine Migration und kein Deployment durchgeführt. Production und Staging
bleiben unverändert.

