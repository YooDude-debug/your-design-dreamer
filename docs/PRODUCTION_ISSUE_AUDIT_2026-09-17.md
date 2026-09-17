# Y-Dude – Production Issue Audit (5 Meldungen), 17.09.2026

Analyse ohne Codeänderung. Grundlage: aktueller Production-Code, Live-Datenbank (Grants/ACL,
Policies), Migrationen, Servermodul-Umgebung.

## PROBLEM 1 – Feed-Bar / Scroll-Lock

- **Status:** BESTÄTIGT, offen.
- **Root Cause:** `src/lib/use-feed-mode.ts` `enter()` committet `setDocking(true)/setFeedMode(true)`
  in `flushSync()`. Dadurch läuft der `useLayoutEffect` (Z. 376 ff.) noch INNERHALB von `flushSync`:
  er nimmt seinen eigenen `lockScroll()` und ruft `releaseEagerLock()`, während `eagerLock.current`
  noch `null` ist. Erst danach setzt `enter()` (Z. 204/205) `eagerLock.current = lockScroll()` – ein
  zweiter gezählter Lock, den der bereits gelaufene Effekt nie freigibt. Beim Unmount im gedockten
  Zustand gibt nur der Effekt-Cleanup frei; der Zähler in `src/lib/scroll-lock.ts` bleibt ≥ 1 →
  `html`/`body` behalten `overflow:hidden` (plus `overscroll-behavior-y:none`) für die restliche
  SPA-Sitzung.
- **Betroffene Dateien:** `src/lib/use-feed-mode.ts` (Ursache), `src/lib/scroll-lock.ts` (Zähler),
  `tests/feed-sticky-cycles.test.ts`, `tests/scroll-lock.test.ts`.
- **DB/RLS/RPC:** keine.
- **Reproduzierbar:** ja, deterministisch (kein Timing): andocken → Feed verlassen (Profil, Market,
  beliebige Route) ohne vorher abzudocken. `position:fixed`/`touch-action` sind nicht beteiligt;
  Feed-Modus greift nur bei aktivem Snap-Layout, also praktisch mobil/schmal – auf Desktop nur, wenn
  der Feed-Modus dort auslöst. Alle Navigationen betroffen, die den Feed unmounten.
- **Auswirkung:** Zielseite nicht scrollbar bis Reload. Hoch.
- **Empfohlener Fix (später):** Lock-Eigentümerschaft eindeutig machen – entweder den Eager-Lock VOR
  `flushSync()` setzen (dann findet der Effekt ihn und übergibt korrekt), oder den Lock
  ausschließlich im Layout-Effekt halten. Kein Zurücksetzen des globalen Zählers.
- **Risiko:** gering, sofern Andock-Flash-Fix und Abdock-Pfad unverändert bleiben.
- **Tests:** andocken, abdocken, Unmount im gedockten Zustand, mehrfache Zyklen, schnelles Andocken;
  jeweils `scrollLockCount() === 0` danach; kein sichtbarer Zwischen-Frame.

## PROBLEM 2 – Marketplace + Messenger Permission-Fehler

- **Status:** URSACHE IDENTIFIZIERT; Code und Live-Rechte sind aktuell korrekt. Live-Bestätigung offen.
- **Root Cause:** Beide Schreibpfade laufen serverseitig über `supabaseAdmin`
  (`src/integrations/supabase/client.server.ts`) und benötigen `service_role`.
  Die protokollierten Fehler („permission denied for function market_complete_transaction“,
  „permission denied for table messages“) entstehen genau dann, wenn diese Serveraufrufe NICHT als
  `service_role` ankommen, also bei falsch gebundener/veralteter Serverumgebung
  (`SUPABASE_SERVICE_ROLE_KEY` faktisch ein Publishable-/anon-Schlüssel) – es ist kein Fehler in
  RLS-Policies oder im Anwendungscode.
- **Belege (Live-Stand):**
  - `market_complete_transaction`: `SECURITY DEFINER`, Owner `postgres`,
    ACL `postgres=X, authenticated=X, service_role=X` (anon entzogen).
  - `public.messages`: `anon=Dxtm` (kein INSERT/SELECT/UPDATE), `authenticated=ardDxtm`
    (INSERT/SELECT/DELETE, kein UPDATE), `service_role` voll.
  - Serverumgebung im Sandbox-Kontext: `SUPABASE_SERVICE_ROLE_KEY` ist ein JWT mit `role=service_role`
    (korrekt). Kein „permission denied“ in den Serverlogs der letzten Stunde.
- **Betroffene Dateien:** `src/lib/market-tx.server.ts` (Z. 213, 436, 473),
  `src/lib/market-chat.server.ts` (Z. 107–216), `src/integrations/supabase/client.server.ts`,
  `drizzle/migrations/0037`, `0038`.
- **Rollen/Policies:** Client-Insert von Nachrichten läuft als `authenticated` (INSERT erlaubt,
  RLS-Policy prüft Mitgliedschaft); Lesestatus läuft über `mark_conversation_read`
  (SECURITY DEFINER) – deshalb ist das fehlende UPDATE für `authenticated` beabsichtigt und
  KEIN Fehler.
- **Reproduzierbar:** aktuell nicht nachstellbar, ohne echte Produktionsdaten zu verändern
  (0 Nachrichten der letzten 3 Tage, 0 Transaktionen) → BLOCKED für einen echten Schreibtest.
- **Auswirkung:** solange die Serverumgebung falsch gebunden ist: Verkaufsbestätigung und
  serverseitige Chat-Systemnachrichten schlagen fehl.
- **Empfohlener Fix:** keine RLS-/Grant-Änderung. Nur Verifikation der Live-Worker-Umgebung
  (Service-Role-Bindung) und, falls gewünscht, eine klare Fehlermeldung/Alarm bei
  „permission denied“ im Serverpfad.
- **Risiko:** keines (keine Rechteänderung).
- **Tests:** ein kontrollierter Verkaufsabschluss auf Testdaten; Prüfung der Postgres-Logs auf
  erneutes „permission denied“.

## PROBLEM 3 – Cover-Position nur direkt nach Upload

- **Status:** BEREITS BEHOBEN (im aktuellen Code).
- **Befund:** `src/components/ProfileEditDialog.tsx` `openCoverAdjust()` ist an `Boolean(cover)`
  gebunden. Bei einer gespeicherten Storage-URL wird das Bild per CORS-Fetch + FileReader in eine
  DataURL geladen und im `CoverPositionDialog` geöffnet. Der Zuschnitt wird beim Speichern in das
  Bild gerechnet (`coverDataUrl` → `uploadDataUrl(..., "covers")`); es gibt bewusst keine separat
  persistierte `object-position`.
- **Restrisiko:** der Fetch benötigt CORS-fähige Auslieferung; scheitert er, erscheint ein Fehlertoast
  statt eines Zuschnitts. Kein Fix nötig, nur beobachten.
- **Empfehlung:** Meldung als behoben schließen.

## PROBLEM 4 – Market-Tab ohne gespeicherte Suche

- **Status:** BEREITS BEHOBEN.
- **Befund:** `src/components/feed/MarketFeedList.tsx` entscheidet über
  `marketFeedEmptyState(items.length, searchCount)`: leer + keine Suche → Hinweistext; leer + Suche
  vorhanden → „nichts gefunden“; `items.length > 0` → normale Darstellung, unabhängig von
  gespeicherten Suchen. Artikel gefolgter Verkäufer (`recentItemsBySellers`) werden damit angezeigt.
  Abgesichert durch `tests/market-feed-empty-state.test.ts`.
- **Empfehlung:** Meldung als behoben schließen.

## PROBLEM 5 – Verkauft bleibt „reserviert“

- **Status:** BEREITS BEHOBEN im Code; verbleibendes Restrisiko ist ausschließlich Problem 2.
- **Befund:** Der Abholcode-Pfad existiert nicht mehr (`tests/market-no-pickup-code.test.ts`).
  `markSold()` und `completeOpenTransactionsForItem()` rufen die Datenbankfunktion
  `market_complete_transaction(_tx_id, _seller_id)` auf. Diese sperrt Vorgang und Artikel, liest die
  Artikel-ID ausschließlich aus dem Vorgang, setzt Vorgang „completed“ und Artikel „sold“ in EINER
  Transaktion und ist bei Wiederholung idempotent (`already_sold`). Der Server prüft zusätzlich
  `item_status === "sold"` und wirft sonst `complete_failed`. Keine Race Condition erkennbar.
- **Gemeinsame Ursache mit #2:** JA – wenn der Aufruf nicht als `service_role` ankommt, schlägt genau
  diese Funktion mit „permission denied“ fehl, der Vorgang bleibt offen und der Artikel „reserved“.
  #5 ist damit heute ein Folgefehler von #2, kein eigener Logikfehler.

## ROOT-CAUSE-ZUSAMMENFASSUNG

- **Tatsächlich unterschiedliche Ursachen: 2**
  1. Falsche Lock-Eigentümerschaft im Feed-Andockvorgang (Problem 1).
  2. Serveraufrufe ohne `service_role`-Rechte durch falsch gebundene Serverumgebung (Problem 2, und
     als Folge Problem 5).
- **Folgefehler:** #5 folgt aus #2.
- **Bereits behoben:** #3, #4 (und die Codeseite von #5).
- **Unabhängig:** #1 gegenüber allen anderen.
- **Gemeinsam umsetzbar:** #2 und #5 (eine Verifikation), #1 separat.

## FIX-PLAN (minimal, noch nicht umgesetzt)

### Fix A – Scroll-Lock-Lifecycle im Feed-Modus
1. Ursache: zweiter, nie freigegebener `lockScroll()` durch `flushSync`-Reihenfolge.
2. Änderung: Eager-Lock vor `flushSync()` anfordern (oder Lock nur im Layout-Effekt halten), sodass
   `releaseEagerLock()` im Effekt immer einen existierenden Lock übernimmt.
3. Dateien: `src/lib/use-feed-mode.ts`; Tests in `tests/feed-sticky-cycles.test.ts`.
4. DB/RLS/RPC: keine.
5. Sicherheit: keine Auswirkung.
6. Regressionsrisiko: gering; Andock-Flash und Abdock-Pfad müssen unverändert bleiben.
7. Tests: 8 Szenarien inkl. Unmount im gedockten Zustand, Zähler danach 0, kein Zwischen-Frame,
   Browsercheck mobil/Desktop.

### Fix B – Serverrechte-Verifikation für Market-Abschluss und Chat
1. Ursache: Serveraufrufe erreichten Postgres als `anon`/`authenticated`.
2. Änderung: keine Code-, Grant- oder Policy-Änderung. Verifikation der Live-Worker-Bindung des
   Service-Role-Schlüssels und ein kontrollierter Abschlusstest.
3. Dateien: keine (optional Fehlerprotokollierung in `src/lib/market-tx.server.ts`).
4. DB/RLS/RPC: unverändert (`market_complete_transaction` bleibt `SECURITY DEFINER` ohne anon).
5. Sicherheit: unverändert, keine Öffnung.
6. Regressionsrisiko: keines.
7. Tests: Verkaufsbestätigung auf Testdaten, Chat-Systemnachricht, Postgres-Log-Kontrolle.

### Kein Fix erforderlich
- Problem 3 und Problem 4 sind im aktuellen Code behoben und durch Tests abgesichert.

## Nachtrag – Fix B: Read-only Live-Prüfung durchgeführt (17.09.2026, 07:35 UTC)

Durchgeführt ohne Schreibzugriff, ohne Rechte-/RLS-Änderung, ohne Änderung der Geschäftslogik.

**Prüfgegenstand**
- Serverfunktion/RPC: `public.market_complete_transaction(_tx_id, _seller_id)` (SECURITY DEFINER),
  aufgerufen in `src/lib/market-tx.server.ts` (`markSold`, `completeOpenTransactionsForItem`).
- Tabellenschreibpfad Chat: `public.messages` (Systemnachrichten in `market-tx.server.ts`,
  `market-chat.server.ts`).
- Benötigte Rolle: `service_role` über `supabaseAdmin` (`src/integrations/supabase/client.server.ts`).
- Benötigte erhöhte Rechte: EXECUTE auf der Abschlussfunktion, INSERT/SELECT auf `messages`.

**Ergebnis des vorbereiteten Lesechecks (`src/lib/market-health.server.ts`)**
- `SUPABASE_URL`: vorhanden. `SUPABASE_SERVICE_ROLE_KEY`: vorhanden.
- Lesesonde `messages`: erlaubt (für `anon` ist SELECT entzogen → privilegierte Rolle bestätigt).
- Lesesonde `market_transactions`: erlaubt.
- Gesamtstatus: **ok** – keine Hinweise, keine Fehlercodes.

**Zusätzliche Kontrollen**
- Live-ACL unverändert korrekt: `market_complete_transaction` = `postgres/authenticated/service_role`
  (anon entzogen); `public.messages` = `anon` ohne INSERT/SELECT/UPDATE, `authenticated` mit
  INSERT/SELECT/DELETE, `service_role` vollständig.
- Serverschlüssel trägt die Rolle `service_role` (Rollenanspruch geprüft, Schlüssel nie ausgegeben).
- Serverlogs der letzten Stunde: kein „permission denied“.

**BLOCKED / offen**
- Die Log-Analyseabfragen (`postgres_logs`, `edge_logs`) liefern im verfügbaren Zeitfenster keine
  Zeilen; ein rückblickender Log-Beleg über die früheren Vorfälle hinaus ist damit nicht möglich.
- Die Laufzeitumgebung der veröffentlichten Website wurde nicht separat gemessen. Dafür steht der
  Admin-Endpunkt `getMarketPermissionHealth` (`src/lib/market-health.functions.ts`) bereit; er ist
  rein lesend und protokolliert im Fehlerfall eindeutig zuordenbar.
- Ein echter Verkaufsabschluss wurde bewusst nicht ausgeführt (keine Produktionsschreibvorgänge).

**Folge:** Kein aktueller Fehler feststellbar. Es wurde nichts weiter geändert.
