# Y-DUDE – Technische, produktbezogene und wirtschaftliche Gesamtanalyse

**Erstellt:** 27. August 2026, 19:45 Uhr (Berlin) / 17:45 UTC
**Vergleichsbasis:** `docs/Y-DUDE_GESAMTANALYSE_2026-08-27.md` (Gesamtscore 79/100)
**Methode:** Neue Messung am aktuellen Stand (Code, Datenbank, Build-Artefakte, Test-/Lint-/Typecheck-Läufe, Security-Scan). Nicht messbare Werte sind ausdrücklich als **Schätzung** gekennzeichnet.
**Am Projekt wurden für diese Analyse keine Änderungen vorgenommen.**

---

## 1. Technische Gesamtanalyse (gemessen)

| Kennzahl                              | Messwert                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Aktive Codezeilen (src, ohne Backups) | **99.675** (TSX 44.772 · TS 54.903, ohne generierten Route-Tree)             |
| SQL-Migrationen                       | **226 Dateien / 11.784 Zeilen**                                              |
| Dateien src + tests (.ts/.tsx)        | 514                                                                          |
| Komponenten-Dateien                   | 128                                                                          |
| lib-Module                            | 278                                                                          |
| Routen-Dateien                        | 67 (davon 8 API-Routen unter `src/routes/api`)                               |
| Server-Function-Module                | 31 (`*.functions.ts`) mit **230 `createServerFn`-Deklarationen**             |
| Datenbanktabellen (public)            | **116** – davon **0 ohne RLS**                                               |
| Datenbankfunktionen (public)          | **162**, davon 113 `SECURITY DEFINER`                                        |
| RLS-Policies                          | **285**                                                                      |
| Indizes                               | **318**                                                                      |
| Datenbankgröße                        | 77 MB · 22 Auth-Nutzer · 36 offene Verbindungen                              |
| Unit-/Logik-Tests                     | **467 Tests in 19 Dateien – alle grün** (3,3 s)                              |
| DB-Integrationstests                  | 14 (`tests/integration`, psql-basiert)                                       |
| E2E-Tests (Playwright)                | **11 Specs in 5 Dateien** (Feed, Market, Messenger, Navigation, Public/Auth) |
| Typecheck (`tsc --noEmit`)            | **grün (0 Fehler)**                                                          |
| Lint                                  | **rot: 5 Fehler (Prettier-Formatierung), 30 Warnungen**                      |
| Build (dist vorhanden)                | grün, 19 MB Gesamt-Output, 296 Client-Chunks                                 |
| CI                                    | GitHub Actions → `scripts/verify.sh` (Typecheck + Lint + Tests)              |

**Lint-Befund (neu, blockierend für CI):** 4 Prettier-Fehler in `remotion/src/XpChaosVideo.tsx` und 1 in `src/lib/audio-format.ts`. Da `verify.sh` bei Lint abbricht, ist die CI aktuell **rot**. Behebbar mit `bun run format` – ich habe es auftragsgemäß nicht durchgeführt.

**Subsysteme (im Code verifiziert):** Feed mit eigenem Ranking + Diversity-Layer, Keyset-Pagination und Werbeplan; Messenger inkl. Realtime, Presence, Typing, Übersetzung, Market-Chats; Market inkl. Transaktions-Engine, Stripe-Webhook, Verkäuferprofile, Gebühren; Arena (Voting/Challenges); Globe (Three.js, LOD); SlangTags (owner-scoped Varianten, Audio-Trim, Manager/Freigabe); Moderation (KI + Admin-Cockpit + DSA-Transparenz); Werbekernel mit Adapter-Registry (AdSense vorbereitet, `VITE_ADSENSE_ENABLED=false`).

**Realtime:** 3 Kanäle (`ydude-presence`, `ydude-social`, `ydude-social-out`) – Presence + Broadcast + postgres_changes.
**Storage:** privater Bucket `media` mit signierten URLs, serverseitige Varianten-Erzeugung und Inventar.
**Auth:** Supabase-Auth mit `_authenticated`-Routen-Gate, `requireSupabaseAuth`-Middleware, Bearer-Attacher, CSRF-Middleware in `src/start.ts`.
**Push:** Web-Push mit lokalisierten Texten, Bündelung, Deep-Links.
**Caching / Medien:** Signierte URLs im `localStorage` (unkritisch) bzw. `sessionStorage` (sensibel), Varianten mit `max-age=1 Jahr, immutable`.
**Code-Splitting / Lazy Loading:** 4 lazy geladene Einheiten (Toaster, PostComposer, ProfileEditDialog, Globe-Route). Der Globe ist sauber isoliert (GlobeStage 1,1 MB + Geodaten 1,6 MB/1,2 MB liegen in eigenen Chunks). Entry-Bundle: **658 KB roh / 189 KB gzip**.

---

## 2. Sicherheit

Bereits geprüfte und bewusst akzeptierte Punkte werden **nicht erneut als Finding** geführt: Arena-Draft-Visibility (LOW/ACCEPTABLE), `market_fee_settings` (INFORMATIONAL), `market_seller_profiles` (LOW, solange nur öffentliche Verkäuferdaten).

| Bereich          | Status | Befund                                                                                     |
| ---------------- | ------ | ------------------------------------------------------------------------------------------ |
| RLS              | gut    | 116/116 Tabellen mit RLS, 285 Policies, DB-Integrationstests prüfen Anon-Zugriff           |
| Rollen           | gut    | eigene `user_roles`-Tabelle + `has_role()`, keine Rolle am Profil                          |
| SECURITY DEFINER | ok     | 113 Funktionen, Trigger-Helfer per `REVOKE` abgeschottet; Scanner-Hinweise sind akzeptiert |
| Storage          | ok     | privater Bucket, ausschließlich signierte URLs                                             |
| Auth             | gut    | Routen-Gate + serverseitige Token-Prüfung (3-teiliger Bearer, `getClaims`)                 |
| Turnstile        | ok     | serverseitige Pflichtprüfung, clientseitig nicht blockierend                               |
| API-Secrets      | gut    | Test verhindert Service-Key im Client-Code; Secrets nur in Handlern                        |
| Webhooks         | gut    | Stripe-Signatur + Idempotenz, Cron-Endpunkte mit Autorisierung (Tests erzwingen das)       |
| SSRF             | ok     | keine offenen Fetch-Proxys mit Nutzer-URL gefunden                                         |
| XSS              | ok     | React-Escaping, kein produktives `dangerouslySetInnerHTML` in Nutzerpfaden                 |
| CSRF             | gut    | `createCsrfMiddleware` für Server-Functions aktiv                                          |
| SQL-Injection    | gut    | ausschließlich PostgREST/RPC mit Parametern                                                |
| Upload           | ok     | Server-Validierung, Varianten-Pipeline, KI-Moderation                                      |
| Rate Limiting    | ok     | 6 Module mit Ratenbegrenzung (Konto, Übersetzung, Reports u. a.)                           |
| Push             | ok     | Endpunkte an Nutzer gebunden, Inhalte gebündelt/gekürzt                                    |
| Audit-Logging    | gut    | `account_security_events` (nur Admin lesbar), Ops-Monitoring                               |

### Neue bzw. tatsächlich relevante Findings

1. **MEDIUM – Realtime-Broadcast ohne Topic-Policies.** `realtime.messages` hat keine Policies, und die App nutzt echte Broadcast/Presence-Kanäle (`ydude-presence`, `ydude-social`, `ydude-social-out`) mit globalen Topic-Namen. Damit kann jeder angemeldete Nutzer Presence- und Typing-Ereignisse aller Nutzer mitlesen bzw. fälschen. Kein Zugriff auf Nachrichteninhalte, aber Metadaten-Leak (wer online ist, wer gerade tippt). Empfehlung: private Kanäle mit Topic-Policies auf `realtime.topic()` + `auth.uid()`, oder Presence auf Connection-Kreise scopen.
2. **LOW – `market_analytics_events` ohne UPDATE/DELETE-Policies.** Fail-closed durch RLS-Default-Deny, also nicht ausnutzbar; nur als bewusste Entscheidung zu dokumentieren.
3. **PROZESS – CI rot durch Formatfehler.** Ein rotes Gate senkt die Wirksamkeit aller anderen Kontrollen, weil Läufe abgebrochen werden, bevor Tests durchlaufen.

Keine kritischen (HIGH) Findings.

---

## 3. Performance & Skalierbarkeit (gemessen, lokal)

| Messwert                | Ergebnis                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| TTFB `/` (Landing)      | **25 ms**                                                            |
| TTFB `/auth`            | 421 ms (Dev-Server, ungecached)                                      |
| TTFB `/agb`             | 316 ms                                                               |
| Entry-Bundle            | 658 KB roh / **189 KB gzip**                                         |
| Client-Assets gesamt    | 9,5 MB über 296 Chunks (Globe/Geodaten dominieren, nur auf `/globe`) |
| DB-Größe / Verbindungen | 77 MB / 36                                                           |
| Fehlerquote Tests       | 0 % (467/467)                                                        |

Hinweis: Die TTFB-Werte stammen aus dem Entwicklungsserver ohne CDN und sind **kein Produktionswert** – produktiv liegen sie erfahrungsgemäß niedriger (Schätzung: 80–250 ms weltweit über Edge). API-/DB-Latenzen im Produktionsbetrieb wurden nicht neu gemessen; belastbar sind nur die dokumentierten Lasttests (siehe Abschnitt 4).

**Feed im Detail – alles im Code bestätigt:**

- Keyset-Pagination: `created_at.lt.<cursor> OR (created_at = cursor AND id < cursor.id)` – korrekt, stabil bei gleichen Zeitstempeln.
- Seitengröße **20** (`POSTS_PAGE_SIZE`), Nachladen über Cursor, `hasMorePosts` aus Rückgabelänge.
- Deduplizierung beim Anhängen, bereits geladene Seiten werden nicht erneut abgerufen.
- Sichtbare Profile: Feed respektiert `profile_visibility` über `can_view_profile`.
- Bildvarianten + `immutable`-Caching, Lazy Loading der Medien, Signatur-Cache im Browser.

**Wichtigster verbleibender Performance-Punkt:** signierte URLs sind schlecht CDN-cachebar. Der Browser-Cache mildert das, der Origin bleibt aber bei jedem neuen Gerät/Tab in der Kette.

---

## 4. Last / Skalierung

Belastbare Grundlage: `docs/LASTTEST_2026-08-15.md` – **750 gleichzeitige virtuelle Nutzer, 14.854 Requests, 0 Fehler / 0 Timeouts, p90 2.981 ms, p95 3.115 ms**. Alles darüber ist **Schätzung**.

| Stufe             | Bewertung             | Erwartete Engpässe                                                                                                   |
| ----------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 500 aktive Nutzer | **belegt tragfähig**  | keine; Messung mit 750 lag darüber und war fehlerfrei                                                                |
| 1.000             | tragfähig (Schätzung) | Latenz steigt in Spitzen; DB-Verbindungen und Medien-Origin zuerst spürbar                                           |
| 5.000             | Umbau nötig           | DB-CPU bei Feed-Ranking, Signieren von Medien-URLs, Realtime-Verbindungen, Push-Fanout über Cron                     |
| 10.000            | nicht ohne Umbau      | Medien über CDN mit öffentlichen, unveränderlichen Pfaden; Queue statt Cron; Read-Replica oder materialisierter Feed |
| 100.000           | Architekturprojekt    | Feed-Fanout-Speicher, dedizierte Realtime-Skalierung, eigenständige Moderations-/Übersetzungs-Worker, Multi-Region   |

Pro Dimension: **DB** – bis ~2.000 unkritisch, danach Ranking-Queries auslagern. **CPU/RAM** – Edge-Rendering skaliert horizontal, Engpass ist die DB. **Realtime** – globale Broadcast-Topics skalieren linear ungünstig, ab ~5.000 Nutzern zwingend zu scopen. **Storage/Medien** – der größte Kostentreiber. **Push** – Cron-getriebener Versand deckelt bei einigen Tausend Nachrichten je Lauf. **Moderation/Übersetzung** – reine KI-Kosten, technisch linear.

---

## 5. Produktreife

| Bereich       | Technisch vorhanden | Produktionsreif | Verbesserbar               | Offen / Risiko              |
| ------------- | ------------------- | --------------- | -------------------------- | --------------------------- |
| Feed          | ja                  | ja              | Vorlade-Strategie          | –                           |
| Profile       | ja                  | ja              | –                          | –                           |
| Messenger     | ja                  | ja              | Mehrgeräte-Sync            | keine E2E-Verschlüsselung   |
| Push          | ja                  | ja              | Cron → Queue               | iOS-PWA-Einschränkungen     |
| Likes         | ja                  | ja              | –                          | –                           |
| Kommentare    | ja                  | ja              | –                          | –                           |
| Übersetzung   | ja                  | ja              | Kostenkontrolle            | Klartext serverseitig nötig |
| SlangTags     | ja                  | ja              | –                          | –                           |
| Arena         | ja                  | ja              | Anreizsystem               | –                           |
| Globe         | ja                  | ja              | Ladegröße auf Mobilgeräten | –                           |
| Market        | ja                  | weitgehend      | Streitfälle/Rückabwicklung | Payout-Prozess              |
| Channels      | teilweise           | nein            | Konzept dünn               | Funktion unklar abgegrenzt  |
| Werbung       | ja                  | nein            | AdSense noch deaktiviert   | CMP-Nachweis                |
| Moderation    | ja                  | ja              | Eskalationspfade           | –                           |
| Admin         | ja                  | ja              | –                          | –                           |
| Auth          | ja                  | ja              | –                          | –                           |
| Registrierung | ja                  | ja              | Onboarding-Funnel          | –                           |
| Mobile UX     | ja                  | ja              | –                          | –                           |
| Desktop UX    | ja                  | weitgehend      | Breitbild-Layouts          | –                           |

---

## 6. Aktuelle Produktänderungen – Verifikation im Code

| Punkt                              | Status        | Nachweis                                                                                        |
| ---------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Messenger-Push-Bündelung           | **umgesetzt** | `push-shared.ts` mit gebündelten Absender-Texten, `push-message.server.ts`                      |
| Like-Push-Bündelung                | **umgesetzt** | `push-shared.ts:194` „N Personen gefällt dein Beitrag."                                         |
| Personen hinter Likes anzeigen     | **umgesetzt** | `post-likes.functions.ts → getPostLikers`, genutzt in `PostStatsBar`                            |
| Messenger Auto-Scroll              | **umgesetzt** | `Messenger.tsx:732` / Scroll-Erhalt beim Nachladen `:828`                                       |
| Chat-Position beim Öffnen          | **umgesetzt** | Sprung ans Ende beim Öffnen, Positionserhalt bei History-Load                                   |
| Hamburger-Menü-Toggle              | **umgesetzt** | `DropdownPortal.tsx:94` Capture-`pointerdown` statt Backdrop                                    |
| Feed-Werbung / einheitlicher Slot  | **umgesetzt** | `AdSlot.tsx`, `FeedAdCard.tsx`, `use-feed-ad-plan.ts`                                           |
| Werbung nur im Feed                | **bestätigt** | Werbekomponenten nur im Feed-Pfad und in Admin-/Dev-Vorschau                                    |
| Feed-Übersetzung / Originalsprache | **umgesetzt** | `use-post-translation.ts`, `translate.functions.ts`                                             |
| Kommentar-Übersetzung              | **umgesetzt** | `use-comment-translation.ts`, `translate-comment.server.ts`                                     |
| Captcha-/Registrierungsfix         | **umgesetzt** | `use-captcha-gate.ts` + serverseitige `turnstile.server.ts`-Prüfung                             |
| Code-Splitting                     | **teilweise** | 4 Lazy-Einheiten, Globe isoliert; Feed-Kern weiter im Entry                                     |
| Medien-/CDN-Optimierung            | **teilweise** | `immutable`-Header + Browser-Cache vorhanden, echtes CDN-Caching nicht möglich (signierte URLs) |

---

## 7. E2E-Verschlüsselung – Machbarkeit (nicht implementiert)

**Grundsätzlich vorbereitbar: ja.** Die Nachrichten laufen bereits über eine schmale Schnittstelle (`messages`-Tabelle mit `body`, `media_url`, `kind`, `slang_tag_ids`; Trigger schützt Fremdänderungen). Ein Feld für Chiffretext + Schlüsselmaterial ließe sich additiv ergänzen.

| Bestandteil          | Bewertung                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Textnachrichten      | unproblematisch (Client-Verschlüsselung, Server speichert Blob)                            |
| Bilder / Audio       | machbar, aber Storage-Varianten-Pipeline und Bildmoderation entfallen für private Chats    |
| SlangTags in Chats   | Referenz-IDs müssten mitverschlüsselt oder als öffentliche Referenz belassen werden        |
| Market-Kommunikation | Konflikt: Streitschlichtung braucht Nachweisbarkeit → Market-Chats besser bewusst ohne E2E |
| Push                 | nur noch inhaltslose Wecker-Pushes; Text muss im Client aus lokalem Schlüssel entstehen    |
| Realtime             | unverändert nutzbar, transportiert dann Chiffretext                                        |
| Live-Übersetzung     | Kernproblem, siehe unten                                                                   |
| Mehrere Geräte       | erfordert Geräte-Schlüsselbund + Sender-Key-Verteilung an alle Geräte                      |
| Schlüsselverwaltung  | größter Aufwand: Identitätsschlüssel, Prekeys, Backup/Recovery, Gerätewechsel              |

**Übersetzung ohne Klartext auf dem Server – drei tragfähige Wege:**

1. **Clientseitige Übersetzung (empfohlen).** Ein On-Device-Modell (WebGPU/WASM, z. B. kleine NMT-Modelle) übersetzt nach dem Entschlüsseln lokal. Server sieht nie Klartext. Kosten: Modell-Download, Qualität unter Gemini-Niveau.
2. **Blind-Relay mit Nutzerfreigabe.** Der **Empfänger-Client** entschlüsselt, sendet nur den ausgewählten Text ephemer und ohne Kontext/Absenderbezug an den Übersetzungsdienst und speichert das Ergebnis nur lokal. Der Server hat keine Zuordnung zum Chat, aber der Dienst sieht den Satz – das ist eine bewusste, pro Nachricht bestätigte Ausnahme, keine Dauer-Klartextspeicherung.
3. **Hybrid.** E2E als Standard, Live-Übersetzung als opt-in pro Konversation, die den Chat sichtbar auf „serverseitig lesbar" schaltet. Ehrlich und einfach, aber schwächt das Versprechen.

Realistische Empfehlung: Weg 1 als Ziel, Weg 2 als Übergang, Market-Chats bewusst ausgenommen. Aufwand **Schätzung: 6–10 Wochen** für Kryptostack, Mehrgeräte und Migration.

---

## 8. Wirtschaftliche Analyse (alle Werte Schätzung, sofern nicht messbar)

Gemessen: DB 77 MB, 22 Nutzer, 19 MB Build-Output. Reale Kosten je Nutzer sind mangels Produktions-Traffic **nicht belastbar bestimmbar**; die folgenden Werte sind Modellrechnungen auf Basis üblicher Cloud-Preise.

| Kostenblock              | Treiber                        | Schätzung pro 1.000 aktiver Nutzer/Monat |
| ------------------------ | ------------------------------ | ---------------------------------------- |
| Datenbank (Compute+Disk) | Feed-Queries, Realtime         | 25–60 €                                  |
| Storage                  | Bilder/Audio, Varianten        | 5–20 €                                   |
| Egress / Medien          | Auslieferung ohne CDN-Treffer  | 20–80 €                                  |
| Realtime                 | gleichzeitige Verbindungen     | 5–25 €                                   |
| Auth                     | inklusive                      | ~0 €                                     |
| Push                     | Cron-Läufe, Versand            | 2–8 €                                    |
| KI-Moderation            | pro Upload                     | 10–40 €                                  |
| Übersetzung              | pro übersetzter Nachricht/Post | 15–60 € (stark nutzungsabhängig)         |
| **Summe**                |                                | **~80–290 € / 1.000 Nutzer**             |

Skalierung ist nicht linear: pro 10.000 Nutzer **Schätzung 600–2.200 €/Monat**, pro 100.000 Nutzer **4.500–18.000 €/Monat** (mit CDN-Umbau eher am unteren Rand, ohne eher darüber).

| Szenario       | Kosten/Monat (Schätzung) | Mögliche Einnahmequellen                         | Break-even                                                    |
| -------------- | ------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| 500 Nutzer     | 60–160 €                 | keine aktiven (AdSense aus, Market ohne Volumen) | nicht erreichbar – bewusste Investitionsphase                 |
| 1.000 Nutzer   | 80–290 €                 | AdSense (nach Aktivierung), Market-Gebühren      | erst bei belegbaren eCPM/GMV bewertbar – **nicht bestimmbar** |
| 10.000 Nutzer  | 600–2.200 €              | Werbung im Feed, Market-Gebühren, Sponsoring     | rechnerisch möglich, empirisch **nicht belastbar**            |
| 100.000 Nutzer | 4.500–18.000 €           | Werbung als Hauptquelle, Market als Zweitquelle  | wahrscheinlich erreichbar, abhängig von Region und Füllrate   |

**Es werden bewusst keine Umsatzzahlen genannt** – es existieren weder Reichweiten- noch Transaktionsdaten. Jede Umsatzangabe wäre erfunden.

---

## 9. Monetarisierung

| Mechanismus      | Technisch vorhanden                | Was fehlt bis zur echten Monetarisierung                             |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------- |
| Werbekernel      | ja, vollständig                    | Live-Betrieb, Messung von Füllrate und Sichtbarkeit                  |
| Feed-Werbung     | ja (`FeedAdCard`)                  | Reichweite; Slot-Dichte-Tuning                                       |
| AdSense          | Adapter fertig, aus                | Aktivierung (`VITE_ADSENSE_ENABLED`), AdSense-Freigabe, CMP-Nachweis |
| Market-Gebühren  | ja (`market_fee_settings`, Stripe) | Payout-Prozess, Streitfälle, steuerliche Abwicklung                  |
| Sponsoring       | über Werbekernel abbildbar         | Vermarktung, Preisliste, Reporting für Sponsoren                     |
| Promotion-Pakete | angelegt                           | Preis- und Wirkungsnachweis                                          |

Rechtlich/technisch offen: Consent-Nachweis (TCF v2.2 ist im Code vorbereitet, ein produktiv zertifiziertes CMP fehlt), Werbekennzeichnung in allen Sprachen, AdSense-Programmprüfung, Verkäufer-Identifikation im Market (DAC7/PSD2-Fragen).

---

## 10. Recht / Compliance

| Bereich          | Bewertung                                                                         |
| ---------------- | --------------------------------------------------------------------------------- |
| DSGVO            | Grundlage vorhanden: Verarbeitungsverzeichnis, Datenschutz-Technikdoku, Retention |
| Consent / CMP    | **offen** – TCF-Gating im Code, kein produktiv zertifiziertes CMP nachweisbar     |
| Datenschutz      | Dokumente in Version 3.1, mehrsprachig                                            |
| Impressum        | vorhanden (`/impressum`)                                                          |
| Löschung         | umgesetzt inkl. Passwortprüfung, Ratenlimit, `auth.admin.deleteUser`              |
| Export           | umgesetzt (`exportMyData`)                                                        |
| Payments         | Stripe integriert; Vertrags-/Steuerfragen **nicht technisch prüfbar**             |
| Werbung          | Kennzeichnung vorhanden, Consent-Kette vor Live-Schaltung zu belegen              |
| AdSense          | noch nicht aktiv → aktuell kein Compliance-Risiko                                 |
| E2E-Auswirkungen | E2E würde Moderation privater Chats faktisch beenden – DSA-Bewertung nötig        |
| Moderation       | DSA-Elemente vorhanden: Meldewege, Widerspruch, Transparenzbericht                |
| Market           | Verbraucherrechte/Widerruf dokumentiert; Verkäuferpflichten nur teilweise         |

Eine abschließende juristische Vollständigkeit kann ich nicht bestätigen – das ist eine Anwaltsfrage, keine Codefrage.

---

## 11. Gesamtbewertung

| Dimension       |        Score |
| --------------- | -----------: |
| Technik         |       86/100 |
| Sicherheit      |       82/100 |
| Performance     |       78/100 |
| Skalierbarkeit  |       68/100 |
| Produktreife    |       81/100 |
| UX              |       82/100 |
| Monetarisierung |       60/100 |
| Compliance      |       76/100 |
| **Gesamt**      | **81 / 100** |

**Launch-Bereitschaft**

- Öffentliche Beta: **ja, ~90 %** – nach Behebung der 5 Formatfehler (CI grün) sofort.
- Normaler Launch: **~78 %** – es fehlen CMP-Nachweis, Market-Payout-Prozess und Realtime-Scoping.
- Skalierender Marktstart: **~62 %** – CDN-fähige Medien und Queue-basierte Hintergrundarbeit sind Voraussetzung.

---

## 12. Vergleich mit der Analyse vom 27.08.2026 (Vormittag)

| Dimension       | ALT | NEU | Veränderung | Grund                                                                           |
| --------------- | --: | --: | ----------- | ------------------------------------------------------------------------------- |
| Technik         |  84 |  86 | +2          | 467 statt 449 Tests, E2E- und DB-Integrationsebene, stabile Fehlerbehandlung    |
| Sicherheit      |  81 |  82 | +1          | Findings geprüft und bewertet; ein neues Realtime-Thema erkannt, aber gering    |
| Performance     |  72 |  78 | +6          | Code-Splitting (1 → 4 Einheiten), Globe isoliert, Medien-Cache, Push-Bündelung  |
| Skalierbarkeit  |  65 |  68 | +3          | Keyset-Pagination bestätigt, Medien-Caching; CDN-Grundproblem unverändert       |
| Produktreife    |  78 |  81 | +3          | Like-Liste, Übersetzung, Beitragsbearbeitung, Menü-Fixes, Market-Verbesserungen |
| UX              |  78 |  82 | +4          | einheitliche ×/←-Muster, Geo-Lokalisierung, Profil-Navigation, Toggle-Menü      |
| Monetarisierung |  58 |  60 | +2          | AdSense-Adapter fertig, aber weiterhin nicht aktiv                              |
| Compliance      |   — |  76 | neu         | DSA-Transparenz und Retention erstmals separat bewertet                         |
| **Gesamt**      |  79 |  81 | **+2**      | Verbesserungen real, aber die Betriebsschulden bestehen fort                    |

Bewusst **nicht** aufgewertet: Skalierbarkeit über 68 (Medien weiterhin nicht CDN-cachebar), Monetarisierung (kein Euro fließt), Compliance (CMP-Nachweis fehlt).

---

## 13. Top-10 nächste Schritte

| #   | Maßnahme                                                                                        | Prio | Zeitpunkt                   |
| --- | ----------------------------------------------------------------------------------------------- | ---- | --------------------------- |
| 1   | Prettier-Fehler beheben, CI wieder grün (`bun run format`)                                      | P1   | **muss vor Launch**         |
| 2   | Realtime auf private, topic-gescopte Kanäle umstellen                                           | P1   | **muss vor Launch**         |
| 3   | Zertifiziertes CMP anbinden, bevor AdSense aktiviert wird                                       | P1   | **muss vor Launch**         |
| 4   | Market: Payout-, Storno- und Streitfallprozess dokumentieren/abschließen                        | P2   | sollte vor Launch           |
| 5   | Medien CDN-fähig machen (öffentliche, unveränderliche Pfade + Signatur nur für private Inhalte) | P2   | sollte vor Launch           |
| 6   | Weiteres Code-Splitting: Market, Arena, Admin aus dem Entry lösen                               | P2   | sollte vor Launch           |
| 7   | Übersetzungs- und Moderationskosten pro Nutzer messen und deckeln                               | P2   | kann nach Launch            |
| 8   | Hintergrundarbeit von Cron auf Queue umstellen (Push, Moderation)                               | P3   | ab ~5.000 Nutzern           |
| 9   | Lasttest auf 2.000+ Nutzer wiederholen, Produktions-Latenzen messen                             | P3   | kann nach Launch            |
| 10  | E2E-Verschlüsselung vorbereiten (Schlüsselstack, On-Device-Übersetzung)                         | P4   | erst bei höherer Nutzerzahl |

---

## 14. Abschluss

**AKTUELLER TECHNISCHER REIFEGRAD: 86 %**
**PRODUKTREIFE: 81 %**
**GESAMTSCORE: 81 / 100**

**BETA-LAUNCH: JA** (nach Behebung der Formatfehler und des Realtime-Scopings – beides Tagesarbeit)
**SKALIERENDER MARKTSTART: NEIN** (Medien-/CDN-Architektur und Queue fehlen)

**GRÖSSTER AKTUELLER ENGPASS:** Medienauslieferung über signierte URLs – nicht CDN-cachebar, damit Origin-gebunden.

**GRÖSSTES AKTUELL BEKANNTES RISIKO:** Realtime-Broadcast ohne Topic-Policies (Presence-/Typing-Metadaten aller Nutzer für jeden Angemeldeten sichtbar).

**WICHTIGSTE OPTIMIERUNG:** Öffentliche, unveränderliche Medienpfade + echtes CDN-Caching.

**WICHTIGSTER MONETARISIERUNGS-SCHRITT:** CMP anbinden und AdSense aktivieren – der Adapter ist fertig, es fehlt nur die Consent-Kette.

**WICHTIGSTER SCHRITT FÜR 10.000+ NUTZER:** Hintergrundarbeit von Cron auf eine echte Queue umstellen und Feed-Ranking von der Hauptdatenbank entlasten.

**WICHTIGSTER SCHRITT FÜR 100.000+ NUTZER:** Feed-Fanout materialisieren, Realtime eigenständig skalieren und Moderation/Übersetzung in dedizierte Worker mit Kostenbudget auslagern.

---

_Alle nicht direkt messbaren Werte sind als Schätzung gekennzeichnet. Für diese Analyse wurden keine Projektdateien verändert._
