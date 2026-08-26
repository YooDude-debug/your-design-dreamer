# Y-Dude – Professionelles Sicherungsnetz (Stand 26. August 2026)

Dieses Dokument beschreibt den Betriebs-, Sicherheits- und Testrahmen von Y-Dude.
Es ist so geschrieben, dass ein externer Entwickler den Betrieb übernehmen kann.
Es wurden in dieser Phase **keine Produktfeatures** hinzugefügt oder entfernt.

---

## 1. Automatisierte Tests

### Ausführen

```bash
bun run test        # einmalig (CI-taugliche Ausführung)
bun run test:watch  # während der Entwicklung
```

Konfiguration: `vitest.config.ts` (Node-Umgebung, `tests/**/*.test.ts`, Alias `@ → src`).
Die Tests laufen **ohne** Zugriff auf die Produktionsdatenbank und ohne Netzwerk.

### Vorhandene Testabdeckung

| Datei | Bereich | Was abgesichert wird |
|---|---|---|
| `tests/payments-webhook-signature.test.ts` | Geldpfad / Sicherheit | HMAC-Signatur gültig/manipuliert/fremdes Environment, veränderter Nachrichtentext, fehlende Signatur, ungültiges Format, Replay-Schutz (alter Zeitstempel), Secret-Rotation (mehrere `v1`) |
| `tests/payments-webhook-idempotency.test.ts` | Geldpfad | Ungültiges Environment wird ignoriert, ungültige Signatur → 400 und **keine** Verbuchung, Marktzahlung genau einmal, doppelte Hervorhebung/Abo-Ereignisse verworfen, unbezahlte Sitzung ignoriert, fremde Ereignisarten ignoriert |
| `tests/push-texts.test.ts` | Messenger / Push | Empfängersprache (ui_language → Freitext → Standard), Bündelung von Likes/Nachrichten, **kein Nachrichteninhalt** in der Push, externe Links im Sprungziel werden verworfen |
| `tests/feed-ranking.test.ts` | Feed | Begrenzung/NaN-Schutz der Ranking-Hilfen, Ortsnormalisierung, Determinismus des Re-Rankings, Ergebnismenge bleibt vollständig, klar relevantere Beiträge bleiben vorne |
| `tests/media-variants.test.ts` | Medien | Variantenkette (Medium → Thumb → Original), keine Varianten von Varianten/externen URLs, Detailansicht nie quadratisch (Regression P-01) |
| `tests/observability.test.ts` | Betrieb | Redaktion von Passwörtern, Tokens, Schlüsseln, E-Mail, Nachrichteninhalt und Signaturen; Aufbau des Protokolleintrags |

Aktueller Stand: **49 Tests, 6 Dateien, grün.**

### Noch offen (bewusst nicht in diesem Schritt)

Authentifizierung, RLS-Grenzen und RPC-Berechtigungen lassen sich **nicht** sinnvoll
als reine Logiktests prüfen – sie brauchen eine echte Datenbank mit zwei Testnutzern.
Solange keine getrennte Staging-Datenbank existiert (siehe Abschnitt 2), würden solche
Tests gegen Produktionsdaten laufen. Das wird ausdrücklich **nicht** gemacht.
Vorbereitung: Testdatei-Skelett und Ablauf sind in Abschnitt 2 beschrieben.

---

## 2. Staging / Production

### Ist-Zustand (ehrlich)

Es existiert **eine** Backend-Instanz (Lovable Cloud) mit zwei Ansichten:
Preview-Deployment und Published-Deployment – beide arbeiten auf **derselben Datenbank**.
Eine echte Trennung Development → Staging → Production ist damit **nicht** gegeben.

Test-/Demo-Mechanismen im gemeinsamen Pfad und ihr Schutz:

| Mechanismus | Ort | Schutz heute | Bewertung |
|---|---|---|---|
| Testwerbung / Livetest | `ad_test_settings`, `ad_test_events` | RLS: nur Admin-Rollen dürfen lesen/schreiben; Anzeige nur für Admins | ausreichend |
| Demo-Chat | `src/routes/demo.messenger.tsx` | rein statisch, keine echten Daten, `robots: noindex` | ausreichend |
| Entwickler-Feed | `src/routes/_authenticated/dev.tsx` | nur eingeloggt; produktive Feed-Ansicht | umbenennen wäre kosmetisch, kein Risiko |
| Testnutzer | `is_test_profile`, `can_view_test_users` | Sichtbarkeit nur für Admins | ausreichend |
| Testzahlungen | Stripe `sandbox` vs. `live` | getrennte Secrets, getrennte Webhook-Endpunkte (`?env=`) | gut getrennt |

**Ergebnis:** Es gibt keine Stelle, an der Testwerbung oder Demo-Logik für normale
Nutzer in Production aktiv werden kann. Was fehlt, ist die **Datentrennung**.

### Voraussetzungen für echtes Staging (DevOps-Aufgabe)

1. Zweites Cloud-Projekt als Staging (eigene Datenbank, eigene Auth-Instanz).
2. Migrationen zuerst auf Staging, dann auf Production anwenden (gleiche SQL-Dateien).
3. Eigene Stripe-Sandbox-Keys und eigener Webhook-Endpunkt für Staging.
4. Anonymisierter Datenabzug (kein Klartext-Kontakt, keine Chatinhalte) für Staging.
5. Danach: RLS-/Auth-Integrationstests gegen Staging in `tests/` ergänzen.

Bis dahin gilt: **keine scheinbare Trennung** – dieser Abschnitt dokumentiert den echten Zustand.

---

## 3. Observability

### Strukturierte Protokolle

`src/lib/observability.server.ts`

```ts
logEvent({ area: "payments", event: "webhook_invalid_env", severity: "warn", context: { env } });
logFailure("payments", "webhook_failed", error, { env });
logIfSlow("payments", "webhook", Date.now() - started, { env });
```

Ausgabeformat (eine Zeile JSON, in der Protokollansicht filterbar):

```json
{"ts":"2026-08-26T16:24:54.126Z","sev":"critical","area":"payments","event":"webhook_failed","ctx":{"env":"sandbox","error":"Error: Invalid webhook signature"}}
```

- `area`: auth | payments | market | messenger | push | feed | database | moderation | server
- `sev`: debug | info | warn | error | critical
- `ms`: Dauer (wird bei Auffälligkeit über `logIfSlow`, Schwelle 1500 ms, geschrieben)
- `ctx`: nur technische Kennungen. Passwörter, Tokens, Schlüssel, Cookies, E-Mail,
  Adressen, Nachrichteninhalte und Signaturen werden automatisch durch `[redacted]` ersetzt
  (getestet in `tests/observability.test.ts`).

### Bereits vorhandene Bausteine

- `src/lib/error-capture.ts` – erhält Stacktraces, die vom Server-Framework verschluckt würden.
- `src/lib/runtime-metrics.server.ts` – anonyme Summen (Anfragen, parallele Anfragen, Fehler, Latenz, Event-Loop-Lag).
- `src/start.ts` – `metricsMiddleware` + `errorMiddleware` über allen Serveraufrufen.
- `/api/public/cache-metrics` – Kennzahlen der Caching-Schicht.

### Verdrahtet in dieser Phase

- Zahlungs-Webhook (`src/routes/api/public/payments/webhook.ts`): ungültiges Environment (`warn`),
  fehlgeschlagene/abgewiesene Meldung (`critical`), auffällige Laufzeit (`warn`).

### Fehleranalyse in der Praxis

1. Protokoll nach `"sev":"critical"` filtern → betroffener `area`/`event`.
2. `ctx.env`, `ctx.transactionId`, `ctx.eventId` als Einstieg in die Datenbank nutzen.
3. Bei Zahlungen: `market_payment_webhook_events` (Ereignis angekommen?) →
   `market_payment_records` (Anbieterstatus) → `market_transactions` (Fachstatus) →
   `market_transaction_events` (Verlauf).

### Offen (DevOps)

Aktives **Alerting** (Push/E-Mail bei `critical`) und eine Protokoll-Aufbewahrung über die
Plattformgrenze hinaus sind nicht eingerichtet. Empfehlung: Log-Drain in ein externes
Ziel und Regel „mehr als N critical/5 min → Benachrichtigung“.

---

## 4. Geldpfad (Market / Stripe)

Kette: User → Market → Checkout → Stripe → Webhook → Datenbank → Order/Payment-Status → Refund/Dispute

### Prüfung der bestehenden Umsetzung

| Risiko | Umsetzung heute | Bewertung |
|---|---|---|
| Manipulierte Webhooks | HMAC-SHA256 über `t.body` gegen Environment-Secret, Zeitfenster 300 s | 🟢 abgesichert + getestet |
| Doppelte Webhooks | eindeutiger Eintrag in `market_payment_webhook_events` (`provider`+`event_id`); Insert-Fehler ⇒ Abbruch | 🟢 abgesichert + getestet |
| Doppelte Verbuchung | zusätzlich bedingtes Update `... .neq("payment_status","paid")` | 🟢 doppelt gesichert |
| Race Condition Reservierung | `market_start_transaction` (SECURITY DEFINER) reserviert Artikel atomar und friert den Preis ein | 🟢 |
| Preismanipulation im Request | Betrag kommt aus der Transaktionszeile, nicht aus dem Client | 🟢 |
| Berechtigungen | jede Server-Funktion in `market-tx.functions.ts` läuft über `requireSupabaseAuth`; Rolle wird im Handler geprüft | 🟢 |
| Zugriff auf Zahlungsgeheimnisse | `market_transaction_secrets` und `market_payment_webhook_events` ohne Client-Zugriff | 🟢 |
| Abo-Status | ausschließlich aus `customer.subscription.*`, Checkout-Sitzung ändert ihn nicht | 🟢 |
| Fachliche Statusfolge | `market_transaction_events` als Verlauf, `guard_transaction_events` als Wächter | 🟢 |
| Refund/Dispute | Anfrage durch Käufer, Entscheidung nur über Admin-Funktionen (`adminDecide*`) | 🟡 Entscheidungen sind nicht automatisiert getestet |

**Gefundene Restrisiken (nicht verändert, bewusst dokumentiert):**

1. Rückerstattungen werden fachlich gesetzt, aber nicht automatisch beim Anbieter ausgelöst –
   die Auszahlung geschieht manuell. Bewertung: geringes Risiko, klarer Prozess nötig.
2. Kommt ein Webhook nie an (Anbieterausfall), bleibt die Transaktion in `pending`.
   Es existiert kein Abgleichlauf („reconciliation“). Empfehlung: täglicher Vergleich
   offener Transaktionen gegen den Anbieter. Aufwand klein, Nutzen hoch.
3. Der Diversity-Layer des Feeds ist bei nahezu gleichen Scores wirkungslos, weil alle
   Kandidaten dieselbe gedeckelte Strafe erhalten (in `tests/feed-ranking.test.ts` als
   Determinismus dokumentiert). Kein Sicherheitsrisiko, nur Feed-Abwechslung.

---

## 5. Backup / Restore

### Was gesichert wird

- **Datenbank** (Lovable Cloud, verwaltet): automatische Point-in-Time-Sicherungen der
  Plattform. Enthält alle ~110 Tabellen inkl. Auth-Nutzer.
- **Medien** (Storage-Buckets): Bilder, Audio, Varianten – **nicht** Teil des DB-Backups.
- **Code + Migrationen**: vollständig versioniert im Projekt (`supabase/migrations/`).

### Kritische Daten (Priorität bei einer Wiederherstellung)

1. `auth.users` + `profiles` (ohne sie ist nichts zuzuordnen)
2. `market_transactions`, `market_payment_records`, `market_payment_webhook_events` (Geld)
3. `messages`, `conversations`, `conversation_members` (Kommunikation)
4. `posts`, `slang_tags`, `slang_definitions` (Inhalte)
5. Medien im Storage (Verweise in der DB werden sonst zu Platzhaltern)

### Abhängigkeiten

- DB-Zeilen verweisen auf Storage-Pfade: Datenbank und Medien müssen **zum gleichen
  Zeitpunkt** wiederhergestellt werden, sonst entstehen tote Bildpfade.
- Stripe ist die führende Quelle für Zahlungen: nach einem Restore muss der Zeitraum
  zwischen Backup-Zeitpunkt und Ausfall gegen den Anbieter abgeglichen werden.
- Push-Abos (`push_subscriptions`) sind unkritisch – Clients registrieren sich neu.

### Wiederherstellung

1. Ausfall feststellen, Umfang eingrenzen (DB, Storage, Anwendung).
2. Anwendung in einen Lesezustand bringen bzw. Wartungshinweis zeigen.
3. Datenbank aus dem Plattform-Backup auf den letzten konsistenten Zeitpunkt zurücksetzen.
4. Medien aus der Bucket-Sicherung auf denselben Zeitpunkt bringen.
5. Zahlungen abgleichen (Stripe-Ereignisse nach Backup-Zeitpunkt erneut zustellen –
   die Idempotenzsperre verhindert Doppelbuchungen).
6. Stichproben: Login, Feed lädt, Bild sichtbar, Chat lesbar, offene Transaktion korrekt.
7. Vorfall dokumentieren (`docs/BETRIEB_LOGS_BACKUPS_VORFALL.md`).

### Restore-Test

Ein echter Restore-Test wurde **nicht** durchgeführt: es gibt keine zweite Umgebung,
in der er ohne Gefahr für Produktionsdaten laufen könnte (siehe Abschnitt 2).
Er ist die erste Aufgabe, sobald Staging existiert. Ein Restore-Versuch auf der
Produktionsinstanz ist ausdrücklich untersagt.

---

## 6. Produktionsbereinigung

Geprüft, **nichts blind entfernt**:

- `src/routes/demo.messenger.tsx` – wird für Marketing-Clips gebraucht, statisch, `noindex`. **Bleibt.**
- `src/routes/_authenticated/dev.tsx` – ist trotz Namens die produktive Feed-Route. **Bleibt.**
- Test-Werbekarten – ausschließlich für Admins sichtbar, ausdrücklich gewünscht. **Bleibt.**
- `.lovable/backup/**` – Wiederherstellungskopien, nicht Teil des Builds. **Bleibt.**
- Debug-Ausgaben – `console.debug` in `challenge-tracking.ts` ist bereits an
  `import.meta.env.DEV` gebunden. Fehlerausgaben laufen absichtlich in das Protokoll.

Empfehlung für später: `dev.tsx` in `feed.tsx` umbenennen (rein kosmetisch, betrifft
Route-Baum und Verlinkungen – deshalb nicht in dieser Phase).

---

## 7. Sicherheit (Kurzreferenz)

- **Auth**: Supabase Auth; geschützte Seiten liegen unter `src/routes/_authenticated/`
  mit clientseitigem Zugangs-Gate. Server-Funktionen prüfen den Bearer-Token selbst
  (`requireSupabaseAuth`) – die Seitensperre ist nur Komfort, nicht die Sicherheitsgrenze.
- **Rollen**: eigene Tabelle `user_roles` + `has_role(user, role)` (SECURITY DEFINER).
  Rollen liegen **nie** im Profil. `admin_owners` schützt die Eigentümerrolle.
- **RLS**: auf allen Nutzertabellen aktiv, Policies auf `auth.uid()` bezogen;
  Sichtbarkeitsprüfungen laufen über `can_view_post`, `can_view_profile`,
  `is_conversation_member`, `can_use_slang_tag`.
- **Kritische RPCs**: `market_start_transaction`, `market_accept_offer`,
  `mark_conversation_read`, `has_active_subscription`, `market_expire_promotions` –
  alle mit festem `search_path` und geprüften Aufruferrechten.
- **Nie protokollieren**: Passwörter, Tokens, Schlüssel, Signaturen, E-Mail-Adressen,
  Chatinhalte (technisch erzwungen in `observability.server.ts`).

---

## 8. Abschlussbericht

| Bereich | vorher | nachher | Status |
|---|---|---|---|
| Automatisierte Tests | 0 Tests, kein Runner | Vitest + 49 Tests über Geldpfad, Push, Feed, Medien, Logging | 🟡 |
| Staging | keine Trennung, undokumentiert | Ist-Zustand geprüft und dokumentiert, Voraussetzungen definiert, Test-/Demo-Pfade nachweislich admin-gebunden | 🟡 |
| Monitoring | Kennzahlen + Stacktraces, unstrukturiert | strukturierte JSON-Logs mit Severity/Bereich/Kontext, PII-Redaktion (getestet), Geldpfad verdrahtet | 🟡 |
| Stripe/Payments | funktionierend, ungeprüft | Signatur, Replay, Idempotenz, Doppelverbuchung automatisiert abgesichert | 🟢 |
| RLS/Security | gehärtet, ohne Tests | Sicherheitsmodell dokumentiert; Logik-Sicherheitstests vorhanden, DB-Grenztests offen | 🟡 |
| Backup/Restore | „es gibt Backups“ | vollständig dokumentierter Wiederherstellungsablauf inkl. Abhängigkeiten; echter Test offen | 🟡 |
| Production Cleanup | ungeprüft | jede Test-/Demo-Stelle bewertet, nichts unnötig entfernt | 🟢 |

### Neu abgesicherte kritische Pfade

- Zahlungs-Webhook: Signatur, Zeitfenster, Environment-Trennung, Idempotenz, keine Doppelverbuchung.
- Push: keine Nachrichteninhalte, richtige Empfängersprache, keine externen Sprungziele.
- Medien: Feed lädt niemals ungefragt Originalbilder (Regression P-01).
- Logging: technisch erzwungene Redaktion von Geheimnissen und PII.

### Offene Risiken

1. Keine getrennte Staging-Datenbank ⇒ keine RLS-/Auth-Integrationstests, kein Restore-Test.
2. Kein aktives Alerting bei `critical`-Ereignissen.
3. Kein Abgleichlauf für Zahlungen ohne eingetroffenen Webhook.
4. Rückerstattungen werden beim Anbieter manuell ausgelöst.

### Für Spezialist/DevOps

- Zweites Cloud-Projekt als Staging + Migrations-Pipeline (Abschnitt 2).
- Log-Drain und Alarmregeln (Abschnitt 3).
- Erster echter Restore-Test auf Staging (Abschnitt 5).
- Täglicher Zahlungsabgleich gegen den Anbieter (Abschnitt 4).
