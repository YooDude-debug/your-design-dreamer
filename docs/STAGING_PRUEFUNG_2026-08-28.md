# Y-Dude – Technische Prüfung der Staging-Umgebung

Stand: 2026-08-28 · **Nur Bestandsaufnahme – keine Änderungen, keine Migrationen, keine Deployments**

## STAGING STATUS: 🟡 teilweise getrennt

Es gibt eine getrennte **Auslieferung** (Vorschau vs. veröffentlichte Version) und eine
umgebungsbewusste Anwendungslogik, aber **nur ein einziges Backend**. Datenbank, Auth,
Storage und Secrets sind zwischen Staging und Production identisch.

## 1. Übersicht

| Bereich    | Staging                                                                | Production                                                  | getrennt?      | Risiko                                                     |
| ---------- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------- | ---------------------------------------------------------- |
| Frontend   | Vorschau-Instanz (`id-preview--…lovable.app`, `project--…-dev.lovable.app`) | veröffentlichte Instanz (`y-dude.com`, `www.y-dude.com`, `y-dude.lovable.app`) | ✅ ja           | niedrig                                                    |
| Backend    | dieselben Server-Funktionen / API-Routen, nur anderer Host             | identischer Code                                            | ⚠️ nur logisch | mittel – Staging-Aufrufe treffen produktive Daten          |
| Database   | ein gemeinsames Cloud-Backend                                          | dasselbe                                                    | ❌ nein         | **hoch** – Testdaten und echte Daten in einer DB           |
| Auth       | gemeinsames Auth-System                                                | dasselbe                                                    | ❌ nein         | mittel – ein Testkonto ist technisch ein echtes Konto      |
| Storage    | gemeinsame Buckets                                                     | dieselben                                                   | ❌ nein         | mittel – Testmedien liegen im Produktivspeicher            |
| Secrets    | gemeinsamer Secret-Speicher (u. a. Push/VAPID, Turnstile, KI, Stripe)  | dieselben Werte                                             | ❌ nein         | mittel – abgemildert durch Umgebungs-Sperren (s. u.)       |
| Domains    | Vorschau-Hosts, unbekannte Hosts → immer „staging"                     | 3 fest hinterlegte Produktionshosts                         | ✅ ja           | niedrig                                                    |
| Deployment | jede Änderung ist sofort in der Vorschau                               | erst nach manuellem „Publish/Update"                        | ✅ ja           | niedrig – Staging kann Production nicht überschreiben      |
| GitHub     | nicht Teil des Deployments                                             | nicht Teil des Deployments                                  | ✅ ja           | keine – CI läuft nur noch manuell (`workflow_dispatch`)     |

## 2. Datentrennung

- **Production DB / API / Auth / Storage / Secrets / Server-Funktionen: gemeinsam genutzt.**
  Bei normalen Tests in der Vorschau werden produktive Tabellen und Buckets tatsächlich beschrieben.
- Vorhandene Schutzmechanismen (bereits umgesetzt):
  - `src/lib/environment.shared.ts` ordnet jeden Host eindeutig zu; ein **unbekannter Host gilt nie als Production**.
  - `src/lib/stripe.server.ts` blockiert Live-Zahlungen in Staging/Development.
  - Der Zahlungs-Webhook verwirft `?env=live`-Meldungen in Staging (`webhook_env_mismatch`).
  - Test-Mechanismen (Testwerbung, Livetest) sind admin-gebunden; Testprofile über `is_test_profile` / `can_view_test_users` sichtbarkeitsbeschränkt.
- **Nicht geschützt:** normale Schreibvorgänge (Beiträge, Nachrichten, Connections, Market-Artikel, Medien-Uploads) aus Staging landen in den Produktivdaten.

## 3. Deployment

- Staging: automatisch – jede Codeänderung ist unmittelbar auf der Vorschau-URL sichtbar.
- Production: **nur** durch bewusstes Veröffentlichen (Publish → Update). Frontend-Änderungen gehen erst dann live.
- Wichtige Ausnahme: **Backend-Änderungen (Migrationen, Server-Logik-Verhalten gegen die DB) wirken sofort**, weil das Backend geteilt wird. Ein „Staging-Test" mit Schemaänderung ist faktisch eine Produktionsänderung.
- Ein Staging-Deployment kann die veröffentlichte Frontend-Version **nicht** überschreiben.
- Kontrollierter Weg heute: Code in der Vorschau testen → `bun run verify` (Typprüfung, Lint, 480 Tests) → veröffentlichen. Für Schemaänderungen existiert dieser Weg **nicht**.

## 4. Domains / Hosts

| Host                            | Zuordnung   |
| ------------------------------- | ----------- |
| `y-dude.com`, `www.y-dude.com`  | PRODUCTION  |
| `y-dude.lovable.app`            | PRODUCTION  |
| `id-preview--…lovable.app`      | STAGING     |
| `project--…-dev.lovable.app`    | STAGING     |
| jeder weitere unbekannte Host   | STAGING (Sicherheitsvorgabe) |
| `localhost`, `127.0.0.1`, `*.local` | DEVELOPMENT |

## 5. GitHub

- Kein Bestandteil des Staging- oder Production-Deployments.
- `.github/workflows/ci.yml` läuft ausschließlich über `workflow_dispatch` (manuell) – keine automatischen Deployments, keine Fehler-Mails.
- Keine unerwünschte Betriebsabhängigkeit. GitHub = reines Backup.

## 6. Datenbank-Migrationen

- 231 Migrationsdateien, alle gegen **eine** Instanz angewendet → **es gibt keinen getrennten Migrationsstand**.
- Eine Migration landet immer direkt auf Production. Ein „erst in Staging testen" ist derzeit technisch nicht möglich.
- Risiko: destruktive oder fehlerhafte Migrationen wirken sofort auf echte Daten. Abgemildert durch Freigabe-Dialog vor jeder Migration, Backups und `scripts/restore-test.sh`.

## 7. Sicherheit

| Punkt              | Bewertung                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------- |
| RLS                | überall aktiv, Sichtbarkeit über gemeinsame `SECURITY DEFINER`-Prüffunktionen; zuletzt gehärtet |
| Auth               | funktional sauber, aber **eine** Nutzerbasis für alle Umgebungen                             |
| Secrets            | ein gemeinsamer Speicher; Live-Zahlungen in Staging gesperrt, Cron-Endpunkte secret-geschützt |
| API Keys           | nur publizierbare Schlüssel im Frontend (`VITE_*`); korrekt                                  |
| Service-Role-Key   | ausschließlich serverseitig, nie im Client-Bundle                                            |
| Storage            | gemeinsame Buckets, signierte URLs; Staging-Uploads landen produktiv                         |
| CORS               | Server-Funktionen sind gleichursprünglich; öffentliche API-Routen prüfen den Aufrufer selbst  |
| Environment-Vars   | identische Werte in allen Umgebungen; Trennung erfolgt nur über Hostname / `APP_ENV`          |

Fazit: kein akutes Leck, aber **Staging-Secrets sind Production-Secrets**.

## 8. Median / mobile Auslieferung (CDN)

Architektur ist geeignet:

- Medien liegen im Objekt-Storage, Zugriff über signierte URLs mit mehrschichtigem Cache (`src/lib/media.ts`, siehe `docs/MEDIEN_CDN_CACHE_2026-08-27.md`).
- Frontend-Assets sind versionierte, immutable Build-Artefakte.
- Eigene Domain vorhanden → ein CDN könnte später ohne Codeumbau davorgeschaltet werden.
- Einzige Einschränkung: signierte, kurzlebige URLs sind schlecht cachebar. Für stark nachgefragte öffentliche Medien wäre später ein öffentlich lesbarer Pfad oder ein Token mit langer Laufzeit nötig. Kein Blocker.

## 9. Bewertung

**A) Bereits sauber**
Frontend-Trennung, Publish-Gate für Production, Hostname-Zuordnung mit fail-safe-Regel,
Zahlungs-Isolation, GitHub ohne Betriebsrolle, RLS-Härtung, Tests (480) und Freigabe-Gate.

**B) Problematisch**
Gemeinsame Datenbank, gemeinsames Auth, gemeinsamer Storage, gemeinsame Secrets,
kein getrennter Migrationsstand. Tests in der Vorschau verändern echte Daten.

**C) Zwingend zu trennen (vor echtem Publikumsbetrieb / vor Team-Arbeit)**
Datenbank, Auth-Nutzerbasis, Storage-Buckets, Secrets, Migrationskette.

**D) Kann so bleiben**
Frontend-/Deployment-Trennung, GitHub als Backup, Umgebungslogik, Domain-Zuordnung,
Stripe-Modus-Steuerung, Cron-Absicherung.

**E) Notwendige Änderungen für eine professionelle Struktur**

1. Zweites Cloud-/Backend-Projekt als echtes Staging (eigene DB, Auth, Storage, Secrets).
2. Migrationen zuerst gegen Staging anwenden, danach kontrolliert auf Production.
3. Getrennte Secret-Sätze pro Umgebung (Push/VAPID, Turnstile, KI, Stripe).
4. Anonymisiertes Seed-/Testdatenset für Staging statt echter Nutzerdaten.
5. Vorschau-Instanz fest auf das Staging-Backend zeigen (`APP_ENV=staging` + eigene `VITE_SUPABASE_*`).
6. Freigabe-Checkliste: Staging grün → Migration Production → Publish.

**F) Auswirkungen einer Trennung**

- Kein Umbau der Produktlogik nötig – die Anwendung liest Backend-Adresse und Schlüssel bereits aus Umgebungsvariablen.
- Vorschau verliert den Zugriff auf echte Daten: bestehende Test-Accounts, Beiträge und Medien sind in Staging zunächst nicht vorhanden.
- Zusätzlicher Aufwand: zweite Infrastruktur (Kosten), doppelte Secret-Pflege, Migrations-Reihenfolge einhalten.
- Übergangsrisiko: einmaliges Nachziehen des Schemas und der Buckets in die neue Instanz.

**G) Eignung für 100k+ Nutzer**

Grundsätzlich ja: managed Postgres mit RLS, Edge-nahe Server-Funktionen, Keyset-Pagination,
Trigram-Indizes, Realtime auf enge Topics beschränkt, Medien im Objekt-Storage.
Vor dieser Größe erforderlich: echte Umgebungstrennung (dieser Bericht), CDN vor den Medien,
Kapazitäts-/Lasttests jenseits des bisherigen 500-Nutzer-Tests, sowie Beobachtung von
Realtime-Verbindungen und Feed-Abfragen als erste Engstellen.
