# Y-Dude – Technischer Audit: Feed, Posting, Social-Graph, Werbung

Stand: 08.08.2026 · **Nur Analyse – kein Code wurde geändert.**
Bewertungsskala: **A** optimal · **B** funktioniert, verbesserbar · **C** potenzieller Fehler · **D** klarer Fehler · **E** fehlt

---

## 0. Kurzfassung (die 8 wichtigsten Befunde)

| # | Befund | Note | Priorität |
|---|--------|------|-----------|
| 1 | **Likes, Kommentare, Shares, Views, Saves haben KEINEN Einfluss auf das Ranking.** Sie werden in `toRankablePost()` befüllt, aber kein einziger Faktor liest `post.stats`. | D | hoch |
| 2 | **Follow/Following hat keinen Ranking-Einfluss.** `followingIds` wird serverseitig geladen, aber von keinem Faktor benutzt. | D | hoch |
| 3 | **Tab „Folge ich“ zeigt nicht gefolgte Nutzer**, sondern Autoren, deren Beiträge man geliked hat (`likedPosts`). | D | hoch |
| 4 | **`slangQuality` (Gewicht 14) rechnet mit Platzhaltern**: `completions = plays` ⇒ `completionRate` immer 1,0; `listenRate`/`repeats` immer 0; `upvotes = likes` (Doppelzählung). Jeder Beitrag mit irgendeinem SlangTag bekommt ~4,2 Punkte geschenkt, ein sehr populärer SlangTag bis ~9–11 Punkte. | D | hoch |
| 5 | **Der Feed lädt ALLE Beiträge ohne Limit** (`posts.select("*")`, kein `range`), rankt komplett im Client. Es gibt **keine Pagination und kein Infinite Scrolling**. | C (heute schnell, skaliert nicht) | hoch |
| 6 | **Zwei unabhängige Werbesysteme** laufen parallel (Live-Test-Zähler + „jeder 15. Index“). Die reguläre Karte hängt an der **Index-Position im gerankten Array** und wandert deshalb bei jedem Live-Refresh/Re-Ranking; im Live-Test kann ein regulärer Slot verschluckt werden. | C | mittel |
| 7 | **Shares sind nicht anonym**: RLS `post_shares_select` erlaubt jedem, der den Beitrag sehen darf, das Lesen aller `user_id` der Teilenden. | D (Anforderungsverletzung) | hoch |
| 8 | **Interest Engine (`user_interests`, `interest_confidence`, `content_categories`) ist nicht mit dem Feed verbunden.** Der Feed nutzt nur `ad_preferences.interests`. Zwei parallele Interessensysteme. | C | mittel |

---

## 1. Feed-Architektur

**Laden** (`src/lib/data.tsx` → `loadAllRaw`)
Ein Bündel paralleler Abfragen pro Sitzungsstart / Reload:

| Abfrage | Zweck | Anmerkung |
|---|---|---|
| `profiles.select(PROFILE_COLUMNS)` | **alle** Profile | ohne Limit |
| `posts.select("*").order(created_at desc)` | **alle** sichtbaren Beiträge | ohne Limit, `*` statt Spaltenliste |
| `rpc bootstrap_user_state()` | Likes, Saves, Shares, Tag-Likes/-Saves, Following, Rollen, Bot-Schalter | 1 Roundtrip – sehr gut |
| `slang_tags` Versionsprüfung (`count` + neuestes `updated_at`) | Snapshot-Invalidierung | sehr gut, spart die größte Abfrage |
| ggf. `slang_tags.select(SLANG_TAG_COLUMNS)` | Stammdaten | nur bei Versionswechsel |
| `rpc profile_locations`, `rpc slang_tag_business_info` | rechtlich gefilterte Zusatzfelder | client-gecacht |
| `signPaths([...])` | Signierte Storage-URLs für Avatare, Cover, Tag-Audios, Post-Bild (3 Varianten) + Post-Audio | **eine Sammel-Signierung** – gut, wächst aber linear mit der Gesamtmenge |

**Sichtbarkeit** wird ausschließlich per RLS entschieden (`posts_select`):
`hidden_at IS NULL` (oder eigen/Admin) **UND** (`public` | eigen | `connections` + `are_connected()` | `following` + `is_following()`).
→ Sauber, serverseitig, keine Client-Duplikate. **A**

**Client-Filter** (`dev.tsx`, `visible`): eigene Beiträge werden aus allen 4 Tabs entfernt (bewusst); `local` = `region` enthält die erste Komponente des eigenen Standorts (ohne Standort ⇒ **leerer Tab**, kein Hinweis, **B**); `trending` = ungewichtete Summe Likes+Kommentare+Shares (keine Zeitgewichtung ⇒ alte virale Beiträge stehen dauerhaft oben, **C**); `following` = **falsch implementiert** (Likes statt Follows, **D**).

**Pagination / Infinite Scroll:** **nicht vorhanden (E).** `FEED_CONFIG.pageSize = 20` und `rankFeed({limit, offset})` existieren, werden aber vom Client nie genutzt. Heute unkritisch (kleiner Datenbestand), bei 5–10 k Beiträgen ein harter Bruch: Payload, `signPaths`, Ranking und Rendering wachsen alle linear.

**Lazy Loading:** Bilder `loading="lazy"`, Artikel mit `content-visibility:auto` + `contain-intrinsic-size:520px`. Gut (**A**), die 520-px-Schätzung verfälscht allerdings die Scroll-Korrektur (siehe Live-Refresh).

**Caching:** `client-cache.ts` (Standorte, Business-Infos), Tag-Snapshot mit Versionsschlüssel, `MIN_LOAD_GAP_MS = 20 s`, In-Flight-Deduplizierung, `syncIfStale(60 s bei Fokus / 120 s Intervall)`. Serverseitig `feed_score_cache` – **wird nie gelesen oder geschrieben (toter Pfad, E)**.

**Neue Beiträge:** `checkNewPosts()` fragt `created_at > newestPostAt` (Limit 30), lädt fehlende Autorenprofile und SlangTags nach, legt Treffer in `pendingPostsRef` und zeigt „X neue Beiträge“. `applyNewPosts()` prependet dedupliziert und markiert die IDs in `freshPostIds`; `dev.tsx` hebt diese als obersten Block (created_at DESC) über das Ranking. **Duplikate: ausgeschlossen** (Set-Prüfung in beiden Stufen, `key={p.id}`). **A/B**

**Bekannte Schwächen im Live-Pfad (C):**
- `newestPostAtRef` wird auf `rows[0].created_at` gesetzt, **bevor** gefiltert wird. Beiträge, die mit gleichem oder minimal älterem `created_at` **später committen** (Bot-Batch, Clock-Skew), werden dauerhaft übersprungen – klassische „gt(timestamp)“-Lücke. Robuster wäre ein Overlap-Fenster (z. B. `created_at > since - 5 s` plus ID-Dedup, was bereits vorhanden ist).
- `checkNewPosts` hängt an `[profiles, tags]` und `applyNewPosts`/`detail` stehen in den Effekt-Deps ⇒ **das 10-s-Intervall wird bei jeder Profil-/Tag-Änderung neu aufgesetzt und `run()` sofort erneut ausgeführt** ⇒ zusätzliche Abfragen, mögliche Parallelläufe trotz `busy`-Flag (das Flag lebt nur innerhalb einer Effekt-Instanz).
- Der Hintergrund-Vollreload (`syncIfStale`) **ersetzt `posts` komplett und setzt `freshPostIds`, `newPostsCount` und die Scroll-Höhenbasis zurück** – damit verliert der Nutzer den „neue Beiträge oben“-Block und der Feed wird komplett neu geordnet, während er ggf. scrollt. Widerspruch zur Live-Feed-Logik (**C, mittel**).
- Scroll-Stabilisierung (`useLayoutEffect` mit Höhen-Delta, `overflow-anchor:none`) funktioniert, ist aber gegen `content-visibility` unscharf: Höhen ändern sich nachträglich beim Einblenden ⇒ Restsprünge möglich (**B**).

**Manueller Refresh:** F5 = kompletter Neuaufbau (alles neu, Reihenfolge ändert sich durch Jitter/Exploration). Ein „Pull-to-Refresh“ im Feed existiert nicht.

**Unnötig geladene Daten (B):** `posts.select("*")` bringt u. a. `moderation_status`, `moderation_reason`, `moderated_at`, `hidden_at`, `updated_at` mit; **alle** Profile werden geladen, nicht nur die der Feed-Autoren; für jedes Bild werden 3 Varianten signiert, obwohl im Feed nur Thumb/Medium gezeigt wird.

---

## 2. Posting-/Ranking-Algorithmus

Kern: `src/lib/feed-ranking/engine.ts` (`scorePost` → `arrangeWithDiversity` → `injectExploration`), Faktoren in `factors.ts`, Gewichte in `config.ts`. Aufruf **rein im Client** über `useFeedRanking` mit dem serverseitig geladenen `FeedViewerContext` (`feed.functions.ts` → `engine.server.ts`).

| Faktor | Gewicht | Datenquelle | Tatsächlicher Einfluss |
|---|---|---|---|
| `interests` | 34 | `ad_preferences.interests` | ja – **stärkster Faktor**, aber Substring-Matching (`t.includes(value)`) ⇒ sehr grobe/false-positive Treffer |
| `region` | 18 | `posts.region` vs. `profiles.location` (String-Split) | ja, immer ≥ 0,06 |
| `hashtagAffinity` | 16 | `post.hashtags` + `hashtag_follows` + `trending_hashtags` + gelernt | ja |
| `slangQuality` | 14 | Zähler der verwendeten SlangTags | ja – **aber mit Platzhaltern verfälscht** (s. u.) |
| `freshness` | 12 | `created_at`, Halbwertszeit 30 h, Floor 0,12 | ja |
| `slangAffinity` | 10 | gelernte Tag-Gewichte + Region/Sprache des Tags | ja |
| `postQuality` | 8 | Beschreibungslänge, Titel, Tag-Anzahl, Medien | ja, aber Medienwerte sind **konstant** (`image ? goodImagePixels : 0`) – keine echte Qualitätsmessung |
| `creatorTrust` | 8 | `post.author.*` | **nie befüllt** ⇒ konstant 0,5 · 8 = 4 Punkte für alle |
| `newCreator` | 6 | `post.author.*` | **nie befüllt** ⇒ immer 0 |
| `spam` | −22 | `post.spam` | **nie befüllt** ⇒ immer 0 (Spam-Erkennung faktisch aus) |
| `learned` | 1 (Default) | `feed_learned_weights` | ja, gedeckelt (`influenceCap 0,35`) |
| `muted` | 1 (Default) | gelernte Gewichte ≤ −0,9 | ja, −1 Punkt (**zu schwach**, um wirklich auszublenden) |
| `jitter` | 2 | Hash(userId+postId) | ja, deterministisch |

**Nur gespeichert, ohne Ranking-Wirkung:** `likes_count`, `comments_count`, `shares_count`, `views_count`, `saves_count`, `follows`, `connections`, `slang_tag_votes`, `feed_score_cache`, `interaction_events`/`user_interest_scores`/`interest_confidence` (Interest Engine), `post_views`.

**Vielfalt & Exploration:** Autor-Cooldown 3, Thema 2, Region 2, Medium 2; Exploration 12 % deterministisch eingemischt. Sauber implementiert, **A**. Ein Detail: `diversityKeys.topic` fällt auf `hashtags[0]` zurück, obwohl Hashtags anderswo bewusst von „topics“ getrennt sind – kleine Inkonsistenz (**B**).

**Zufall:** nur `jitter` (2 Punkte) + Exploration – nachvollziehbar und deterministisch pro Nutzer. **A**

---

## 3. Hashtags

- **Erkennung/Speicherung:** `posts.hashtags` (Array) + Trigger `sync_post_hashtags` → `hashtags` (mit `posts_count`, `last_used_at`) + `post_hashtags`. Normalisierung `normalizeHashtag()` (klein, ohne `#`). **A**
- **Ranking:** `hashtagFactor` – gefolgt 1,0 · trending 0,45 · Interesse 0,6, Sättigung 2,5, Gewicht 16. **2–3 passende Hashtags sättigen den Faktor bereits vollständig.**
- **Trends:** SQL-Funktion `trending_hashtags` (7 Tage): `recent_posts·3 + (likes + 2·comments + 2·shares)·0,5`, nur öffentliche, nicht geblockte Beiträge. Serverseitig 60 s gecacht. **A/B** – keine Zeitgewichtung *innerhalb* des Fensters, keine Autor-Deduplizierung ⇒ ein Konto kann mit vielen Posts einen Tag pushen.
- **Manipulation (C, mittel):** Es gibt **keine Obergrenze für Hashtags pro Beitrag** im Ranking. Wer 10 trendende/gefolgte Hashtags anhängt, erreicht garantiert die volle Sättigung (16 Punkte = zweitstärkstes Signal) – Hashtag-Stuffing ist derzeit die billigste Reichweitensteigerung. Empfehlung: nur die ersten 3–5 Hashtags werten, Sättigung beibehalten und Stuffing (> 8 Tags) in `postQuality` leicht abstrafen.

---

## 4. SlangTag-System

Zwei getrennte Faktoren – konzeptionell sauber:
- `slangAffinity` (10): **gelernte** Tag-Vorlieben + Region/Sprache. Persönlich, kaum manipulierbar. **A**
- `slangQuality` (14): **globale Zähler** des Tags. **Hier liegt das Kernproblem (D).**

In `toRankablePost()` gilt:
```
completions = plays        → completionRate = 1,0 (immer)
avgListenSeconds = 0, durationSeconds = 0 → listenRate = 0
repeats = 0                → repeatRate = 0
upvotes = likes            → likes zählen doppelt im engagement-Term
profileVisits = 0
```
Ergebnis: `value ≈ 0,30 + 0,20·engagement + 0,07·reach`.
- Jeder Beitrag mit **irgendeinem** SlangTag mit ≥ 1 Play erhält **~4,2 Punkte geschenkt** (mehr als `creatorTrust`, `freshness`-Rest oder `newCreator`).
- Ein sehr populärer SlangTag (viele Plays/Likes) erreicht **bis ~9–11 von 14 Punkten** – **ja, ein populärer SlangTag kann einen an sich schwachen Beitrag deutlich nach oben drücken.**
- Verstärkend: `registerPlay()` wird beim **AutoPlay** ausgelöst (30-s-Throttle pro Tag/Sitzung, clientseitig). Ein häufig ausgespielter Tag sammelt automatisch Plays → höheres Ranking → mehr AutoPlay-Plays. **Selbstverstärkende Schleife (C, hoch).**
- Die Werte sind **absolut**, nicht zeitgewichtet und nicht pro Beitrag normalisiert; bei mehreren Tags werden sie **summiert** (`sum()`), d. h. 5 Tags = 5-fache Reichweitenzahlen.
- `slang_tag_votes` (Up/Down) fließen **gar nicht** ins Ranking (E).

Empfehlung (ohne Performance-Kosten, reine Client-Rechnung): fehlende Messgrößen nicht als „perfekt“ interpretieren (`completionRate` nur werten, wenn echte Completion-Daten existieren), Tag-Statistiken **mitteln statt summieren**, `reach` stärker sättigen und das Gesamtgewicht von 14 auf ~8 senken.

---

## 5. Follow / Follower / Connections

| Aspekt | Status |
|---|---|
| Speicherung | `follows(follower_id, following_id)` **PK auf beiden Spalten** ⇒ kein Doppelfollow möglich. **A** |
| Schreiben | `data.tsx: follow()/unfollow()`, optimistisch, mit lokaler Vorprüfung. **A** |
| Lesen | über `bootstrap_user_state()` → `following[]`; Profilseite ergänzt `profile_stats`. **A** |
| RLS | `follows_select`: nur eigene Beziehungen (`follower_id` oder `following_id` = auth.uid()). ⇒ **Follower-Listen Dritter sind nicht lesbar**; die Zahl kommt aus `profile_stats` (SECURITY DEFINER). Konsistent, aber: Zähler und Rohdaten haben zwei getrennte Pfade (**B**) |
| Ranking | **`followingIds` wird geladen und nirgends verwendet (D, hoch).** Beiträge gefolgter Nutzer haben denselben Score wie fremde. |
| Tab „Folge ich“ | Nutzt `likedPosts` statt `following` – **D, hoch.** |
| Connections | Wirken **nur** als Sichtbarkeitsregel (`visibility='connections'` + `are_connected()`); kein Ranking-Signal (E). `connection_influence`/`connection_suggestions` existieren, speisen den Feed aber nicht. |
| Widersprüche | Follow und Connection sind zwei unabhängige Kanten ohne gemeinsame Auflösung. Ein Nutzer, dem man folgt **und** mit dem man verbunden ist, wird nirgends doppelt gewichtet – aktuell also kein Doppelzähl-Risiko, aber auch kein Nutzen. |

Empfehlung: neuen Faktor `relationship` (Following ~ 12, Connection ~ 8, beides gedeckelt) ergänzen; Tab „Folge ich“ auf `following` umstellen (rein clientseitig, keine zusätzliche Abfrage, da `following` bereits im Bootstrap enthalten ist).

---

## 6. Likes

- Speicherung: `post_likes` mit **PK (post_id, user_id)** ⇒ Mehrfach-Like technisch unmöglich. **A**
- Zähler: Trigger `sync_post_counter` aktualisiert `posts.likes_count` synchron; Client führt zusätzlich eine optimistische Erhöhung (`bumpPost`) und korrigiert bei Fehlern über `scheduleRefresh()`. **A/B** (kurzzeitige Divergenz möglich, wird beim nächsten Vollreload geglättet)
- Ranking: **kein Einfluss** (siehe Befund 1). Nur der Tab „Trending“ nutzt Likes – ungewichtet und **ohne Zeitverfall**, deshalb dominieren dort dauerhaft alte virale Beiträge (**C**).
- Zeitgewichtung: existiert nirgends (E).
- Manipulationsschutz: kein Rate-Limit, keine Sybil-Erkennung; der `spam`-Faktor mit `artificialEngagement` ist vorbereitet, aber nie befüllt (E). Über Testbots/Zweitkonten wären Like-Kaskaden möglich – aktuell folgenlos, **weil Likes das Ranking gar nicht beeinflussen**. Sobald Likes gewichtet werden, ist eine zeitverfallende, pro-Nutzer-gedeckelte Aggregation zwingend.
- Datenschutz: `post_likes_select` erlaubt nur eigene Likes bzw. dem Beitragseigentümer; die öffentliche Liker-Liste läuft bewusst über `getPostLikers` (Service-Role + Namensmaskierung). **A**

---

## 7. Kommentare

- Vorhanden: `comments` (inkl. `parent_id` für Antworten, `slang_tag_ids`), Trigger `sync_comment_counts`, RLS an `can_view_post` gekoppelt. **A**
- **Ranking-Einfluss: keiner** – weder direkt noch als Qualitätssignal. Einzige Wirkung: doppelte Gewichtung (×2) im `trending_hashtags`-Score und in der Trending-Tab-Summe. **Dokumentiert, bewusst nicht aktiviert.**
- Kein Spam-Schutz: kein Rate-Limit, keine Duplikatserkennung, kein „gegenseitiges Kommentieren“-Erkennen, keine Qualitätsbewertung (E). Kommentare durchlaufen allerdings die KI-Moderation.
- Empfehlung, falls später aktiviert: nur **eindeutige Kommentatoren** der letzten 48 h zählen, Autor-eigene Kommentare ausschließen, reziproke Paare deckeln.

---

## 8. Shares

- Speicherung: `post_shares` mit **PK (post_id, user_id)** ⇒ ein Share pro Nutzer, kein Mehrfachzählen. Client blockt Wiederholung zusätzlich. **A**
- Ranking: **kein Einfluss** (nur Trending-Summe).
- Zeitgewichtung: keine (E).
- **Anonymität verletzt (D, hoch):** `post_shares_select` = `user_id = auth.uid() OR admin OR can_view_post(post_id)`. Jeder, der den Beitrag sehen darf, kann die vollständige Liste der teilenden `user_id` abfragen. Für die Anforderung „Shares bleiben gegenüber anderen Nutzern anonym“ müsste die Policy auf `user_id = auth.uid()` (+ Admin) reduziert und der Zähler ausschließlich über `posts.shares_count` ausgeliefert werden. (`post_views` verhält sich analog – bitte mitprüfen.)

---

## 9. Werbefeed (Feed-Werbekarten)

Es existieren **zwei voneinander unabhängige Auslöser** in `dev.tsx`:

**(a) Live-Test-Zähler** `useAdTestCounter` (`ad-test-counter.ts`)
- Aktiv nur wenn `isAdmin` **und** `test_bot_settings.live_test` **und** `bots enabled`.
- Zählt echte Ereignisse: Sichtbarkeit ≥ 50 % für 800 ms (`SeenWatcher`), Öffnen eines Beitrags, Wechsel in der Detailansicht. DB-Refreshes zählen nie. **A**
- Bei Erreichen von `adFrequency` (15/25) wird die Karte an eine **Post-ID** (`slotPostId`) gebunden ⇒ stabil gegen Prepend. **A**
- Protokolliert in `ad_test_events`.

**(b) Reguläre Platzierung** `adSlotFor(index)`
- `(index+1) % 15 === 0` ⇒ Karte aus der **statischen Liste** `SPONSORED_ADS` (`ad-demo.ts`).
- Werbekarten liegen **außerhalb** des `feed`-Arrays ⇒ zählen selbst nicht als Feed-Element. „Nach 15 normalen Beiträgen“ ist damit **korrekt**. **A**
- **Aber: der Slot hängt am Index des gerankten Arrays.** Kommen oben neue Beiträge dazu (Live-Feed) oder ändert sich das Ranking (Vollreload alle 60–120 s, Kontextwechsel, Tabwechsel), rutscht die Karte auf einen anderen Beitrag. Widerspruch zur (a)-Logik und zur Anforderung „stabil verankert“ (**C**).
- **Überspringen möglich:** Steht an derselben Position eine Live-Test-Karte, wird der reguläre Slot per `else`-Zweig **komplett unterdrückt** (**C**).
- `dismissedSlots` merkt sich die **Slot-Nummer**, nicht den Beitrag ⇒ nach einem Prepend blendet ein früheres Wegklicken eine andere Karte aus (**C**).
- **Kein Tracking für reguläre Karten:** `logAdEvent` prüft `active` (nur Admin + Live-Test) ⇒ für normale Nutzer werden **keine Impressionen/Klicks** erfasst (**E**).
- Lazy Loading verhindert die Anzeige nicht (Karte liegt im selben `space-y-4`-Block). Ad- und Feed-Laden konkurrieren nicht: Werbedaten sind statisch im Bundle, es gibt keine zusätzliche Anfrage. **A (Performance)**
- Doppelte Anzeige: pro Index kann höchstens eine Karte entstehen; bei wenigen `SPONSORED_ADS` wiederholt sich derselbe Inhalt zyklisch (fachlich gewollt?).
- **Werbepause (`useAdPause`, 3/Monat) wird von den Feed-Karten ignoriert** – sie wirkt nur in `AdFeed`/`AdSlider`. Der Admin-Schalter `ads_enabled` wirkt dagegen überall. Inkonsistenz (**C**).

---

## 10. Werbeeinblendungen allgemein

| Format | Umsetzung | Trennung vom Content |
|---|---|---|
| Feed-Werbekarte | `FeedAdCard` aus statischer `SPONSORED_ADS` | vollständig getrennt: nie im `posts`-Array, nie im Ranking, eigener Render-Zweig. **A** |
| Werbefeed oben / Slider | `AdFeed.tsx`, `AdSlider.tsx` | eigener Container, eigener Pull-down-Mechanismus |
| Werbe-SlangTags | `slang_tags` mit `owner_type='company'`, `sponsored=true` | **nicht getrennt:** solche Tags fließen mit ihren Zählern (`plays`, `likes`, `reach`) ganz normal in `slangQuality` ein. Ein gesponserter Tag kann damit organische Beiträge nach oben ziehen (**C, mittel**) |
| Kampagnen-Tabelle `ad_campaigns` | existiert, wird nur in Admin/Live-Test/Export gelesen | **keine echte Auslieferung/Targeting/Frequency-Capping (E)** |

**Fazit:** Werbekarten beeinflussen das Ranking nicht. Werbe-**SlangTags** hingegen schon – das ist der einzige Kanal, über den bezahlte Inhalte den organischen Algorithmus verfälschen können.

---

## 11. Gesamt-Zusammenhang (Landkarte)

```text
POST ERSTELLEN
  CreatePostDialog → createModeratedPost (server) → posts INSERT
     ├─ Trigger sync_post_hashtags   → hashtags / post_hashtags
     ├─ Trigger sync_post_tag_uses   → slang_tags.uses_count
     └─ post_moderation_jobs         → KI-Moderation (async) → moderation_status/hidden_at

FEED-AUSWAHL (wer darf was sehen)
  RLS posts_select: public | eigen | connections+are_connected | following+is_following
  Client: eigene Posts raus, Tab-Filter (local/global/trending/following)

RANKING (100 % im Browser, 1 Server-Call für den Kontext)
  getFeedContext()  → ad_preferences.interests, profiles.location/language,
                      follows(ungenutzt), feed_learned_weights,
                      hashtag_follows, rpc trending_hashtags
  scorePost()       → interests 34 | region 18 | hashtag 16 | slangQuality 14 |
                      freshness 12 | slangAffinity 10 | postQuality 8 |
                      creatorTrust 8(konstant) | newCreator 6(0) | spam −22(0) |
                      learned | muted | jitter 2
  arrangeWithDiversity() → Autor/Thema/Region/Medium-Cooldowns
  injectExploration()    → 12 % Entdeckung
  freshPostIds           → neue Beiträge als oberster Block (über dem Ranking)

SOCIAL-SIGNALE
  post_likes / comments / post_shares / post_saves / post_views
     → Trigger bzw. counter_events+flush → posts.*_count
     → Anzeige + Tab „Trending“ + trending_hashtags-Score
     → RANKING: KEIN EINFLUSS
  feed_signals + feed_learned_weights (view_complete, dwell, like …)
     → learnedFactor / slangAffinity / hashtagFactor / muted  ← einziger Lernpfad

WERBUNG
  ads_enabled (Admin) → adSlotFor(index % 15) → FeedAdCard (statische SPONSORED_ADS)
  live_test (Admin)   → useAdTestCounter (15/25 echte Interaktionen) → ad_test_events
  Beide außerhalb des Ranking-Arrays.

ANZEIGE
  dev.tsx → SeenWatcher → FeedPost → PostDetailOverlay (registerView, Swipe)
```

**Werte-Matrix**

| Wert | Gespeichert | Berechnet | Verwendet | Feed-Einfluss | Bewertung |
|---|---|---|---|---|---|
| `likes_count` | `posts` (Trigger) | DB | Anzeige, Trending-Tab | **0 %** | zu wenig |
| `comments_count` | `posts` (Trigger) | DB | Anzeige, Trending, Hashtag-Trend | **0 %** | zu wenig |
| `shares_count` | `posts` (Trigger) | DB | Anzeige, Trending | **0 %** | zu wenig |
| `views_count` | `counter_events` → Cron-Flush | DB | Anzeige | 0 % | ok |
| `follows` | `follows` | – | Profil, Kontext (ungenutzt) | **0 %** | Fehler |
| Connections | `connections` | `are_connected()` | RLS | nur Sichtbarkeit | ok/erweiterbar |
| Hashtags | `posts.hashtags`, `post_hashtags` | Trigger + `trending_hashtags` | `hashtagFactor` | **16/~104** | leicht zu hoch, stuffing-anfällig |
| SlangTag-Zähler | `slang_tags.*_count` | Trigger/Cron | `slangQuality` | **14/~104**, faktisch verzerrt | zu hoch + falsch berechnet |
| Interessen | `ad_preferences.interests` | – | `interestFactor` | **34/~104** | dominant, Matching zu grob |
| Interest Engine | `user_interests`, `interest_confidence` | `engine.server.ts` | **nirgends im Feed** | 0 % | totes Parallelsystem |
| Gelerntes | `feed_learned_weights` | `learning.ts` | 4 Faktoren | gedeckelt 0,35 | gut |
| `feed_score_cache` | Tabelle | Funktionen vorhanden | **nie aufgerufen** | 0 % | toter Pfad |
| Werbung | `ad-demo.ts` (statisch) | – | Render | 0 % (korrekt) | ok |

**Widersprüche:** (1) „Feed ist niemals chronologisch“ (engine.ts) vs. `freshPostIds` erzwingt chronologischen Kopfblock; (2) Hashtags sind bewusst kein „topic“, dienen aber im Diversity-Key als Thema; (3) Werbepause wirkt in Slider/AdFeed, nicht in Feed-Karten; (4) `spam`-Gewicht −22 (größter Hebel) bei nie befülltem Kontext.

---

## 12. Manipulations- und Edge-Case-Prüfung

| Fall | Status heute | Risiko |
|---|---|---|
| Fake-Likes / Like-Spam | 1 Like pro Nutzer/Post erzwungen, sonst kein Schutz | derzeit **irrelevant** (kein Ranking-Einfluss), kritisch sobald aktiviert |
| Follow/Unfollow-Spam | kein Rate-Limit | gering (kein Ranking-Einfluss) |
| Kommentar-Spam | kein Rate-Limit, nur KI-Moderation | mittel (Zähler + Hashtag-Trend ×2) |
| Share-Spam | PK verhindert Mehrfach-Share | gering |
| SlangTag-Spamming | `spamSlangRepeatLimit` definiert, **nie ausgewertet**; Zähler werden summiert | **hoch** – 5 populäre Tags an einen Beitrag hängen = maximaler `slangQuality` |
| Hashtag-Stuffing | keine Mengenbegrenzung im Ranking | **hoch** |
| Alte virale Beiträge | `freshnessFloor 0,12` begrenzt gut; Trending-Tab jedoch ohne Zeitverfall | mittel |
| Neue Beiträge ohne Interaktion | profitieren (Freshness + `freshPostIds`-Kopfblock) | gut |
| Nutzer mit wenigen Followern | nicht benachteiligt (Follower zählen nicht) | gut |
| Nutzer mit vielen Followern | nicht bevorzugt | „gut“ nur, weil das Signal fehlt |
| Sehr populäre SlangTags/Hashtags | ziehen Beiträge stark nach oben | **hoch** |
| Gelöschte Beiträge | Vollreload entfernt sie; ein bereits in `pendingPostsRef` liegender gelöschter Beitrag kann noch einmal eingefügt werden | gering |
| Gelöschte/unsichtbare Nutzer | Live-Batch verwirft Beiträge ohne ladbares Autorenprofil, der Vollreload zeigt sie mit „unbekannt“ | Inkonsistenz (**C**) |
| Private Inhalte | RLS sauber (`connections`/`following`/`private`) | gut |
| Blockierte Nutzer | **kein Block-System** – nur gelernte Gewichte ≤ −0,9 mit lediglich −1 Punkt Abzug | **E, hoch** |
| Mehrfach auftretende Inhalte | ID-Dedup in Feed, Pending und Exploration | gut |
| Testbots | über `test_bots_visible()` global schaltbar, in allen Pfaden geprüft | gut |

---

## 13. Performance

| Kennzahl | Ist-Zustand |
|---|---|
| DB-Anfragen pro Feed-Ladung | 4–5 parallel + 2 gecachte RPCs + 1 Storage-Sammelsignierung + 1 `getFeedContext` (der wiederum 6 parallele Abfragen bündelt) |
| N+1-Queries | **keine** im Feed-Pfad – Profile/Tags/Signaturen werden gebündelt. Ausnahme: `getPostLikers` signiert Avatare in einer Schleife (nur im Modal) |
| Ranking-Ort | vollständig **Client** (~13 Faktoren × n Beiträge, reine Arithmetik) – für n < ~500 unproblematisch, ab ~2 000 spürbar (O(n²)-Anteil in `arrangeWithDiversity`) |
| Bilder | 3 signierte Varianten pro Beitrag, `loading=lazy`, `content-visibility:auto` |
| Cache | Tag-Snapshot-Version, Client-Cache für RPCs, 20-s-Load-Gap, Server-Cache 60 s für Trends |
| Datenmenge | **alle** Profile + **alle** Beiträge mit `select("*")` – der größte Skalierungsrisikofaktor |
| Re-Renders | `AppDataProvider` hält den gesamten Zustand ⇒ jedes Like rendert die komplette Feed-Liste neu (`FeedPost` ist nicht memoisiert) |
| Live-Refresh | 10 s, nur bei sichtbarem Tab, ohne Geste/Overlay; Intervall wird jedoch bei Kontextänderung neu aufgesetzt |
| Pagination | nicht vorhanden |

**Ausdrücklich nicht empfohlen** (würde Tempo kosten): serverseitiges Ranking pro Anfrage, Realtime-Subscriptions auf `posts`, Aktivierung von `feed_score_cache` mit Roundtrip pro Feed-Aufbau, kürzere Live-Intervalle.
**Empfohlen, performance-neutral oder -positiv:** Spaltenliste statt `select("*")`, `range(0, 199)` + Nachladen am Listenende, nur Autorenprofile statt aller Profile laden, `React.memo` für `FeedPost`, `checkNewPosts` über Refs statt `[profiles, tags]`-Deps.

---

## 14. Abschlussbericht (priorisierte Befundliste)

| # | Befund | Datei / Query | Abhängigkeiten | Auswirkung | Empfehlung | Note | Priorität |
|---|---|---|---|---|---|---|---|
| 1 | Engagement (Likes/Kommentare/Shares/Saves) ohne Ranking-Einfluss | `use-feed-ranking.ts` (befüllt), `factors.ts` (liest nie) | Trigger-Zähler, Trending-Tab | Beliebte Beiträge werden nicht bevorzugt | Faktor `engagement` (Gewicht ~10) mit Zeitverfall + Deckelung pro Nutzer | D | hoch |
| 2 | Follow ohne Ranking-Einfluss | `engine.server.ts:158`, `factors.ts` | `follows`, Profilseite | Follow fühlt sich wirkungslos an | Faktor `relationship` (Following/Connection) | D | hoch |
| 3 | Tab „Folge ich“ filtert nach Likes | `dev.tsx:582-585` | `following` aus Bootstrap | Falscher Feed-Inhalt | auf `following.includes(p.userId)` umstellen | D | hoch |
| 4 | `slangQuality` mit Platzhaltern, Summierung, Doppelzählung | `use-feed-ranking.ts:53-67`, `factors.ts:198` | SlangTag-Zähler, AutoPlay | Populäre Tags drücken schwache Beiträge nach oben | Kennzahlen mitteln, fehlende Werte neutral behandeln, Gewicht 14 → ~8 | D | hoch |
| 5 | Shares/Views nicht anonym | RLS `post_shares_select`, `post_views` | Datenschutzversprechen | Teilende Nutzer identifizierbar | Policy auf `user_id = auth.uid()` (+Admin) reduzieren | D | hoch |
| 6 | Kein Limit / keine Pagination | `data.tsx:373` | signPaths, Ranking, Rendering | Bricht bei Wachstum | `range()` + Nachladen, Spaltenliste | C | hoch |
| 7 | `spam`, `creatorTrust`, `newCreator` nie befüllt | `factors.ts:269-346`, `use-feed-ranking.ts:30` | – | 3 Faktoren wirkungslos, Spam-Abwehr aus | Autor-/Spam-Kontext in `getFeedContext` mitliefern (1 zusätzliche Aggregatabfrage) | C | mittel |
| 8 | Hashtag-Stuffing möglich | `factors.ts:84` | `trending_hashtags` | billige Reichweite | nur erste 3–5 Hashtags werten | C | mittel |
| 9 | Werbeslot an Array-Index gebunden, kann übersprungen/falsch dismissed werden | `dev.tsx:644-654, 821-849` | Live-Feed, Ranking | Karte wandert/fehlt | Slot wie im Live-Test an Post-ID binden, Dismiss per Post-ID | C | mittel |
| 10 | Vollreload verwirft `freshPostIds` und ordnet neu | `data.tsx:483-491`, `syncIfStale` | Live-Feed, Scroll | Feed springt/verliert „neu“-Block | Vollreload bei aktivem Live-Feed aussetzen bzw. Reihenfolge einfrieren | C | mittel |
| 11 | `checkNewPosts` mit `[profiles, tags]`-Deps ⇒ Intervall-Neustarts | `data.tsx:606`, `dev.tsx:532-560` | Live-Feed | überzählige Abfragen, mögliche Parallelläufe | Refs statt Deps, `busy` außerhalb des Effekts | C | mittel |
| 12 | `gt(created_at)`-Lücke | `data.tsx:519-530` | Bot-Runner | einzelne Beiträge werden nie nachgeladen | Overlap-Fenster (−5 s) + vorhandenes ID-Dedup | C | mittel |
| 13 | Werbepause wirkt nicht auf Feed-Karten | `ad-pause.ts`, `dev.tsx:645` | AdFeed/AdSlider | Inkonsistente Werbefreiheit | `useAdPause` in `adSlotFor` berücksichtigen | C | mittel |
| 14 | Keine Ad-Metriken für reguläre Karten | `ad-test-counter.ts:71-84` | `ad_test_events` | keine Auswertung außerhalb des Tests | Impression/Click auch ohne Live-Test protokollieren | E | mittel |
| 15 | Interest Engine nicht angebunden | `interest-engine/*` | `ad_preferences` | Doppelsystem, tote Rechenlast | entweder anbinden (Kontext ergänzen) oder Feed-Bezug klar dokumentieren | C | mittel |
| 16 | `feed_score_cache` toter Pfad | `engine.server.ts:88-119` | – | irreführende Infrastruktur | belassen (Reserve) oder entfernen | B | niedrig |
| 17 | Trending-Tab ohne Zeitverfall | `dev.tsx:575-581` | Zähler | alte Beiträge zementiert | Score/(Alter+2)^1,5 – reine Client-Rechnung | B | niedrig |
| 18 | Kein Block-/Report-basiertes Ausblenden im Feed | `factors.ts:386` (`muted` = −1) | `reports` | Unerwünschte Inhalte bleiben sichtbar | `muted` hart filtern statt −1 Punkt | C | mittel |
| 19 | Interessen-Matching per Substring | `factors.ts:53` | `ad_preferences` | Fehltreffer beim stärksten Faktor (34) | exakte bzw. Token-Übereinstimmung, Mindestlänge 3 | C | mittel |
| 20 | `local`-Tab ohne Standort leer | `dev.tsx:568-573` | Profilstandort | leerer Tab ohne Erklärung | Hinweis + Fallback auf Land | B | niedrig |
| 21 | `FeedPost` nicht memoisiert | `dev.tsx:79` | globaler Data-Context | vollständige Re-Renders bei jedem Like | `React.memo` + stabile Callbacks | B | mittel |
| 22 | Werbe-SlangTags fließen in `slangQuality` | `use-feed-ranking.ts:53` | `slang_tags.sponsored` | bezahlte Inhalte beeinflussen organisches Ranking | gesponserte Tags aus `slangQuality` ausschließen | C | mittel |
| 23 | Duplikate/fehlende Posts | Dedup in `applyNewPosts`, `checkNewPosts`, `injectExploration` | – | keine Duplikate feststellbar | keine Änderung nötig | A | – |
| 24 | RLS-Sichtbarkeit des Feeds | `posts_select` | `are_connected`, `is_following` | korrekt | keine Änderung nötig | A | – |
| 25 | Bootstrap-Aufruf + Tag-Snapshot-Versionierung | `data.tsx:371-402` | – | sehr gute Ladezeit | erhalten | A | – |

---

## 15. Empfohlene Reihenfolge (falls umgesetzt wird)

1. **Korrekturen ohne Ranking-Risiko:** Tab „Folge ich“ (#3), Shares/Views-Anonymität (#5), Werbeslot an Post-ID (#9), Werbepause im Feed (#13).
2. **Ranking-Balance:** `slangQuality` entzerren (#4), Engagement-Faktor mit Zeitverfall (#1), Beziehungsfaktor (#2), Hashtag-Deckel (#8), Interessen-Matching schärfen (#19). Gewichte anschließend neu normieren – sonst summiert sich die Skala von ~104 auf ~135.
3. **Skalierung:** Spaltenliste + `range()` + Nachladen (#6), nur benötigte Profile, `React.memo` (#21).
4. **Integrität:** Spam-/Autor-Kontext befüllen (#7), Blockieren/Reports hart filtern (#18), Ad-Metriken (#14).
