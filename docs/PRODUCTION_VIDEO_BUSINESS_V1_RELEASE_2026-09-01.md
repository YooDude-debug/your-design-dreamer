# Y-Dude Production – Video V1 + Business V1 Release

Datum: 2026-09-01
Paket: `release/production-video-business-v1-2026-09-01-rebased.tar.gz`
SHA-256: `e513f74cdcb42d6ee2ebba17355bbbf631466a8bf3490ab7f41cecf4515dd153`
Baseline: aktueller Production-Stand (Paket auf Basis `cdf7634` **nicht** verwendet)

Status: 🟢 **PRODUCTION VIDEO + BUSINESS V1 RELEASE COMPLETE**

## 1. Gates vor der Migration

| Gate | Ergebnis |
| --- | --- |
| Archiv-SHA-256 | ✅ übereinstimmend |
| `PACKAGE_FILES.sha256` | ✅ 49/49 OK |
| Diff-Gate (14 Rollback-Originale vs. Production) | ✅ byteidentisch, 0 Abweichungen |
| Backup | ✅ `rollback-production-original/` (Source) + Rollback-SQL in `ROLLBACK.md` |
| Migrations-Gate | ✅ `media_video_assets`, `video_processing_status`, `posts.video_kind` fehlten vollständig; Voraussetzungen `set_updated_at()`, `ad_campaigns`, `business_plan_tier()`, `creator_subscriptions` vorhanden |

Keine Abweichung → Freigabe umgesetzt, keine automatische Konfliktauflösung nötig.

## 2. Migrationen (3, in Reihenfolge)

| # | Datei | Ergebnis | Prüfung danach |
| --- | --- | --- | --- |
| 01 | `drizzle/migrations/0023_media_video_assets.sql` | ✅ | Tabelle vorhanden, RLS aktiv, 2 Policies (Owner-SELECT `authenticated`, ALL `service_role`), 4 Indizes, Trigger `media_video_assets_touch`, 4 Check-Constraints |
| 02 | `drizzle/migrations/0024_posts_video_kind.sql` | ✅ | `posts.video_kind` NOT NULL, Default `'shot'`, Constraint `posts_video_kind_check` aktiv |
| 03 | `drizzle/migrations/0025_media_video_assets_revoke_anon.sql` | ✅ | `anon` aus der Tabellen-ACL entfernt; `authenticated` (CRUD) und `service_role` gesetzt |

Keine weitere Migration, keine Wiederholung bestehender Migrationen, keine
zusätzlichen Grants, keine RLS-Änderung außerhalb des Pakets.

Hinweis: Nach Migration 01 stand `anon` durch Datenbank-Standardrechte in der
ACL. Genau das entfernt Migration 03 (Defense in Depth) – Endzustand ist ohne
`anon` und ohne `PUBLIC`.

## 3. Source

23 Zieldateien übernommen (9 neu, 14 gemergt). `src/integrations/supabase/types.ts`
wurde nach den Migrationen neu generiert und ist **byteidentisch** mit der
Paketfassung (Diff: 0 Zeilen).

Erhaltene Production-Fixes (nachgeprüft):

| Fix | Nachweis |
| --- | --- |
| Long-Post-Fix Server | `titleField` in `post-moderation.functions.ts` (3 Treffer) |
| Long-Post-Fix Client | `slice(0, 40)` in `CreatePostDialog.tsx` |
| Aktuelle Rollentrennung | `role-scope.ts` in Betrieb, `role-visibility.ts` nicht vorhanden |
| iPhone Responsive Fix | 22× `min-w-0` in `ProfilePanel.tsx` |
| Aktuelle Signup-UX | `signupEntryCopy` in `auth.tsx` |
| Aktuelle Supabase-Typen | neu generiert, identisch zum Paket |
| Campaign Environment Fix | `getRequest()` in `ad-plan.server.ts` |
| Privilegierter `business_plan_tier`-Pfad | `supabaseAdmin` in `business-campaigns.server.ts` |

Nichts zurückgespielt, nichts überschrieben.

## 4. Security nach der Migration

| Prüfung | Ergebnis |
| --- | --- |
| `media_video_assets` – anon | ✅ keine Rechte (REVOKE wirksam) |
| `media_video_assets` – PUBLIC | ✅ keine PUBLIC-Rechte |
| `media_video_assets` – RLS | ✅ aktiv, Lesen nur Eigentümer, Schreiben nur `service_role` |
| Video-Storage | ✅ Bucket `media` weiterhin privat; Pfadprüfung `isOwnedVideoPath()` serverseitig |
| Business Campaign RLS | ✅ `ad_campaigns` unverändert 8 Policies |
| `business_plan_tier()` | ✅ EXECUTE nur `postgres` + `service_role` |
| `user_roles` | ✅ ACL unverändert (`authenticated` nur SELECT, kein anon) |
| `comments` | ✅ ACL unverändert |
| Creator Subscription | ✅ Policies unverändert |
| Stripe | ✅ keine Konfigurations- oder Logikänderung, keine Secrets ausgegeben |

## 5. Verify

| Prüfung | Ergebnis |
| --- | --- |
| Typecheck (`tsgo --noEmit`) | ✅ fehlerfrei |
| Lint (`eslint src tests`) | ✅ 0 Fehler (29 vorbestehende Warnungen) |
| Unit-Tests | ✅ 552/552 (27 Dateien) |
| DB-Integrationstests | ✅ 68/68 (8 Dateien) |
| Build | ✅ erfolgreich |
| E2E (Playwright) | ✅ 10 bestanden, 1 übersprungen |

Zum E2E-Lauf: der erste Durchlauf zeigte einen Kaltstart-Flake im Feed-Test
(Feed noch im Ladezustand). Einzelwiederholung ✅ und vollständige
Wiederholung ✅ 10/10 – kein Codefehler, keine Änderung vorgenommen.

## 6. Smoke-Test – Video V1

| Fall | Ergebnis |
| --- | --- |
| Composer bietet Video-Upload | ✅ Dateiauswahl mit `video/mp4, video/quicktime, video/x-m4v` |
| Serverseitige Grenzen | ✅ 60 s (+Toleranz), 50 MB, MIME-/Container-/Maß-/Rotationsprüfung, per Unit-Tests abgedeckt |
| Thumbnail & Processing-Status | ✅ Pfadlogik `…__t.webp`, Status-Enum `uploaded/processing/ready/failed` in Betrieb |
| Eigener Videoton | ✅ `videoWithSound`/`videoPoster` im Canvas, Feed-Wiedergabe für `video_kind='post'` |
| Composer/Feed ohne Konsolenfehler | ✅ keine Konsolenfehler beim Öffnen |
| SlangShot unverändert | ✅ `SHORT_VIDEO_MAX_SECONDS = 5`, stumm, Datei nicht Teil des Releases |

Kein echter Video-Upload veröffentlicht – es wurden absichtlich keine
Produktionsdaten erzeugt.

## 7. Smoke-Test – Business V1 (@unternehmer)

| Fall | Ergebnis |
| --- | --- |
| Rolle unabhängig vom Abo | ✅ `user_roles` = `business`, kein Abo aktiv |
| Business-Bereich erreichbar | ✅ `/business` lädt ohne Abo |
| Abo-Auswahl sichtbar | ✅ Business 14,90 €/Monat, Business Pro 39,00 €/Monat (plus Jahresvarianten 149,00 € / 390,00 €) |
| Kampagnen sichtbar, aber deaktiviert | ✅ „Kampagne erstellen“ ist `disabled`, Hinweistext + CTA „Business-Abo wählen“ |
| „Später entscheiden“ / Konto unberührt | ✅ „Dein Unternehmerkonto bleibt davon unberührt“, volle Nutzung ohne Abo |
| Limits | ✅ Business = 2, Business Pro = 5 (Client-Gate + DB-Trigger `enforce_business_campaign_limit()` autoritativ) |

Rollenprüfung Testaccounts: @community = keine Rolle, @creator = `creator`,
@unternehmer = `business`.

## 8. Creator

Creator-Bereich, Creator-SlangTags und Creator-Abo waren nicht Teil des
Releases (`creator.tsx` und `CreatorSlangTagsDialog.tsx` wurden bewusst aus dem
Paket entfernt). Policies von `creator_subscriptions` unverändert.

## 9. Stripe-Status

Bestehende Production-Konfiguration unverändert. Keine neue Stripe-Logik, kein
erzwungener Testmodus, keine Secrets ausgegeben. Der Hinweis „Zahlungen in der
Vorschau laufen im Testmodus“ betrifft ausschließlich die Vorschauumgebung.

## 10. Bekannte offene Punkte

- Video-spezifische DB-Integrationstests fehlen; abgedeckt über Unit-Tests der
  Validierung und den manuellen Composer-Check.
- Ein echter Video-Upload wurde in Production nicht durchgeführt (keine
  Testdaten erzeugt) – erster realer Upload bitte manuell beobachten.
- Zwei vorbestehende Prettier-Fehler in `remotion/` bleiben unangetastet (out
  of scope).
- E2E-Feed-Test ist beim Kaltstart flakey (Ladezustand); nicht releasebedingt.
- Frontend geht erst mit „Update“ im Publish-Dialog live; die DB-Migrationen
  sind bereits aktiv (`video_kind` hat Default `shot`, daher rückwärtskompatibel).

Rollback bei Bedarf: `release/production-video-business-v1-2026-09-01-rebased/ROLLBACK.md`.
