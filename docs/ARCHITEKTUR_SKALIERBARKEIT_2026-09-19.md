# Y-Dude – Produktions-Architektur- und Skalierbarkeitsanalyse

Stand: 19.09.2026. **Reine Analyse. Keine Code-, Datenbank-, RLS-, Migrations-
oder Konfigurationsänderung durchgeführt.** Alle Datenbankabfragen waren lesend.

Belegarten in diesem Dokument:
`[CODE]` = Quelltextstelle, `[DB]` = gemessener Datenbankzustand,
`[MESS]` = vorhandener Lasttestbericht, `[UNBELEGT]` = Einschätzung ohne Messung.

---

## 0. Antwort in drei Sätzen

Nachgewiesen ist ausschließlich Lese-Last: 1.000 gleichzeitige simulierte
Nutzer, ~715 Anfragen/s, 0 Serverfehler `[MESS: docs/PRODUCTION_LOAD_TEST_2026-09-17.md]`.
Die Anwendungsschicht ist bis auf drei benannte Ausnahmen zustandslos und
könnte nach heutigem Codestand horizontal vervielfacht werden; die Datenbank
ist heute weit von ihren Grenzen entfernt (19/60 Verbindungen, 22 % Disk)
`[DB: db_health 19.09.2026]`.
Eine **konkrete Nutzerzahl ist aus den vorhandenen Daten nicht seriös
bestimmbar** – Schreiblast, Echtzeit, Uploads und angemeldete Sitzungen wurden
nie unter Last gemessen: **Keine belastbare numerische Aussage möglich.**

---

## 1. Gesamtarchitektur

### 1.1 Tatsächlicher Aufbau `[CODE]`

| Schicht | Ort | Zustand |
| --- | --- | --- |
| Browser (React 19, PWA, TanStack Router/Query) | `src/routes/**`, `src/components/**` | clientseitig |
| SSR/Worker-Laufzeit (Cloudflare workerd) | `src/server.ts`, `src/start.ts`, Nitro-Build via `vite.config.ts` | **fast** zustandslos (Ausnahmen § 4.2) |
| Server-Funktionen (RPC) | `src/lib/*.functions.ts` → `src/lib/*.server.ts` | zustandslos je Aufruf |
| Öffentliche HTTP-Endpunkte | `src/routes/api/public/` (8 Routen: Zahlungs-Webhook, `moderation-run`, `push-run`, `counters-run`, `retention-run`, `ops-health-run`, `beta-launch-run`, `cache-metrics`) | zustandslos, eigene Absicherung im Handler |
| Datenbank + Auth + Storage + Realtime | Lovable Cloud (Postgres, PostgREST, GoTrue, Realtime, S3-kompatibler Storage) | **zustandsbehaftet** |
| Hintergrundjobs | `cron.job` in Postgres, 7 aktive Jobs `[DB]` | zustandsbehaftet (DB-getrieben) |
| Externe Dienste | Lovable AI Gateway (Moderation/Übersetzung), Stripe (Abos/Werbung), Web Push (VAPID) `[CODE: src/lib/push.server.ts]` | extern |

Client schreibt für viele Pfade **direkt** in die Datenbank (Supabase JS unter
RLS als angemeldeter Nutzer): Kommentare, Likes, Nachrichten, Views,
Konversationen `[CODE: src/lib/social.tsx, src/lib/data.tsx]`. Rechte-kritische
Vorgänge laufen ausschließlich serverseitig (Market-Transaktionen, Moderation,
Push, Admin) `[CODE: docs/ARCHITEKTUR.md §1, src/lib/market-tx.server.ts]`.

### 1.2 Zustandslos / zustandsbehaftet

**Zustandslos (beliebig vervielfachbar, keine Sticky Sessions):**
SSR-Rendering, alle Server-Funktionen, alle `api/public/*`-Routen.
Sitzungen liegen als JWT im Browser (`localStorage` + Bearer-Anhang über
`functionMiddleware`) `[CODE: src/start.ts:50, src/integrations/supabase/auth-attacher.ts]`
– **kein serverseitiger Sitzungsspeicher, keine Sticky Sessions nötig.**

**Zustandsbehaftet:**
Postgres (einzelne Instanz), Storage-Bucket `media` (privat) `[DB: storage.buckets]`,
Realtime-Server, `cron.job`-Zeitpläne, Job-Tabellen
(`post_moderation_jobs`, `notification_jobs`, `media_variant_jobs`, `counter_events`).

**Prozess-lokaler Zustand in der Worker-Instanz (die drei Ausnahmen):**

1. SSR-Seitencache: `const store = new Map()`, `MAX_ENTRIES = 200`
   `[CODE: src/lib/http-cache.server.ts:57,61]`
2. Server-Datencache inkl. Stampede-Schutz: `store`, `inflight`,
   TTL 60 s, `MAX_ENTRIES = 500` `[CODE: src/lib/server-cache.server.ts:26,27,30,33]`
3. IP-Rate-Limit: `const buckets = new Map()`, `MAX_KEYS = 5000`
   `[CODE: src/lib/ip-rate-limit.server.ts:11,13]`
4. Laufzeit-Kennzahlen: Modulobjekt `metrics`
   `[CODE: src/lib/runtime-metrics.server.ts:14]`
5. Interessen-Engine-Cache: `const cache = new Map()` **ohne Obergrenze**,
   Schlüssel enthalten die Nutzer-ID `[CODE: src/lib/interest-engine/engine.server.ts:43,49,55]`
6. Supabase-Admin-Client als Lazy-Singleton (`let _supabaseAdmin`)
   `[CODE: src/integrations/supabase/client.server.ts:61]` – unkritisch

Alle sind **pro Instanz** und gehen bei Neustart verloren. Die meisten sind
unkritisch (Cache = Trefferquote sinkt, Kennzahlen = pro Instanz sichtbar), zwei
sind relevant: das IP-Limit (§ 7) und der **unbegrenzte** Interessen-Cache, dessen
Speicherbedarf mit der Zahl aktiver Nutzer wächst, weil die Schlüssel
nutzerspezifisch sind und nur `invalidateInterestCache` löscht.

### 1.3 Single Points of Failure

| Komponente | SPOF? | Begründung |
| --- | --- | --- |
| Postgres-Primary | **Ja** | Eine Instanz, keine Read-Replica in dieser Architektur nachweisbar |
| PostgREST/PgBouncer | Ja (vorgelagert) | Teil derselben Cloud-Instanz; `Pool clients 3/200` `[DB]` |
| Storage-Bucket `media` | Ja | einziger Medienspeicher, privat, signierte URLs (7 Tage TTL) `[CODE: src/lib/media.ts:6]` |
| Realtime-Server | Ja | alle Presence-/Chat-/DB-Ereignisse laufen darüber |
| pg_cron | Ja | 7 Jobs; fällt Cron aus, stauen sich Moderation, Push, Zählerabgleich `[DB]` |
| SSR-Worker | Nein | edge-verteilt, zustandslos |
| Lovable AI Gateway | Nein (degradiert) | Moderation/Übersetzung haben Fallback `[CODE: docs/ARCHITEKTUR.md]` |

---

## 2. Datenbank

### 2.1 Gemessener Zustand `[DB, 19.09.2026]`

- Größe 133,4 MB, Data-Disk 22 % belegt, RAM 46 %
- Verbindungen 19/60, Pool-Clients 3/200, 0 Neustarts seit Boot
- Cache-Trefferquote im Lasttest 99,9999 % `[MESS]`, 0 Deadlocks, 0 wartende Sperren
- 121 Tabellen mit RLS-Policies, **301 Policies** insgesamt
- Rollbacks seit Boot: 897.483 – deckungsgleich mit den bewusst abgewiesenen
  anonymen Anfragen aus den Lasttests `[MESS + docs/RLS_PERMISSION_INCIDENT_2026-09-17.md]`

### 2.2 Indizes und Schreibpfade `[DB: pg_indexes, pg_trigger]`

Die Kernpfade sind indexiert und passen zu den tatsächlichen Abfragen:
`posts_feed_idx (moderation_status, created_at DESC)`,
`messages_conversation_created_idx (conversation_id, created_at DESC)`,
`messages_unread_idx … WHERE read_at IS NULL`,
`notifications_user_unread_idx`, `post_likes_pkey (post_id, user_id)`,
`post_views_pkey (post_id, user_id)`,
`conversation_members_pkey (conversation_id, user_id)`.
Keyset-Pagination im Feed ist im Code umgesetzt `[CODE: src/lib/data.tsx]`.

**Trigger-Dichte auf heißen Tabellen** – dies ist der strukturell wichtigste
Schreib-Kostenfaktor `[DB]`:

| Tabelle | Trigger |
| --- | --- |
| `posts` | 12 (Hashtags ×3, SlangTag-Nutzung, Kanalzähler, Moderationsmeldung, Mentions, Übersetzungs-Invalidierung, Bann-Prüfung, …) |
| `messages` | 5 (Rate-Limit, Inhaltsschutz, Lesezustandsschutz, Konversation-Aktivität, Benachrichtigung) |
| `comments` | 3 (Zähler, Rate-Limit, Benachrichtigung) |
| `post_likes` | 3 (Zähler, Benachrichtigung, Gegenbuchung) |
| `post_views` | 1 (`queue_counter_event` → entkoppelte Zählung) |
| `notifications` | 1 (`enqueue_notification_push`) |
| `conversation_members` | **0** |

Bemerkenswert positiv: Views und Plays schreiben **nicht** direkt auf die
Zählerspalte, sondern in `counter_events`; der Minutenjob
`y-dude-counter-flush` aggregiert gebündelt und macht daraus **einen** Update je
Post statt tausender `UPDATE posts` `[DB: cron.job, prosrc flush_counter_events]`.
Das ist genau die Bauweise, die Hot-Row-Contention auf `posts.views_count`
vermeidet.

### 2.3 Sonderfall `conversation_members.last_read_at`

**Gemessen** `[DB: slow_queries]`: teuerste Abfrage der Historie –
12.019 Aufrufe, Mittel 11,49 ms, Max 689,93 ms, gesamt 138,1 s. Es handelt sich
um einen **PostgREST-`PATCH`** (`UPDATE … SET last_read_at … WHERE conversation_id = $2 AND user_id = $3`).

**Warum teuer – belegte Ursachen:**

1. Die Tabelle hat **keine** Trigger `[DB]`; die Kosten kommen nicht aus
   Trigger-Ketten.
2. `conversation_members` zeigt **4.125.971 Sequential Scans** bei 36 lebenden
   Zeilen `[DB: pg_stat_user_tables]`. Ursache: die SELECT-/UPDATE-Policies von
   `conversation_members`, `conversations` und `messages` rufen alle
   `is_conversation_member()` auf `[DB: pg_policies]`, und diese Funktion macht
   ein `EXISTS (SELECT 1 FROM conversation_members …)` `[DB: prosrc]`. Bei 36
   Zeilen wählt der Planer dafür einen Seq-Scan – billig heute, aber es ist
   **je geprüfter Zeile eine zusätzliche Unterabfrage**.
3. 12.043 HOT-Updates bei 36 Zeilen `[DB]`: dieselben wenigen Zeilen werden
   dauernd neu geschrieben → klassische **Hot-Row-Signatur**, jede Änderung
   erzeugt eine neue Tupelversion plus WAL.

**Aktueller Codestand entschärft das bereits messbar:** Der Client ruft heute
nicht mehr den `PATCH`, sondern die Funktion `mark_conversation_read` mit
2 s-Entprellung `[CODE: src/lib/social.tsx:171,1378]`. Diese Funktion schreibt
`last_read_at` nur, wenn tatsächlich etwas gelesen wurde
(`IF _touched > 0 OR _last_read IS NULL OR _last_read < _last_message`)
`[DB: prosrc mark_conversation_read]`. Sie erscheint **nicht** in der Liste der
teuersten Abfragen `[DB: slow_queries]` – der 11,5-ms-Eintrag ist ein
**historischer Rückstand aus der Zeit vor dieser Umstellung**, kein Beleg für
das heutige Verhalten.

**Bewertung:**
- Würde bei steigender Messenger-Schreiblast problematisch? **Nur die eine Zeile
  pro (Konversation, Nutzer)** ist betroffen; Postgres serialisiert Updates auf
  derselben Zeile. Bei zwei Teilnehmern je Direktchat ist echte Contention
  unwahrscheinlich, bei großen Gruppen-/Kanalchats mit vielen parallelen Lesern
  derselben Konversation wächst sie. `[UNBELEGT – nie unter Last gemessen]`
- Reicht mehr Infrastruktur? **Für den Update selbst ja** (mehr RAM/CPU/IOPS
  hilft, es ist ein PK-Punkt-Update). Für Zeilenkonflikte auf derselben Zeile
  **nein** – Sperren skalieren nicht mit Hardware.
- Struktureller Umbau erst dann nötig, wenn Lesezustände für große Gruppenchats
  in hoher Frequenz geschrieben werden (dann: Lesezustand als Append-Strom oder
  im Client/Cache statt als Einzeilen-Update). **Sicherheit der Einschätzung:
  mittel**, weil keine Schreiblastmessung existiert.

### 2.4 Weitere gemessene Auffälligkeiten `[DB]`

- `http_request_queue`: 334.125 Seq-Scans, 111.764 Inserts/Deletes – das ist
  `pg_net`, über das die Cron-Jobs die `api/public/*`-Endpunkte aufrufen. Wächst
  linear mit Jobfrequenz.
- `post_moderation_jobs`: 83.762 Polling-Selects, je 0,08 ms – Minutenpolling
  läuft auch bei leerer Warteschlange. Günstig, aber Grundlast.
- `connection_suggestions`: 120.598 Inserts / 120.836 Deletes bei 315 Zeilen –
  der 10-Minuten-Job berechnet Vorschläge vollständig neu. Kosten wachsen mit
  Nutzer × Verbindungen.
- Unfilterte Listenabfragen in der Statistik (`SELECT id, body, created_at FROM
  messages ORDER BY created_at DESC LIMIT …` ohne `conversation_id`) stammen aus
  der Betriebssonde `ops_rpc_probe`/Health-Check, nicht aus dem Produktpfad.

---

## 3. Supabase / Postgres / PostgREST

- **Verbindungen:** Obergrenze 60 direkte, 200 Pool-Clients `[DB]`. Unter
  1.000 VU Lese-Last wurden maximal **29/60** erreicht `[MESS]`. PostgREST
  multiplext, daher steigt die Verbindungszahl nicht linear mit VU.
- **RLS-Ausführung:** 301 Policies; die Messenger-Policies rufen
  `is_conversation_member()` je Zeile auf, Kommentar-/Like-Policies rufen
  `can_view_post()` bzw. `has_role()` `[DB: pg_policies]`. Alle
  `auth.uid()`-Aufrufe sind als `(SELECT auth.uid())` gekapselt – das ist die
  Form, die Postgres einmal je Anweisung statt je Zeile auswertet. Sauber
  umgesetzt.
- **RPC:** Market-Abschluss, Lesezustand, Zählerabgleich, Rechteprüfungen laufen
  als `SECURITY DEFINER`-Funktionen; `market_complete_transaction` sperrt
  Transaktion und Artikel und ist idempotent (frühere Prüfung, unverändert).
- **Wie viel zusätzliche Last passt noch hinein?**
  Gemessen sind 715 Anfragen/s mit p95 = 125 ms bei 48 % RAM und 29/60
  Verbindungen – also **keine erkennbare Sättigung in irgendeiner der vier
  Größen**. Eine belastbare Obergrenze lässt sich daraus **nicht** ableiten,
  weil kein Kipppunkt erreicht wurde und der Lastgenerator selbst bei 1.000 VU
  die Grenze war `[MESS §3]`. **Keine belastbare numerische Aussage möglich.**

---

## 4. Horizontale Skalierung

### 4.1 Was bereits horizontal skaliert

Ja, mit den Belegen: kein serverseitiger Sitzungsspeicher (JWT im Client,
Bearer-Anhang je Aufruf) `[CODE: src/start.ts, auth-attacher.ts]`, keine lokalen
Dateien (Uploads gehen in den Storage, nicht auf die Instanzplatte)
`[CODE: src/lib/media.ts]`, keine Sticky Sessions erforderlich, keine
Instanz-Affinität in Routen. 1 → 2 → 5 → 10 Instanzen wäre nach heutigem
Codestand **ohne Codeänderung möglich**, mit drei Verhaltensänderungen:

### 4.2 Was bei mehreren Instanzen anders funktioniert

| Komponente | Verhalten bei N Instanzen | Schwere |
| --- | --- | --- |
| SSR-Seitencache (`Map`, 200 Einträge) `[CODE: http-cache.server.ts:57]` | Trefferquote sinkt ~1/N, N-facher Ursprungs-Render | gering (CDN `s-maxage` fängt das ab) |
| Server-Datencache (`Map`, 500, TTL 60 s, `inflight`) `[CODE: server-cache.server.ts]` | Stampede-Schutz gilt nur **innerhalb** einer Instanz → bis zu N gleichzeitige Origin-Abfragen statt 1 | gering bis mittel |
| **IP-Rate-Limit (`Map`, MAX_KEYS 5000)** `[CODE: ip-rate-limit.server.ts:11]` | Limit wird **N-fach großzügiger** | **sicherheitsrelevant, § 7** |
| Laufzeit-Kennzahlen `[CODE: runtime-metrics.server.ts]` | je Instanz getrennt, keine Gesamtsicht | gering (Monitoring) |
| Realtime/Presence | läuft über den Realtime-Server, nicht über die Instanz | keine |
| pg_cron-Jobs | in der DB, nicht in der Instanz → **keine Doppelausführung** | keine |

Wichtig: Alle vier Punkte sind **Cache-/Zähl-Zustand**, kein fachlicher Zustand.
Es gibt keine Komponente, die für Korrektheit Instanz-Affinität benötigt.

---

## 5. Storage und Medien

**Stand `[DB: storage.buckets]`:** genau ein Bucket `media`, **privat**, kein
`file_size_limit`, keine MIME-Beschränkung auf Bucket-Ebene (Validierung liegt
im Code, z. B. `tests/video-upload-validation.test.ts`).
Zugriff ausschließlich über **signierte URLs mit 7 Tagen Gültigkeit**
`[CODE: src/lib/media.ts:6,495]`; Bildvarianten/Thumbnails werden clientseitig
per Canvas erzeugt `[CODE: src/lib/media.ts:255–286]`; zusätzlich existiert eine
Varianten-Jobtabelle `media_variant_jobs` und `media_video_assets`.

**Erwartete Skalierungswirkung – qualitativ, weil aus der Architektur nicht
in Nutzerzahlen umrechenbar:**

- **Struktureller Punkt (unabhängig von der Nutzerzahl):** private Objekte +
  signierte URLs bedeuten, dass jede Medien-URL **nutzer- und zeitabhängig
  eindeutig** ist. Ein vorgeschalteter CDN-Cache kann solche URLs nur je
  Signatur cachen, nicht je Objekt. Bei wachsender Nutzerzahl steigt daher der
  Storage-Egress **annähernd proportional zur Zahl der Betrachter**, nicht zur
  Zahl der Medien. Das ist der am klarsten belegbare Kostentreiber der
  Architektur.
- Die Ausgangsgrößen sind gemessen ungünstig: `og-logo.png` 1,13 MB,
  `globe.png` 721 KB, 3,7 MB Geodaten-JS (lazy) – Build-Audit vom 18.09.
- 10.000 / 100.000 / 1.000.000 Nutzer: **Keine belastbare numerische Aussage
  möglich** – es existiert keine Messung von Upload-Last, Egress pro Sitzung
  oder Medien pro Nutzer.

---

## 6. Caching

| Ebene | Was | TTL | Invalidierung | Beleg |
| --- | --- | --- | --- | --- |
| CDN/Browser | öffentliche Seiten `/`, `/auth`, Rechtsseiten | 60–3.600 s | ablaufbasiert | `http-cache.server.ts:24–31` |
| CDN/Browser | öffentliche Beitragsseiten `/post/<uuid>` | 60 s, nur mit Marker-Header | ablaufbasiert | `http-cache.server.ts:44–48` |
| CDN/Browser | statische Dateien | 86.400 s / CDN 604.800 s + SWR | ablaufbasiert, kein `immutable` | `http-cache.server.ts:69–72` |
| Browser/Storage | Medien: `originals/` → `no-store`, alle anderen Ordner → `max-age=31536000, immutable` (UUID-Pfade) | 1 Jahr | Pfad ist unveränderlich | `src/lib/media.ts:20–42` |
| Instanz | SSR-Kurzzeitcache, 200 Einträge, **ohne** Stampede-Schutz | s. o. | FIFO-Verdrängung + `invalidateHttpCache(path?)` | `http-cache.server.ts:57,177` |
| Instanz | Server-Datencache, 500 Einträge, **mit** Stampede-Schutz | 60 s | LRU + TTL + `invalidateServerCache(prefix?)` | `server-cache.server.ts:30,33,117` |
| Instanz | Interessen-Engine, **ohne Obergrenze** | 900 s / 3.600 s | nur `invalidateInterestCache` | `interest-engine/engine.server.ts:43,72,80` |
| Browser | TanStack Query | `staleTime` 30 s, `gcTime` 5 min, kein Refetch bei Fokus, `retry: 1` | Query-Invalidierung | `src/router.tsx` |
| Postgres | Buffer-Cache | – | – | Trefferquote 99,9999 % `[MESS]` |

**Harte Sicherheitsregel ist umgesetzt:** gecacht wird nur bei GET/HEAD,
Status 200, **ohne Cookie und ohne Authorization**, `Vary: Cookie, Authorization`,
nie bei `set-cookie` `[CODE: http-cache.server.ts:10–20]`. Damit ist der
gefährlichste Cache-Fehler (personalisierte Antwort im Shared Cache)
konstruktiv ausgeschlossen.

**Cache-Stampede:** Für den **Datencache** innerhalb einer Instanz durch
`inflight` verhindert `[CODE: server-cache.server.ts:27]`. Über Instanzgrenzen
hinweg **nicht** – bei N Instanzen bis zu N parallele Origin-Abfragen pro kaltem
Schlüssel. Der **SSR-Seitencache hat gar keinen Stampede-Schutz**: bei einem Miss
rendert jede parallele Anfrage die Seite eigenständig `[CODE: http-cache.server.ts]`.
Ebenso wirkt eine Invalidierung nur in der Instanz, die sie ausführt – andere
Instanzen liefern bis zu ihrem eigenen TTL-Ablauf weiter den alten Stand.
Reicht der Ansatz langfristig? Für den Lesepfad öffentlicher Seiten: ja, weil
der CDN-Layer davor sitzt. Ein **verteilter Cache** würde erst relevant, wenn
teure, nicht-öffentliche Berechnungen (Feed-Ranking, Interest-Engine) pro
Instanz neu berechnet werden müssen. `[UNBELEGT]`

---

## 7. Rate Limiting

Drei getrennte Mechanismen `[CODE]`:

1. **Datenbank-Trigger `enforce_write_rate_limit`** auf `comments`, `messages`,
   SlangTags u. a. `[DB: pg_trigger, prosrc]`. Zählt eigene Zeilen im Fenster,
   wirft `RATE_LIMIT`. **Verteilt korrekt, nicht umgehbar am Client vorbei,
   instanzunabhängig.** Kosten: ein `count(*)` je Schreibvorgang – wächst mit
   der Zeilenzahl im Fenster, nicht mit der Tabellengröße.
2. **Server-seitiges Zählen `checkRateLimit`** für Server-Funktions-Pfade
   (`posts`, `slang_tags`) über `supabaseAdmin`-`count` `[CODE: src/lib/rate-limit.server.ts]`
   – **DB-basiert, also ebenfalls instanzunabhängig korrekt.** Bei Zählfehler
   wird bewusst nicht blockiert.
3. **IP-Limit im Arbeitsspeicher** `[CODE: src/lib/ip-rate-limit.server.ts]` –
   `Map` im Prozess, `MAX_KEYS = 5000`, bei Überschreitung `buckets.clear()`.
   Der Kommentar benennt es selbst als Best-Effort-Kostenbremse neben Turnstile.

**Antwort auf die gestellte Frage:** Die beiden DB-gestützten Mechanismen (1, 2)
funktionieren bei mehreren Instanzen unverändert korrekt. Mechanismus 3 **nicht**:
Bei N Instanzen darf ein Angreifer effektiv N × `max` Anfragen im Fenster, und
`buckets.clear()` löscht bei >5.000 Schlüsseln **alle** Zähler gleichzeitig – ein
Angreifer mit vielen IPs kann das gezielt auslösen. Notwendige Änderung dafür:
zentraler Zähler (DB-Tabelle oder externer KV-Speicher) oder Limitierung
vorgelagert an der Edge. **Heute nicht akut**, weil nur eine Instanz läuft und
Turnstile die verbindliche Prüfung ist – es ist eine **Vorbedingung für
horizontale Skalierung**, keine aktuelle Lücke.

---

## 8. Messenger und Realtime

### 8.1 Im Code vorhanden `[CODE: src/lib/social.tsx]`

- Nachrichten: Client schreibt direkt in `messages` (RLS + 5 Trigger).
- Lesezustand: RPC `mark_conversation_read`, 2 s entprellt (`READ_DEBOUNCE_MS = 2000`, Zeile 171).
- Übersetzung: `message_translations` + AI Gateway mit Kontingent-Fallback.
- Push: `notifications` → Trigger `enqueue_notification_push` → `notification_jobs`
  → Minutenjob `y-dude-push-run` → `api/public/push-run` (VAPID).
- **E2EE: nicht vorhanden.** Nachrichteninhalte liegen als Klartext in `messages`
  (belegt durch Spaltenzugriff `body` in Policies und Slow-Query-Statistik).
- Realtime-Kanäle **pro angemeldeter Nutzersitzung**:
  - 1 eigenes Presence-Topic (Zeile 640)
  - **bis zu 80** Presence-Topics fremder Personen (`PRESENCE_PEER_LIMIT = 80`, Zeile 127/633)
  - 1 nutzereigenes `postgres_changes`-Topic (Zeile 696)
  - **bis zu 60** Chat-Broadcast-Topics für Tipp-Hinweise (`CHAT_TOPIC_LIMIT = 60`, Zeile 128/842)

  → **bis zu ~142 gleichzeitige Realtime-Abonnements je aktiver Nutzersitzung.**

### 8.2 Unter Produktionslast nachgewiesen

**Nichts davon.** Der Lasttest enthielt ausdrücklich keine Realtime/WebSockets,
kein Nachrichtenversenden `[MESS §2]`. Gemessen existieren nur Lesepfade
(`messages`-Abfrage p95 71 ms bei 1.000 VU) `[MESS: LASTTEST_1000VU_2026-09-14.md §3]`.

### 8.3 Einschätzung 1.000 / 5.000 / 10.000 / 50.000 / 100.000 gleichzeitige Messenger-Nutzer

**Keine belastbare numerische Aussage möglich** – keine Messung existiert.
Was sich **strukturell** sagen lässt: die Zahl gleichzeitiger
Realtime-Abonnements skaliert nicht mit der Nutzerzahl, sondern mit
*Nutzer × sozialem Graph*, begrenzt durch 80 + 60. Die Kanalanzahl ist damit die
Größe, die als Erste an eine Plattformgrenze stößt – nicht die
Nachrichtenanzahl. Bei jeder Skalierungsplanung ist **die Obergrenze
gleichzeitiger Realtime-Verbindungen/Kanäle des Realtime-Dienstes** zu prüfen,
bevor Nutzerzahlen diskutiert werden. **Sicherheit: hoch für die Aussage
„Kanäle vor Nachrichten", niedrig für jede Zahl.**

---

## 9. Write-Load

Nach gemessener Trigger- und Zählerstruktur, sortiert nach erwarteter
Reihenfolge des Auftretens:

| Pfad | Schreibkosten heute | Risikotyp |
| --- | --- | --- |
| `post_views` | 1 Insert + 1 Trigger → `counter_events`; Aggregation im Minutenjob `[DB]` | **entschärft** – kein Hot-Row auf `posts` |
| `messages` Insert | 5 Trigger, u. a. Rate-Limit-`count`, `bump_conversation_activity` (Update auf `conversations` = **Hot Row je Konversation**), Benachrichtigung | Lock-Contention je Konversation |
| `conversation_members.last_read_at` | PK-Punkt-Update auf wenige Zeilen, 12.043 HOT-Updates bei 36 Zeilen `[DB]` | Hot Row, siehe § 2.3 |
| `post_likes` | 3 Trigger, davon `sync_post_counter` = **Update auf `posts` derselben Zeile** | **Hot Row auf virale Beiträge** |
| `comments` | 3 Trigger, `sync_comment_counts` = Update auf `posts` | Hot Row auf virale Beiträge |
| `posts` Insert | **12 Trigger** + Moderationsjob + Übersetzungs-Invalidierung | längste Transaktion, aber niedrige Frequenz |
| Market-Aktionen | serverseitig, `SECURITY DEFINER` mit Zeilensperren, idempotent | korrekt, geringe Frequenz |
| Uploads | Storage-Egress/Ingress, nicht DB | Bandbreite |

**Was wahrscheinlich zuerst relevant wird:** Likes und Kommentare auf einem
einzelnen sehr populären Beitrag. Beide schreiben synchron auf **dieselbe Zeile
in `posts`** (`sync_post_counter`, `sync_comment_counts` `[DB: pg_trigger]`),
während Views diesen Weg bereits vermeiden. Bei gleichzeitigen Likes auf einen
Beitrag serialisiert Postgres diese Updates zeilenweise – mehr Hardware hilft
dabei nicht. Die Architektur enthält mit `counter_events` +
`flush_counter_events` **bereits das passende Muster**; es ist nur für Views und
Plays angewendet, nicht für Likes und Kommentare. **Sicherheit: hoch für den
Mechanismus, unbekannt für den Zeitpunkt (keine Schreiblastmessung).**

---

## 10. Skalierbarkeitsstufen

**LEVEL 1 – nachgewiesen** `[MESS]`
1.000 gleichzeitige Nutzer, 767.637 Anfragen, ~715 Anf./s über 15 min,
0×5xx, 0 Timeouts, 0 Verbindungsabbrüche, p50 49 ms / p95 125 ms / p99 438 ms,
DB 29/60 Verbindungen, 0 Deadlocks, 0 wartende Sperren, sofortige Erholung —
**ausschließlich anonyme Lese-Last (GET)**.

**LEVEL 2 – architektonisch gut vorbereitet** (mehr Infrastruktur genügt
voraussichtlich)
Zustandslose SSR- und Server-Funktionsschicht, mehrere Instanzen ohne Sticky
Sessions; CDN-Auslieferung öffentlicher Seiten und statischer Dateien; Postgres
vertikal (CPU/RAM/IOPS) und Disk unabhängig vergrößerbar (heute 22 % / 46 %);
PostgREST-Multiplexing statt Verbindung-pro-Nutzer; Feed-Keyset-Pagination und
passende Indizes; entkoppelte Zählung über `counter_events`;
DB-basiertes Rate Limiting.

**LEVEL 3 – Validierung erforderlich** (nicht „unsicher", sondern **ungemessen**)
Schreiblast jeder Art; Nachrichtenversand; Realtime/WebSocket-Kanäle;
Uploads und Storage-Egress; Registrierung inkl. Turnstile; Market-Abschlüsse;
angemeldete Sitzungen unter Last; echtes Browser-Rendering; Lastbereich > 1.000 VU;
Dauerstabilität > 25 min; Wirksamkeit des IP-Limits bei mehreren Instanzen.

**LEVEL 4 – struktureller Umbau wahrscheinlich bei starkem Wachstum**
1. Zähler-Trigger für Likes/Kommentare auf dieselbe `posts`-Zeile → Übergang auf
   das bereits existierende `counter_events`-Muster.
2. IP-Rate-Limit im Prozessspeicher → zentraler/verteilter Zähler.
3. Private Medien mit nutzerspezifischen signierten URLs → CDN-fähiges
   Auslieferungsmodell für öffentliche Medien, wenn Egress dominiert.
4. Ein einzelner Postgres-Primary für alle Lese- und Schreibpfade → Read-Replicas
   oder Trennung heißer Tabellen.
5. Bis zu ~142 Realtime-Kanäle je Sitzung → serverseitige Fan-out-/Presence-
   Aggregation statt Kanal-pro-Person.
6. Minutenpolling der Jobtabellen über `pg_net` → ereignisgetriebene
   Warteschlange, wenn Jobvolumen steigt.

---

## 11. Bottleneck-Prognose

Sortiert nach technischer Abhängigkeit (zuerst, was am frühesten in der
Aufrufkette greift).

### B1 Zähler-Trigger auf `posts` (Likes/Kommentare)
- **Warum:** jeder Like/Kommentar aktualisiert synchron dieselbe `posts`-Zeile
  `[DB: post_likes_count, comments_counts]`.
- **Zustand:** funktionsfähig, niedrige Frequenz (`posts` 903 Updates, 820 HOT `[DB]`).
- **Messwerte:** keine Schreiblastmessung. Views nutzen bereits den entkoppelten Weg.
- **Erhöht Last:** ein viraler Beitrag mit parallelen Likes.
- **Einfache Maßnahme:** keine – Hardware löst Zeilenkonflikte nicht.
- **Umbau nötig, wenn:** gleichzeitige Likes je Beitrag messbar zu Wartezeiten führen.
- **Sicherheit:** hoch im Mechanismus, unbekannt im Zeitpunkt.

### B2 Messenger-Schreibpfad (`messages` + `conversations` + Lesezustand)
- **Warum:** 5 Trigger je Insert, `bump_conversation_activity` schreibt auf die
  Konversationszeile, Lesezustand auf die Mitgliedszeile.
- **Zustand:** Lesepfad gemessen gut (p95 71 ms `[MESS]`), Lesezustand durch RPC +
  Entprellung entschärft `[CODE]`.
- **Messwerte:** historisch 11,49 ms Mittel / 690 ms Max auf dem alten PATCH-Pfad `[DB]`.
- **Erhöht Last:** aktive Gruppenchats, viele parallele Leser derselben Konversation.
- **Einfache Maßnahme:** mehr DB-Ressourcen hilft der Latenz, nicht der Serialisierung.
- **Umbau nötig, wenn:** Gruppenchats mit hoher Leserzahl Standard werden.
- **Sicherheit:** mittel.

### B3 Realtime-Kanalanzahl
- **Warum:** bis ~142 Abonnements je Sitzung `[CODE: social.tsx:127,128]`.
- **Zustand:** durch zwei Obergrenzen bewusst gedeckelt.
- **Messwerte:** **keine** – Realtime war in keinem Lasttest enthalten `[MESS §2]`.
- **Erhöht Last:** mehr gleichzeitig **angemeldete** Nutzer (nicht mehr Anfragen).
- **Einfache Maßnahme:** Grenzen senken; Realtime-Dienstgröße erhöhen.
- **Umbau nötig, wenn:** die Kanalgrenze des Realtime-Dienstes erreicht wird.
- **Sicherheit:** hoch in der Struktur, keine Zahl.

### B4 Storage-Egress / signierte URLs
- **Warum:** privater Bucket, 7-Tage-Signaturen, pro Betrachter eigene URL `[CODE/DB]`.
- **Zustand:** ein Bucket, keine Bucket-Limits gesetzt, Varianten clientseitig.
- **Messwerte:** statische Asset-Auslieferung p95 69 ms `[MESS 14.09.]`; kein Egress gemessen.
- **Erhöht Last:** mehr Betrachter je Medium, Video.
- **Einfache Maßnahme:** Ausgangsgrößen reduzieren, Varianten serverseitig vorhalten.
- **Umbau nötig, wenn:** Medienauslieferung die Kosten dominiert.
- **Sicherheit:** hoch in der Ursache, keine Zahl.

### B5 IP-Rate-Limit im Prozessspeicher
- **Warum:** `Map` je Instanz, `buckets.clear()` bei >5.000 Schlüsseln `[CODE]`.
- **Zustand:** wirksam bei einer Instanz, Best Effort neben Turnstile.
- **Messwerte:** keine.
- **Erhöht Last:** horizontale Skalierung, verteilte Anfragequellen.
- **Einfache Maßnahme:** keine – Zustand liegt am falschen Ort.
- **Umbau nötig, wenn:** mehr als eine Instanz läuft → **Vorbedingung für § 4**.
- **Sicherheit:** hoch.

### B6 Einzelner Postgres-Primary
- **Warum:** alle Lese- und Schreibpfade laufen durch eine Instanz.
- **Zustand:** 19/60 Verbindungen, 46 % RAM, 22 % Disk, 0 Neustarts `[DB]`;
  unter 1.000 VU max. 29/60 `[MESS]`.
- **Erhöht Last:** alles.
- **Einfache Maßnahme:** vertikal vergrößern (Compute und Disk getrennt steuerbar) –
  deckt voraussichtlich einen erheblichen weiteren Bereich ab.
- **Umbau nötig, wenn:** Lesevolumen auch nach vertikaler Vergrößerung dominiert
  → Read-Replicas.
- **Sicherheit:** hoch im Zustand, keine Zahl zum Kipppunkt.

### B7 Cron-/Jobkette über `pg_net`
- **Warum:** 7 Minuten-/10-Minuten-Jobs, 334.125 Seq-Scans auf `http_request_queue` `[DB]`.
- **Zustand:** funktionsfähig, Polling läuft auch leer.
- **Erhöht Last:** mehr Beiträge (Moderation), mehr Benachrichtigungen (Push),
  mehr Nutzer (Vorschlagsberechnung: 120.598 Inserts bei 315 Zeilen `[DB]`).
- **Einfache Maßnahme:** Intervalle und Batchgrößen anpassen.
- **Umbau nötig, wenn:** ein Minutenfenster nicht mehr für einen Durchlauf reicht.
- **Sicherheit:** mittel.

### B8 Instanz-lokale Caches
- **Warum:** Trefferquote und Stampede-Schutz gelten nur je Instanz `[CODE]`.
- **Zustand:** CDN sitzt davor, Wirkung begrenzt.
- **Umbau nötig, wenn:** teure nicht-öffentliche Berechnungen pro Instanz anfallen.
- **Sicherheit:** mittel.

---

## 12. Enterprise-typische Eigenschaften – vorhanden / fehlend

Kein Gesamturteil, keine Gesamtnote.

| Bereich | Vorhanden | Fehlt / ungemessen |
| --- | --- | --- |
| **A Skalierbarkeit** | zustandslose App-Schicht, CDN, Keyset-Pagination, entkoppelte Zähler | Schreib-/Realtime-Skalierung ungemessen, IP-Limit nicht verteilt |
| **B Zuverlässigkeit** | 0×5xx über 767.637 Anfragen `[MESS]`, sofortige Erholung, Fehlerseite statt Blankoausfall (`src/server.ts`) | kein Chaos-/Ausfalltest, keine Redundanz der DB |
| **C Datenbankarchitektur** | 121 Tabellen mit RLS, zielgenaue Indizes, `SECURITY DEFINER`-RPC, additive Migrationen (222) | keine Partitionierung, keine Replica, Zähler-Trigger auf Hot Rows |
| **D Security** | 301 RLS-Policies, keine anonymen Leserechte auf Beiträge/SlangTags, Rechteentzug per Migration, CSRF-Middleware (`src/start.ts:45`), Turnstile, Webhook-Signaturprüfung, `service_role` nur serverseitig | IP-Limit nicht verteilt, kein E2EE im Messenger |
| **E Auth/Autorisierung** | JWT, Rollen in separater `user_roles` + `has_role()`, `_authenticated`-Gate, Admin-Owner-Trennung | keine SSO/SAML-Nutzung, MFA nicht nachgewiesen aktiv genutzt |
| **F Performance** | p50 49 ms / p95 125 ms bei 1.000 VU, Buffer-Hit 99,9999 % `[MESS]`, Initial Load 194 KB Brotli | Schreiblatenzen, Browser-Rendering ungemessen |
| **G Caching** | drei Ebenen, strikte Trennung angemeldet/anonym, Stampede-Schutz je Instanz | nicht verteilt |
| **H Storage** | privater Bucket, signierte URLs, Varianten-/Video-Jobtabellen, Medien-Cache-Politik getestet | CDN-Fähigkeit privater Medien, Egress ungemessen, keine Bucket-Limits |
| **I Realtime** | Presence, `postgres_changes` RLS-gefiltert, Broadcast-Tippen, harte Kanalobergrenzen, Topic-Scoping getestet (`tests/realtime-topic-scoping.test.ts`) | **nie unter Last gemessen**, ~142 Kanäle je Sitzung |
| **J Monitoring** | `ops_events`/`ops_incidents`, Alarmzustellung, `/admin/health`, 5-Minuten-Health-Cron, Laufzeitkennzahlen, Cache-Metrik-Endpunkt, Tests für Alerting | Kennzahlen nur je Instanz, kein verteiltes Tracing, Plattform-Log-Alarme nicht projektseitig klassifizierbar (siehe `RLS_PERMISSION_INCIDENT_2026-09-17.md`) |
| **K Deployment** | CI (`.github/workflows/ci.yml`), `bun run verify` als Gate, 678 Unit- + 68 DB- + E2E-Tests, Publish-Prozess dokumentiert | 2 vorbestehende veraltete E2E-Erwartungen; **Staging und Production teilen Datenbank und Storage** (`docs/ARCHITEKTUR.md §2`) |
| **L Disaster Recovery** | Notfallhandbuch + Runbooks vorhanden | Wiederherstellungszeit/-punkt nicht geprobt (im Handbuch als nicht dokumentiert markiert) |
| **M Backup/Restore** | plattformseitige Sicherung | **kein durchgeführter Wiederherstellungstest belegt** |
| **N Compliance** | Verarbeitungsverzeichnis, Datenschutz-Technikdoku, Rechts-Audit, Löschpfade (`account.server.ts`), Retention-Job | keine externe Zertifizierung |
| **O Fault Tolerance** | AI-Gateway-Fallback, Rate-Limit-Fehler blockieren nicht, h3-Fehler werden normalisiert, Job-Wiederholungen mit `attempts` | DB/Realtime/Storage jeweils ohne Ausweichpfad |
| **P Horizontale Skalierbarkeit** | keine Sitzungsaffinität, keine lokalen Dateien, Cron in der DB | 4 prozess-lokale Zustände, davon 1 sicherheitsrelevant |

**Der größte Abstand zu Enterprise-Praxis ist nicht die Architektur, sondern die
geteilte Datenbank zwischen Staging und Production** (`docs/ARCHITEKTUR.md §2`) und
das **nicht geprobte Restore** – beides sind Betriebs-, nicht Skalierungsthemen.

---

## 13. Antwort auf die Hauptfrage

> Wie weit kann die aktuelle Y-Dude-Architektur skalieren, bevor ein
> grundlegender Architekturumbau notwendig wird?

**Gemessene Kapazität:** 1.000 gleichzeitige anonyme Leser, ~715 Anfragen/s,
15 Minuten gehalten, ohne einen einzigen Serverfehler und ohne Sättigung von
CPU, RAM, Verbindungen oder Latenz `[MESS]`. Der Kipppunkt wurde **nicht**
erreicht; die Grenze des Tests war der Lastgenerator, nicht das System.

**Technisch plausible Skalierung ohne Umbau:** Die Leseseite kann
voraussichtlich deutlich über das Gemessene hinaus wachsen, weil sie auf drei
skalierbaren Achsen liegt – CDN vor öffentlichen Seiten, zustandslose
App-Instanzen, vertikal vergrößerbare Datenbank mit heute 46 % RAM und 22 % Disk.
Diese Skalierung erfordert **eine** vorbereitende Änderung: das IP-Rate-Limit
darf nicht im Instanzspeicher liegen (§ 7).

**Ungetestete Bereiche:** Schreiblast, Nachrichtenversand, Realtime/WebSockets,
Uploads, Registrierung, Käufe, angemeldete Sitzungen unter Last, Browser-Rendering,
> 1.000 VU, Dauerlast > 25 min. Über diese Bereiche existiert **keine einzige
Messung**; sie bilden zusammen die Mehrheit der tatsächlichen Nutzerinteraktion.

**Erwartete erste Engpässe:** B1 Zähler-Trigger auf `posts` bei Likes und
Kommentaren (Zeilenkonflikt, hardwareunabhängig), danach B2 Messenger-Schreibpfad
und B3 Realtime-Kanalanzahl.

**Notwendiger Architekturumbau:** erst für die sechs Punkte in Level 4 – und
davon ist keiner ein Neubau, sondern jeweils die Ausweitung eines Musters, das im
System **bereits existiert** (entkoppelte Zähler, zentrale Zustandshaltung,
CDN-Auslieferung, Read-Replicas, serverseitiges Fan-out, ereignisgetriebene Jobs).

**Konkrete Nutzerzahl:** **Keine belastbare numerische Aussage möglich.** Aus
767.637 anonymen GET-Anfragen lässt sich keine Zahl gleichzeitiger oder
registrierter Nutzer ableiten, weil das Verhältnis von Nutzer zu Schreibvorgang,
Realtime-Kanal und Medien-Egress in dieser Produktion nie gemessen wurde. Jede
genannte Nutzerzahl wäre erfunden.

---

## 14. Empfohlene nächste Tests (Priorität)

Voraussetzung für 1–8: eine **eigene Testumgebung mit getrennter Datenbank**.
Heute teilen Staging und Production Datenbank und Storage
(`docs/ARCHITEKTUR.md §2`), deshalb waren Schreibtests bisher **BLOCKED**
(`docs/LASTTEST_1000VU_READ_WRITE_2026-09-14.md`).

| # | Test | Ziel | Zu messen | Validiert | Kritisches Ergebnis |
| --- | --- | --- | --- | --- | --- |
| 1 | **1.000 VU Write Load** | erste echte Schreibgrenze | Insert-Latenz p95/p99, Lock-Wartezeit, Deadlocks, WAL-Wachstum | Trigger-Ketten, RLS beim Schreiben | wartende Sperren > 0 oder p99 über Faktor 10 gegen Lese-p99 |
| 2 | **Likes/Kommentare auf einen Beitrag** | B1 gezielt | Wartezeit auf `posts`-Zeile, Durchsatz je Beitrag | `sync_post_counter`, `sync_comment_counts` | Durchsatz sinkt bei mehr Parallelität (Serialisierung) |
| 3 | **Messenger Send Load** | B2 | Insert-Latenz, `conversations`-Update-Konflikte, Rate-Limit-Treffer, Push-Staulänge | 5 `messages`-Trigger, `notification_jobs` | `notification_jobs` wächst schneller als der Minutenjob abbaut |
| 4 | **Realtime/WebSocket Load** | B3 – größte Wissenslücke | max. gleichzeitige Kanäle, Ereignislatenz, Abbruchrate | Presence ×80, Chat ×60, `postgres_changes` | Kanalgrenze erreicht oder Ereignisse kommen verzögert/nicht an |
| 5 | **Authenticated Session Load** | bisher nur anonym gemessen | RLS-Kosten mit echter `auth.uid()`, Token-Refresh-Wellen | `is_conversation_member`, `can_view_post`, `has_role` | p95 angemeldet deutlich über p95 anonym |
| 6 | **Upload Load** | B4 | Upload-Dauer, Fehlerquote, Storage-Egress je Sitzung, Varianten-Jobstau | Bucket `media`, `media_variant_jobs` | Jobstau wächst monoton oder Egress pro Nutzer unerwartet hoch |
| 7 | **Market Read/Write** | Kaufpfad (Zahlung derzeit inaktiv) | Transaktionsdauer, Idempotenz bei Parallelaufruf | `market_complete_transaction` | doppelter Abschluss oder Statusinkonsistenz |
| 8 | **Mixed Read/Write** | Realitätsnähe | Lese-p95 **während** Schreiblast | Gesamtsystem | Lese-p95 steigt unter Schreiblast deutlich an |
| 9 | **Dauerlauf ≥ 2 h** | Kriechfehler | Speicherverlauf, Verbindungsverlauf, Cache-Trefferquote, Jobstaulänge | Instanz + DB über Zeit | monoton steigender Speicher-/Verbindungsverbrauch |
| 10 | **> 1.000 VU** | Kipppunkt finden | Punkt, an dem p95 überproportional steigt | Gesamtsystem | erstes 5xx / erster Timeout / Verbindungssättigung; **verteilter Generator nötig**, sonst ist die Messung nicht zuordenbar |

Zusätzlich empfohlen, außerhalb der Lastreihe: ein **geprobter Restore** (§ 12 M)
und eine **Verifikation des IP-Limits mit zwei Instanzen** (§ 7) – letzteres
bevor horizontal skaliert wird.

---

## 15. Abschluss

**1. Was Y-Dude heute nachweislich kann**
1.000 gleichzeitige Leser, 767.637 Anfragen, ~715 Anf./s über 15 Minuten,
0 Serverfehler, 0 Timeouts, 0 Verbindungsabbrüche, p50 49 ms / p95 125 ms,
Datenbank bei 29 von 60 Verbindungen, 0 Deadlocks, 0 wartende Sperren, sofortige
Erholung `[MESS]`. Zugriffsschutz greift auch unter Last unverändert.

**2. Was die aktuelle Architektur wahrscheinlich unterstützt**
Deutlich mehr Lese-Last, weil keine der vier Sättigungsgrößen ausgelastet war
und Anwendungsschicht, CDN und Datenbank je eigenständig vergrößerbar sind.
Mehrere App-Instanzen sind nach Codestand möglich, ohne fachlichen Zustand zu
verlieren – **nach** Behebung des instanzlokalen IP-Limits.

**3. Was noch nicht bewiesen ist**
Alles Schreibende und alles Angemeldete: Nachrichten senden, Likes, Kommentare,
Uploads, Registrierung, Käufe, Realtime/WebSockets, angemeldete Sitzungen unter
Last, Browser-Rendering, Lastbereich über 1.000 VU und Dauerlast über 25 Minuten.
Grund: keine getrennte Testumgebung – Staging und Production teilen Datenbank
und Storage.

**4. Was voraussichtlich der erste technische Engpaß wird**
Die Zähler-Trigger auf `posts`: Likes und Kommentare aktualisieren synchron
dieselbe Beitragszeile. Das ist ein Zeilenkonflikt, den mehr Hardware nicht löst.
Views vermeiden diesen Weg über `counter_events` bereits – das Muster existiert,
es ist nur nicht auf Likes und Kommentare angewendet.
Danach: Messenger-Schreibpfad, dann die Anzahl der Realtime-Kanäle
(bis ~142 je aktiver Sitzung).

**5. Welche Architekturänderungen erst bei starkem Wachstum notwendig werden**
Entkoppelte Zählung auch für Likes/Kommentare; zentrales statt instanzlokales
IP-Limit; CDN-fähiges Auslieferungsmodell für öffentliche Medien; Read-Replicas
oder Trennung heißer Tabellen; serverseitige Presence-/Fan-out-Aggregation
statt Kanal-pro-Person; ereignisgetriebene statt pollende Jobkette.
Keine dieser Änderungen ist ein Neubau – jede erweitert ein Muster, das im
System schon vorhanden ist.

---

*An Production wurde nichts verändert: kein Code, keine Migration, keine
RLS-Policy, keine Berechtigung, keine Konfiguration, kein Deployment. Alle
Datenbankzugriffe dieses Audits waren lesend.*
