# Y-Dude – Business Campaigns V1: Post-Release Difference Audit

Datum: 2026-08-31 · Umfang: **reine Analyse** (keine Änderung, kein Redeploy, keine Migration, kein Rollback)
Vergleichsbasis: Release-Paket `production-business-campaigns-v1-2026-08-31.tar.gz` (39 Dateien, SHA-256 beim Release geprüft) gegen aktuellen Production-Stand.

## 0. Vollständiger Dateivergleich

Alle 20 Dateien aus `target-production-files/` wurden byteweise gegen Production verglichen.
Ergebnis: **genau 3 Abweichungen**, alle übrigen 17 Dateien sind byte-identisch.

| Datei | Status |
| --- | --- |
| `src/integrations/supabase/types.ts` | abweichend (generiert) |
| `src/lib/admin.shared.ts` | abweichend (Formatierung) |
| `src/lib/business-campaigns.shared.ts` | abweichend (Formatierung) |
| 17 weitere Dateien (u. a. `business-campaigns.server.ts`, `business-campaigns.functions.ts`, `business-campaigns-metrics.server.ts`, `ads/campaign-provider.server.ts`, `ads/campaign-ranking.shared.ts`, `ad-plan.server.ts`, `ad-catalog.shared.ts`, `use-feed-ad-plan.ts`, `FeedCampaignCard.tsx`, `BusinessCampaignsSection.tsx`, `business.tsx`, `dev.tsx`, 4 Testdateien) | identisch |

---

## 1. Abweichung 1 – generierte Typdatei

**DATEI:** `src/integrations/supabase/types.ts`

**RELEASE-VERSION:** 6.159 Zeilen · SHA-256 `1e3333a017b2dbace8609e8d2090a5a79b0dfd255fd33e1862adb9c6a3108dcb`
**PRODUCTION-VERSION:** 6.093 Zeilen · SHA-256 `1e32ea354b8dd762776b62b82b504584c02270c6322374d3c545c959211f1168`

**DIFF (semantisch, 5 Hunks, 85 entfernte / 19 hinzugefügte Zeilen):**

| Hunk | Inhalt | Richtung |
| --- | --- | --- |
| @@4060 / @@4111 / @@4162 | `profiles.is_test_bot` (Row/Insert/Update) | in Production **nicht** vorhanden |
| @@5153 | Tabellen `test_accounts` und `test_bot_settings` (Row/Insert/Update/Relationships) | in Production **nicht** vorhanden |
| @@5508 | Functions `globe_vote_ensure_round`, `globe_vote_week_end` | in Production **zusätzlich** vorhanden |

**Datenbank-Gegenprüfung (lesend, Production):**

- `test_accounts` / `test_bot_settings`: 0 Tabellen vorhanden ✅ (Staging-only Testdaten-Infrastruktur)
- `profiles.is_test_bot`: 0 Spalten vorhanden ✅
- `globe_vote_ensure_round` / `globe_vote_week_end`: 2 Functions vorhanden ✅ (bestehende Slang-Globe-Funktionen, vor diesem Release existent)

**Kampagnen-relevante Typen:** Der Diff enthält **null** Treffer auf `campaign`. Alle Kampagnenobjekte sind in beiden Dateien identisch belegt:
`ad_campaigns` (5/5), `ad_campaign_event_guard` (2/2), `increment_campaign_metric` (1/1), `business_campaign_limit` (1/1), `business_plan_tier` (1/1).
Ebenso unverändert enthalten: Creator-Abo, Creator-Drops, SlangTag-Bibliothek, Market, `user_roles` (26 Treffer).

**Spalten/Datentypen/Enums/Relations/Nullability:** außerhalb der drei genannten Hunks keine Unterschiede — keine geänderten Typen, keine geänderte Nullability, keine geänderten Enum-Werte, keine geänderten Relationships.

**URSACHE:** Die Datei wurde nach der Migration aus dem **tatsächlichen Production-DB-Stand** neu generiert. Das Paket-Artefakt stammt aus Staging, wo zusätzlich Testdaten-Tabellen existieren; Production besitzt dafür zwei Globe-Funktionen, die im Staging-Snapshot des Pakets fehlten.

**FUNKTIONALE AUSWIRKUNG:** keine. Datei enthält ausschließlich TypeScript-Typdeklarationen (kein Laufzeitcode), Kampagnen-Typen identisch.

**SECURITY-AUSWIRKUNG:** keine. Typen erteilen keine Rechte; RLS und Grants werden nicht aus dieser Datei abgeleitet.

**BEWERTUNG:** **A – ausschließlich generiert (DB-Stand-bedingt).**

---

## 2. Abweichung 2 – `src/lib/admin.shared.ts`

**RELEASE-VERSION:** SHA-256 `cfbdc49404777545553c5736afe3aa6cfa85a21d6acef058d6e129bac919ccee`
**PRODUCTION-VERSION:** SHA-256 `6e586f1dfbc6dc58002462eb22c00a1fbcf3f8f46c639355da33be151cf296f3`

**DIFF:** 2 Hunks, ausschließlich Union-Umbruch (Prettier `|`-Leading-Style):

```
-export type AdminUserSort =
-  "recent_activity" | "oldest_activity" | "newest_signup" | "oldest_signup";
+export type AdminUserSort =
+  | "recent_activity"
+  ... (identische 4 Literale, je eigene Zeile)

-export type ReportTargetType =
-  "post" | "slang_tag" | ... | "market_seller";
+  | "post" ... (identische 7 Literale, je eigene Zeile)
```

`diff -u -w -B` zeigt keine inhaltliche Differenz über die Umbrüche hinaus. Die Menge der Union-Literale ist in beiden Versionen exakt identisch (4 bzw. 7).

**URSACHE:** Production-Formatierungsregel (Prettier `printWidth`). Belegt: Production-Version besteht `prettier --check`, Paket-Version wird als `[warn]` beanstandet.

**FUNKTIONALE AUSWIRKUNG:** keine. Reine Typaliase; keine Business-Logik, keine Berechtigungen, kein RLS-Aufruf, kein Tracking, kein Kampagnen-Code.

**SECURITY-AUSWIRKUNG:** keine.

**BEWERTUNG:** **A – ausschließlich Formatierung.**

---

## 3. Abweichung 3 – `src/lib/business-campaigns.shared.ts`

**RELEASE-VERSION:** SHA-256 `191f68afcfc6861dea770d226c32d61285b193bfc4a71e73dc8e240fce71f4ef`
**PRODUCTION-VERSION:** SHA-256 `e28c0f4b79e41b476f0d140180d5fe121501fe29afbc844ab7f86f981b2666a3`

**DIFF:** 1 Hunk, Zeilen 44–50, ausschließlich Union-Umbruch:

```
 export type CampaignCtaTarget =
-  { kind: "listen" } | { kind: "slangtag"; name: string } | { kind: "profile"; username: string };
+  | { kind: "listen" }
+  | { kind: "slangtag"; name: string }
+  | { kind: "profile"; username: string };
```

**Gezielt geprüfte Bereiche – alle unverändert (byte-identisch außerhalb des Hunks):**

| Bereich | Ergebnis |
| --- | --- |
| Kampagnenlimit (`CAMPAIGN_LIMITS` free 0 / business 2 / business_pro 5, `campaignLimitFor`) | unverändert |
| Subscription-/Rollenprüfung (nur Typen; Logik liegt in `.server.ts`, identisch) | unverändert |
| SlangTag-Eigentum / Drop-Eigentum (`slangTagId`, `slangTagDropId`, Fehlercodes `slang_tag_not_owned`, `slang_tag_drop_not_owned`) | unverändert |
| CTA (`CAMPAIGN_CTAS`, `isCampaignCta`, `campaignCtaTarget` inkl. Null-Fälle) | unverändert |
| Tracking (`CAMPAIGN_EVENT_KINDS`, `isCampaignEventKind`, `isUuid`) | unverändert |
| Status / Zeitfenster (`CAMPAIGN_STATUSES`, `validateCampaignWindow`, `isCampaignServable`) | unverändert |
| Error Handling (`campaignErrorFrom`, `CampaignErrorCode`) | unverändert |
| Feed-Ausspielung / Ranking (`ads/campaign-provider.server.ts`, `campaign-ranking.shared.ts`, `ad-plan.server.ts`) | Dateien byte-identisch |

**URSACHE:** Production-Formatierungsregel (Prettier). Production-Version besteht `prettier --check`, Paket-Version nicht.

**FUNKTIONALE AUSWIRKUNG:** keine. Der geänderte Ausdruck ist ein Typalias; die drei Varianten sind identisch, TypeScript-semantisch deckungsgleich.

**SECURITY-AUSWIRKUNG:** keine.

**BEWERTUNG:** **A – ausschließlich Formatierung.**

---

## 4. Hash-Übersicht

| Datei | Release-SHA-256 | Production-SHA-256 | Abweichung |
| --- | --- | --- | --- |
| `src/integrations/supabase/types.ts` | `1e3333a0…08dcb` | `1e32ea35…f1168` | ja (generiert) |
| `src/lib/admin.shared.ts` | `cfbdc494…9ccee` | `6e586f1d…f296f3` | ja (Formatierung) |
| `src/lib/business-campaigns.shared.ts` | `191f68af…1f4ef` | `e28c0f4b…2666a3` | ja (Formatierung) |
| 17 weitere Paketdateien | — | — | nein (identisch) |

---

## 5. Release-Scope

Der Vergleich über **alle** Paketdateien zeigt Abweichungen nur in den drei genannten Dateien. Nicht berührt:

- Creator-Abo, Creator-SlangTags, Creator-Drops, SlangTag Box: keine Quelldatei geändert; Typen in `types.ts` unverändert vorhanden
- Login / Auth, Rollen (`user_roles`, `has_role`), Admin-Logik: keine Änderung (in `admin.shared.ts` nur Typumbruch)
- Bestehender Feed außerhalb Campaigns: `ad-plan.server.ts`, `ad-catalog.shared.ts`, `registry.server.ts`, `use-feed-ad-plan.ts` byte-identisch zum Paket
- Payment-Architektur: nicht berührt

**Ergebnis:** Scope eingehalten.

---

## 6. Security Gate (lesende DB-Prüfung, Production)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Neue `anon`-Rechte auf `ad_campaigns` | keine (`none`) ✅ |
| Neue `PUBLIC`-Rechte auf `ad_campaigns` | keine ✅ |
| `ad_campaign_event_guard` Rechte für `anon`/`authenticated`/`PUBLIC` | keine (`none`) ✅ |
| `increment_campaign_metric` ACL | `postgres=X/postgres,service_role=X/postgres` – nur `service_role` ✅ |
| RLS `ad_campaigns` | aktiv, 8 Policies ✅ |
| RLS `ad_campaign_event_guard` | aktiv ✅ |
| Campaign-Owner-Prüfung | unverändert (Server- und Trigger-Dateien identisch) ✅ |
| SlangTag-Owner-Prüfung | unverändert ✅ |
| Kampagnenlimit | `business_campaign_limit` unverändert (md5 `c2bc76ff…`), Trigger unverändert ✅ |
| Tracking-Schutz | Guard-Tabelle + Stundenfenster unverändert ✅ |
| Zeitfenster-Constraint | `CHECK ((starts_at IS NULL) OR (ends_at IS NULL) OR (ends_at > starts_at))` ✅ |

Keine Security-Regression.

---

## 7. Tests

Keine funktionale Änderung festgestellt → Production-Tests und `bun run verify` wurden **nicht** verändert und nicht erneut angestoßen. Es wurde ausschließlich lesend geprüft (Dateivergleich, `prettier --check`, DB-Katalogabfragen). Kein neuer Code geschrieben.

---

## ABSCHLUSS

🟢 **DIFFERENCES VERIFIED – NO LOGIC CHANGE**

Alle drei Abweichungen sind nachweislich rein technisch: eine aus dem aktuellen Production-DB-Stand neu generierte Typdatei sowie zwei Dateien mit Prettier-Union-Umbrüchen. Keine funktionale, keine sicherheitsrelevante Änderung. Production bleibt unverändert.
