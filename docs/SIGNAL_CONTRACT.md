# Y-Dude – Kanonischer Signalvertrag (Stand Schritt 2A, Staging)

Reiner Audit-/Vertragsschritt. Keine Codeänderung, keine Ranking-, Decay-, Confidence- oder
Lernraten-Änderung, keine Production-Migration.

Quelle der Wahrheit ist der Code:
`src/lib/feed-signals.ts`, `src/lib/data.tsx`, `src/components/feed/FeedPost.tsx`,
`src/routes/_authenticated/feed.tsx`, `src/components/ReportDialog.tsx`,
`src/lib/feed.functions.ts`, `src/lib/feed-ranking/{learning,config,engine.server}.ts`,
`src/lib/interest-engine/{signal-map,engine.server,config,scoring}.ts`.

---

## 1. Laufzeitpfad

```
Nutzeraktion (UI)
   -> trackFeedSignal(FeedSignalInput)        src/lib/feed-signals.ts (eine globale Queue)
   -> Debounce 2.5 s / Flush
   -> recordFeedSignals({ signals })          Server Function, POST, requireSupabaseAuth
   -> engine.recordSignals(db, userId, list)  feed-ranking/engine.server.ts
        - INSERT feed_signals (Rohsignale)
        - UPSERT feed_learned_weights (aggregierte Deltas)
        - ggf. Score-Cache leeren (Suppress-Signale)
   -> forwardToInterestEngine(db, userId, list)
        - Altersprüfung (advertisingProfilingBlocked) – fail-closed
        - interest-engine/engine.server.applyFeedSignals
             mapSignals() -> interaction_events, user_interest_scores,
             interest_confidence, connection_influence
```

Ein Serveraufruf, zwei Lernpfade. Kein zweiter Client-Request.

## 2. Kanonisches Signalmodell (`FeedSignalInput`)

| Feld | Typ | Pflicht | Quelle | Bemerkung |
|---|---|---|---|---|
| `signal` | `FeedSignal` | ja | UI | einziges Pflichtfeld |
| `postId` | uuid | nein | geladener Post | fehlt bei `follow` |
| `authorId` | uuid | nein | geladener Post / Ziel-Profil | Interest: `peerId` |
| `dwellMs` | number | nein | nur `dwell` | Millisekunden |
| `topics` | string[] | nein | – | im Typ vorhanden, wird von der UI derzeit nicht befüllt |
| `hashtags` | string[] | nein | Post | Feed-Namensraum `hashtag:` |
| `slangTagIds` | string[] | nein | Post | Feed-Namensraum `slang:`; Interest ignoriert sie |
| `region` | string | nein | Post | Freitext, mehrteilig möglich |
| `language` | string | nein | – | im Typ vorhanden, wird derzeit nicht befüllt |

Nicht im Vertrag: `user_id` und `timestamp`.
`user_id` wird ausschließlich serverseitig aus der authentifizierten Session gesetzt
(`requireSupabaseAuth` → `context.userId`); ein Clientwert existiert nicht und wird nicht akzeptiert.
`timestamp` = `created_at DEFAULT now()` in der Datenbank (Server-Zeit).
`signal_value` ist kein Eingabefeld: es wird serverseitig über `signalValue()` berechnet.

## 3. Tatsächlich erzeugte Signale (Codezustand)

| Feed-Signal | Erzeugt in | Interest-Aktion |
|---|---|---|
| `like` | `data.tsx` `signalPost` (nur beim Setzen) | `post_like` |
| `comment` | `data.tsx` nach erfolgreichem Speichern | `post_comment` |
| `share` | `data.tsx` nach Share-Aktion | `post_share` |
| `save` | `data.tsx` (nur beim Setzen) | `post_save` |
| `view_complete` | `feed.tsx` `openDetail` | `post_view_complete` |
| `dwell` | `FeedPost.tsx` IntersectionObserver | `post_view` (nur ≥ 4000 ms) |
| `follow` | `data.tsx` `follow()` | `connection` |
| `report` | `ReportDialog.tsx` (nur `post`) | – (nur Feed-Learning) |

**Abweichungen von der Vorgabe-Tabelle:** `not_interested`, `mute`, `block`, `skip`, `view`,
`fast_scroll`, `listen_complete`, `repeat`, `profile_visit` sind im Typ und im Feed-Learning
vorgesehen, werden aber von keiner Oberfläche erzeugt. `fast_scroll` und `skip` existieren nur
als *Wert* innerhalb der Dwell-Auswertung, nicht als eigenes Ereignis.

## 4. Semantik je Signal

| Signal | Trigger | Nicht-Trigger | Richtung | Wert | Wiederholung | Verarbeitung |
|---|---|---|---|---|---|---|
| `like` | Like gesetzt | Like entfernt | positiv | binär (1.0) | 1× pro Aktion | Feed + Interest |
| `comment` | Kommentar gespeichert | Fehlerfall, Löschen | positiv | binär (1.2) | 1× pro Kommentar | Feed + Interest |
| `share` | Share ausgelöst | Abbruch vor Aktion | positiv | binär (1.3) | beliebig | Feed + Interest |
| `save` | Merken gesetzt | Merken entfernt | positiv | binär (1.2) | 1× pro Aktion | Feed + Interest |
| `view_complete` | Detailansicht geöffnet | Sichtbarkeit im Feed | positiv | binär (0.6) | beliebig (pro Öffnung) | Feed + Interest |
| `dwell` | Karte verlässt Sichtfeld / unmountet | wenn Sichtdauer 0 | abgeleitet | Dauer (ms) | 1× pro Beitrag und Sitzung | Feed + Interest (≥ 4 s) |
| `follow` | Folgen bestätigt | Entfolgen | positiv | binär (1.5) | 1× pro Aktion | Feed + Interest |
| `report` | Meldung erfolgreich gesendet | Abbruch, SlangTag-Meldung | negativ | binär (−2.0) | 1× pro Meldung | nur Feed |

## 5. Dwell-Vertrag

- **Messung startet**, sobald die Karte zu ≥ 50 % im Scroll-Container sichtbar ist
  (`IntersectionObserver`, `threshold [0, 0.5, 1]`, `root = scrollRoot`).
- **Messung endet**, wenn die Karte unter 50 % fällt oder die Komponente unmountet;
  sichtbare Zeitspannen werden aufaddiert.
- **Einheit:** Millisekunden (`dwellMs`), serverseitig als `dwell_ms` (integer) gespeichert.
- **Schwelle 4000 ms** stammt aus `FEED_CONFIG.learning.dwellPositiveMs` (bestehende Feed-Logik)
  und wird von der Interest-Brücke als `DWELL_POSITIVE_MS` gespiegelt.
- **Unterhalb:** ≤ 1200 ms → Feed-Learning wertet mit `fast_scroll` (−0.4);
  1201–3999 ms → Wert 0, also keine Gewichtsänderung. In beiden Fällen: **kein** Interest-Event.
- **Oberhalb:** Feed-Wert `dwell` (+0.4); Interest-Aktion `post_view` mit
  Zusatzpunkten `dwell_per_second 0.5`, gedeckelt bei `dwell_max 15`.
- `fast_scroll` wird **nicht** als eigenes Ereignis erzeugt, sondern nur numerisch abgeleitet.
- **Häufigkeit:** genau ein Dwell-Signal pro Beitrag und Sitzung
  (modulweites `dwellSeen`-Set, gilt bis zum Neuladen der Seite).

## 6. Feed → Interest Mapping (`signal-map.ts`)

```
like    -> post_like          -> Punkte auf aufgelöste Kategorien + connection_influence.like_count
comment -> post_comment       -> Punkte + connection_influence.comment_count
share   -> post_share         -> Punkte
save    -> post_save          -> Punkte
view_complete -> post_view_complete -> Punkte
dwell (>= 4 s) -> post_view   -> Basispunkte + Dwell-Punkte
follow  -> connection         -> connection_influence (Beziehungsstärke)
view / profile_visit          -> im Mapping vorhanden, werden von der UI nicht erzeugt
report / skip / fast_scroll / not_interested / mute / block -> KEIN Interest-Event
```

Negative Signale werden bewusst **nicht** weitergereicht: Die vorhandene Interest Engine kennt
keine negativen `InteractionAction`-Werte. Eine Weitergabe würde Ablehnung als Interesse zählen.

## 7. Batch-Vertrag

- Eine globale Queue (`src/lib/feed-signals.ts`), appweit, kein Provider-State.
- **Debounce 2500 ms, gleitend**: jedes neue Signal setzt den Timer zurück.
- **Maximal 50 Signale pro Sendung** (Client-Slice und serverseitiges `slice(0, 50)`);
  Reste werden im nächsten Fenster nachgeschickt.
- **Queue-Deckel 200**: bei Überlauf werden die ältesten Einträge verworfen.
- **Flush** bei `visibilitychange` (hidden), `pagehide` und beim Abbau der Bridge.
- **Fehlerverhalten:** `.catch(() => undefined)` – Fehler blockieren die Oberfläche nie.
- **Kein Retry**: fehlgeschlagene Batches sind verloren (bewusst, da Signale unkritisch sind).
- **Duplikate:** Ein Batch wird vor dem Senden aus der Queue entfernt → keine Doppelsendung
  desselben Eintrags. Doppelte fachliche Ereignisse sind aber möglich (siehe 8).

## 8. Duplikate / Idempotenz

| Signal | Klasse | Risiko |
|---|---|---|
| like | one-per-action | Wiederholtes An/Aus erzeugt mehrere Signale (nur beim Setzen) |
| comment | one-per-action | pro Kommentar ein Signal; korrekt |
| share | repeatable | mehrfaches Teilen zählt mehrfach |
| save | one-per-action | wie Like |
| follow | one-per-action | Entfolgen/Folgen zählt erneut |
| view_complete | repeatable | jedes Öffnen zählt |
| dwell | one-per-session (pro Beitrag) | nach Reload erneut möglich |
| view | – | wird nicht erzeugt |

Es gibt **keinen** dedizierten Idempotenzschlüssel (kein `event_id`, kein Unique-Index auf
`feed_signals` / `interaction_events`). Ein doppelt gesendeter Batch würde doppelt zählen.
Wird hier nur dokumentiert, nicht behoben.

## 9. Datenbankvertrag

**feed_signals** – `id`, `user_id` (NOT NULL), `post_id`, `author_id`, `signal` (text, NOT NULL),
`value` (numeric, default 1), `dwell_ms` (int, default 0), `created_at` (now()).
Indizes: `(user_id, created_at DESC)`, `(post_id)`.
RLS: INSERT/SELECT/DELETE nur `auth.uid() = user_id`, Rolle `authenticated`. Kein UPDATE.

**feed_learned_weights** – PK `(user_id, key)`, `weight` numeric, `events_count` int.
RLS: ALL nur eigene Zeilen. Schreibpfad ausschließlich UPSERT `onConflict user_id,key`.

**interaction_events** – `id`, `user_id`, `action` (text), `category_id` (nullable),
`content_type` (enum), `content_id`, `peer_id`, `weight`, `dwell_ms`, `created_at`.
Indizes: `(user_id, created_at DESC)`, `(user_id, category_id, created_at DESC)`,
partiell `(user_id, peer_id, created_at DESC) WHERE peer_id IS NOT NULL`.
RLS: INSERT/SELECT nur eigene Zeilen. Append-only.

**user_interest_scores** – PK `(user_id, category_id)`, `dynamic_score`, `events_count`,
`last_event_at`, `last_decay_at`. Indizes: `(user_id, dynamic_score DESC)`, `(last_decay_at)`.

**interest_confidence** – PK `(user_id, category_id)`, `confidence`, `view_count`, `engage_count`,
`distinct_days`, `first/last_event_at`, `promoted`, `promoted_at`.
Index: `(user_id, promoted, confidence DESC)`.

**connection_influence** – PK `(user_id, peer_id)`, Zähler + `strength`.
Index: `(user_id, strength DESC)`.

**user_interests** – freiwillige Basisinteressen, PK `(user_id, category_id)`;
vom Signalpfad **nicht** geschrieben.

Alle Interest-Tabellen: RLS `ALL` auf `auth.uid() = user_id`, Rolle `authenticated`.

```
feed_signals   -> Feed Learning  -> feed_learned_weights
Signal (gleicher Batch) -> Interest Engine -> interaction_events
                                           -> user_interest_scores
                                           -> interest_confidence
                                           -> connection_influence
```

## 10. Kategoriebestimmung

Auflösung ausschließlich über exakte Treffer (normalisiert: lowercase, `#` entfernt,
Leerzeichen/Unterstrich → `-`) gegen aktive `interest_categories` (Slug **oder** Name):

1. Hashtags des Beitrags
2. Topics (Feld vorhanden, derzeit nicht befüllt)
3. Region, an `,` `/` `|` zerlegt, nur gegen Kategorien der Art `region`
4. Sprache als `lang-xx`, nur gegen `language` (Feld derzeit nicht befüllt)
5. Redaktionelle `content_categories` des Beitrags (eine gebündelte Abfrage)

Keine Semantik, keine KI, keine Zufallszuordnung. Ohne Treffer wird das Ereignis mit
`category_id = NULL` protokolliert und beeinflusst weder Score noch Confidence.
`content_categories` bleibt unverändert und ist derzeit leer.

## 11. Feed Learning vs. Interest Learning

| Signal | Feed Learning | Interest Engine |
|---|---|---|
| like / comment / share / save | ✓ | ✓ |
| view_complete | ✓ | ✓ |
| dwell ≥ 4 s | ✓ | ✓ |
| dwell < 4 s | ✓ (0 bzw. fast_scroll) | – |
| follow | ✓ | ✓ (connection) |
| report | ✓ | – |
| not_interested / mute / block / skip | vorgesehen, nicht erzeugt | – |

## 12. Performance-Vertrag

- **Requests pro Einzelaktion: 0.** Jede Aktion legt nur ein Objekt in die Queue.
- **1 Request pro Batch** (max. 50 Signale, min. 2,5 s Abstand).
- DB-Operationen pro Batch: Feed 3 (INSERT, SELECT, UPSERT) + optional Cache-Löschung;
  Interest max. 8 (Config, Kategorien, content_categories, INSERT events, 2 SELECT, 2 UPSERT)
  + optional 2 für `connection_influence`. Gesamt ≈ 11–13, unabhängig von der Signalanzahl.
- **Kein N+1**: alle Zugriffe sind über den gesamten Stapel gebündelt.
- **UI blockiert nie**: Senden ist Fire-and-Forget, Fehler werden verschluckt.
- Interest-Verarbeitung läuft **synchron innerhalb desselben Serveraufrufs**, nach dem
  bereits gespeicherten Feed-Learning; ein Fehler dort bleibt folgenlos.

## 13. Security-Vertrag

- Alle Signalpfade laufen über `requireSupabaseAuth`; unangemeldet keine Verarbeitung.
- `user_id` stammt ausschließlich aus `context.userId` (Session), nie aus dem Client.
  Ein fremder `user_id`-Wert ist nicht übermittelbar und würde zusätzlich an RLS scheitern.
- RLS auf allen beteiligten Tabellen: jeder Nutzer sieht und schreibt nur eigene Zeilen.
  Kein `anon`-Zugriff.
- `feed_signals` erlaubt kein UPDATE; `interaction_events` ist append-only.
- Jugendschutz: `advertisingProfilingBlocked()` läuft einmal pro Batch **vor** der
  Interest-Verarbeitung und ist fail-closed (unbekanntes Alter ⇒ kein Interessenprofil).
  Feed-Learning bleibt davon unberührt.

## 14. Kanonische Signalmatrix

| Feed Event | Interest Event | Trigger | Richtung | Wert | Wiederholung | Feed | Interest |
|---|---|---|---|---|---|---|---|
| like | post_like | Like gesetzt | positiv | binär 1.0 | one-per-action | ✓ | ✓ |
| comment | post_comment | Kommentar gespeichert | positiv | binär 1.2 | one-per-action | ✓ | ✓ |
| share | post_share | Teilen ausgeführt | positiv | binär 1.3 | repeatable | ✓ | ✓ |
| save | post_save | Merken gesetzt | positiv | binär 1.2 | one-per-action | ✓ | ✓ |
| view_complete | post_view_complete | Detail geöffnet | positiv | binär 0.6 | repeatable | ✓ | ✓ |
| dwell ≥ 4 s | post_view | Karte verlässt Sichtfeld | abgeleitet | Dauer ms | one-per-session | ✓ | ✓ |
| dwell < 4 s | – | wie oben | neutral/negativ | Dauer ms | one-per-session | ✓ | – |
| follow | connection | Folgen bestätigt | positiv | binär 1.5 | one-per-action | ✓ | ✓ |
| report | – | Meldung gesendet | negativ | binär −2.0 | one-per-action | ✓ | – |
| view, profile_visit, listen_complete, repeat, skip, fast_scroll, not_interested, mute, block | – | derzeit kein UI-Trigger | – | – | – | vorgesehen | – |

## 15. Offene Risiken (nur dokumentiert)

1. **Keine negativen Interest-Signale** – Ablehnung wirkt nur auf das Feed-Ranking.
2. **Keine Content-Kategorisierung** – `content_categories` leer; ohne Kategorietreffer
   entstehen Ereignisse ohne Wirkung auf Score/Confidence.
3. **Keine Idempotenz** – kein Event-Schlüssel, kein Unique-Index; doppelte Batches zählen doppelt.
4. **Kein Retry / Signalverlust** – abgebrochene Sendungen und Queue-Überlauf (> 200) sind endgültig.
5. **Datenmenge** – `feed_signals` und `interaction_events` wachsen unbegrenzt; keine Retention.
6. **Ungenutzte Felder** – `topics`, `language`, `slangTagIds` (Interest) werden nicht befüllt
   bzw. nicht ausgewertet und senken die Kategorie-Trefferquote.
7. **Dwell-Sitzungssperre** – modulweit, überlebt Navigation, aber nicht das Neuladen.
