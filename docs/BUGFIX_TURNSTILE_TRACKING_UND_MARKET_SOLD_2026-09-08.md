# Bugfix 2026-09-08 – Turnstile-Tracking & Market „reserved → sold“

Scope: ausschließlich die beiden gemeldeten Fehler. Keine neuen Features, keine
UI-Redesigns, keine historischen Daten verändert oder gelöscht. Nicht veröffentlicht.

## Bug 1 – „turnstile_failed“ obwohl der Security Check ok war

**Root Cause:** `src/components/Turnstile.tsx` meldete jeden „nicht nutzbar“-Zustand
über denselben Callback (`onUnavailable(true)`), ohne Grund zu unterscheiden. Dazu
gehörte auch die reine Heuristik „Widget nach 15 s noch nicht im DOM erkannt“ –
also ein **Lade-/Wartezustand**. `src/routes/auth.tsx` protokollierte jeden dieser
Fälle als `turnstile_failed` (`detail: "unavailable"`). Belegt in der Datenbank:
22 × `turnstile_failed / unavailable` gegenüber 27 × `turnstile_loaded`.

**Fix:**

- `src/components/Turnstile.tsx`: neuer Typ `TurnstileFailureReason`
  (`error | timeout | script | sitekey | not_rendered`); `onUnavailable` liefert
  jetzt zusätzlich den Grund. Erfolg (`callback`) setzt weiterhin `succeeded` und
  überstimmt jeden späteren Timeout/Fehler; `expired-callback` löscht nur das
  Token (kein Fehler); `reset()` setzt `succeeded` zurück.
- `src/routes/auth.tsx`: `turnstile_failed` wird nur noch bei echten Fehlschlägen
  (`error`, `timeout`, `script`, `sitekey`) getrackt, mit dem Grund im `detail`.
  `not_rendered` (Laden/Warten) wird nicht mehr als Fehler protokolliert; die
  blockierende UI-Meldung/der Retry-Button bleiben unverändert.

Analytics-/Dashboard-Struktur, Event-Enum und Ursachenliste unverändert.

## Bug 2 – Artikel bleibt nach bestätigter Übergabe „reserved“

**Root Cause:** `markSold()` in `src/lib/market-tx.server.ts` führte zwei getrennte,
nicht atomare Updates aus: erst `market_transactions.status = completed`, dann
`market_items.status = sold`. Das Ergebnis des Artikel-Updates wurde **nicht geprüft**
(kein Error-Handling, kein Logging). Schlug es fehl (Trigger-Fehler, Abbruch,
Netzwerk), war der Vorgang „completed“, der Artikel aber weiter „reserved“ – genau
das gemeldete Symptom. `completeOpenTransactionsForItem()` setzte den Artikelstatus
gar nicht mit.

**Fix:**

- Neue Datenbankfunktion `public.market_complete_transaction(_tx_id, _seller_id)`
  (Migration `drizzle/migrations/0037_market_complete_transaction_atomic.sql`,
  SECURITY DEFINER, `search_path = public`, EXECUTE nur `service_role`):
  sperrt Vorgang und Artikel (`FOR UPDATE`), setzt beide Status in **einer**
  Transaktion, weist `cancelled`/`refunded` ab, wirft `already_sold`, wenn Vorgang
  *und* Artikel bereits abgeschlossen sind, und gibt den persistierten Artikelstatus
  zurück. Bestehende Tabellen und Statuswerte werden wiederverwendet.
- `src/lib/market-tx.server.ts`: `markSold()` nutzt diese Funktion, prüft Fehler,
  loggt sie serverseitig und wirft `complete_failed`, wenn der Artikel danach nicht
  wirklich `sold` ist. `completeOpenTransactionsForItem()` (Listing direkt auf
  „verkauft“) nutzt dieselbe Funktion und setzt damit auch den Artikelstatus mit.

Folge: Der Artikel ist nach der Bestätigung persistent `sold`, verschwindet aus
aktiven/unverkauften Listen (Filter auf `status` unverändert), kann nicht erneut
reserviert werden, und ein zweiter Handover wird mit `already_sold` abgewiesen.

## Geänderte Dateien

- `src/components/Turnstile.tsx`
- `src/routes/auth.tsx` (nur der Tracking-Callback der Registrierung)
- `src/lib/market-tx.server.ts`
- `tests/market-transaction-flow.test.ts` (angepasst + 1 neuer Negativtest)
- `drizzle/migrations/0037_market_complete_transaction_atomic.sql` (neu)

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck (`tsgo --noEmit`) | PASS |
| Unit-/Logiktests | PASS (38 Dateien / 621 Tests) |
| Lint + Prettier (geänderte Dateien) | PASS |
| Build | PASS (`build OK`) |
| Rechte der neuen DB-Funktion | PASS – Aufruf ohne `service_role` wird mit „permission denied“ abgewiesen |

Nicht ausgeführt: ein echter Verkaufsabschluss an Production-Daten. Dafür müssten
Test-Artikel/-Vorgänge in der Live-Datenbank erzeugt werden; das wurde bewusst
unterlassen. Der Abschlusspfad ist über die Unit-Tests (Erfolg, fehlender
`sold`-Status, doppelter Handover) und die Datenbankfunktion abgedeckt.

Nichts veröffentlicht/deployt.
