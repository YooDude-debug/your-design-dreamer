# Y-Dude – Production → Staging Synchronisationsaudit

**Datum:** 2026-09-02  
**Prüfumfang:** read-only Vergleich des zugänglichen Production-Arbeitsbereichs mit dem separaten Projekt **Y-Dude Staging** (ehemals Y-Dude Launchpad), Projekt-ID `4a5bd367-098d-4501-b206-9e1696fcc09c`.

## 1. Ergebnis / Freigabestatus

**Status: NICHT SYNCHRONISIERT – STOP-REGEL AKTIV.**

Der Vergleich bestätigt, dass Staging die relevanten Production-Schema-Migrationen für Creator Subscription V1, Business Campaigns V1 und Video V1 bereits als eigene, angewendete Migrationshistorie enthält. Der Production-Code ist jedoch nicht bytegleich mit dem Staging-Code. Eine blinde Übernahme wäre wegen aktiver Architektur- und Funktionskonflikte nicht sicher.

Eine tatsächliche Änderung an Staging wurde in diesem Audit nicht vorgenommen. Production-Daten, Benutzer, Medien und Secrets wurden nicht kopiert.

## 2. Vergleichsbasis

| Bereich | Production | Y-Dude Staging |
|---|---|---|
| Projekt | aktueller Production-Arbeitsbereich | `4a5bd367-098d-4501-b206-9e1696fcc09c` |
| Snapshot / Stand | HEAD `4bb5c76d719dbfa53a962e644d10f6e59d87e698` | read-only Snapshot `67b925bb` |
| Source-Dateien | 587 Dateien (`src`) | 632 Dateien (`src`) |
| Abweichende vorhandene Source-Dateien | – | 44 gemeinsame Dateien unterscheiden sich |
| Production-only Kernmodule | – | 5 Dateien fehlen in Staging |
| Routen | 69 | 69 |
| Production-Migrationsordner | 26 konsolidierte Drizzle-Dateien | – |
| Staging-Migrationsordner | – | 259 Supabase-Dateien |

Die Zählung der Dateien ist kein Beweis für eine Versionsgleichheit: Staging enthält zusätzlich eine umfangreiche UI-/shadcn-Komponentenschicht und eigene historische Dateien.

## 3. Klassifizierung der Abweichungen

### A – eindeutig übertragbar, nach Review

Diese Production-Bausteine sind isoliert und haben im Staging-Vergleich keinen gleichnamigen Gegenpart:

- `src/lib/ip-rate-limit.server.ts` – Schutz für den öffentlichen Transkriptionspfad.
- `src/lib/role-guard.server.ts` – serverseitige Rollenprüfung.
- `src/lib/role-scope.ts` – aktuelle Darstellung der Rollen `community`, `creator`, `business`, `creator_business`.
- `src/lib/video/video-sound.ts` – Feed-Soundpräferenz und Browser-Autoplay-Regeln.
- `src/lib/video/viewport-video.ts` – viewport-basiertes Video-Playback.

Diese Dateien dürfen erst in Staging übernommen werden, nachdem die Importpfade und das dortige `role-visibility.ts`-Konzept geprüft und die Staging-Tests im Zielprojekt ausgeführt wurden. Die Staging-Datei `src/lib/role-visibility.ts` ist nicht automatisch zu löschen oder zu ersetzen; sie ist eine semantische Architekturabweichung.

### B – bereits in Staging nachgewiesen / nicht erneut migrieren

Folgende Production-Schema-Stände sind in Staging durch byteidentische oder semantisch identische Migrationen nachgewiesen:

- Creator Subscription V1 inklusive Preis-/Drop-Migrationen.
- Business Campaigns V1 inklusive Status, Limits, Event-Guard, Metrikschutz und CTA/Drop-Erweiterungen.
- Video V1:
  - `media_video_assets` mit RLS, Constraints, Indizes und Update-Trigger.
  - `posts.video_kind` samt Constraint und Default.
  - Entzug der `anon`-Rechte auf `media_video_assets`.
- Die Production-Dateien `0023`, `0024` und `0025` sind in Staging byteidentisch vorhanden.
- Die Production-Role-Sicherheitsmigrationen `0006` und `0007` liegen in Staging als getrennte, zeitgestempelte Migrationen mit identischem SQL-Inhalt vor.

**Regel:** Diese Migrationen nicht erneut anwenden. Die unterschiedliche Dateibenennung ist kein Beleg für fehlenden Schema-Stand.

### C – semantische Konflikte, manuell zusammenführen

Die folgenden Bereiche unterscheiden sich funktional oder architektonisch und dürfen nicht blind aus Production überschrieben werden:

- `src/components/CreatePostDialog.tsx`
  - Production enthält die Korrektur für das Verwerfen von Video-Entwürfen.
  - Production begrenzt automatisch erzeugte No-SlangTag-Titel auf 40 Zeichen.
- `src/lib/post-moderation.functions.ts`
  - Production begrenzt Titel defensiv serverseitig auf 300 Zeichen.
- `src/routes/auth.tsx`
  - Production nutzt die aktuelle `signupEntryCopy`-Registrierungsführung.
  - Staging enthält eine ältere `accountTypeCopy`-Variante mit Tariftexten.
- `src/components/ProfilePanel.tsx`
  - Production enthält die aktuelle Rollentrennung und iPhone-Responsive-Sicherungen.
- `src/lib/video/video-file.ts`
  - Production enthält die korrigierten ISO-BMFF-`tkhd`-Offsets (v0 Base 24, v1 Base 36).
- Feed-/Video-/Campaign-/Moderationsdateien sowie Supabase-Client, Auth-Middleware und generierte Typen.
- `vite.config.ts`
  - Production enthält die aktuelle Cloudflare-Worker-first-Static-Cache-Konfiguration.
  - Staging hat dieselbe Grundkonfiguration, aber diese Production-Erweiterung fehlt.
- `package.json` / `bun.lock`
  - Staging hat zusätzliche, bereits verwendete UI-Abhängigkeiten.
  - Production hat Drizzle-/Postgres-Entwicklungsabhängigkeiten.
  - Lockfiles sind nicht identisch; kein Lockfile darf ohne Installations- und Verify-Lauf ersetzt werden.

### D – bewusst nicht synchronisieren

Folgende Inhalte dürfen ausdrücklich nicht aus Production nach Staging kopiert werden:

- `.env`, `.env.development`, `.env.production` und sämtliche Secret-Werte.
- Live-Stripe-Konfiguration oder Production-Payment-Token.
- Production-Benutzerkonten, Beiträge, Kommentare, Medien, Storage-Inhalte und Seeds.
- Production-Ads, Testdaten und Betriebsdaten.
- historische `.lovable/backup`- und Plan-Dateien ohne konkreten Quellcodebedarf.
- Production-Migrationsdateien, deren Schemawirkung in Staging bereits vorhanden ist.

## 4. Schema- und Sicherheitsbefund

Der Production-Live-Stand weist 122 öffentliche Tabellen auf; alle geprüften Tabellen haben RLS aktiviert und einen Primärschlüssel. Die drei policy-losen RLS-Tabellen (`ad_campaign_event_guard`, `slang_tag_track_dedup`, `market_payment_webhook_events`) sind Backend-/Dedup-Tabellen mit bewusstem Deny-by-default-Verhalten.

Der Supabase-Linter meldet 64 Hinweise in vier Typen:

- 3× RLS aktiviert, keine Policy – intentional für Backend-Guard-/Dedup-Tabellen.
- 2× Extensions im `public`-Schema – `pg_trgm`/`pg_net`, niedriges Hygiene-Risiko.
- 7× anon darf SECURITY-DEFINER-Funktionen ausführen.
- 52× authenticated darf SECURITY-DEFINER-Funktionen ausführen.

Der ergänzende Audit bestätigt für die benutzerdefinierten SECURITY-DEFINER-Funktionen einen gesetzten `search_path`; die Mehrzahl der gemeldeten Funktionen sind bewusst als RLS-/Backend-Helfer gestaltet. Diese Warnungen sind bei der Synchronisation nicht durch Statusänderungen oder Warnungsunterdrückung zu behandeln.

Die Production-Abfrage der internen Migrationstabelle war mit der verfügbaren Rolle nicht möglich. Deshalb wird die angewendete Migrationshistorie nicht anhand der Dateianzahl bewertet. Die in Staging nachgewiesenen Feature-Migrationen und der aktuelle Schema-Befund reichen aus, um eine erneute Anwendung der Video-/Business-/Creator-Migrationen auszuschließen; ein vollständiger `schema_migrations`-Abgleich bleibt ein offener Verifikationspunkt.

## 5. Umgebungs- und Datenisolation

Staging ist als separates Projekt mit eigener Datenbank, eigener Auth-Instanz und eigenem privaten `media`-Bucket dokumentiert. Die Staging-Dokumentation weist außerdem aus:

- `APP_ENV=staging`.
- Sandbox-only Payments; kein Live-Schlüssel.
- keine Production-Daten und eigene Testkonten.
- Production-Cron bewusst nicht aktiviert.

Die Runtime-Umgebungserkennung ist in Production und Staging identisch. Die konkrete Deployment-Konfiguration (`APP_ENV`, Supabase-Projekt und Payment-Variablen im laufenden Staging-Deployment) konnte aus diesem read-only Production-Arbeitsbereich nicht live verifiziert werden. Das muss vor dem nächsten Staging-Deployment als Gate geprüft werden.

## 6. Backup- und Konfliktstatus

Ein Staging-Backup wurde in diesem Arbeitsbereich nicht erstellt, weil der zugängliche Staging-Snapshot read-only ist und keine Änderungen am separaten Y-Dude-Staging-Projekt ausgeführt werden können. Die Production-Arbeitskopie war sauber; es gab keine Änderungen durch den Audit.

Damit greift die angeforderte Stop-Regel:

1. kein blindes Überschreiben gemeinsamer Dateien;
2. keine erneute Anwendung bereits vorhandener Migrationen;
3. keine Änderung an Production;
4. keine Änderung an Staging aus dem Production-Projekt;
5. Fortsetzung nur innerhalb des Staging-Projekts mit Live-Schema-Zugriff, Backup und manueller Konfliktfreigabe.

## 7. Empfohlener nächster Ablauf im Staging-Projekt

1. Staging-Datenbank, Storage, Auth und Payment-Umgebung live prüfen und Backup-/Rollback-Punkt erstellen.
2. `schema_migrations` bzw. die verfügbare Supabase-Migrationsliste gegen das Staging-Live-Schema prüfen.
3. Die fünf Production-only Kernmodule einzeln übernehmen und Import-/Rollen-Konflikte mit `role-visibility.ts` lösen.
4. Die in Abschnitt C genannten Dateien semantisch mergen; insbesondere Video-Draft-Cleanup, Titelgrenzen, `signupEntryCopy`, `ProfilePanel`, `video-file` und Feed-Video-Sound.
5. Nur wirklich fehlende Schemaänderungen als neue Staging-Migration anwenden; Creator-/Business-/Video-Migrationen nicht wiederholen.
6. RLS, Grants, Storage-Privatsphäre, Turnstile, Transkriptions-Rate-Limit und Business-/Creator-Berechtigungen prüfen.
7. Staging-Umgebungsvariablen und Sandbox-Paymentpfad separat bestätigen.
8. `bun run verify`, DB-Integrationstests, E2E-Smoke-Tests und Video-/Campaign-Smoke-Tests ausführen.
9. Erst nach grüner Prüfung den finalen Sync-Bericht mit Datei-, Schema- und Deployment-Hashes erstellen.

## 8. Abschlussbewertung

| Ziel | Bewertung |
|---|---|
| Read-only Production/Staging-Vergleich | **Erledigt** |
| Production-Schema fachlich gegen Staging-Migrationen abgeglichen | **Teilweise erledigt** – Live-Migrationshistorie von Staging fehlt |
| Production-Code vollständig nach Staging synchronisiert | **Offen** |
| Production-Daten/Secrets/Live-Stripe ausgeschlossen | **Erledigt** |
| Backup vor Änderungen | **Offen** – mangels Schreibzugriff im separaten Staging-Projekt |
| RLS/Grants/Security geprüft | **Teilweise erledigt** – Production live, Staging nur über Snapshot/Migrationen |
| Verification im Staging-Zielprojekt | **Offen** |

**Finale Entscheidung:** Die Synchronisation darf aus dem aktuellen Workspace nicht als abgeschlossen freigegeben werden. Der korrekte nächste Schritt ist die kontrollierte, semantische Umsetzung innerhalb des Projekts **Y-Dude Staging**, nicht das Kopieren von Production-Daten oder Secrets.
