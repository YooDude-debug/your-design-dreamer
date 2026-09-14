# Y-Dude – Controlled Production Migration: kleine Performance-/Request-Optimierungen

Datum: 2026-09-14 · Umgebung: **PRODUCTION** (Projekt „Y-Dude", eine Cloud-Instanz für
Vorschau und veröffentlichte Website) · Quelle: Projekt „Y-Dude Staging"
(Snapshot-Commit `23ca00c4`)

---

## 1. Production-Ausgangsstand

| Punkt | Wert |
|---|---|
| Letzter Production-Commit vor der Übernahme | `4458ff288675bd8c11d1c0ba5d4ac548e05611c1` (2026-09-14 10:39 UTC, „Produktions-HBPDF erstellt") |
| Migrationsstand vorher | `drizzle/migrations` bis `0038` |
| `public.can_read_media` vorher | Vergleich mit Cast auf der **Spaltenseite** (`…::text = owner_seg`) |
| Enthielt Production die vier Request-Optimierungen? | **Nein** – Prüfung per Dateivergleich Staging↔Production: alle vier Änderungen fehlten vollständig, keine teilweise Übernahme, nichts doppelt angewendet |
| Enthielt Production den Storage-Access-Fix? | **Nein** – Funktionsdefinition aus der Live-Datenbank gelesen und verglichen |

## 2. Übertragene Änderungen

| Datei | Änderung | Staging-Test | Production-Ziel |
|---|---|---|---|
| `src/routes/_authenticated/market.$itemId.tsx` | `favorite()` invalidiert die Artikelabfrage nicht mehr; lokales Umschalten im Query-Cache, Übernahme des Serverwerts (`{ favorited }`), bei Fehler exakte Wiederherstellung des vorherigen Cache-Zustands | Testsuite grün, code-verifiziert (Staging-Doku Abschnitt 5) | Favoriten-Klick 8 → ~2 Zugriffe |
| `src/lib/social.tsx` | `messages`-INSERT-Listener: eigene Nachricht löst kein zweites `loadMessages` und keine Ungelesen-Abfrage aus | Testsuite grün, code-verifiziert | Nachricht senden 11 → ~7 Zugriffe |
| `src/lib/social.tsx` | `conversation_members`-Listener: eigenes `last_read_at`-Echo innerhalb `READ_ECHO_MS` (10 s) löst keine Folgeabfrage aus | Testsuite grün, code-verifiziert | Lesestand 4 → 1 Zugriff |
| `src/lib/use-debounced-value.ts` (neu) | Hook `useDebouncedValue` (300 ms, leerer Wert wirkt sofort) | Testsuite grün | Grundlage für Punkt 4 |
| `src/routes/_authenticated/channels.index.tsx` | 300-ms-Tippverzögerung, Enter sucht sofort, Leeren wirkt sofort, Ergebnisse je Begriff getrennt zwischengespeichert | Testsuite grün, code-verifiziert | 6 schnelle Zeichen → 1 Anfrage |
| `src/components/composer/FeedChannelPicker.tsx` | dieselbe Tippverzögerung im Kanal-Auswahlfeld des Composers | Testsuite grün, code-verifiziert | 6 schnelle Zeichen → 1 Anfrage |
| `public.can_read_media(text)` (DB) | Eigentümersegment einmalig nach `uuid` typisiert, Vergleich `uuid = uuid` gegen die typisierten Spalten statt Cast auf der Spaltenseite | Staging-Fix vom 2026-09-14, Query-Pläne belegt | vorhandene Indizes nutzbar statt sequenzieller Scans |

Übernahme erfolgte 1:1 aus dem Staging-Snapshot; die Dateidiffs enthielten ausschließlich
die oben genannten Abschnitte, keine weiteren Abweichungen.

### 2a. Notwendige Abweichung (Fehler aus Staging korrigiert)

Die Staging-Fassung von `can_read_media` benennt die neue Variable `owner_id`. In
`plpgsql` kollidiert dieser Name mit der Spalte `slang_tags.owner_id`; Postgres bricht die
Prüfung mit **SQLSTATE 42702 (ambiguous column)** ab. Wirkung nach dem ersten Anwenden:
Signierung fremder Mediendateien schlug fehl (`[media] sign failed database error, code:
42702`, HTTP 500), Bilder fremder Konten wurden nicht ausgeliefert. Reproduziert im
Browser-Smoke-Test unmittelbar nach der Migration.

Korrektur: Variable in `owner_uid` umbenannt – **keine** Änderung der Prüflogik, der
Reihenfolge Q1→Q6, der Sichtbarkeitsregeln, der Rechte oder der Policies.
Migration `0040_can_read_media_fix_ambiguous_owner`. Danach im Browser erneut geprüft:
Fehler verschwunden.

Hinweis für Staging: derselbe Namenskonflikt besteht dort weiterhin.

## 3. Nicht übertragene Änderungen

Bewusst **nicht** nach Production übernommen: Loadtest-Skripte, LOADTEST-Testdaten,
Staging-Testaccounts, Staging-Testartikel, Testtransaktionen, Testdateien, Testnachrichten,
Cleanup-Testdaten, staging-spezifische Konfiguration, experimentelle Änderungen,
Realtime-Optimierungen, Storage-Parallelisierung, neue Indizes, Connection-Pool-Änderungen
sowie alle in der Staging-Doku als „verbleibende Redundanzen" gelisteten Kandidaten
(Market-Startseite, „Für dich"-Feed, Item-Detail-Bündelung, `loadUnreadCounts`, sekundäre
Feed-Daten, `slang_tags`-Versionsprobe, Abbruchgrenze/Retry).

Keine RLS-, Policy-, Bucket-, Rechte-, Index- oder Schemaänderung. Keine neuen Features.

## 4. Betroffene Dateien

```
src/routes/_authenticated/market.$itemId.tsx   (geändert)
src/lib/social.tsx                             (geändert)
src/lib/use-debounced-value.ts                 (neu)
src/routes/_authenticated/channels.index.tsx   (geändert)
src/components/composer/FeedChannelPicker.tsx  (geändert)
drizzle/migrations/0039_can_read_media_uuid_compare.sql            (neu, angewendet)
drizzle/migrations/0040_can_read_media_fix_ambiguous_owner.sql      (neu, angewendet)
src/integrations/supabase/types.ts             (automatisch neu erzeugt)
```

## 5. Tests vor Deployment

| Prüfung | Ergebnis |
|---|---|
| Typprüfung (`tsgo --noEmit`) | fehlerfrei |
| Lint der geänderten Dateien | 0 Fehler, 4 vorbestehende Warnungen in `social.tsx` |
| Unit-/Komponententests | **664 / 664 grün** (46 Dateien) |
| Datenbank-Integrationstests | **68 / 68 grün** (8 Dateien) |
| Build | `build OK` |

## 6. Deployment

Production-Umgebung bestätigt (Projekt „Y-Dude", Live-Instanz). Keine Staging-Secrets,
keine Testdaten, keine Loadtest-Skripte ausgeführt. Datenbankänderung: ausschließlich
`CREATE OR REPLACE FUNCTION public.can_read_media(text)` (Migrationen 0039 und 0040);
Eigentümer und `EXECUTE`-Rechte bleiben durch `CREATE OR REPLACE` unverändert.

## 7. Smoke-Tests

Mit normalen Produktionsfunktionen, angemeldete Sitzung, keine künstliche Last.

| Prüfpunkt | Ergebnis |
|---|---|
| A) Market öffnen | 🟢 `/market` lädt, Artikelliste sichtbar, Artikelseite lädt |
| B) Favorit setzen | ⚪ **nicht ausführbar** – der einzige aktive Artikel gehört dem angemeldeten Konto; für eigene Artikel gibt es keinen Merken-Knopf. Änderung code-verifiziert, Browser-Klick **ungemessen** |
| C) Favorit entfernen | ⚪ dito |
| D) Nachricht senden | ⚪ **nicht ausgeführt** – ein Sendevorgang hätte eine echte Nachricht an ein reales Konto in der Live-Datenbank erzeugt; nach Vorgabe „keine Produktionsdaten manipulieren" unterlassen. Änderung code-verifiziert |
| E) Nachricht empfangen | ⚪ dito |
| F) Conversation öffnen | 🟢 `/messages` lädt fehlerfrei, keine Konsolenfehler |
| G) Kanalsuche verwenden | 🟢 gemessen: 6 schnell getippte Zeichen → **1 Suchanfrage**; Enter danach → 0 zusätzliche Anfrage (Begriff unverändert, Ergebnis zwischengespeichert); Leeren → 0 Anfrage |
| H) Bild anzeigen | 🟢 Artikelbild und Medien laden; die nach Migration 0039 aufgetretenen Signierfehler (HTTP 500, 42702) sind nach 0040 vollständig verschwunden |
| Feed | 🟢 `/feed` lädt, Tabs sichtbar, keine Konsolenfehler |
| Login/Sitzung | 🟢 angemeldete Sitzung trägt auf allen geprüften Routen |

Verbleibende Konsolenmeldung: eine 404-Ressource, bereits vor dieser Übernahme vorhanden,
kein Bezug zu den übertragenen Änderungen.

## 8. Ergebnis

Alle fünf beauftragten Optimierungen sind in Production aktiv. Ein aus Staging
mitgebrachter Fehler (Namenskonflikt in `can_read_media`) wurde im Smoke-Test entdeckt und
mit einer minimalen Korrektur behoben – ohne Änderung der Zugriffsregeln. Zwei
Smoke-Test-Blöcke (Favoriten-Klick, Nachrichtenversand) sind aus Datenschutz-/Datenlage-
Gründen **ungemessen** und nicht als grün bewertet.

## 9. Rollback-Stand

- Vorheriger Production-Stand: Commit `4458ff288675bd8c11d1c0ba5d4ac548e05611c1`.
- Codeseitiger Rollback: über die Versionshistorie des Projekts zu diesem Commit
  zurückkehren und erneut veröffentlichen.
- Datenbankseitiger Rollback: die vorherige Definition von `can_read_media` ist in diesem
  Bericht dokumentiert (Cast auf der Spaltenseite) und lässt sich per
  `CREATE OR REPLACE FUNCTION` wiederherstellen; es wurden keine Schema-, Rechte- oder
  Policy-Änderungen vorgenommen, ein Rückschritt ist daher verlustfrei möglich.
- **NICHT DOKUMENTIERT / EXTERN ZU PRÜFEN:** die Rückkehr zu einem älteren
  *veröffentlichten* Stand ist aus dem Repository nicht belegbar; sie erfolgt über die
  Plattformoberfläche.

## 10. Production-Status

Anwendung erreichbar, Build erfolgreich, Feed, Market, Kanäle, Nachrichten und Bilder
funktionieren; Tests, Typprüfung und Build grün.

---

## Bewertung

### 🟡 übertragen, aber einzelne Verifikation offen

Alle beauftragten Änderungen sind übertragen, geprüft und aktiv; der einzige aufgetretene
Fehler ist behoben und nachgeprüft. Die Einordnung bleibt gelb, weil Favoriten-Klick und
Nachrichtenversand im Browser **ungemessen** sind – für Ersteres fehlt ein fremder
Marktartikel, für Letzteres wäre ein Schreibvorgang in echte Nutzerdaten nötig gewesen.
