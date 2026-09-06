# Y-Dude – Vollständiger Production Audit & Optimierungs-Check

**Datum:** 2026-09-06 (04:25–05:10 UTC)
**Ziel:** belastbarer Ist-Zustand vor dem geplanten IBB-Pro-FIT-Antrag
**Vorgehen:** ausschließlich prüfend. Keine neuen Features, keine Architektur- oder
Schemaänderungen, keine Testanpassungen, keine Workarounds. Alle Datenbankzugriffe
dieses Audits waren lesend.

**Wichtiger Hinweis zur Datengrundlage:** Backend-Instanz und Datenbank sind für
Vorschau und veröffentlichte App identisch (eine Cloud-Instanz). Die erhobenen
Bestandszahlen sind daher der reale Ist-Zustand dieser Instanz, kein Testschema.

---

## 1. Executive Summary

Der Production-Stand ist funktional stabil und ohne bekannte kritische Fehler.
Typprüfung, Unit-Tests, Datenbank-Integrationstests, Browsertests und der
Produktions-Build laufen vollständig durch. Die Sicherheitsarchitektur ist
flächendeckend umgesetzt: alle 122 öffentlichen Tabellen haben aktive
Zeilensicherheit, 299 Policies, keine einzige SECURITY-DEFINER-Funktion ohne
festen Suchpfad, alle 24 anon-bezogenen Schreibregeln sind explizite
Verbotsregeln.

Die relevanten Schwächen liegen nicht in der Funktionsfähigkeit, sondern in
**Nachweisbarkeit, Betriebsabsicherung und UX-Führung**: fehlende
Upload-Begrenzung am Speicher-Bucket, kein Backfill für Teilen-Vorschaubilder
älterer Beiträge, ein übersprungener Browsertest, ein sehr großes
Globus-Bundle, gemeinsame Backend-Instanz für Vorschau und Produktion, und ein
Datenbestand, in dem zentrale Signal- und Kampagnentabellen leer sind
(`interaction_events` = 0, `ad_campaigns` = 0). Letzteres ist für den
IBB-Antrag wichtig, weil die signalbasierte Logik dadurch heute **nicht
empirisch validiert** ist – genau das ist als FuE-Arbeit abgegrenzt.

| Kennzahl | Wert |
|---|---|
| Geprüfte Bereiche | 10 |
| Befunde insgesamt | 42 |
| OK | 14 |
| OPTIMIEREN | 11 |
| RISIKO | 7 |
| FEHLER | 0 |
| DOKUMENTIEREN | 6 |
| FuE SPÄTER | 4 |

**Es wurde kein reproduzierbarer Production-Fehler gefunden.**

---

## 2. Production Readiness Score

| Dimension | Score | Begründung (belegt) |
|---|---|---|
| Stabilität | 88 / 100 | 591 Unit-Tests + 68 DB-Tests + 10 E2E-Tests grün, 0 Typfehler, Build erfolgreich, 0 offene Ops-Vorfälle, 0 offene Moderationsjobs. Abzug: 1 übersprungener E2E-Test, gemeinsame Instanz Vorschau/Produktion. |
| Security | 85 / 100 | 122/122 Tabellen mit RLS, 299 Policies, 0 SECURITY DEFINER ohne `search_path`, alle 8 öffentlichen Schnittstellen mit 401-Gate, Stripe-Webhook mit Signaturprüfung, CSRF-Middleware aktiv. Abzug: Bucket ohne Größen-/MIME-Grenze, 7 anon-ausführbare Prädikatfunktionen (u. a. `has_role`), `pg_net` im öffentlichen Schema. |
| Performance | 82 / 100 | Lasttest bis 750 gleichzeitige Nutzer: 366 Anfragen/s, p95 45 ms, p99 114 ms, 0 Fehler. Abzug: Globus-/Geodaten-Bundle 1,6 MB + 1,2 MB + 1,1 MB, 22 Fremdschlüssel ohne führenden Index, Lasttest nur lesend/anonym. |
| UX | 72 / 100 | Vollständige Navigation über alle Kernbereiche, 53/54 Seiten mit eigenen Seitentiteln/Metadaten, Fehler- und Leerzustände vorhanden. Abzug: Einstieg für neue Nutzer erklärt SlangTags/Grants/Drops nicht geführt, Creator- und Unternehmerpfade sind funktional aber nicht onboardinggeführt. |
| Wartbarkeit | 78 / 100 | 0 TODO/FIXME/HACK in `src`, klare Trennung `*.functions.ts` (36) / `*.server.ts` (54), dokumentierte Middleware. Abzug: 9.940 Stilabweichungen im Lint (davon 9.881 in Archivordnern), 38 Hook-/Fast-Refresh-Warnungen, große Archiv- und Backup-Ordner im Repository. |
| Testabdeckung | 80 / 100 | 32 Unit-Dateien / 591 Tests, 8 Integrationsdateien / 68 Tests, 5 E2E-Suiten / 11 Tests, Sicherheitsvertragstests vorhanden. Abzug: kein E2E für Kauf-, Kampagnen- und SlangTag-Erstellungspfad, 1 Test übersprungen. |

### Gesamtscore: **81 / 100** – produktionsreif, mit klar benannten Optimierungs- und Nachweislücken.

Gewichtung: Stabilität 25 %, Security 25 %, Performance 15 %, UX 15 %, Wartbarkeit 10 %, Testabdeckung 10 %.

---

## 3. Befundtabelle

### 3.1 Authentifizierung & Accounts

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| A-01 | Auth-Guards | Geschützte Route leitet ohne Sitzung zur Anmeldung (E2E bestätigt, 307). Sitzung wird nach Neuladen wiederhergestellt (E2E bestätigt). | OK | – | keine |
| A-02 | Serverfunktionen | 29 Module nutzen `requireSupabaseAuth`; `src/start.ts` registriert `attachSupabaseAuth` als Client-Middleware und eine CSRF-Middleware für Serverfunktionen. | OK | – | keine |
| A-03 | Rollen | Rollen liegen in `user_roles` (10 Zuordnungen, 2 Admins), Prüfung über SECURITY-DEFINER-Funktion `has_role`; keine Rollenspalte am Profil (Test erzwingt das). | OK | – | keine |
| A-04 | Rolleninformation | `has_role` ist für nicht angemeldete Besucher ausführbar. Damit ist abfragbar, ob eine bekannte Nutzer-ID Admin ist. Funktional notwendig für Policy-Auswertung, Informationswert gering. | RISIKO | P1 | Prüfen, ob `EXECUTE` für `anon` auf `has_role`, `test_user_visible`, `owns_moderation_action` entzogen werden kann, ohne Policies zu brechen; Ergebnis dokumentieren. |
| A-05 | CAPTCHA | Turnstile-Prüfpfad vorhanden und durch Tests abgedeckt (`turnstile-verify.test.ts`, `captcha-gate.test.ts`). | OK | – | keine |
| A-06 | Kontolöschung / Datenauskunft | Eigene Routen `delete-account.tsx` und `request-data.tsx` vorhanden. Kein automatisierter Test des vollständigen Löschpfads. | DOKUMENTIEREN | P1 | Löschpfad einmalig manuell protokollieren (welche Tabellen/Objekte betroffen sind) als Nachweis für Datenschutz und Antrag. |
| A-07 | Sicherheitsereignisse | `account_security_events` ist für Clients vollständig schreibgesperrt (drei Verbotsregeln), Schreiben nur serverseitig. | OK | – | keine |

### 3.2 Social Feed

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| F-01 | Initial Load / Scroll / Reload | E2E bestätigt: Feed lädt Beiträge, scrollt weiter und lässt sich neu laden (29,9 s Laufzeit). | OK | – | keine |
| F-02 | Beitragsdetailseite | E2E-Test „Beitragsdetailseite öffnet und Rückweg führt zum Feed" wird **übersprungen**. Damit ist der Detail-/Rückwegpfad nicht browsergeprüft. | RISIKO | P0 | Ursache der Übersprung-Bedingung ermitteln und den Test lauffähig machen – ohne den Test abzuschwächen. |
| F-03 | Kernrouten ohne Serverfehler | E2E „keine Serverfunktions- oder Serverfehler auf den Kernrouten" grün (35,4 s). | OK | – | keine |
| F-04 | Ranking / Diversity | Ranking- und Diversity-Logik ist implementiert und durch `feed-ranking.test.ts`, `feed-tabs.test.ts` sowie `docs/feed-diversity.md` abgedeckt. | OK | – | Verhalten nicht verändern (siehe FuE-1). |
| F-05 | Signaldaten | `interaction_events` enthält **0 Zeilen**. Die signalbasierte Personalisierung ist damit fachlich implementiert, aber nicht mit realen Daten validiert. | DOKUMENTIEREN | P1 | Im IBB-Antrag als Ausgangslage festhalten: Logik vorhanden, empirische Validierung offen (FuE-1). |
| F-06 | Teilen-Vorschaubilder | Live-Konsole zeigt wiederkehrende Warnungen `[media] sign skipped … __s.webp`. Im Speicher existieren nur 8 Teilen-Vorschauen bei 40 Beiträgen. Es gibt keinen Backfill; die Anzeige fällt korrekt auf das Beitragsbild zurück. | OPTIMIEREN | P1 | Einmaliger Nachlauf für bestehende Beiträge mit SlangTag-Platzierungen; Warnung auf „info" herabsetzen, wenn der Rückfall greift. |
| F-07 | Bildvarianten | 60 Klein- und 57 Mittelvarianten bei 225 Medienobjekten; alle 27 Varianten-Aufträge auf `done`, keine offenen Jobs. Kein verwaister Bild- oder Videoverweis (`posts.image_url`/`video_url`: je 0 fehlende Objekte). | OK | – | keine |
| F-08 | Übersetzung | Übersetzungspfad mit Kontingent- und Tokenprüfung getestet (`translation-quota.test.ts`, `translation-tokens.test.ts`); Fehlerfall 402 „Not enough credits" wird geordnet behandelt. | OK | – | keine |
| F-09 | Video im Sichtbereich | Autoplay-/Sichtbarkeitslogik getestet (`viewport-video.test.ts`), Uploadvalidierung getestet (`video-upload-validation.test.ts`). | OK | – | keine |

### 3.3 Community

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| C-01 | Sichtbarkeit | Zentrale Sichtbarkeitsprüfungen `can_view_post`, `can_view_profile`, `is_conversation_member`, `are_connected`, `is_following` existieren als SECURITY-DEFINER-Funktionen mit festem Suchpfad (Vertragstest erzwingt das). | OK | – | keine |
| C-02 | Channels / Arena / Globe | Routen vorhanden und im Navigations-E2E fehlerfrei erreichbar; Channel-Rollen, Bans und Mitgliedschaften sind eigene Tabellen mit Policies. | OK | – | keine |
| C-03 | Globus-Auslieferung | Globus lädt `land-10m` (1.595 kB), `borders-10m` (1.205 kB) und `GlobeStage` (1.099 kB) – rund 3,9 MB ungepackt für eine einzelne Ansicht. | OPTIMIEREN | P2 | Geodaten weiter herabstufen oder erst nach Nutzergeste laden; kein Architekturumbau nötig. |
| C-04 | Beziehungen | `connections`, `follows`, `channel_members` sind klein (22 / 5 Zeilen) – Community-Funktionen sind gebaut, aber kaum bespielt. | DOKUMENTIEREN | P1 | Nutzungsstand als Ist-Zustand festhalten, nicht als technischen Mangel. |

### 3.4 SlangTag

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| S-01 | Moderationskette | 14 SlangTags, **0 im Status `pending`**; Moderationsergebnisse sind per Trigger `guard_slang_tag_moderation` gegen Clientschreiben gesperrt, Moderationsereignisse clientseitig vollständig schreibgesperrt. | OK | – | keine |
| S-02 | Transkript | Spaltengenaues Leserecht auf `slang_tags.transcript`; öffentlicher Transkriptionspfad durch `public-transcribe-guard.test.ts` abgesichert. | OK | – | keine |
| S-03 | Zugriff / Grants / Drops | `can_use_slang_tag`, `has_slang_tag_grant`, `has_pending_drop_entitlement`, Reifelogik für exklusive Drops per Integrationstest geprüft (`db-exclusive-drop-maturation.test.ts`, `db-creator-slangtag-free.test.ts`). | OK | – | keine |
| S-04 | Speicher-Bucket | Bucket `media` ist privat (korrekt), hat aber **keine Größenbegrenzung und keine MIME-Allowlist**. Validierung erfolgt nur im Anwendungscode. | RISIKO | P0 | Größenlimit und erlaubte MIME-Typen am Bucket setzen (Konfigurationsänderung, kein Schema-Eingriff). |
| S-05 | QR / Deep Link | QR-Erzeugung (`qrcode`) und Deep-Link-Route `slangtag.$name` vorhanden; keine Auswertung der Aufrufe. | FuE SPÄTER | FuE | Nicht implementieren – gehört zu FuE-3 (datenschutzkonforme Attribution inkl. QR). |
| S-06 | Erstellungspfad | Kein Browsertest für Erstellung inkl. Audioaufnahme, Zuschnitt und Platzierung; Logik ist unit-getestet. | DOKUMENTIEREN | P1 | Einmaliges manuelles Abnahmeprotokoll (Aufnahme → Zuschnitt → Platzierung → Moderation → Veröffentlichung). |

### 3.5 Business & Kampagnen

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| B-01 | Kampagnenlogik | Vollständig implementiert und getestet (`business-campaigns.test.ts`, `campaign-editor.test.ts`, `business-onboarding.test.ts`), inklusive Trennung von Rolle und Abo: Entwurf/Bearbeitung ohne Abo, Aktivierung nur mit Abo. | OK | – | keine |
| B-02 | Limits & Eigentum | Tarifabhängiges Kampagnenlimit per Trigger (`enforce_business_campaign_limit`), Medien- und SlangTag-Eigentum per Trigger erzwungen, per Integrationstest geprüft. | OK | – | keine |
| B-03 | Ereigniszählung | Doppelzählschutz über `ad_campaign_event_guard`; Tabelle hat aktive Zeilensicherheit **ohne** Policy, ist also für Clients vollständig gesperrt (beabsichtigt, nur Serverrolle). | OK | – | Absicht dokumentieren, damit der Datenbank-Linter-Hinweis nicht als Mangel gelesen wird. |
| B-04 | Datenbestand | **0 Kampagnen** in der Datenbank. Ausspielung, Impressionen und Klicks sind damit nur synthetisch geprüft, nicht im Realbetrieb. | RISIKO | P1 | Vor dem Antrag mindestens einen vollständigen Kampagnendurchlauf im Vorschaubetrieb protokollieren (keine Codeänderung). |
| B-05 | Pacing / Frequency Capping / Attribution | Nicht vorhanden. Bewusst nicht umgesetzt. | FuE SPÄTER | FuE | Nicht implementieren – FuE-2 und FuE-3. |
| B-06 | Admin-Sicht | 15 Admin-Routen vorhanden (u. a. `admin.ads`, `admin.stats`, `admin.moderation`, `admin.health`, `admin.log`). `admin.tsx` ist ein Layout ohne eigene Metadaten – korrekt. | OK | – | keine |

### 3.6 Messenger

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| M-01 | Chatliste & Navigation | E2E grün, inklusive Regressionstest „Market-Liste bleibt nach Navigation nicht hängen". 130 Nachrichten im Bestand. | OK | – | keine |
| M-02 | Berechtigungen | Regeln auf `messages` und `conversation_members` nutzen durchgängig `is_conversation_member` bzw. `auth.uid()` (Vertragstest erzwingt das). | OK | – | keine |
| M-03 | Realtime-Zuschnitt | Themenzuschnitt getestet (`realtime-topic-scoping.test.ts`), Dokumentation in `docs/REALTIME_SICHERHEIT_2026-08-27.md`. | OK | – | keine |
| M-04 | Push | `notification_jobs` clientseitig vollständig schreibgesperrt; Zustellung und Texte getestet (`push-texts.test.ts`). Nur 1 aktives Push-Abonnement im Bestand – Zustellung ist im Realbetrieb praktisch unbelegt. | DOKUMENTIEREN | P1 | Eine Zustellung Ende-zu-Ende protokollieren (Gerät, Zeitstempel, Ergebnis). |
| M-05 | Nachrichtenbearbeitung | `guard_message_content_edits` und `guard_message_read_state_update` verhindern nachträgliche Inhalts- und Lesestandsmanipulation. | OK | – | keine |

### 3.7 Marketplace

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
K-01 | Erreichbarkeit | E2E grün: Market öffnet, Kategorien und Artikel erreichbar, eigene Artikelübersicht lädt. | OK | – | keine |
| K-02 | Zahlungs-Webhook | Signaturprüfung über `verifyWebhook` vorhanden; Idempotenz über `market_payment_webhook_events`, für `anon`/`authenticated` entzogen und ohne Policy – nur Serverrolle. Zwei Tests decken Signatur und Idempotenz ab. | OK | – | keine |
| K-03 | Transaktionssichtbarkeit | Regeln auf `market_transactions` binden an `buyer_id`/`seller_id`/`has_role`; `market_transaction_secrets` ist für `anon` ohne jedes Datenrecht. | OK | – | keine |
| K-04 | Bestand | 2 Artikel, 0 Transaktionen, 0 Streitfälle, 0 Rückerstattungen. Kauf-, Versand-, Streit- und Rückerstattungspfade sind implementiert und unit-getestet, aber ohne echten Durchlauf. | RISIKO | P0 | Vor dem Antrag einen vollständigen Kauf-, Versand- und Rückerstattungsdurchlauf im Testmodus protokollieren. Kein Codeeingriff. |
| K-05 | Kauf-Ende-zu-Ende | Kein E2E-Test über Angebot → Annahme → Zahlung → Versand. | DOKUMENTIEREN | P1 | Als Testlücke festhalten; Ergänzung optional nach dem Antrag. |
| K-06 | Doppelte Angebote | `market_flag_duplicate_item` markiert Duplikate per Trigger. | OK | – | keine |

### 3.8 Security

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| SEC-01 | Zeilensicherheit | **122 von 122** öffentlichen Tabellen mit aktiver Zeilensicherheit, 299 Policies. | OK | – | keine |
| SEC-02 | Schreibregeln für Gäste | Alle 24 Regeln, die `anon`/`public` betreffen und schreiben könnten, sind explizite Verbotsregeln (`with_check = false`). Keine offene Schreibregel. | OK | – | keine |
| SEC-03 | Suchpfad | **0** SECURITY-DEFINER-Funktionen ohne festen `search_path` (von 126). | OK | – | keine |
| SEC-04 | Ausführbare SECURITY-DEFINER-Funktionen | Datenbank-Linter meldet 7 für Gäste und 52 für angemeldete Nutzer ausführbare Funktionen. Geprüft: die 7 Gastfunktionen sind reine Prädikate für die Regelauswertung (`are_connected`, `can_view_post`, `has_role`, `is_following`, `market_event_refs_valid`, `owns_moderation_action`, `test_user_visible`). Beide Sicherheitsscan-Hinweise sind bereits bewusst als ignoriert markiert. | RISIKO | P1 | Nicht neu entwerfen. Nur die 52 Funktionen für angemeldete Nutzer durchgehen und dort `EXECUTE` entziehen, wo keine Policy sie braucht; Begründung je Funktion dokumentieren. |
| SEC-05 | Tabellen ohne Policy | 3 Tabellen mit Zeilensicherheit und ohne Policy: `ad_campaign_event_guard`, `market_payment_webhook_events`, `slang_tag_track_dedup`. Wirkung: vollständig gesperrt außer Serverrolle. Beabsichtigt. | DOKUMENTIEREN | P2 | Begründung im Sicherheitsdokument ergänzen, damit der Linter-Hinweis eingeordnet ist. |
| SEC-06 | Erweiterungen im öffentlichen Schema | `pg_net` und `pg_trgm` liegen im Schema `public`. `pg_trgm` ist harmlos; `pg_net` erlaubt ausgehende Netzaufrufe aus der Datenbank. | RISIKO | P1 | Prüfen, ob `EXECUTE` auf die `pg_net`-Funktionen für `anon`/`authenticated` entzogen ist; falls nicht, entziehen. |
| SEC-07 | Öffentliche Schnittstellen | Alle 8 Routen unter `api/public/*` prüfen den Aufrufer: 7 Cron-/Betriebsrouten mit Token und 401-Antwort (`moderation-run` mit laufzeitkonstantem Vergleich), der Zahlungs-Webhook mit Providersignatur. | OK | – | keine |
| SEC-08 | CSRF | `createCsrfMiddleware` ist für Serverfunktionen aktiv und im Code begründet. | OK | – | keine |
| SEC-09 | Speicherobjekte | Regeln auf `storage.objects` vorhanden; Leseprüfung über `can_read_media`. Bucket privat. | OK | – | keine |
| SEC-10 | Sicherheitsscan | Plattform-Sicherheitsscan: 2 Hinweise, beide Stufe „warn", beide vom Betreiber bewusst ignoriert. Keine Feststellung der Stufe „error". | OK | – | keine |

### 3.9 Performance

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| P-01 | Lasttest | Bestehender Lasttest vom 2026-08-30 gegen die Produktionsadresse: 50 → 750 gleichzeitige Nutzer, 24 → 366 Anfragen/s, p95 zwischen 45 und 66 ms, p99 ≤ 150 ms, **0 Fehler (4xx/5xx/Timeouts)**. | OK | – | keine |
| P-02 | Aussagekraft des Lasttests | Der Lasttest lief ausschließlich **lesend und anonym**. Schreibpfade (Posten, Nachrichten, Kauf) sind nicht lastgeprüft. | DOKUMENTIEREN | P1 | Grenze des Nachweises im Antrag klar benennen (gehört zu FuE-4). |
| P-03 | Build | Produktions-Build erfolgreich in 2,43 s; Serverbündel klein (größte Einheit 662 kB ungepackt / 139 kB gepackt). | OK | – | keine |
| P-04 | Client-Auslieferung | Gesamt 12 MB ausgelieferte Dateien. Größter Einzelbrocken ist die Globus-Ansicht (siehe C-03); Hauptbündel 645 kB (191 kB gepackt). Regionale Geodateien sind bereits pro Land aufgeteilt und werden nachgeladen – korrekt. | OPTIMIEREN | P2 | Hauptbündel unter 500 kB gepackt halten; Globus wie in C-03 behandeln. |
| P-05 | Fremdschlüssel-Indizes | 22 Fremdschlüssel ohne führenden Index. Bei den heutigen Tabellengrößen (max. 130 Zeilen) ohne Wirkung, bei Wachstum jedoch relevant. | OPTIMIEREN | P2 | Indizes gezielt für die wachstumsstärksten Tabellen ergänzen (`interaction_events`, `feed_signals`, `messages`, `market_analytics_events`). |
| P-06 | Sequenzielle Scans | 9 Tabellen mit hohem Anteil sequenzieller Scans. Alle betroffenen Tabellen sind sehr klein (0–22 Zeilen); die Datenbank wählt hier korrekt den vollen Scan. Kein Handlungsbedarf. | OK | – | keine |
| P-07 | Zwischenspeicher | Cache-Kennzahlen sind über eine eigene Betriebsroute abrufbar; Landing- und Auth-Seite hatten im Lasttest 192/202 bzw. 197/202 Treffer. | OK | – | keine |
| P-08 | Wiederholte Renderdurchläufe | 38 Lint-Warnungen zu Abhängigkeitslisten und Fast Refresh, u. a. in Messenger und Feed – potenzielle unnötige Renderdurchläufe. | OPTIMIEREN | P2 | Warnungen einzeln bewerten, nicht pauschal „reparieren". |

### 3.10 UX & Nutzerführung

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| U-01 | Neuer Community-Nutzer | Landing mit Login und Registrierung lädt (E2E), Feed ist nach Anmeldung direkt erreichbar. Es gibt jedoch **keine geführte Erklärung, was ein SlangTag ist** – das zentrale Alleinstellungsmerkmal muss selbst entdeckt werden. | OPTIMIEREN | P1 | Einmalige Erklärkarte beim ersten Feedaufruf; nutzt ausschließlich bestehende Funktionen, kein neues Feature. |
| U-02 | Posten | Beitragserstellung inklusive SlangTag-Platzierung vorhanden. Der Weg von „Beitrag erstellen" zu „SlangTag auswählen/aufnehmen" ist mehrstufig und ohne Zwischenerklärung. | OPTIMIEREN | P1 | Beschriftungen und Zwischenschritte klarer benennen. |
| U-03 | Creator | Creator-Bereich unter `/creator` mit Übersicht vorhanden. Grants und Drops sind funktional, aber begrifflich nicht erklärt; Berechtigungslogik ist für Nutzer nicht sichtbar. | OPTIMIEREN | P1 | Kurze Erläuterung je Begriff direkt an der Stelle einblenden. |
| U-04 | Unternehmer | `/business` und `/business/campaigns` vorhanden, Zähler „aktive Kampagnen", Statistikbereich, Zurück-Navigation. Der Zusammenhang „Rolle vorhanden, Abo fehlt → Entwurf möglich, Veröffentlichung nicht" ist logisch korrekt, aber erklärungsbedürftig. | OPTIMIEREN | P0 | Zustandstext an der Aktivierungsschaltfläche eindeutig formulieren. Betrifft eine bestehende Funktion und ist antragsrelevant. |
| U-05 | Marketplace-Nutzer | Suche, Kategorien, Favoriten und eigene Artikel erreichbar (E2E). Kauf-/Verkaufsablauf ist vorhanden, aber ohne Fortschrittsanzeige über die Transaktionsschritte. | OPTIMIEREN | P2 | Statusfolge sichtbar machen; nutzt bestehende Transaktionszustände. |
| U-06 | Metadaten / Auffindbarkeit | 53 von 54 Seiten besitzen eigene Seitentitel und Beschreibungen; die Ausnahme ist ein Layout ohne eigene Seite. `robots.txt`, `sitemap.xml`, `llms.txt`, `manifest.webmanifest` vorhanden. | OK | – | keine |
| U-07 | Fehlerdarstellung | Zentrale Fehlerseite, definierte Antwort für veraltete Browser-Bündel (409 + Selbstneuladen), Serverfunktionen erhalten keine HTML-Fehlerseite. Gut gelöst und im Code begründet. | OK | – | keine |
| U-08 | Konsolenrauschen | Wiederkehrende Warnungen zu fehlenden Teilen-Vorschauen (siehe F-06) erschweren die Fehlersuche im Betrieb. | OPTIMIEREN | P1 | Zusammen mit F-06 beheben. |
| U-09 | Mobil | Bestehende Anpassungen dokumentiert (`docs/IPHONE_RESPONSIVE_FIX_2026-08-31.md`); keine mobile Messung in diesem Audit. | DOKUMENTIEREN | P2 | Eine mobile Abnahme protokollieren. |

### 3.11 Betrieb

| ID | Bereich | Befund | Status | Priorität | Empfohlene Maßnahme |
|---|---|---|---|---|---|
| O-01 | Umgebungstrennung | Eine gemeinsame Backend-Instanz bedient Vorschau und veröffentlichte App. Vorschauzugriffe wirken auf denselben Datenbestand. | RISIKO | P0 | Als bewusst getragenes Betriebsrisiko dokumentieren oder vor dem Antrag trennen. Bereits in `docs/STAGING_TRENNUNG_ENTSCHEIDUNG_2026-08-28.md` behandelt – Stand aktualisieren. |
| O-02 | Vorfälle | 0 offene Betriebsvorfälle, 0 offene Moderationsaufträge, 0 offene Meldungen. | OK | – | keine |
| O-03 | Stilprüfung | `bun run lint` endet mit Fehlercode: 9.978 Meldungen. Davon **9.881 Formatabweichungen in Archivordnern** (`release/…`), 55 in `remotion/`, und nur **4 in `src/`**. | OPTIMIEREN | P1 | Archiv- und `remotion`-Ordner in `.prettierignore`/ESLint-Ignore aufnehmen, die 4 Stellen in `src/` formatieren. Danach ist die Stilprüfung wieder ein nutzbares Signal. |
| O-04 | Repository-Hygiene | Mehrere große Backup-, Release- und Archivordner liegen im Arbeitsbaum und verzerren jede Auswertung. | OPTIMIEREN | P2 | Archivstand außerhalb des Arbeitsbaums ablegen. |

---

## 4. Vor IBB erledigen

Nur echte Fehler, Sicherheitsrisiken, Stabilitätsprobleme, UX-Probleme an bestehenden
Funktionen und fehlende Nachweise:

1. **S-04 – Speicher-Bucket ohne Größen- und Typbegrenzung** (Sicherheitsrisiko, P0).
2. **O-01 – gemeinsame Backend-Instanz für Vorschau und Produktion** (Betriebsrisiko, P0 – entscheiden und dokumentieren).
3. **F-02 – übersprungener Browsertest der Beitragsdetailseite** (Stabilitätslücke, P0).
4. **K-04 – kein protokollierter Kauf-, Versand- und Rückerstattungsdurchlauf** (fehlender Nachweis, P0).
5. **U-04 – Zustandstext zur Kampagnenaktivierung ohne Abo** (UX an bestehender Funktion, P0).
6. **SEC-04 / SEC-06 – Ausführungsrechte auf SECURITY-DEFINER-Funktionen und `pg_net` einzeln prüfen** (P1).
7. **A-04 – Gastausführbarkeit von `has_role` bewerten** (P1).
8. **F-06 / U-08 – Teilen-Vorschauen nachziehen, Konsolenrauschen beenden** (P1).
9. **B-04 – vollständigen Kampagnendurchlauf protokollieren** (P1).
10. **A-06 – Löschpfad protokollieren** (Datenschutznachweis, P1).
11. **M-04 – eine Push-Zustellung Ende-zu-Ende protokollieren** (P1).
12. **O-03 – Stilprüfung wieder aussagefähig machen** (P1).
13. **U-01 / U-02 / U-03 – Erklärungen für SlangTags, Grants und Drops** (P1).
14. **P-02 – Grenze des Lastnachweises schriftlich festhalten** (P1).

---

## 5. Dokumentieren – Ist-Zustand für den IBB-Antrag

Diese bereits erbrachten technischen Leistungen sollten als **Ausgangslage**
festgehalten werden und dürfen nicht als zukünftige Fördermaßnahme dargestellt werden:

| Nachweis | Belegter Wert |
|---|---|
| Datenmodell | 122 öffentliche Tabellen, 40 Aufzählungstypen, 231 Migrationen |
| Sicherheitsarchitektur | 122/122 Tabellen mit Zeilensicherheit, 299 Policies, 126 SECURITY-DEFINER-Funktionen, davon 0 ohne festen Suchpfad |
| Serverlogik | 36 typisierte Serverfunktionsmodule, 54 serverseitige Module, 8 abgesicherte öffentliche Schnittstellen |
| Anwendungsumfang | 68 Routendateien, 54 Seiten mit eigenen Metadaten, 15 Admin-Bereiche |
| Automatisierung | 136 Datenbanktrigger, Zählerspülung, Moderationslauf, Medienvarianten-Nachlauf, Aufbewahrungslauf, Push-Lauf, Betriebsgesundheitslauf |
| Datenintegrität | Doppelzählschutz für Kampagnenereignisse, Idempotenzsperre für Zahlungsereignisse, Duplikatmarkierung im Marktplatz |
| Testpyramide | 591 Unit-/Logiktests (32 Dateien), 68 Datenbank-Integrationstests (8 Dateien), 11 Browsertests (5 Suiten), Sicherheitsvertragstests |
| Verifikation zum Auditzeitpunkt | Typprüfung 0 Fehler, Unit 591/591 grün, Integration 68/68 grün, E2E 10 grün + 1 übersprungen, Produktions-Build erfolgreich |
| Leistungsnachweis | Lasttest bis 750 gleichzeitige Nutzer, 366 Anfragen/s, p95 45 ms, p99 114 ms, 0 Fehler (lesend/anonym) |
| Betriebsfähigkeit | Ops-Ereignisse und Vorfälle als eigene Tabellen, Alarmzustellung getestet, Notfall- und Vorfall-Runbooks vorhanden |
| Datenschutztechnik | Verarbeitungsverzeichnis, Datenschutztechnikdokument, Konto-Löschroute, Datenauskunftsroute, verpixelte Teilen-Vorschauen |
| Vorhandene Dokumentation | über 45 technische Dokumente unter `docs/`, u. a. Sicherheitsaudits, Release- und Checkpoint-Berichte, Architektur- und Caching-Analysen |

---

## 6. FuE SPÄTER – bewusst unangetastet

Diese Punkte wurden im Audit erkannt und **nicht verändert**. Sie bilden die
Abgrenzung zur geplanten FuE-Arbeit:

| ID | Thema | Warum jetzt nicht |
|---|---|---|
| FuE-1 | Adaptive, rückkopplungsstabile Feed-Rangfolge und empirische Validierung der Signalkette (`interaction_events`, `feed_signals`, `user_interest_scores`, `interest_confidence`, `connection_influence`) | Erfordert Forschungsarbeit zu Rückkopplung und Messbarkeit; heutige Logik bleibt unverändert (F-04, F-05) |
| FuE-2 | Kampagnen-Pacing, Frequenzbegrenzung und Messung der Verdrängung organischer Inhalte | Nicht implementiert und ausdrücklich nicht vorwegzunehmen (B-05) |
| FuE-3 | Datenschutzkonforme, bereichsübergreifende Wirkungsmessung inklusive QR-Attribution | Keine QR-Auswertung vorhanden; Datenschutzmodell ist offene Forschungsfrage (S-05, B-05) |
| FuE-4 | Skalierungs- und Kostenmodell für Schreib- und Echtzeitlast | Heutiger Nachweis ist lesend/anonym; Schreiblastmodell ist FuE-Gegenstand (P-02) |

Ergänzend bleiben zwei bereits im FuE-Bericht benannte Themen unangetastet:
systematischer maschineller Nachweis der Sichtbarkeitsregeln und quantifizierte
Güte der Audio-/Slang-Moderation. Beide sind heute funktional umgesetzt, aber
nicht messtechnisch validiert.

---

## 7. Optimierungs-Checkliste (priorisiert)

### P0 – muss vor Production/IBB erledigt werden
- [ ] S-04 Größenlimit und MIME-Allowlist am Speicher-Bucket setzen
- [ ] O-01 Entscheidung zur Trennung von Vorschau- und Produktionsdaten treffen und dokumentieren
- [ ] F-02 übersprungenen Browsertest der Beitragsdetailseite lauffähig machen (ohne Abschwächung)
- [ ] K-04 vollständigen Kauf-, Versand- und Rückerstattungsdurchlauf protokollieren
- [ ] U-04 Zustandstext zur Kampagnenaktivierung ohne Abo eindeutig formulieren

### P1 – sollte vor dem Antrag erledigt werden
- [ ] SEC-04 die 52 für angemeldete Nutzer ausführbaren SECURITY-DEFINER-Funktionen einzeln bewerten, unnötige Rechte entziehen
- [ ] SEC-06 Ausführungsrechte auf `pg_net` prüfen und ggf. entziehen
- [ ] A-04 Gastausführbarkeit von `has_role`, `test_user_visible`, `owns_moderation_action` bewerten
- [ ] F-06 / U-08 Teilen-Vorschauen für bestehende Beiträge nachziehen, Warnstufe korrigieren
- [ ] B-04 einen vollständigen Kampagnendurchlauf protokollieren
- [ ] A-06 Konto-Löschpfad protokollieren
- [ ] M-04 eine Push-Zustellung Ende-zu-Ende protokollieren
- [ ] S-06 Abnahmeprotokoll SlangTag-Erstellung
- [ ] O-03 Archiv-/`remotion`-Ordner aus der Stilprüfung nehmen, 4 Stellen in `src/` formatieren
- [ ] U-01 / U-02 / U-03 Erklärungen für SlangTags, Grants und Drops an der jeweiligen Stelle
- [ ] P-02 Grenze des Lastnachweises schriftlich festhalten
- [ ] C-04 / F-05 Nutzungs- und Signalstand als Ist-Zustand festhalten
- [ ] K-05 fehlenden Kauf-E2E als Testlücke dokumentieren

### P2 – kann später optimiert werden
- [ ] C-03 / P-04 Globus- und Geodatenauslieferung verkleinern oder später laden
- [ ] P-05 Indizes für die wachstumsstärksten Fremdschlüssel ergänzen
- [ ] P-08 die 38 Hook-/Fast-Refresh-Warnungen einzeln bewerten
- [ ] SEC-05 Absicht der drei policyfreien Tabellen dokumentieren
- [ ] U-05 Fortschrittsanzeige über die Transaktionsschritte
- [ ] U-09 mobile Abnahme protokollieren
- [ ] O-04 Archivordner aus dem Arbeitsbaum nehmen

### FuE – erst nach Förderentscheidung
- [ ] FuE-1 adaptive Feed-Rangfolge und Validierung der Signalkette
- [ ] FuE-2 Pacing, Frequenzbegrenzung, Verdrängungsmessung
- [ ] FuE-3 datenschutzkonforme Attribution inklusive QR
- [ ] FuE-4 Skalierungs- und Kostenmodell für Schreib- und Echtzeitlast

---

## 8. Abschließende Empfehlung

**Ist der aktuelle Production-Stand stabil?**
Ja. Alle automatisierten Prüfebenen laufen durch: 0 Typfehler, 591 Unit-Tests,
68 Datenbanktests, 10 Browsertests grün, Produktions-Build erfolgreich, 0 offene
Betriebsvorfälle. Der bestehende Lasttest belegt Leseverhalten bis 750
gleichzeitige Nutzer ohne Fehler.

**Gibt es kritische Fehler?**
Nein. Es wurde **kein reproduzierbarer Fehler** gefunden. Die als P0 geführten
Punkte sind Risiken und Nachweislücken, keine Funktionsfehler.

**Welche Punkte müssen vor dem IBB-Antrag erledigt werden?**
Die fünf P0-Punkte (Bucket-Begrenzung, Entscheidung zur Umgebungstrennung,
übersprungener Browsertest, protokollierter Kaufdurchlauf, Zustandstext
Kampagnenaktivierung) und die P1-Nachweise. Entscheidend für den Antrag ist
weniger Code als **Protokollierung**: mehrere zentrale Pfade (Kauf, Kampagne,
Push, Löschung) sind implementiert und getestet, aber ohne dokumentierten
Realdurchlauf.

**Welche Punkte sollen bewusst unangetastet bleiben?**
FuE-1 bis FuE-4 sowie der maschinelle Sichtbarkeitsnachweis und die quantifizierte
Moderationsgüte. Wichtig für die Abgrenzung: `interaction_events` und
`ad_campaigns` sind heute leer. Die signalbasierte Personalisierung und die
Kampagnenwirkung sind damit als Logik vorhanden, aber **empirisch unvalidiert** –
genau diese Validierung ist der förderfähige Kern und darf jetzt nicht
vorweggenommen werden.

**Nachregel:** Mit diesem Bericht endet der Audit. Es wurden keine Features
implementiert und keine Strukturen geändert. Die Entscheidung, welche P0/P1-Punkte
gezielt umgesetzt werden, erfolgt separat.
