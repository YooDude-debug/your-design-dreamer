# Live-Testmodus: Werbekernel im Feed + Bot-Aktivität + Feed-Algorithmus-Beobachtung

Ziel: ein klar gekennzeichneter Testmodus, der (a) eine Werbekarte in den Hauptfeed einmischt und (b) Bot-Accounts zeitgesteuert posten lässt, damit der Feed-Algorithmus unter realistischer Aktivität beobachtbar wird. Keine Produktionslogik wird ersetzt, keine Abrechnung ausgelöst, keine echten Nutzer betroffen.

## 1. Vorhandene Werbe-Bausteine, die wiederverwendet werden

| Baustein | Rolle im Test |
| --- | --- |
| `src/lib/ad-demo.ts` (`SPONSORED_ADS`) | Datenquelle für Testwerbung inkl. Bild, Firma, CTA und `slangDrop` (Audio) — keine echte Kampagne, keine Kosten |
| `src/components/AdFeed.tsx` / `AdSlider.tsx` / `SponsoredFeed.tsx` | Bleiben unverändert; nur Design-Referenz für die neue Feed-Karte |
| `src/lib/ad-pause.ts` (`useAdsEnabled`) | Bestehender Admin-Werbeschalter: steht er auf AUS, erscheint auch die Testkarte nicht |
| `slang_tags`-Felder `sponsored`, `logo_url`, `cta_*`, `clicks_count`, `reach_count` | Erklären das bestehende Werbe-SlangTag-Modell; im Test nur gelesen, nicht beschrieben |
| `track_slang_tag_click` / `track_slang_tag_reach` | Werden im Testmodus NICHT aufgerufen — Zählung läuft rein in die Testmetrik |

Der blaue Werbe-SlangTag wird als eigene Darstellungsvariante gebaut (Blue-Business-Theme, Label „AD“/„Sponsored“ am Chip). Er ist kein Datensatz in `slang_tags` und kommt damit nicht in die Owner-scoped-Logik, nicht in Plays/Uses/Likes echter Tags und nicht in Interest-Engine-Signale.

## 2. Wo die Feed-Werbekarte integriert wird

- Neue Komponente `src/components/feed/FeedAdCard.tsx`: gleiche Kartenhülle wie `FeedPost` (Rahmen, Radien, Abstände), zusätzlich Badge „GESPONSERT / SPONSORED“ oben und blauer Werbe-SlangTag über dem Bild.
- Einbindung in `src/routes/_authenticated/dev.tsx` in der bestehenden `ranked.map(...)`-Ausgabe: an der berechneten Position wird zusätzlich eine Ad-Karte gerendert. Die `ranked`-Liste selbst und `PostDetailOverlay` bleiben unangetastet (Ad ist kein Post, hat keinen Detail-Index).
- Sichtbarkeitsregeln: nur wenn Testmodus EIN, nur für Admin/Test-Session, und nur wenn `useAdsEnabled` nicht AUS ist.

## 3. Zählung der 15/25-Logik

Neuer Hook `src/lib/ad-test-counter.ts`:

- Gezählt werden ausschließlich **Feed-Interaktionen**:
  - Wechsel zum nächsten Post (Swipe/Index-Änderung in `PostDetailOverlay`)
  - Wechsel zum vorherigen Post
  - Öffnen eines Beitrags aus dem Feed
- Getrennt davon eine eigene Metrik **Scroll-Impression**: ein Post gilt als gesehen, wenn er ≥ 50 % Fläche für ≥ 800 ms im Viewport war (IntersectionObserver, ein Event pro Post pro Sitzung). Diese Impressionen zählen als eigene Kennzahl und optional (Schalter) auch für die Ad-Frequenz.
- Kein Touch-/Pixel-Event zählt. Entprellung: max. 1 Interaktion pro 250 ms.
- Erreicht der Zähler den Schwellwert (15 oder 25), wird eine Ad-Karte an der nächsten Feed-Position eingeplant, der Zähler zurückgesetzt und die Position protokolliert.

## 4. Zeitgesteuerte Bot-Posts

- Wiederverwendung der bestehenden Server-Logik `runBotActivity` in `src/lib/testbots.server.ts` (erzeugt Posts, SlangTags, Likes, Kommentare über `supabaseAdmin`, ausschließlich für `bot_`-Accounts).
- Neue öffentliche Route `src/routes/api/public/bot-live-run.ts` (Muster wie `api/public/counters-run.ts`, Aufruf mit `apikey`-Header). Sie prüft zuerst die Test-Einstellungen und bricht ab, wenn der Testmodus AUS ist.
- Taktung über `pg_cron` jede Minute; bei Intervall „3 min“ läuft der Lauf nur, wenn seit dem letzten Lauf ≥ 3 Minuten vergangen sind.
- Zeitliche Streuung: pro Lauf wird nur eine Teilmenge der Bots bedient (zufällige Auswahl plus bot-eigenes `intervalMinutes`), sodass nicht alle gleichzeitig posten.
- Doppelte/ähnliche Inhalte sind gewollt: dieselben SlangTag-Namen dürfen mehrfach mit unterschiedlichen Bildern verwendet werden, jeweils als owner-scoped Variante des jeweiligen Bots.

## 5. Verwendete Bot-Accounts

Nur bestehende Accounts aus `test_accounts` mit `is_bot = true` bzw. `profiles.is_test_bot = true` und Benutzername mit Präfix `bot_` (Pool in `src/lib/testbots.shared.ts`, aktuell 10–12 Bots über DE/GR/UK/GR-Regionen und drei Sprachen). Echte Accounts, insbesondere `@mario`, werden ausgeschlossen und niemals verändert.

## 6. Aktivierung/Deaktivierung des Testmodus

Erweiterung der bestehenden Tabelle `test_bot_settings` um drei Felder (`live_test boolean`, `post_interval_minutes int`, `ad_frequency int`) — keine neue Tabelle, keine Änderung an Produktionstabellen.

Neuer Abschnitt in `src/routes/admin.testbots.tsx`:

```text
BOT LIVE TEST     [ AUS | EIN ]
POSTING INTERVAL  [ 1 min | 3 min ]
AD FREQUENCY      [ 15 | 25 ]
```

- AUS: Cron-Route bricht sofort ab, keine Bot-Posts, keine Ad-Testkarte im Feed.
- EIN: Bots posten im gewählten Intervall, Ad-Karte erscheint nach der gewählten Interaktionszahl.
- Der Feed liest die Werte über eine kleine Server-Funktion (kurzer Cache), damit der Schalter ohne Reload wirkt.

## 7. Nutzbare vorhandene Analytics

- `feed_signals`, `feed_learned_weights`, `feed_score_cache` — welche Posts warum priorisiert werden (Score-Breakdown existiert bereits).
- `posts.likes_count/comments_count/views_count/shares_count/saves_count`, `post_views`, `counter_events`.
- `slang_tags.plays_count/uses_count/likes_count/shares_count`, `slang_tag_plays`.
- `interaction_events`, `user_interest_scores`, `interest_confidence` — Interessen-Wirkung.
- `test_accounts.last_activity_at` und die Bot-Zähler in `getTestBotState` — Posts pro Bot, letzter Post.

## 8. Zusätzlich nötige Testmetriken

Ein neues Test-Dashboard (eigener Admin-Tab) zeigt:

- **Feed**: geladene Posts, neue Posts seit Teststart, Feed-Impressionen, Post-Wechsel, durchschnittliche Sichtbarkeitsdauer, Wiederholungsrate (gleicher Post/gleicher Tag mehrfach gesehen).
- **SlangTag**: Plays, Uses, Likes, Shares, neu erzeugte Tags im Testzeitraum.
- **Werbung**: Ad-Impressionen, Ad-Klicks, Ad-SlangTag-Plays, Feed-Position jeder Einblendung, Interaktionen bis zur Einblendung, Skip-Rate.
- **Bots**: Anzahl aktiver Bots, Posts pro Bot, letzter Post, nächster geplanter Lauf.

Ad- und Sichtbarkeitsmetriken werden in einer separaten Testtabelle `ad_test_events` (Typ, Referenz, Feed-Position, Interaktionszähler, Zeitstempel) gesammelt — bewusst getrennt von `ad_campaigns`, damit keine echte Kampagnen- oder Abrechnungszahl berührt wird.

## 9. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
| --- | --- |
| Feed-Re-Renders durch häufige Zählerupdates | Zähler in `useRef` + Commit nur bei Schwellwert; Ad-Position memoisiert |
| Wachsender Feed führt zu langen Listen und Speicherdruck | Bestehendes Paging/Limit beibehalten, Testlauf begrenzt (z. B. max. Posts pro Lauf) |
| Bot-Flut verschiebt echte Inhalte | Bot-Posts nur im Testmodus; Abschalten stoppt sofort, `resetTestBotActivity` räumt auf |
| Realtime-/DB-Last durch 1-Minuten-Takt | Pro Lauf nur Teilmenge der Bots, harte Obergrenze pro Lauf, Cron kann jederzeit deaktiviert werden |
| Vermischung von Test- und Produktionszahlen | Ad-Testkarte schreibt nichts in `slang_tags`/`ad_campaigns`; eigene Testtabelle |
| Ad-Karte verschiebt Detailansicht-Indizes | Ad wird außerhalb der `ranked`-Datenstruktur gerendert; `PostDetailOverlay` bleibt unverändert |
| Testkarte versehentlich für echte Nutzer sichtbar | Sichtbarkeit an Admin-Session + Testmodus-Flag gebunden |

## Technische Details

- Neue Dateien: `src/components/feed/FeedAdCard.tsx`, `src/lib/ad-test-counter.ts`, `src/lib/live-test.functions.ts` (+ `.server.ts`), `src/routes/api/public/bot-live-run.ts`, neuer Admin-Testtab.
- Geänderte Dateien: `src/routes/_authenticated/dev.tsx` (Ad-Einmischung, Impressionsmessung), `src/routes/admin.testbots.tsx` (Schalter), `src/lib/testbots.server.ts` (Streuung + Live-Lauf-Einstiegspunkt), `src/components/PostDetailOverlay.tsx` (nur Interaktions-Callback bei Index-Wechsel).
- Migration: drei Spalten auf `test_bot_settings`, eine neue Testtabelle `ad_test_events` mit GRANTs und RLS (nur Admin lesen, eigener Nutzer schreiben).
- Keine Änderungen an Post-, Profil-, SlangTag- oder Kampagnenstruktur.
