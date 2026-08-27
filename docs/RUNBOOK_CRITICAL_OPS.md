# Y-Dude – Critical Operations Runbook

Stand: 2026-08-27. Für den Fall, dass eine andere Person das System übernehmen
oder ein akutes Problem lösen muss. Reine Handlungsanweisungen.

Vorher lesen (einmalig): `docs/ARCHITEKTUR.md`.
Vorfallsdokumentation und Datenschutzvorfälle: `docs/RUNBOOK_INCIDENT.md`.

Grundregeln:

- Nicht in Production experimentieren. Reproduktion immer in der Vorschau.
- Nichts löschen, solange die Ursache unklar ist.
- Jede Maßnahme kurz dokumentieren (`ops_incidents.note`).
- Freigabe-Gate niemals umgehen: `bun run verify`.

---

## §1 Fehlerhaftes Deployment / Rückkehr zu einem stabilen Stand

1. Fehlerbild festhalten: URL, Zeitpunkt, Umgebung (Preview oder Production).
2. Buildlog und CI-Ergebnis prüfen (`.github/workflows/ci.yml` →
   `scripts/verify.sh`). Ein rotes Gate wird nicht erzwungen.
3. Lokal reproduzieren: `bun install`, `bun run dev`, dann `bun run verify`.
4. Häufige Ursachen zuerst prüfen:
   - Import einer `*.server.ts` aus Route oder Komponente
   - geschützte Server-Funktion im Loader einer öffentlichen Route
   - Laufzeitcode auf Modulebene in einer `*.functions.ts`
   - fehlender `GRANT` bei einer neuen Tabelle
5. Wenn der Fehler durch die letzte Änderung entstand: **keine weitere
   Veröffentlichung.** Zuerst Ursache beheben, dann erneut veröffentlichen.
6. Alten Codestand holen: Git-Historie oder Sicherung unter
   `.lovable/backup/<datum>-<zweck>/`. Datei einzeln zurückspielen, nie den
   ganzen Ordner blind über `src/` kopieren.
7. Nach der Korrektur: `bun run verify`, veröffentlichen, Rauchtest (§6).

---

## §2 Backend / App antwortet nicht

1. `/admin/health` öffnen. Neue kritische Ereignisse oder offene Vorfälle?
2. Serverlogs des betroffenen Deployments prüfen (Preview und Published sind
   getrennt).
3. Prüfen, ob nur ein Teilbereich betroffen ist:
   - Startseite `/` lädt? → SSR in Ordnung
   - `/auth` funktioniert? → Auth in Ordnung
   - Feed leer, Rest funktioniert? → Datenzugriff oder RLS
4. Externe Abhängigkeiten prüfen: Lovable Cloud (Datenbank/Auth), Cloudflare
   (Auslieferung), Zahlungsanbieter, AI Gateway.
5. Wenn eine einzelne Funktion die Ursache ist: Funktion vorübergehend
   abschalten (z. B. Werbung über `/admin/ads`, Testmodus über
   `/admin/livetest`), statt die ganze App abzuschalten.
6. Ereignisse laufen nicht mehr ein (letzter `ops_events`-Eintrag alt)?
   → Cron-Endpunkte prüfen, siehe §5.

---

## §3 Datenbankproblem („permission denied“, fehlende Daten, langsame Abfragen)

1. Fehlermeldung genau lesen. `permission denied for table X` bedeutet fast
   immer: fehlender `GRANT`, nicht fehlende Policy.
2. Betroffene Tabelle prüfen: RLS aktiv? Policies vorhanden? `GRANT` für
   `authenticated` (und `anon` nur bei bewusst öffentlichen Tabellen)?
3. Für Reparaturen immer eine **neue Migration** in `supabase/migrations/`
   anlegen. Bestehende Migrationen nicht ändern.
4. Reihenfolge in der Migration: `CREATE TABLE` → `GRANT` →
   `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
5. Danach zwingend: `bunx vitest run tests/rls-policy-contract.test.ts` und
   Sicherheits-Scan.
6. Langsame Abfragen: Slow-Query-Ansicht im Backend, dann Index prüfen. Neue
   Indizes ebenfalls als Migration.
7. Datenverlust: kein eigenes Backup-Skript vorhanden – Wiederherstellung läuft
   über die Plattform-Backups von Lovable Cloud. Vorher `ops_incidents`-Eintrag
   anlegen und den Zeitpunkt des Verlusts festhalten.

---

## §4 Sicherheitsvorfall (kompromittierter Zugang, geleaktes Secret)

1. **Nichts löschen.** Löschlauf `retention-run` für betroffene Tabellen nicht
   auslösen, Spuren erhalten.
2. Eingrenzen: `account_security_events`, `admin_audit_log`, `ops_events`
   (Bereich `security`/`auth`), Auth-Logs, Cloudflare-Logs.
3. Betroffene Secrets rotieren (Secret-Verwaltung in Lovable):
   Cron-Token (`MODERATION_CRON_TOKEN` und die Einzel-Token), Webhook-Secret
   des Zahlungsanbieters, `LOVABLE_API_KEY`, VAPID-Schlüssel,
   `MASTER_ADMIN_PASSWORD`.
   Reihenfolge: neues Secret setzen → veröffentlichen → externen Aufrufer
   (Cron/Webhook) umstellen → altes Secret entfernen.
4. Sitzungen beenden bzw. Passwort-Reset für betroffene Konten anstoßen.
5. Schwachstelle beheben (Policy, Grant, Serverfunktion, Validierung), dann
   Sicherheits-Scan und `bunx vitest run`.
6. Vorfall dokumentieren nach Vorlage in `docs/RUNBOOK_INCIDENT.md` §4.

Bewusst nicht automatisiert: Sperren von Konten (`user_bans`) und Verbergen von
Inhalten (`posts.hidden_at`) bleiben manuelle Entscheidungen.

---

## §5 Hintergrundläufe (Cron) reparieren

Aktive Zeitpläne:

| Job                              | Takt          | Endpunkt / Aufgabe                       |
| -------------------------------- | ------------- | ---------------------------------------- |
| `post-moderation-worker`         | jede Minute   | `/api/public/moderation-run`             |
| `y-dude-counter-flush`           | jede Minute   | `flush_counter_events` (Zähler)          |
| `y-dude-push-run`                | jede Minute   | `/api/public/push-run`                   |
| `refresh-connection-suggestions` | 10 Minuten    | Connection-Vorschläge                    |
| `y-dude-ops-health`              | 5 Minuten     | `/api/public/ops-health-run` + Heartbeat |
| `y-dude-retention-run`           | 03:17 UTC     | `/api/public/retention-run` (Löschläufe) |

Vorgehen bei „läuft nicht mehr“:

1. Wirkung prüfen (z. B. Moderationsstatus bleibt `pending`, Push kommt nicht
   an, Zähler stehen still).
2. Zeitplan prüfen: ist der Job aktiv, wann war der letzte Lauf?
3. Antwort des Endpunkts prüfen. **401** bedeutet: Token stimmt nicht.
   Endpunkte akzeptieren ihr Einzel-Token oder ersatzweise
   `MODERATION_CRON_TOKEN`.
4. **5xx** bedeutet: Serverfehler → Serverlogs des Deployments, das der Job
   aufruft (stabile Adressen: `project--<id>.lovable.app` für Production,
   `project--<id>-dev.lovable.app` für Preview).
5. Nach der Korrektur einen Lauf abwarten und in `/admin/health` bestätigen.

---

## §6 Rauchtest nach jeder Wiederherstellung

Reihenfolge einhalten:

1. `/` lädt (kein 500).
2. `/auth`: Anmeldung funktioniert, Session wird gesetzt.
3. Feed lädt Beiträge inklusive Bildvarianten.
4. Profil und Connections laden (RLS als angemeldeter Nutzer).
5. Messenger: Nachricht senden, Lesestatus wird gesetzt.
6. Market: Artikelliste lädt; Checkout nur in Sandbox testen.
7. Medien: Bild und Audio eines Beitrags laden bzw. spielen.
8. `/admin/health`: keine neuen kritischen Ereignisse.

---

## §7 Zugänge und Abhängigkeiten (Übergabe-Checkliste)

Ohne diese Zugänge ist der Betrieb nicht möglich:

- Lovable-Projekt (Code, Veröffentlichung, Secrets, Serverlogs)
- Lovable Cloud Backend (Datenbank, Auth, Storage, Backups)
- Domainverwaltung für `y-dude.com` und Cloudflare-Konto
- Zahlungsanbieter-Konto (Live- und Sandbox-Schlüssel, Webhook-Konfiguration)
- E-Mail-Versand/Absenderdomain
- Google-Play-Konsole (PWA/Store-Auftritt, Testkonto)
- Alarmkanal und Heartbeat-Dienst (`OPS_ALERT_WEBHOOK_URL`,
  `OPS_HEARTBEAT_URL`) – **offen: noch nicht eingerichtet**
- Adminrolle in `user_roles` für mindestens zwei Personen

Offene Punkte aus dem Betriebsteil sind in
`docs/PHASE6_BETRIEB_AUSFALLSICHERHEIT_2026-08-27.md` geführt.
