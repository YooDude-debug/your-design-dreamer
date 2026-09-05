# Y-Dude – FuE-Ankerprojekt für IBB Pro FIT (Frühphasenfinanzierung)

**Stand:** 05.09.2026
**Zweck:** Technische Grundlage zur gemeinsamen Erarbeitung eines Pro-FIT-Antrags mit einem Fördermittelberater.
**Charakter des Dokuments:** technische Bestandsaufnahme und Ableitung eines FuE-Anteils. Keine Förderzusage, keine Aussage über Förderfähigkeit. Alle Angaben zum Ist-Zustand sind aus dem vorhandenen Quellcode und dem laufenden Datenbankschema erhoben und mit Dateipfaden bzw. Zählwerten belegt.

**Abgrenzung der Statusbegriffe (im gesamten Dokument einheitlich verwendet):**

| Status | Bedeutung |
| --- | --- |
| UMGESETZT | im Code vorhanden, im Produktivsystem aktiv, durch Tests oder Schema belegt |
| TEILWEISE | vorhanden, aber heuristisch, unvollständig oder nicht validiert |
| OFFEN | technisch identifiziert, nicht implementiert |
| FuE | Gegenstand der geplanten Forschungs- und Entwicklungsarbeit |

---

## 1. Executive Summary

Y-Dude ist eine produktiv betriebene Web-Plattform (TanStack Start / React 19, serverseitige Funktionen im Edge-Runtime, PostgreSQL mit Row-Level-Security). Erhobene Kennzahlen zum Stichtag:

| Kennzahl | Wert | Erhebung |
| --- | --- | --- |
| Anwendungscode (TS/TSX) | 107.584 Zeilen | `find src -name '*.ts*' \| xargs wc -l` |
| SQL-Migrationen | 231 Dateien, 12.115 Zeilen | `supabase/migrations` |
| Tabellen im Schema `public` | 122 | `pg_tables` |
| davon mit aktivierter RLS | 122 (100 %) | `pg_tables.rowsecurity` |
| RLS-Policies | 299 | `pg_policies` |
| Datenbankfunktionen | 176, davon 126 `SECURITY DEFINER` | `pg_proc` |
| Enums / Trigger / Indizes | 40 / 136 / 343 | `pg_type`, `pg_trigger`, `pg_indexes` |
| Routen (Dateirouten) | 68 Routendateien, davon 17 im Gate `_authenticated/`, 19 Admin-Routen, 8 öffentliche API-Routen | Dateisystem |
| Serverfunktionsmodule | 37 `*.functions.ts`, 60 `*.server.ts` | Dateisystem |
| Automatisierte Tests | 591 Unit-/Logiktests (32 Dateien) grün, 9 DB-Integrationstests, 5 Playwright-E2E-Suiten | `bunx vitest run`, `tests/integration`, `tests/e2e` |

Die technische Substanz liegt nicht in einer einzelnen Funktion, sondern in einem **gemeinsamen Datenmodell, das Community-Interaktion, Creator-Monetarisierung, Unternehmenskampagnen, Messenger und Marketplace auf denselben Signal- und Berechtigungslayer aufsetzt**. Ein einziger Signalstrom (`interaction_events`, `feed_signals`, `user_interest_scores`, `interest_confidence`, `connection_influence`) speist gleichzeitig das Feed-Ranking (`src/lib/feed-ranking/`), die Interest Engine (`src/lib/interest-engine/`) und die Kampagnenrelevanz (`src/lib/ads/campaign-ranking.shared.ts`). Berechtigungen für alle Bereiche laufen über eine einzige Rollenquelle (`public.user_roles` + `has_role()`), ausgewertet in 299 Policies.

Die im Bestand nachweisbaren Schwachstellen sind gleichzeitig der eigentliche FuE-Kern:

1. Ranking- und Kampagnenrelevanz arbeiten mit **statisch konfigurierten Gewichten** (`FEED_WEIGHTS`, `CAMPAIGN_SIGNAL_WEIGHTS`); eine Lernschicht ist rudimentär (`feed-ranking/learning.ts`, 67 Zeilen, Tabelle `feed_learned_weights`) und nicht validiert.
2. Kampagnenmessung besteht aus **zwei aggregierten Zählern** (`ad_campaigns.impressions`, `ad_campaigns.clicks`, dedupliziert per Stunde in `increment_campaign_metric`). Eine Attribution über die Kette Kampagne → Interaktion → SlangTag/QR → Marketplace existiert **nicht**.
3. Der Offline-Online-Übergang (SlangTag-QR, `src/lib/slangtag-qr.ts`) erzeugt Deep Links, aber **keine messbare, datenschutzkonforme Wirkungskette**.
4. Skalierung des Rankings erfolgt heute überwiegend im Request-Pfad mit Cache-Tabelle (`feed_score_cache`); ein belastbares Verhalten bei stark wachsendem Signalvolumen ist nicht nachgewiesen (Lasttest bislang 750 virtuelle Nutzer, `docs/Y-DUDE_PRODUCTION_LOADTEST_750_USERS_2026-08-30.json`).
5. Die KI-Moderation (`src/lib/content-moderation.server.ts`, 535 Zeilen, Mehrmodell-Prüfung) ist funktional, aber ohne quantifizierte Fehlerraten (kein Testkorpus, keine Precision/Recall-Messung).

Daraus wird ein FuE-Ankerprojekt mit sechs aufeinander aufbauenden Arbeitspaketen abgeleitet (Kapitel 5–7).

---

## 2. Technische Bestandsaufnahme Y-Dude

### 2.1 Frontend

- TanStack Start v1 / React 19 / Vite 7, Dateirouting unter `src/routes` (68 Routendateien, u. a. `index.tsx`, `dev.tsx` als Feed, `arena`, `globe`, `market*`, `business*`, `admin*`, `p.$postId`, `api/public/*`).
- Öffentliche und authentifizierte Bereiche getrennt (`src/routes/_authenticated/route.tsx` als Gate).
- Mehrsprachigkeit DE/EN/EL (`src/lib/i18n.tsx`), Landingpage-Sprache über Edge-Geo-Header (`src/lib/lang-geo.ts`).
- Feed-Interaktionsschicht: `src/lib/feed-tabs.ts`, `feed-anchor.ts`, `feed-scroll.ts`, `feed-freeze.ts`, `feed-session.ts`, `live-feed.ts`; viewportbasiertes Video-Autoplay (`src/lib/viewport-video.ts`, Tests `tests/viewport-video.test.ts`).
- Status: UMGESETZT.

### 2.2 Backend / Serverschicht

- Kein separater Applikationsserver: serverseitige Logik als typisierte RPC-Funktionen (`createServerFn`) in 37 `*.functions.ts`, fachliche Implementierung in 60 `*.server.ts`.
- Externe Aufrufe (Webhooks, Cron, Health) über Dateirouten unter `src/routes/api/public/*`, jeweils mit eigener Prüfung im Handler (z. B. Signaturprüfung Zahlungs-Webhook, `tests/payments-webhook-signature.test.ts`, Idempotenz `tests/payments-webhook-idempotency.test.ts`).
- Ausführung im Worker/Edge-Runtime; daraus folgen harte Einschränkungen (kein `sharp`/`canvas`, keine Subprozesse), die die Medienpipeline geprägt haben (siehe 2.13).
- Status: UMGESETZT.

### 2.3 Datenbank

231 Migrationen, 122 Tabellen. Fachliche Gruppen (Auszug, vollständig im Schema):

| Domäne | Tabellen (Auswahl) |
| --- | --- |
| Feed / Inhalte | `posts`, `post_likes`, `post_views`, `post_video_views`, `post_saves`, `post_shares`, `post_hashtags`, `post_originals`, `post_translations`, `comments`, `comment_translations` |
| Signale / Personalisierung | `interaction_events`, `feed_signals`, `feed_score_cache`, `feed_learned_weights`, `user_interests`, `user_interest_scores`, `interest_confidence`, `interest_engine_config`, `interest_categories`, `connection_influence`, `counter_events` |
| SlangTags | `slang_tags`, `slang_tag_library`, `slang_tag_grants`, `slang_tag_plays`, `slang_tag_likes`, `slang_tag_saves`, `slang_tag_shares`, `slang_tag_share_requests`, `slang_tag_votes`, `slang_tag_video_uses`, `slang_tag_drops`, `slang_tag_moderation_events`, `slang_tag_track_dedup`, `slang_definitions`, `slang_definition_translations` |
| Arena / Globe | `arena_challenges`, `arena_submissions`, `arena_votes`, `arena_likes`, `arena_plays`, `arena_comments`, `arena_awards`, `globe_entries`, `globe_vote_rounds`, `globe_vote_entries`, `globe_vote_results` |
| Sozialgraph | `connections`, `connection_suggestions`, `follows`, `hashtag_follows`, `channels`, `channel_members`, `channel_follows`, `channel_bans`, `channel_categories` |
| Messenger | `conversations`, `conversation_members`, `messages`, `message_translations`, `chat_slang_tags` |
| Marketplace | `market_items`, `market_images`, `market_categories`, `market_offers`, `market_transactions`, `market_transaction_events`, `market_transaction_secrets`, `market_payment_records`, `market_payment_webhook_events`, `market_refunds`, `market_disputes`, `market_shipping`, `market_fee_settings`, `market_seller_profiles`, `market_promotions`, `market_promotion_plans`, `market_favorites`, `market_searches`, `market_analytics_events`, `market_item_slang_tags`, `market_item_channels`, `market_ad_campaigns` |
| Kampagnen / Werbung | `ad_campaigns`, `ad_campaign_event_guard`, `ad_preferences`, `ad_pauses`, `ad_test_settings`, `ad_test_events` |
| Creator-Monetarisierung | `creator_subscriptions`, `creator_subscription_prices`, `subscriptions` |
| Moderation / Recht | `reports`, `moderation_actions`, `moderation_appeals`, `content_moderation_log`, `post_moderation_jobs`, `user_warnings`, `user_bans`, `admin_audit_log`, `account_security_events`, `identity_policy` |
| Benachrichtigung | `notifications`, `notification_jobs`, `push_subscriptions` |
| Medien | `media_variant_jobs`, `media_video_assets` |
| Betrieb | `ops_events`, `ops_incidents`, `beta_launch_state`, `beta_launch_notifications` |

Status: UMGESETZT.

### 2.4 Authentifizierung, Rollen, Berechtigungen

- Auth über den Backend-Dienst (E-Mail/Passwort + Google), Registrierung mit AGB-Zustimmung und CAPTCHA-Gate (`src/lib/use-captcha-gate.ts`, `src/lib/turnstile.server.ts`, fail-closed, Tests `tests/turnstile-verify.test.ts`, `tests/captcha-gate.test.ts`).
- Rollen ausschließlich in `public.user_roles`, geprüft über `has_role()` (`SECURITY DEFINER`, `EXECUTE` für `anon` entzogen). Darstellungsschicht: `src/lib/role-scope.ts` (Community / Creator / Unternehmer / Admin, Mehrfachrolle Creator+Unternehmer erlaubt). Test: `tests/role-separation.test.ts`, `tests/integration/db-user-roles-write.test.ts`.
- Sichtbarkeitsentscheidungen zentral in Datenbankfunktionen (`can_view_post`, `can_view_profile`, `is_conversation_member`, `are_connected`), nicht im Client.
- Status: UMGESETZT.

### 2.5 Sicherheitsarchitektur / RLS

- RLS auf allen 122 Tabellen, 299 Policies, GRANT-Vergabe rollenspezifisch je Tabelle; sensible Tabellen (`market_transaction_secrets`, `market_fee_settings`) ohne `anon`-Zugriff.
- 126 `SECURITY DEFINER`-Funktionen mit fixiertem `search_path`; `EXECUTE` gezielt entzogen (Beispiele in den Migrationen `…03cc0768…`, `…46da53fc…`).
- Schreibpfade für Beiträge sind clientseitig entzogen (`REVOKE INSERT, UPDATE ON public.posts FROM authenticated`) – Veröffentlichung läuft zwingend über die serverseitige Moderationsprüfung.
- Vertragstests gegen Policies: `tests/rls-policy-contract.test.ts`, `tests/auth-guard-contract.test.ts`, `tests/integration/db-security.test.ts`, `tests/integration/db-anon-access.test.ts`.
- Realtime-Kanäle nutzerbezogen gescoped (`src/lib/social.tsx`, `tests/realtime-topic-scoping.test.ts`).
- Status: UMGESETZT.

### 2.6 Social Feed und Ranking

- Ranking-Engine `src/lib/feed-ranking/` (1.815 Zeilen): 11 Faktoren in `factors.ts` (Interessen, Region, Hashtag-Affinität, Beziehung, Engagement, SlangTag-Affinität, SlangTag-Qualität, Beitragsqualität, Aktualität, neue Creator, Creator-Vertrauen, Spam-Abzug), Gewichte zentral in `config.ts` (`FEED_WEIGHTS`), Explorationsanteil 12 %.
- Diversity-Re-Ranking (`diversity.ts`) mit Fenstern und Strafen je Autor, Channel, Thema, Region, Medientyp, SlangTag-Präsenz; relativ zur Score-Spanne des Kandidatenfensters (18).
- Serverseitige Ausführung und Cache in `engine.server.ts` + `feed_score_cache`; Signalaufnahme über `feed_signals`; Keyset-Pagination.
- Lernschicht `learning.ts` (67 Zeilen) schreibt Gewichtsdeltas nach `feed_learned_weights`. Status dieser Teilkomponente: TEILWEISE (kein Offline-Evaluationsrahmen, keine A/B-Infrastruktur, keine Absicherung gegen Rückkopplung/Selbstverstärkung).

### 2.7 Interest Engine

- `src/lib/interest-engine/` mit reiner Rechenlogik (`scoring.ts`: Punkte je Aktion, Verweildauer-Anteil, zeitlicher Abbau) und serverseitiger Persistenz (`engine.server.ts`) auf `user_interest_scores`, `interest_confidence`, `connection_influence`, Konfiguration in `interest_engine_config`.
- Status: UMGESETZT (Modell heuristisch, Parameter konfigurativ, nicht empirisch kalibriert → FuE-relevant).

### 2.8 Community-, Creator- und Unternehmensfunktionen

- Community: Beiträge, Kommentare, Likes, Saves, Shares, Connections, Follows, Channels, Hashtags, Arena-Voting, Slang Globe (Three.js, `docs/SLANG_GLOBE.md`).
- Creator: Eligibility-Schwelle (`src/lib/creator-eligibility.ts`, 10 Connections/Follower, Tests `tests/creator-eligibility.test.ts`), Creator-SlangTags (`creator-slangtags.functions.ts`, `slang_tag_grants`), Abonnements (`creator_subscriptions`, `creator_subscription_prices`), exklusive Drops (`slang_tag_drops`, `tests/integration/db-exclusive-drop-maturation.test.ts`).
- Unternehmen: Business-Onboarding und Tarife (`business-campaigns.shared.ts`, `tests/business-onboarding.test.ts`), Kampagnenverwaltung unter `/business/campaigns` (`business-campaigns.functions.ts`, `business-campaigns.server.ts`, `tests/campaign-editor.test.ts`, `tests/business-campaigns.test.ts`), Limits (`tests/integration/db-campaign-limits.test.ts`).
- Status: UMGESETZT.

### 2.9 Kampagnensystem und Ausspielung

- Trennung „Werbekernel entscheidet WO, Quelle liefert WAS“: Planerzeugung `src/lib/ad-plan.server.ts` (14 Slots, variable Abstände 6–12 / 8–18, serverseitiger Zufall, Videoanteil 0,35), Provider-Registry `src/lib/ads/registry.server.ts`, Kampagnenquelle `ads/campaign-provider.server.ts`, Demo-Inventar `ads/demo-inventory.server.ts`.
- Relevanz als Gewicht, nicht als Filter: `ads/campaign-ranking.shared.ts` mit `CAMPAIGN_SIGNAL_WEIGHTS` (Region 2, Hashtag 1,5, SlangTag 2,5, Following 3, Connection 1,5), Grundgewicht 1.
- Zielgruppenschnitt aus Nutzerpräferenzen (`ad_preferences`) und Interessen-Daten, Ausspielpausen (`ad_pauses`), Testmodus (`ad_test_settings`, `ad_test_events`).
- Externe Nachfrage vorbereitet: AdSense-Adapter mit Consent-/TCF-Gating (`ads/adsense-provider.ts`, `adsense-consent.ts`, `tests/adsense-provider.test.ts`) – per Umgebungsschalter deaktiviert.
- Status: UMGESETZT (Ausspielung), TEILWEISE (Relevanzmodell heuristisch, ohne Wirkungsnachweis).

### 2.10 Impressionen, Interaktionen, Analytics

- Kampagnenmessung: `recordCampaignEvent` → RPC `increment_campaign_metric`; serverseitige Prüfung von Ereignisart, Kampagnenexistenz, Status, Umgebung, Zeitfenster; Deduplizierung je Person/Kampagne/Art/Stunde (`ad_campaign_event_guard`). Gespeichert werden nur die aggregierten Zähler `impressions` und `clicks` (`src/lib/business-campaigns-metrics.server.ts`, `tests/integration/db-campaign-tracking.test.ts`).
- Nutzerinteraktionen: `interaction_events`, `post_views` (gebündelt), `post_video_views`, `counter_events`, Zählerkonsistenz über Trigger (`sync_post_counter`, `sync_comment_counts`, `sync_tag_counter`, `sync_arena_counter`).
- Marketplace-Analytik: `market_analytics_events`, `market-analytics.server.ts`, `market_searches`.
- **Nicht vorhanden:** kohorten- oder zeitreihenbasierte Kampagnenanalytik, Conversion-Attribution über Bereichsgrenzen, Uplift-/Kontrollgruppenmessung, Reporting-API. Status: OFFEN → FuE.

### 2.11 SlangTag-System und QR

- SlangTag = 1–5 s Audio, an Bild/Video positionierbar (Position, Skalierung, Rotation, Varianten; Typen `src/lib/types.ts`), maximal 5 pro Beitrag mit fester Abspielreihenfolge, optional gesperrt.
- Community- (`$`) vs. Creator-/Unternehmens-SlangTags (`$$`), Besitz- und Freigabemodell (`slang_tag_grants`, `slangtag-grants.ts`, `slangtag-rules.ts`), Freischaltarten (`open`, `follow`, `challenge`, `event`, `premium`), Moderationsstatus und Soft-Delete.
- Automatische Transkription (öffentlicher Endpunkt gehärtet: CAPTCHA-Pflicht, 8 Anfragen/10 min/IP, 2 MB / 15 s Limit; `tests/public-transcribe-guard.test.ts`), Redaction (`slangtag-redaction.ts`), Definitionen mehrsprachig (`slang_definitions*`).
- QR: deterministisch aus der SlangTag-ID erzeugter Deep Link (`src/lib/slangtag-qr.ts`, `https://y-dude.com/?slangtag=<id>`), keine Speicherung des Bildes. **Keine Erfassung von Scan-Ereignissen, kein Bezug Scan → Kampagne/Marketplace.** Status: UMGESETZT (Erzeugung), OFFEN (Messbarkeit) → FuE.

### 2.12 Messenger

- Konversationen mit Mitgliederprüfung in der Datenbank (`is_conversation_member`), Realtime-Zustellung, SlangTags in Chats (`chat_slang_tags`), Market-Chats getrennt von Connection-Chats (`market-chat.server.ts`, `tests/messenger-navigation.test.ts`).
- Übersetzung von Nachrichten, Kommentaren und Beiträgen über KI-Gateway mit Persistenz und Kontingentsteuerung (`translate-*.server.ts`, `translation-tokens.ts`, `tests/translation-quota.test.ts`, `tests/translation-tokens.test.ts`).
- Push-Benachrichtigungen mit senderbezogener Bündelung, Cooldowns, Deep Links (`push*.ts`, `tests/push-texts.test.ts`).
- Status: UMGESETZT.

### 2.13 Marketplace

- Artikel, Bilder, Kategorien, Angebote, Transaktionen mit Ereignisprotokoll, Zahlungsabgleich über Webhooks mit Signaturprüfung und Idempotenz, Rückerstattungen, Streitfälle, Versand, Gebührenmodell, Verkäuferprofile, Promotions.
- Verknüpfung mit dem sozialen Layer: `market_item_slang_tags`, `market_item_channels`, `market_ad_campaigns`.
- Status: UMGESETZT.

### 2.14 Moderation, Recht, Meldewesen

- Vorabprüfung aller Inhalte serverseitig (`content-moderation.server.ts`, 535 Zeilen): getrennte Text-/Bild-/Audioprüfung, Bilder durch zwei unabhängige Modelle, Kategorien/Konfidenz/Schweregrad, keine Freigabe bei fehlender Antwort; Policy und Schwellen ausgelagert (`moderation-policy.ts`, `moderation-reasons.ts`).
- Warteschlange und Jobs (`moderation-queue.server.ts`, `post_moderation_jobs`), Meldungen (`reports`), Maßnahmen (`moderation_actions`), Widersprüche (`moderation_appeals`), DSA-Transparenz (`moderation-dsa.*`), Audit-Log (`admin_audit_log`).
- **Nicht vorhanden:** quantifizierte Modellgüte (Precision/Recall), Referenzkorpus, Kalibrierung der Schwellen, Drift-Überwachung bei Modellwechsel. Status: TEILWEISE → FuE.

### 2.15 Medienpipeline

- Bildvarianten primär im Browser (WebP 300 px / 1080 px), serverseitiger Backstop über die Bildtransformation des Speichers, da `sharp`/`canvas` im Worker-Runtime nicht verfügbar sind (`media-variants.server.ts`, `media_variant_jobs`, `tests/media-variants.test.ts`).
- Video: eigene Auswertung der ISO-BMFF-Metadaten für Maße/Rotation (`tkhd`-Offsets v0=24 / v1=36), Assets in `media_video_assets`, Shots (≤ 5 s, stumm) und Video-Beiträge (≤ 60 s) getrennt (`tests/video-upload-validation.test.ts`).
- Auslieferung mit mehrschichtigem Cache, langlebigen signierten URLs und Cache-Policy-Tests (`docs/MEDIEN_CDN_CACHE_2026-08-27.md`, `tests/media-cache-policy.test.ts`).
- Status: UMGESETZT (Bild/Video-Basis), TEILWEISE (Kostenverhalten und Cache-Trefferquote unter Wachstum nicht modelliert).

### 2.16 Betrieb, Observability, Performance

- Ereigniserfassung, Gruppierung, Bewertung, Schwellwertprüfung und Alarmierung in `ops-monitor.server.ts` (710 Zeilen) mit `ops_events`, `ops_incidents`, Umgebungstrennung (Development alarmiert nie, Staging nie in Production) und externem Alarmkanal per Webhook; Health-Endpunkt `/api/public/ops-health-run` per Zeitplan alle 5 min (HTTP-Timeout 20 s), DB-Probe mit 3 s Abbruch und einem Wiederholversuch.
- SSR-/HTTP-Caching (`http-cache.server.ts`), View- und Übersetzungs-Bündelung, 343 Indizes inkl. Trigramm-Indizes für Suche.
- Nachgewiesene Last: 750 virtuelle Nutzer, 366 RPS, p95 45 ms, SSR-Cache-Trefferquote 92 % (`docs/Y-DUDE_PRODUCTION_LOADTEST_750_USERS_2026-08-30.json`).
- Bekannte betriebliche Lücke: Staging und Production sind codeseitig getrennte Projekte, ein vollständig isolierter Datenbestand für Lastversuche mit realistischem Signalvolumen fehlt (`docs/STAGING_PRUEFUNG_2026-08-28.md`, `docs/STAGING_SCHEMA_AUDIT_2026-09-02.md`).
- Status: UMGESETZT (Basis), TEILWEISE (Skalierungsnachweis jenseits 750 VU).

### 2.17 Schnittstellen

- Intern: typisierte RPC (`createServerFn`), PostgREST/RPC gegen PostgreSQL, Realtime-Kanäle.
- Extern eingehend: Zahlungs-Webhooks, Cron/Health, öffentliche Transkription (gehärtet), AdSense (deaktiviert).
- Extern ausgehend: KI-Gateway (Moderation, Übersetzung, Transkription), Web-Push, Zahlungsdienstleister, Alarm-Webhook.
- **Nicht vorhanden:** öffentliche, dokumentierte API für Werbetreibende/Agenturen oder Datenexport für Kampagnenauswertung. Status: OFFEN → FuE (AP5).

---

## 3. Technologische Kerninnovation

Die Innovation ist nicht die Existenz der Einzelbereiche, sondern deren **technische Kopplung über einen gemeinsamen Signal-, Berechtigungs- und Inhaltsraum**. Nachweisbare Verknüpfungen entlang der geforderten Kette:

| Kettenglied | Technische Verknüpfung (belegt) |
| --- | --- |
| Community → Signal | Interaktionen schreiben `interaction_events` / `feed_signals`; daraus `user_interest_scores`, `interest_confidence`, `connection_influence` (`interest-engine/engine.server.ts`) |
| Signal → Feed | dieselben Tabellen sind Eingangsgrößen der 11 Ranking-Faktoren (`feed-ranking/factors.ts`) plus Diversity-Layer |
| Community → Creator | Eligibility aus Sozialgraph-Kennzahlen (`creator-eligibility.ts`), Freischaltung von Creator-SlangTags über `slang_tag_grants` |
| Creator → Monetarisierung | `creator_subscriptions` + `slang_tag_drops` steuern Zugriff auf denselben Inhaltstyp (SlangTag) |
| Unternehmen → Kampagne | `ad_campaigns` mit Region, Hashtags, optionaler SlangTag-Bindung (`slang_tag_id`) |
| Kampagne → Ausspielung | Werbekernel bestimmt Positionen im echten Feed (`ad-plan.server.ts`), Kampagnenquelle liefert Inhalt; Relevanz aus **denselben** Nutzersignalen wie das organische Ranking (`ads/campaign-ranking.shared.ts`) |
| Interaktion → Daten | serverseitig geprüfte, stundenweise deduplizierte Zähler (`increment_campaign_metric`) |
| SlangTag → Offline | deterministischer QR-Deep-Link auf die SlangTag-ID (`slangtag-qr.ts`) |
| Plattform → Marketplace/Messenger | `market_item_slang_tags`, `market_item_channels`, `market_ad_campaigns`, `chat_slang_tags`; Sichtbarkeit über dieselben DB-Funktionen (`can_view_post`, `can_view_profile`, `is_conversation_member`) |

Der technisch tragende Punkt ist der **SlangTag als bereichsübergreifende Entität**: dasselbe Audio-Objekt ist Inhaltsbestandteil (Beitrag), Ranking-Signal (Affinität, Qualität), Zugangsobjekt (Grants, Drops, Abo), Kampagnenbindung (`ad_campaigns.slang_tag_id`), Marketplace-Attribut (`market_item_slang_tags`), Chatinhalt (`chat_slang_tags`) und Offline-Anker (QR). Diese Mehrfachrolle einer Entität in einem einzigen, RLS-durchgesetzten Datenmodell ist die eigentliche Entwicklungsleistung – und gleichzeitig die Quelle der in Kapitel 4 beschriebenen Unsicherheiten.

Nicht behauptet wird: dass diese Kette bereits durchgängig **gemessen** oder **gelernt** wird. Sie ist heute strukturell verbunden, aber wirkungsseitig nicht auswertbar.

---

## 4. Technische Unsicherheiten (FuE-Kandidaten)

Jeweils: Problem – technischer Anspruch – bestehender Ansatz – offene Frage – geplante Arbeit – erwartetes Ergebnis.

### U1 Mehrzielige Feed-Rangfolge mit gekoppelten Signalen

1. **Problem:** 11 Faktoren, Diversity-Fenster und Explorationsanteil müssen gleichzeitig Relevanz, Vielfalt, Regionalität, Neu-Creator-Sichtbarkeit und Werbeverträglichkeit erfüllen; die Gewichte sind heute manuell gesetzt (`FEED_WEIGHTS`).
2. **Anspruch:** Es liegt ein mehrkriterielles Optimierungsproblem mit Rückkopplung vor: Ranking beeinflusst Interaktion, Interaktion beeinflusst Signale, Signale beeinflussen Ranking. Ohne Kontrolle entstehen Selbstverstärkung und Sichtbarkeitskollaps für neue Inhalte.
3. **Bestehend:** deterministische, konfigurierbare Gewichtung + Diversity-Re-Ranking relativ zur Score-Spanne; rudimentäre Deltalernung (`learning.ts` → `feed_learned_weights`).
4. **Offen:** Wie lassen sich Gewichte datengetrieben und stabil anpassen, ohne Rückkopplungsdrift? Welche Zielfunktion (Relevanz vs. Vielfalt vs. Neuheit) ist messbar dominierend?
5. **Arbeit:** Offline-Evaluationsrahmen mit Replay historischer Signale, Kennzahlen (nDCG-ähnlich, Vielfaltsindex, Neu-Creator-Abdeckung), kontrollierte Online-Variantenschaltung, Regularisierung/Dämpfung der Lernschritte.
6. **Ergebnis:** reproduzierbar messbare Ranking-Varianten mit dokumentierter Wirkung; validierte oder widerlegte Lernschicht.

### U2 Kampagnenausspielung im organischen Feed ohne zweite Engine

1. **Problem:** Kampagnen werden in den bestehenden Feed eingesetzt (Positionslogik) und über Gewichte relevant gemacht, ohne Filter und ohne separate Feed-Engine.
2. **Anspruch:** Konkurrierende Anforderungen: Budget-/Laufzeitsteuerung, Frequenzbegrenzung, Relevanz, Nichtverdrängung organischer Vielfalt, Fairness zwischen Kampagnen – bei serverseitig randomisierter Slotvergabe und Cache.
3. **Bestehend:** `ad-plan.server.ts` (Slots, variable Abstände, Videoanteil), `scoreCampaign` als additive Gewichtung, `ad_pauses`, Umgebungstrennung.
4. **Offen:** Wie lässt sich Auslieferungsgerechtigkeit (Budgetausschöpfung je Kampagne) mit Relevanzgewichtung und Frequenzdeckelung gleichzeitig einhalten – nachweisbar und ohne Nutzerermüdung?
5. **Arbeit:** Simulationsumgebung für Auslieferungsverläufe, Pacing-Verfahren, Frequency-Capping auf Personenebene ohne Verhaltensprofilbildung, Messung der Verdrängungswirkung auf organische Beiträge.
6. **Ergebnis:** validiertes Auslieferungsverfahren mit dokumentierten Grenzen (Kampagnenzahl, Slotdichte, Budgetgenauigkeit).

### U3 Attribution über Bereichsgrenzen (Kampagne → Interaktion → SlangTag/QR → Marketplace)

1. **Problem:** Heute existieren nur zwei aggregierte Zähler je Kampagne; die Wirkungskette bis zu Marketplace-Aktion oder Offline-Scan ist nicht rekonstruierbar.
2. **Anspruch:** Attribution über mehrere Domänen erfordert ein Ereignismodell, das ohne personenbezogene Verhaltensprofile auskommt (DSGVO), gegen Mehrfachzählung, Bot-Traffic und Manipulation robust ist und trotzdem aussagefähige Aggregate liefert.
3. **Bestehend:** serverseitige Deduplizierung pro Stunde (`ad_campaign_event_guard`), getrennte Ereignistabellen (`interaction_events`, `market_analytics_events`), QR-Deep-Link mit stabiler SlangTag-ID.
4. **Offen:** Welches Aggregationsmodell (k-anonyme Kohorten, Zeitfenster-Aggregate, Schwellenwertunterdrückung) liefert belastbare Wirkungsaussagen bei kleinen Fallzahlen und ohne Einzelpersonenrückschluss?
5. **Arbeit:** Entwurf eines domänenübergreifenden Ereignis- und Aggregationsmodells, Scan-Erfassung für QR ohne Personenbezug, Mindestfallzahl-/Unterdrückungslogik, Manipulationsschutz, Reporting-Aggregate.
6. **Ergebnis:** prototypische, datenschutzgeprüfte Attributionsschicht mit dokumentierter Genauigkeit und dokumentierten Grenzen.

### U4 Offline-Online-Kopplung über SlangTag-QR

1. **Problem:** QR-Codes verweisen auf SlangTags, der Übergang ist aber weder messbar noch kampagnenseitig auswertbar; Scans in physischen Umgebungen sind unzuverlässig (Kontext, Sprache, Erstnutzung ohne Konto).
2. **Anspruch:** Der Einstieg muss ohne Anmeldung funktionieren, darf keine Tracking-Identität setzen und muss dennoch einer Kampagne/Region zuordenbar sein.
3. **Bestehend:** deterministische Linkerzeugung, öffentlicher SlangTag-Zugriff (`public-slangtag.functions.ts`), Geo-Sprachwahl (`lang-geo.ts`).
4. **Offen:** Welche zustandslose Kennzeichnung (Kampagnen-/Platzierungsparameter) erlaubt Aggregatmessung ohne Personenbezug und ohne manipulierbare Zählstände?
5. **Arbeit:** signierte Platzierungsparameter, serverseitige Aggregatzählung mit Missbrauchsschutz, Erstkontakt-Strecke ohne Konto, Auswertung auf Kampagnen-/Regionsebene.
6. **Ergebnis:** validierter, messbarer Offline-Einstieg mit nachweislich fehlender Personenbeziehbarkeit.

### U5 Skalierung von Ranking und Signalverarbeitung

1. **Problem:** Ranking und Signalauswertung laufen weitgehend im Anfragepfad mit Cache-Tabelle; nachgewiesen sind 750 gleichzeitige Nutzer bei geringem historischem Signalvolumen.
2. **Anspruch:** Kosten wachsen mit Nutzer × Kandidaten × Signalen; Cacheinvalidierung kollidiert mit Aktualitätsanforderung eines Live-Feeds.
3. **Bestehend:** `feed_score_cache`, Keyset-Pagination, SSR-Cache (92 % Trefferquote), 343 Indizes, gebündelte View-Zählung.
4. **Offen:** Ab welchem Signal- und Nutzervolumen ist Vorberechnung (materialisierte Scores, inkrementelle Aktualisierung) notwendig, und wie stark verschlechtert das die Aktualität?
5. **Arbeit:** Lastversuche mit synthetischem Signalvolumen mehrerer Größenordnungen, Vergleich On-Request-Ranking vs. inkrementelle Vorberechnung, Definition von Aktualitäts-/Kostenbudgets.
6. **Ergebnis:** belastbares Skalierungsmodell mit dokumentierten Grenzwerten und einer validierten Architekturentscheidung.

### U6 Berechtigungsmodell bei bereichsübergreifenden Entitäten

1. **Problem:** Dieselbe Entität (SlangTag, Profil, Beitrag) ist in Community, Creator-Abo, Kampagne, Marketplace und Messenger unterschiedlich sichtbar; heute 299 Policies und 126 `SECURITY DEFINER`-Funktionen.
2. **Anspruch:** Kombinatorische Zustandsräume (Rolle × Sichtbarkeit × Abo × Grant × Moderationsstatus × Umgebung) sind manuell nicht vollständig prüfbar; Fehler führen unmittelbar zu Datenschutzvorfällen.
3. **Bestehend:** zentrale Sichtbarkeitsfunktionen, Vertragstests (`rls-policy-contract`, `db-security`, `db-anon-access`), Auditdokumente.
4. **Offen:** Wie lässt sich Policy-Korrektheit systematisch (generativ/eigenschaftsbasiert) statt beispielhaft nachweisen?
5. **Arbeit:** Modellierung der Sichtbarkeitsregeln als prüfbare Spezifikation, generierte Testmatrix über Rollen-/Zustandskombinationen, Abweichungsanalyse gegen die 299 Policies.
6. **Ergebnis:** automatisierter Nachweis der Sichtbarkeitsregeln inkl. Liste erkannter Regelkonflikte.

### U7 Moderationsgüte bei nutzergenerierten Audioinhalten

1. **Problem:** SlangTags sind kurze, dialektale, mehrsprachige Audioaufnahmen; Text-/Bildmoderation ist etabliert, Audioprüfung von Dialekt und Slang ist fehleranfällig.
2. **Anspruch:** Weder Übersperrung (Community-Sprache ist der Produktkern) noch Unterblockung (Rechtspflichten) sind hinnehmbar; es fehlen quantifizierte Fehlerraten.
3. **Bestehend:** Mehrmodellprüfung, Zero-Tolerance-Kategorien, Schwellen je Kanal, Transkription, Redaction, Widerspruchsverfahren.
4. **Offen:** Welche Precision/Recall erreicht die Kette Transkription → Bewertung bei Dialekt/Slang, und wie müssen Schwellen je Sprache/Region kalibriert werden?
5. **Arbeit:** Aufbau eines annotierten Referenzkorpus, Messung je Kategorie/Sprache, Schwellenkalibrierung, Drift-Prüfung bei Modellwechsel, Eskalationslogik in die manuelle Warteschlange.
6. **Ergebnis:** dokumentierte Modellgüte und kalibrierte, versionierte Schwellenwerte.

### U8 Übersetzung im Interaktionsfluss (Kosten, Latenz, Bedeutungserhalt)

1. **Problem:** Beiträge, Kommentare und Nachrichten werden KI-übersetzt; Slang-Bedeutung darf nicht verloren gehen, Kosten und Latenz sind begrenzt.
2. **Anspruch:** Kontingentsteuerung, Persistenz, Ausfallverhalten und Bedeutungserhalt bei dialektalem Ausgangsmaterial stehen im Konflikt.
3. **Bestehend:** `translate-*.server.ts`, Persistenz in `*_translations`, Tokenbudget (`translation-tokens.ts`), Bündelung, Fallbacks.
4. **Offen:** Welche Kombination aus Caching, Bündelung und SlangTag-Kontext (`slang_definitions`) hält Qualität bei sinkenden Kosten pro Interaktion?
5. **Arbeit:** Qualitätsmessung mit Referenzsätzen, kontextangereicherte Übersetzung, Kosten-/Latenzbudgets pro Interaktion.
6. **Ergebnis:** messbar begründete Übersetzungsstrategie mit Kostenkennzahl pro 1.000 Interaktionen.

Abgrenzung: Nicht als FuE geführt werden reguläre Entwicklungsaufgaben wie UI-Ausbau, weitere Marketplace-Kategorien, zusätzliche Zahlungswege, Übersetzung weiterer Oberflächentexte, Bibliotheksaktualisierungen.

---

## 5. FuE-Ankerprojekt

**Arbeitstitel (durch die Analyse gedeckt):**
„Technologische Weiterentwicklung einer integrierten Community-, Creator- und Unternehmensplattform: signalbasierte Interaktions- und Kampagnenlogik mit datenschutzkonformer, bereichsübergreifender Wirkungsmessung“

### Ausgangssituation

Es existiert eine produktiv betriebene Plattform mit 122 vollständig RLS-geschützten Tabellen, 231 Migrationen, 107.584 Zeilen Anwendungscode, serverseitigem Feed-Ranking mit 11 Faktoren und Diversity-Layer, heuristischer Interest Engine, Kampagnenausspielung im organischen Feed, KI-Moderation, Messenger mit Übersetzung, Marketplace mit Zahlungsabwicklung und einem Betriebsmonitoring mit Alarmierung. Nachgewiesene Last: 750 gleichzeitige Nutzer.

### Technisches Problem

Die Bereiche sind strukturell verbunden, aber die Verbindung ist **weder gemessen noch adaptiv**: Rangfolge und Kampagnenrelevanz beruhen auf manuell gesetzten Gewichten; die Wirkungskette Kampagne → Interaktion → SlangTag/QR → Marketplace ist nicht rekonstruierbar; Skalierungsgrenzen der Signalverarbeitung sind unbekannt; Korrektheit des bereichsübergreifenden Berechtigungsmodells ist nur beispielhaft, nicht systematisch nachgewiesen; die Güte der Audiomoderation für Dialekt/Slang ist nicht quantifiziert.

### Forschungs- und Entwicklungsfrage

Kann ein Signal- und Ereignismodell entwickelt und validiert werden, das (a) organische Rangfolge und Kampagnenauslieferung aus demselben Signalraum adaptiv, rückkopplungsstabil und mehrkriteriell steuert, (b) die Wirkung bereichsübergreifender Interaktionen einschließlich Offline-Einstieg über QR ohne personenbezogene Profilbildung messbar macht, und (c) dabei nachweislich Skalierungs-, Berechtigungs- und Moderationsanforderungen einhält?

### Ziel

Ein technisch überprüfbarer Zustand, in dem Ranking- und Kampagnenparameter datengetrieben statt manuell bestimmt werden, bereichsübergreifende Wirkung als datenschutzkonformes Aggregat auswertbar ist, Skalierungsgrenzen quantifiziert vorliegen, das Sichtbarkeitsmodell automatisiert nachgewiesen wird und Moderationsgüte mit Zahlen belegt ist.

### Entwicklungsarbeit

Offline-Evaluationsrahmen mit Signal-Replay; regularisierte Lernschicht auf `feed_learned_weights`; Pacing und Frequenzdeckelung im Werbekernel; domänenübergreifendes Ereignis-/Aggregationsmodell mit Mindestfallzahlunterdrückung; signierte, personenfreie QR-Platzierungsparameter mit Aggregatzählung; Vorberechnungs-/Invalidierungsvarianten für Ranking-Scores; generative Prüfmatrix für Sichtbarkeitsregeln; annotierter Audiokorpus und Schwellenkalibrierung.

### Technische Risiken

Rückkopplungsdrift der Lernschicht; unzureichende Trennschärfe der Attribution bei kleinen Fallzahlen; Datenschutzkonflikt zwischen Aussagekraft und Anonymität; Vorberechnung verschlechtert Aktualität unzumutbar; QR-Zählung manipulierbar; Audiomoderation erreicht bei Dialekt keine ausreichende Recall-Rate; Kostenprofil der KI-Aufrufe skaliert nicht.

### Lösungsansätze zur prototypischen Validierung

Replay- und Simulationsumgebung statt Live-Experiment als Erstinstanz; gedämpfte Gewichtsanpassung mit Ober-/Untergrenzen; k-anonyme Kohorten- und Zeitfensteraggregate mit Schwellenunterdrückung; signierte Parameter mit serverseitiger Deduplizierung analog `increment_campaign_metric`; Vergleich On-Request vs. inkrementell vorberechnet unter definierten Aktualitätsbudgets; eigenschaftsbasierte Policy-Tests; Referenzkorpus mit Kategorien- und Sprachschnitt.

### Ergebnis

Prototypisch validierte Erweiterung der bestehenden Plattform mit dokumentierten Messgrößen: Ranking-Varianten mit belegter Wirkung, Attributionsschicht mit Genauigkeits- und Grenzangabe, Skalierungsmodell mit Grenzwerten, automatisierter Sichtbarkeitsnachweis, quantifizierte Moderationsgüte, Kostenkennzahlen pro 1.000 Interaktionen.

---

## 6. Projektziele

| Nr. | Ziel | Überprüfbares Kriterium |
| --- | --- | --- |
| Z1 | Datengetriebene Ranking-Parameter | Offline-Replay reproduziert Ranking-Varianten; Wirkung je Kennzahl dokumentiert |
| Z2 | Rückkopplungsstabile Lernschicht | Gewichtsverläufe bleiben in definierten Grenzen; Neu-Creator-Abdeckung sinkt nicht unter definierten Schwellwert |
| Z3 | Gerechte Kampagnenauslieferung | Budgetausschöpfung je Kampagne innerhalb definierter Abweichung bei eingehaltener Frequenzdeckelung |
| Z4 | Bereichsübergreifende Wirkungsmessung | Aggregatbericht Kampagne → Interaktion → SlangTag/QR → Marketplace mit dokumentierter Mindestfallzahl |
| Z5 | Personenfreier Offline-Einstieg | Nachweis, dass Scan-Aggregate keinen Einzelpersonenrückschluss zulassen |
| Z6 | Quantifiziertes Skalierungsverhalten | Messreihen über mehrere Signalvolumina mit Latenz-/Kostenkurve und Architekturentscheidung |
| Z7 | Nachgewiesenes Sichtbarkeitsmodell | generierte Prüfmatrix deckt Rollen-/Zustandskombinationen ab; Abweichungen dokumentiert und behoben |
| Z8 | Belegte Moderationsgüte | Precision/Recall je Kategorie und Sprache auf dem Referenzkorpus |

---

## 7. Arbeitspakete

### AP1 – Messgrundlage und Evaluationsrahmen

- **Ziel:** reproduzierbare Bewertung von Ranking- und Auslieferungsvarianten.
- **Ausgangspunkt:** `feed_signals`, `interaction_events`, `feed_score_cache`, `engine.server.ts`; keine Evaluationsschicht vorhanden.
- **Fragestellung:** Welche Kennzahlen erfassen Relevanz, Vielfalt und Neuheitsabdeckung gleichzeitig ohne Live-Eingriff?
- **Arbeit:** Signal-Replay, Kennzahlendefinition, deterministische Wiederholbarkeit, Datensparsamkeit im Replay-Datensatz.
- **Risiken:** historische Signale nicht repräsentativ; Replay verzerrt durch fehlende Nichtgesehen-Information.
- **Validierung:** identische Eingaben ergeben identische Kennzahlen; Sensitivitätsprüfung gegen Gewichtsänderungen.
- **Ergebnis:** Evaluationsrahmen als Voraussetzung für AP2–AP4.

### AP2 – Adaptive, rückkopplungsstabile Ranking-Schicht

- **Ziel:** Ersetzen manueller Gewichte durch gedämpft gelernte Gewichte.
- **Ausgangspunkt:** `FEED_WEIGHTS`, `learning.ts` (67 Zeilen), `feed_learned_weights`, `diversity.ts`.
- **Fragestellung:** Wie werden Gewichte angepasst, ohne Selbstverstärkung und Sichtbarkeitskollaps neuer Inhalte?
- **Arbeit:** Regularisierung, Grenzwerte, Explorationssteuerung, Kopplung an Diversity-Layer, Rollback-Pfad auf statische Gewichte.
- **Risiken:** Drift, Überanpassung an Vielnutzer, Verschlechterung der Vielfalt.
- **Validierung:** AP1-Kennzahlen im Replay; anschließend kontrollierte Variantenschaltung mit Abbruchkriterien.
- **Ergebnis:** validierte oder begründet verworfene Lernschicht mit dokumentierten Grenzen.

### AP3 – Kampagnenauslieferung: Pacing, Frequenz, Verdrängungsmessung

- **Ziel:** budgetgerechte, frequenzbegrenzte Auslieferung im organischen Feed.
- **Ausgangspunkt:** `ad-plan.server.ts`, `ads/campaign-provider.server.ts`, `scoreCampaign`, `ad_pauses`.
- **Fragestellung:** Wie lassen sich Budgetausschöpfung, Relevanzgewichtung und Frequenzdeckelung gleichzeitig einhalten, ohne organische Vielfalt zu verdrängen?
- **Arbeit:** Pacing-Verfahren, personenbezogenlose Frequenzdeckelung, Simulation von Auslieferungsverläufen, Messung der Verdrängung.
- **Risiken:** Pacing kollidiert mit serverseitigem Zufall und Cache; Fairnessziele widersprechen Relevanzzielen.
- **Validierung:** Simulationsläufe mit synthetischen Kampagnensätzen; Abweichung Budget/Ist dokumentiert.
- **Ergebnis:** Auslieferungsverfahren mit dokumentierten Kapazitätsgrenzen.

### AP4 – Bereichsübergreifende, datenschutzkonforme Attribution inkl. QR

- **Ziel:** auswertbare Wirkungskette ohne Personenprofil.
- **Ausgangspunkt:** `increment_campaign_metric`, `ad_campaign_event_guard`, `market_analytics_events`, `slangtag-qr.ts`.
- **Fragestellung:** Welches Aggregationsmodell liefert belastbare Aussagen bei kleinen Fallzahlen und ohne Einzelrückschluss?
- **Arbeit:** Ereignismodell über Domänen, signierte QR-Platzierungsparameter, Aggregatzählung mit Mindestfallzahlunterdrückung, Manipulationsschutz, Reportingaggregate.
- **Risiken:** Aussagekraft zu gering; Datenschutzprüfung verwirft Modell; Missbrauch der QR-Zählung.
- **Validierung:** synthetische Wirkungsketten mit bekannter Grundwahrheit; Re-Identifikationsversuche gegen die Aggregate; Missbrauchsszenarien.
- **Ergebnis:** Attributionsprototyp mit Genauigkeits- und Grenzdokumentation.

### AP5 – Skalierung, Kosten und Aktualität

- **Ziel:** quantifizierte Skalierungsgrenzen und begründete Architekturentscheidung.
- **Ausgangspunkt:** 750-VU-Lasttest, `feed_score_cache`, SSR-Cache 92 %, 343 Indizes, Worker-Runtime-Beschränkungen.
- **Fragestellung:** Ab welchem Signal-/Nutzervolumen ist inkrementelle Vorberechnung nötig, und welcher Aktualitätsverlust entsteht?
- **Arbeit:** synthetische Signalvolumina, Vergleichsmessung On-Request vs. vorberechnet, Cache-Invalidierungsstrategien, Kostenmodell inkl. KI-/Medienkosten.
- **Risiken:** Vorberechnung verschlechtert Live-Charakter; Testumgebung ohne isolierten Datenbestand verfälscht Messung.
- **Validierung:** Messreihen mit Latenz-p95, Trefferquoten, Kosten pro 1.000 Feed-Abrufe.
- **Ergebnis:** Skalierungsmodell mit Grenzwerten und Entscheidungsgrundlage.

### AP6 – Nachweis von Sichtbarkeitsmodell und Moderationsgüte

- **Ziel:** systematischer Korrektheits- und Gütenachweis.
- **Ausgangspunkt:** 299 Policies, 126 `SECURITY DEFINER`-Funktionen, `content-moderation.server.ts`, Vertragstests.
- **Fragestellung:** Wie wird Policy-Korrektheit generativ nachgewiesen, und welche Fehlerraten erreicht die Audioprüfung bei Dialekt/Slang?
- **Arbeit:** Sichtbarkeitsspezifikation, generierte Prüfmatrix, Abweichungsanalyse; annotierter Audiokorpus, Precision/Recall je Kategorie/Sprache, Schwellenkalibrierung, Drift-Prüfung.
- **Risiken:** Zustandsraum zu groß für vollständige Abdeckung; Korpusaufbau rechtlich/aufwandsseitig begrenzt; Modellwechsel invalidiert Kalibrierung.
- **Validierung:** Prüfmatrix im CI; Gütekennzahlen gegen Korpus; Wiederholmessung nach Modellwechsel.
- **Ergebnis:** automatisierter Sichtbarkeitsnachweis und dokumentierte Moderationsgüte.

**Abhängigkeiten:** AP1 → AP2, AP3, AP4; AP2/AP3 → AP5; AP6 begleitend, mit Abschlussmessung nach AP4.

---

## 8. Technische Risiken (Gesamtsicht)

| Risiko | Auswirkung | Erkennung | Umgang |
| --- | --- | --- | --- |
| Rückkopplungsdrift der Lernschicht | Vielfalt und Neu-Creator-Sichtbarkeit sinken | AP1-Kennzahlen, Gewichtsverläufe | Grenzwerte, Dämpfung, Rückfall auf statische `FEED_WEIGHTS` |
| Attribution ohne Trennschärfe | Kampagnenwirkung nicht belegbar | Grundwahrheitstests in AP4 | Mindestfallzahlen, längere Zeitfenster, Ergebnis ggf. als negatives Wissen dokumentieren |
| Datenschutzkonflikt | Modell nicht einsetzbar | Re-Identifikationsversuche | Aggregation, Schwellenunterdrückung, Verzicht auf Einzelereignisspeicherung |
| Vorberechnung verschlechtert Aktualität | Live-Charakter des Feeds verloren | Latenz-/Aktualitätsmessung AP5 | Hybridmodell, Aktualitätsbudget als harte Grenze |
| Manipulation der QR-/Kampagnenzähler | verfälschte Auswertung | Anomalieprüfung, Guard-Tabellen | signierte Parameter, serverseitige Deduplizierung, Ratenbegrenzung |
| Unzureichender Recall der Audiomoderation | Rechtsrisiko | Korpusmessung AP6 | Schwellenabsenkung mit Eskalation in manuelle Prüfung |
| Kostenanstieg KI/Medien | Betrieb unwirtschaftlich | Kostenkennzahlen AP5/U8 | Caching, Bündelung, Kontingente |
| Fehlender isolierter Testdatenbestand | Messergebnisse nicht belastbar | Abweichung Staging/Production | eigener synthetischer Datenbestand für Lastversuche |

---

## 9. Validierungsstrategie

1. **Ebene Logik:** Unit-/Eigenschaftstests im bestehenden Rahmen (aktuell 591 Tests, 32 Dateien) – für neue Ranking-, Pacing-, Aggregations- und Signaturlogik verpflichtend.
2. **Ebene Datenbank/Berechtigung:** Integrationstests gegen die reale Datenbank (`tests/integration/*`, heute 9 Dateien) plus generierte Prüfmatrix aus AP6.
3. **Ebene Ende-zu-Ende:** Playwright-Suiten (`tests/e2e/*`, heute 5) für Kampagnen-, QR- und Marketplace-Strecken.
4. **Ebene Offline-Evaluation:** Replay historischer Signale mit definierten Kennzahlen (AP1) – Voraussetzung jeder Ranking-Änderung.
5. **Ebene Simulation:** synthetische Kampagnen- und Wirkungsketten mit bekannter Grundwahrheit (AP3, AP4).
6. **Ebene Last:** Messreihen über mehrere Signalvolumina, Referenz ist der bestehende 750-VU-Lauf (366 RPS, p95 45 ms).
7. **Ebene Betrieb:** bestehende Observability (`ops_events`, `ops_incidents`, Alarmkanal, 5-Minuten-Health-Zeitplan) als Beobachtungsinstanz während kontrollierter Variantenschaltung.
8. **Ebene Datenschutz:** dokumentierte Re-Identifikationsversuche gegen alle neuen Aggregate; Ergebnis fließt in `docs/DATENSCHUTZ_TECHNIK.md` und `docs/VERARBEITUNGSVERZEICHNIS_TECHNISCH.md`.

Negative Ergebnisse (z. B. Lernschicht nicht stabilisierbar, Attribution ohne Trennschärfe) gelten als gültiges Projektergebnis und werden als technisches Wissen dokumentiert.

---

## 10. Bereits umgesetzt vs. zukünftige Entwicklung

| Bereich | Bereits umgesetzt | Noch zu entwickeln | FuE-Relevanz |
| --- | --- | --- | --- |
| Frontend / Routing | 68 Routendateien (17 geschützt, 19 Admin, 8 öffentliche API), öffentliche/authentifizierte Trennung, DE/EN/EL, Geo-Sprachwahl | Oberflächen für Auswertung/Reporting | keine (reguläre Entwicklung) |
| Serverschicht | 37 RPC-Module, 60 Servermodule, öffentliche API-Routen mit eigener Prüfung | Reporting-/Export-Schnittstelle für Kampagnendaten | mittel (Aggregationsmodell) |
| Datenbank | 122 Tabellen, 231 Migrationen, 343 Indizes, 136 Trigger | domänenübergreifendes Ereignis-/Aggregatmodell | hoch |
| Auth / Rollen | `user_roles` + `has_role()`, Rollentrennung, CAPTCHA fail-closed | – | keine |
| RLS / Sicherheit | RLS auf 122 Tabellen, 299 Policies, 126 `SECURITY DEFINER`, Vertragstests | generativer Korrektheitsnachweis über Rollen-/Zustandsmatrix | hoch |
| Feed / Ranking | 11 Faktoren, Diversity-Layer, Exploration 12 %, Score-Cache, Keyset-Pagination | Offline-Evaluation, regularisiertes Lernen, Vorberechnungsvariante | hoch |
| Interest Engine | Punktemodell, Verweildauer, Zeitabbau, Konfidenz, Connection-Einfluss | empirische Kalibrierung der Parameter | hoch |
| Community-Funktionen | Beiträge, Kommentare, Likes, Connections, Channels, Arena, Globe | – | keine |
| Creator-Funktionen | Eligibility, Grants, Abos, exklusive Drops | Wirkungsmessung von Drops/Abos auf Interaktion | mittel |
| Unternehmensfunktionen | Onboarding, Tarife, Kampagneneditor, Limits | Auswertung/Reporting je Kampagne | mittel |
| Kampagnenausspielung | Slotplanung, Providerregistry, Gewichtsrelevanz, Pausen, Testmodus, AdSense-Adapter (deaktiviert) | Pacing, Frequenzdeckelung, Verdrängungsmessung | hoch |
| Impressionen / Klicks | serverseitige, stundenweise deduplizierte Zähler | Zeitreihen, Kohorten, Uplift-Messung | hoch |
| Analytics | Marketplace-Ereignisse, Interaktionsereignisse, Zählertrigger | bereichsübergreifende Attribution mit Datenschutzschranken | hoch |
| QR / SlangTag-Offline | deterministischer Deep Link aus SlangTag-ID | signierte Platzierungsparameter, personenfreie Aggregatzählung | hoch |
| SlangTag-System | Audio 1–5 s, Platzierung, Reihenfolge, Typen, Grants, Transkription, Moderationsstatus, Definitionen | Qualitätsmodell für SlangTag-Signale, Audiomoderationsgüte | hoch |
| Messenger | Realtime, Mitgliederprüfung in der DB, SlangTags im Chat, Push-Bündelung | – | keine |
| Übersetzung | Beitrag/Kommentar/Nachricht, Persistenz, Kontingente, Fallbacks | Bedeutungserhalt bei Slang, Kostenkennzahl | mittel |
| Marketplace | Artikel, Angebote, Transaktionen, Webhooks (Signatur + Idempotenz), Gebühren, Streitfälle | Verknüpfung mit Kampagnenwirkung | hoch |
| Profile | Nutzer- und Verkäuferprofile, Sichtbarkeitsstufen, Präsenzstatus | – | keine |
| Moderation | serverseitige Vorabprüfung, Mehrmodell-Bildprüfung, Meldungen, Maßnahmen, Widerspruch, DSA-Transparenz, Audit-Log | quantifizierte Güte, Schwellenkalibrierung, Drift-Prüfung | hoch |
| Benachrichtigungen | Push mit Bündelung, Cooldowns, Deep Links, Jobtabellen | – | keine |
| Medienpipeline | Client- und Servervarianten, ISO-BMFF-Videometadaten, CDN-Cache | Kostenmodell unter Wachstum | mittel |
| Betrieb / Observability | `ops_events`/`ops_incidents`, Alarmkanal, Health-Zeitplan, Runbooks | Beobachtung kontrollierter Variantenschaltung | mittel |
| Tests | 591 Unit, 9 DB-Integration, 5 E2E-Suiten | Replay-, Simulations- und Matrixtests | hoch |
| Skalierung | 750 VU, 366 RPS, p95 45 ms, SSR-Cache 92 % | Messreihen höherer Volumina, Architekturentscheidung | hoch |

---

## 11. Technische Alleinstellungsmerkmale (nur nachweisbar)

Keine Aussage über weltweite Einzigartigkeit. Verglichen wird gegen den üblichen technischen Aufbau vergleichbarer Systeme.

### M1 SlangTag als bereichsübergreifende Erstklassen-Entität

- **Übliche Lösung:** Audio ist Anhang eines Beitrags oder Bibliothekselement (Sound-Bibliothek); Berechtigung und Monetarisierung hängen am Beitrag oder am Konto.
- **Y-Dude:** eine Entität (`slang_tags`) wirkt gleichzeitig als Inhalt, Ranking-Signal, Zugangsobjekt (`slang_tag_grants`, `slang_tag_drops`), Kampagnenbindung (`ad_campaigns.slang_tag_id`), Marketplace-Attribut (`market_item_slang_tags`), Chatobjekt (`chat_slang_tags`) und Offline-Anker (QR).
- **Unterschied:** ein Datenmodell und ein Berechtigungspfad statt mehrerer paralleler Subsysteme.
- **Vorteil:** Signale und Rechte müssen nicht zwischen Subsystemen synchronisiert werden.
- **Aufwand:** hoch – Ursache der Policy-Komplexität (299 Policies) und Gegenstand von AP6.

### M2 Gemeinsamer Signalraum für organische und werbliche Auslieferung

- **Übliche Lösung:** getrennter Ad-Server mit eigenem Zielgruppen- und Profilmodell neben der Feed-Engine.
- **Y-Dude:** Werbekernel entscheidet Position, Kampagnenrelevanz nutzt dieselben Signale wie das organische Ranking (`ads/campaign-ranking.shared.ts` auf Basis von `interest_confidence`/`user_interests`, Sozialgraph, SlangTag-Besitz), Relevanz als Gewicht statt Filter.
- **Unterschied:** keine zweite Feed-Engine, keine separate Profilhaltung für Werbezwecke.
- **Vorteil:** weniger Datenhaltung, konsistentes Nutzererlebnis, geringere Datenschutzoberfläche.
- **Aufwand:** mittel umgesetzt, hoch in der Absicherung (Pacing/Fairness, AP3).

### M3 Moderationszwang durch Rechteentzug in der Datenbank

- **Übliche Lösung:** Moderation als nachgelagerter Prozess oder Anwendungsschicht, die theoretisch umgangen werden kann.
- **Y-Dude:** `INSERT`/`UPDATE` auf `posts` ist der Rolle `authenticated` entzogen; Veröffentlichung ist ausschließlich über den serverseitigen Moderationspfad möglich.
- **Unterschied:** Durchsetzung auf Datenbankebene statt in der Anwendung.
- **Vorteil:** kein Umgehen über direkte API-Aufrufe.
- **Aufwand:** mittel; Auswirkung auf alle Schreibpfade.

### M4 Sichtbarkeitsentscheidungen als Datenbankfunktionen

- **Übliche Lösung:** Sichtbarkeitslogik im Anwendungscode, Datenbank liefert Rohdaten.
- **Y-Dude:** `can_view_post`, `can_view_profile`, `is_conversation_member`, `are_connected` als `SECURITY DEFINER`-Funktionen, in Policies verwendet; `anon` gezielt entzogen.
- **Unterschied:** eine Wahrheitsquelle für alle Zugriffswege (SSR, Client, Realtime, Serverfunktionen).
- **Vorteil:** konsistente Sichtbarkeit über alle Kanäle.
- **Aufwand:** hoch; kombinatorische Prüfbarkeit ist offen (AP6).

### M5 Kampagnenmessung ohne Verhaltensspeicherung

- **Übliche Lösung:** Ereignis-Logging pro Nutzer und Impression, spätere Aggregation.
- **Y-Dude:** `increment_campaign_metric` prüft Ereignisart, Kampagnenstatus, Umgebung und Zeitfenster und lässt je Person/Kampagne/Art/Stunde genau ein gezähltes Ereignis zu; gespeichert werden nur Zählerstände.
- **Unterschied:** Datenminimierung als Systemeigenschaft, nicht als Nachbearbeitung.
- **Vorteil:** geringes Datenschutzrisiko.
- **Nachteil und FuE-Anknüpfung:** dadurch fehlt jede Auswertungstiefe – genau das adressiert AP4.

### M6 Medienpipeline unter Edge-Runtime-Beschränkungen

- **Übliche Lösung:** serverseitige Bild-/Videoverarbeitung mit `sharp`/`ffmpeg` auf einem Node-Host.
- **Y-Dude:** Varianten im Browser plus Speicher-Transformation als Backstop; Videomaße/-rotation durch eigene ISO-BMFF-Auswertung (`tkhd` v0=24 / v1=36) statt Medienbibliothek.
- **Unterschied:** Verarbeitung ohne native Abhängigkeiten.
- **Vorteil:** Lauffähigkeit im Edge-Runtime, keine Medien-Serverflotte.
- **Aufwand:** mittel-hoch; Kostenverhalten unter Wachstum offen (AP5).

---

## 12. Stand der Technik

| Plattformtyp | Typischer technischer Aufbau | Verhältnis zu Y-Dude |
| --- | --- | --- |
| Klassische Social-Media-Plattformen | ML-basiertes Ranking auf Feature-Stores, getrennte Ad-Serving-Infrastruktur, umfangreiche Verhaltensprofile | Y-Dude nutzt regelbasiertes, konfigurierbares Ranking mit Diversity-Layer und **ohne** separaten Ad-Stack; Reifegrad des Rankings ist geringer, die Kopplung an das Werbesystem enger und datenärmer |
| Creator-Plattformen | Abomodell + Paywall auf Beitragsebene, Zahlungsabwicklung, Bibliotheken | Y-Dude bindet Zugang an eine Audio-Entität (Grants/Drops), nicht an den Beitrag; damit ist derselbe Inhaltstyp gleichzeitig frei, freischaltbar und kampagnengebunden |
| Community-Plattformen | Foren-/Gruppenstruktur, rollenbasierte Rechte pro Gruppe | Y-Dude setzt Rechte über eine zentrale Rollenquelle und DB-Funktionen für alle Bereiche durch, nicht pro Gruppe |
| Social-Commerce-Plattformen | Shop-Modul neben Feed, Verknüpfung über Produkt-Links | Y-Dude verknüpft Marketplace-Objekte über SlangTags/Channels/Kampagnen im gemeinsamen Schema (`market_item_slang_tags`, `market_ad_campaigns`) |
| Marketing-/Campaign-Plattformen | Kampagnenmanagement mit Pacing, Frequency Capping, Attributionsmodellen, Reporting-APIs | genau diese Ebenen fehlen bei Y-Dude (Pacing, Capping, Attribution, Reporting) – deshalb AP3/AP4; vorhanden sind Slotlogik, Relevanzgewichte und deduplizierte Zähler |
| Messenger | Ende-zu-Ende- oder serverseitig verschlüsselte Zustellung, Gruppenverwaltung | Y-Dude nutzt Mitgliederprüfung in der Datenbank und Realtime; zusätzlich SlangTags und Inline-Übersetzung im Chat |
| Marketplace-Systeme | Bestell-/Zahlungsabwicklung, Streitfallverwaltung, Gebührenlogik | technisch vergleichbar umgesetzt; Unterscheidungsmerkmal ist die Verknüpfung mit sozialen Signalen |

**Ehrliche Einordnung:** Die Kombination mehrerer Funktionsbereiche in einer Anwendung ist als solche kein technischer Neuheitswert. Entwicklungsleistung entsteht dort, wo die Bereiche **denselben Datenraum und dasselbe Berechtigungssystem teilen** – konkret: ein Signalraum für organische und werbliche Auslieferung (M2), eine bereichsübergreifende Entität mit gestaffelten Zugriffsrechten (M1), Sichtbarkeit als einzige Wahrheitsquelle in der Datenbank (M4) und Messung unter bewusster Datenminimierung (M5). Genau an diesen Punkten liegen auch die ungelösten Fragen.

---

## 13. FuE-Logik (Kernkette)

| Problem | Technische Unsicherheit | FuE-Arbeit | Technische Validierung | Neues technisches Wissen | Prototyp / verbesserte Plattform |
| --- | --- | --- | --- | --- | --- |
| Ranking-Gewichte manuell gesetzt (`FEED_WEIGHTS`) | Rückkopplung Ranking ↔ Interaktion; Zielkonflikt Relevanz/Vielfalt/Neuheit | AP1 Evaluationsrahmen, AP2 regularisierte Lernschicht | Replay mit festen Kennzahlen; kontrollierte Variante mit Abbruchkriterien | Wirkungszusammenhang Gewicht → Relevanz/Vielfalt/Neu-Creator-Abdeckung; Stabilitätsgrenzen | adaptives Ranking mit Rückfallpfad |
| Kampagnen ohne Pacing/Capping im organischen Feed | Fairness vs. Relevanz vs. Verdrängung bei randomisierter Slotvergabe | AP3 Pacing, personenfreie Frequenzdeckelung, Verdrängungsmessung | Simulation mit synthetischen Kampagnensätzen | Kapazitätsgrenzen (Kampagnen je Feed, Budgetgenauigkeit) | steuerbare Kampagnenauslieferung |
| Wirkung nur als zwei Zähler messbar | Attribution über Domänen ohne Personenprofil; kleine Fallzahlen | AP4 Ereignis-/Aggregatmodell, signierte QR-Parameter | Grundwahrheitstests, Re-Identifikationsversuche, Missbrauchsszenarien | belegte Genauigkeits- und Datenschutzgrenzen der Aggregatattribution | Attributionsschicht + Kampagnenbericht |
| Skalierungsverhalten unbekannt jenseits 750 VU | Kosten Nutzer × Kandidaten × Signale vs. Aktualität | AP5 Messreihen, Vorberechnungsvarianten | Latenz-/Kosten-/Trefferquotenkurven | Schwellwert, ab dem Vorberechnung nötig ist, und dessen Aktualitätspreis | dokumentiertes Skalierungsmodell |
| Policy-Korrektheit nur beispielhaft geprüft | kombinatorischer Zustandsraum Rolle × Sichtbarkeit × Abo × Grant × Status | AP6 Spezifikation + generierte Prüfmatrix | Matrix im CI, Abweichungsanalyse gegen 299 Policies | systematisch geprüftes Sichtbarkeitsmodell, erkannte Regelkonflikte | automatisierter Sichtbarkeitsnachweis |
| Audiomoderation für Dialekt/Slang ohne Kennzahlen | Übersperrung vs. Unterblockung, Modell-Drift | AP6 Referenzkorpus, Schwellenkalibrierung | Precision/Recall je Kategorie/Sprache, Wiederholmessung nach Modellwechsel | quantifizierte Güte und kalibrierte Schwellen | versionierte, belegte Moderationskonfiguration |

---

## 14. Erwartete technische Ergebnisse

1. Offline-Evaluationsrahmen mit Signal-Replay und definierten Kennzahlen (reproduzierbar, im CI ausführbar).
2. Adaptive Ranking-Schicht mit dokumentierten Stabilitätsgrenzen – oder belegte Aussage, dass die Lernschicht unter diesen Bedingungen nicht stabilisierbar ist.
3. Kampagnenauslieferung mit Pacing und Frequenzdeckelung, inklusive gemessener Budgetgenauigkeit und Verdrängungswirkung.
4. Prototyp einer bereichsübergreifenden Attributionsschicht mit Genauigkeitsangabe, Mindestfallzahlregel und dokumentiertem Re-Identifikationsschutz.
5. Messbarer, personenfreier Offline-Einstieg über signierte QR-Platzierungsparameter.
6. Skalierungsmodell mit Latenz-, Kosten- und Aktualitätskurven über mehrere Signalvolumina und einer begründeten Architekturentscheidung.
7. Automatisierte Prüfmatrix für das Sichtbarkeitsmodell über Rollen-/Zustandskombinationen.
8. Quantifizierte Moderationsgüte (Precision/Recall je Kategorie und Sprache) mit kalibrierten, versionierten Schwellenwerten.
9. Kostenkennzahlen pro 1.000 Interaktionen für KI-Nutzung (Moderation, Übersetzung, Transkription) und Medienauslieferung.
10. Fortgeschriebene technische Dokumentation inkl. Datenschutzbewertung der neuen Aggregate.

---

## 15. Fehlende Informationen für den Förderantrag

Aus dem System **nicht** feststellbar; muss vom Unternehmen ergänzt werden:

**Unternehmen und Organisation**
- Gründungsdatum, Rechtsform, Sitz (Berlin-Bezug für IBB), Handelsregisterdaten
- Unternehmensgröße, KMU-Status, Beteiligungsverhältnisse
- Betriebsstätte in Berlin und Nachweisform

**Ressourcen und Kosten**
- bisherige Entwicklungsaufwendungen (Stunden, Personen, aktivierte Kosten)
- vorhandene Entwicklerkapazitäten und Qualifikationen
- geplante Personalkosten je Arbeitspaket, Stundensätze, Vollzeitäquivalente
- geplante Projektlaufzeit, Start-/Endtermin, Meilensteintermine
- bereits angefallene Projektkosten und Abgrenzung zum Förderzeitraum (Vorhabenbeginn!)
- geplante Investitionen (Infrastruktur, Testumgebungen, Datenerhebung/Annotation)
- externe Entwicklungs-, Beratungs- oder Forschungsleistungen (Auftragsforschung, Kooperationspartner)
- Finanzierungsbedarf, Eigenmittelanteil, Liquiditätsplanung, weitere Förderungen/De-minimis

**Markt und Schutzrechte**
- Markt- und Wettbewerbsanalyse, Zielkunden (Community, Creator, Unternehmen), Preismodell-Validierung
- Umsatz-/Nutzerplanung und Annahmen
- Patente, Marken, Gebrauchsmuster, Schutzrechtsstrategie, Rechteinhaberschaft am Code
- Verwertungs- und Markteinführungsplan nach Projektende

**Rechtliches und Betrieb (nur teilweise dokumentiert)**
- Auftragsverarbeitungsverträge mit eingesetzten Dienstleistern (KI-Gateway, Zahlungsdienst, Hosting/Backend, Push)
- Datenschutz-Folgenabschätzung für die geplante Attributionsschicht
- Nutzerzahlen und reale Nutzungsdaten (aus dem Code nicht ableitbar)
- Versicherungs-, Haftungs- und Compliance-Nachweise (DSA-Rolle und -Einordnung)

---

### Quellenhinweis

Alle Ist-Angaben stammen aus dem Repository (Stand 05.09.2026) und aus read-only-Abfragen des Produktivschemas (`pg_tables`, `pg_policies`, `pg_proc`, `pg_trigger`, `pg_indexes`, `pg_type`) sowie aus dem Testlauf `bunx vitest run` (591 Tests, 32 Dateien, grün). Ergänzende Dokumente: `docs/Y-DUDE_TECHNICAL_ASSESSMENT_2026-08-26.md`, `docs/Y-DUDE_PRODUCTION_LOADTEST_750_USERS_2026-08-30.json`, `docs/TESTING.md`, `docs/PHASE3_OBSERVABILITY_2026-08-26.md`, `docs/SECURITY_AUDIT_RLS_PUBLIC_POLICIES_2026-08-29.md`, `docs/MEDIEN_CDN_CACHE_2026-08-27.md`, `docs/STAGING_SCHEMA_AUDIT_2026-09-02.md`, `docs/IBB_PRO_FIT_TECHNISCHER_AUSZUG_2026-08-28.md`.
