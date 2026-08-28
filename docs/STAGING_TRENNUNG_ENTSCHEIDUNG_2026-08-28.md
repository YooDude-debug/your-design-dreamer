# Y-Dude – Trennung Staging / Production: technische Entscheidung

Datum: 2026-08-28 · Status: **nicht umgesetzt – technisch nicht innerhalb dieses Projekts möglich**

## 1. Befund

Dieses Projekt besitzt genau **ein** Cloud-Backend (Datenbank, Auth, Storage, Secrets).
Vorschau (Staging) und veröffentlichte Seite (Production) sind zwei Auslieferungen
**desselben** Codes gegen **dasselbe** Backend. Es gibt in der Projektstruktur keinen
Mechanismus, ein zweites, eigenständiges Backend anzulegen oder umzuschalten:

| Ressource | isolierbar im Projekt? | Grund |
|---|---|---|
| Frontend / Deployment | ✅ bereits getrennt | Vorschau- und Publish-Build sind unabhängig |
| Datenbank | ❌ | ein Projekt = ein Backend; kein zweites Schema-Ziel für Migrationen |
| Auth | ❌ | Benutzer/Sessions hängen am selben Backend |
| Storage | ❌ (Buckets nur logisch trennbar) | gleiche Storage-Instanz, gleiche Zugriffsschlüssel |
| Secrets / Env | ❌ | ein Secret-Satz pro Projekt; `SUPABASE_*` ist reserviert und nicht überschreibbar |
| Domains | ✅ getrennt | Vorschau-Host vs. y-dude.com |
| GitHub | ✅ nur Backup | CI nur manuell, kein Deployment |

## 2. Was **nicht** gebaut wurde (und warum nicht)

Bewusst **keine** Ersatzlösung wie
- ein zweites Schema `staging` in derselben Datenbank,
- ein Präfix `staging_` auf Tabellen/Buckets,
- ein Env-Schalter, der im gleichen Backend „umschaltet“.

Alle drei würden weiterhin dieselben Zugangsschlüssel, dieselbe Auth-Instanz und
dieselbe Datenbank verwenden. Ein Fehler in Staging könnte Production-Daten
weiterhin verändern – die Isolation wäre nur scheinbar. Das widerspricht dem Ziel.

## 3. Sichere Alternative (empfohlen)

**Zwei Projekte statt zwei Umgebungen in einem Projekt:**

1. Dieses Projekt bleibt **Production** (unverändert, keine Datenmigration nötig).
2. Ein **Remix/Kopie** dieses Projekts wird als **Staging** angelegt. Der Remix
   erhält automatisch ein **eigenes** Cloud-Backend: eigene Datenbank, eigene
   Benutzer, eigenen Storage, eigene Secrets.
3. Migrationen und Änderungen werden zuerst im Staging-Projekt gebaut und getestet,
   danach identisch im Production-Projekt angewendet.
4. Externe Secrets (Stripe, Alert-Webhook, KI) werden im Staging-Projekt bewusst
   mit Test-Werten belegt – niemals mit Production-Credentials.

Damit sind Datenbank, Auth, Storage und Secrets vollständig getrennt; Median/CDN
zeigt später ausschließlich auf das Production-Projekt.

## 4. Erforderliche manuelle Schritte (durch den Betreiber)

1. Production-Backup anfertigen (Datenbank-Export + Storage-Export) **vor** allem Weiteren.
2. Dieses Projekt remixen und den Remix z. B. „Y-Dude Staging“ nennen.
3. Im Staging-Projekt Cloud aktivieren und alle Migrationen einmalig anwenden lassen.
4. Im Staging-Projekt Testdaten anlegen (keine Production-Daten kopieren).
5. Im Staging-Projekt Test-Secrets setzen; Production-Secrets dort nicht eintragen.
6. Ab dann: Änderungen zuerst Staging → `bun run verify` → dann Production.

## 5. Bis dahin geltender Schutz (bereits vorhanden)

- Host-basierte Umgebungserkennung (`src/lib/environment.shared.ts`): unbekannte Hosts
  gelten nie als Production.
- Zahlungen: Live-Modus in Staging/Development gesperrt (`src/lib/stripe.server.ts`).
- Test-Mechanismen in Production nur nach ausdrücklicher Freigabe
  (`ALLOW_TEST_FEATURES_IN_PRODUCTION`).
- Migrationen laufen nur nach ausdrücklicher Freigabe; GitHub deployt nichts.
- Freigabe-Gate vor dem Veröffentlichen: `bun run verify`.

**Restrisiko bis zur Umsetzung von Abschnitt 3:** Tests in der Vorschau schreiben in
echte Daten. Deshalb gilt weiterhin: keine Lasttests und keine Löschtests in der Vorschau.
