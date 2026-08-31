# Y-Dude PRODUCTION – CREATOR SUBSCRIPTION V1 (Release-Protokoll)

Datum: 2026-08-31 · Umgebung: **PRODUCTION** · Paket: `release/production-creator-subscription-v1-2026-08-31.tar.gz`

---

## Phase 1 – Paketprüfung

- SHA-256-Prüfsummen aller Paketdateien verifiziert: **✅ übereinstimmend** (EXIT 0).
- Inhalt: 6 SQL-Migrationen, 1 pg_cron-Job, 7 neue Quelldateien, 3 geänderte Quelldateien, 3 Testdateien.

## Phase 2 – Baseline-Sicherung

| Prüfpunkt | Ergebnis |
| --- | --- |
| `creator_subscription_prices`, `creator_subscriptions`, `slang_tag_library`, `slang_tag_drops` | nicht vorhanden (erwartet) |
| `enforce_slang_tag_kind` | entsprach exakt der erwarteten Vorversion |
| `slang_tags.unlock_type`, `follow_required` | vorhanden |
| Abhängigkeiten der neuen Dateien (`loadProfileDetails`, `Sparkles` u. a.) | vorhanden |

## Phase 3 – Diff Gate

Nur die drei vorgesehenen Dateien geändert; jede Änderung strikt im Creator-Abo-Scope:

- `src/routes/api/public/payments/webhook.ts` – zusätzlicher Zweig für `metadata.kind = "creator_subscription"`; Business-Abo-Pfad unverändert.
- `src/routes/_authenticated/creator.tsx` – Einstieg „Creator SlangTags“ inkl. Dialog.
- `src/routes/_authenticated/profile.$username.tsx` – Creator-SlangTag-Bereich im Profil.

Keine Regression an Market, Feed, Moderation, Messenger oder Business-Abo.

## Phase 4 – Datenbank-Migration (6 Migrationen + pg_cron)

| # | Migration | Ergebnis |
| --- | --- | --- |
| 1 | `creator_subscription_v1_01_core` – Tabellen, RLS, Rechte-Funktionen, Löschschutz | ✅ |
| 2 | `creator_subscription_v1_02_grants` – Funktionsrechte verengt | ✅ |
| 3 | `creator_subscription_v1_03_drops` – Preisrahmen, Exclusive Drops, 3-Monats-Regel | ✅ |
| 4 | `creator_subscription_v1_04_maturation` – `run_exclusive_drop_maturation()` | ✅ |
| 5 | `creator_subscription_v1_05_slang_tag_kind` – Zugriffsstufen `open/follow/premium` | ✅ |
| 6 | `creator_subscription_v1_06_cron` – stündlicher Reifungsjob (`7 * * * *`) | ✅ |

## Phase 5/6 – RLS & Sicherheit

| Prüfung | Ergebnis |
| --- | --- |
| Zeilensicherheit auf allen 4 neuen Tabellen | ✅ aktiv |
| Policies | 9, ausschließlich `authenticated`, nutzer- bzw. creator-bezogen |
| Rechte für `anon`/`PUBLIC` auf neuen Tabellen | ✅ keine |
| Schreibpfad Bibliothek/Abos | ausschließlich `SECURITY DEFINER`-Funktion bzw. signaturgeprüfter Webhook |
| Preisrahmen | `CHECK (price_cents >= 299 AND price_cents <= 9999)` |
| Löschschutz erworbener SlangTags | Trigger `slang_tags_protect_owned_delete` (Soft-Delete statt Entzug) |

## Phase 7 – Quell-Migration und eine nachgewiesene Zusatzabhängigkeit

Die 7 neuen und 3 geänderten Dateien wurden übernommen. Zusätzlich war eine
**belegte Release-Abhängigkeit** zu erfüllen: `src/lib/creator-subscription.server.ts`
importiert die Helfer `admin`, `isoFromUnix`, `resolveOrCreateCustomer`,
`stripeFor`, `stripeMessage`, `userEmail` aus `billing.server.ts`. Diese waren in
Production modul-lokal. Minimaler Eingriff: nur das Schlüsselwort `export` ergänzt –
keine Logik-, Signatur- oder Verhaltensänderung am Business-Abo.

## Phase 8/9 – Verify und Build

| Stufe | Ergebnis |
| --- | --- |
| Typprüfung | ✅ fehlerfrei |
| Lint | ✅ fehlerfrei |
| Unit-Tests | ✅ 502 / 502 |
| DB-Integrationstests | ✅ 43 / 43 (inkl. Drop-Reifung und freier Creator-SlangTags) |
| Browser/E2E | ✅ 10 bestanden, 1 übersprungen |
| Build | ✅ build OK |

## Phase 10/11 – Smoke Test

Kernrouten (Landingpage, Recht, Feed, Market, Messenger, geschützte Routen,
Sitzungswiederherstellung) ohne Serverfunktions- oder Serverfehler.

## Phase 12 – Rollback

1. **Quellcode:** die 7 neuen Dateien entfernen, die 3 geänderten Dateien auf den
   Stand vor dem Release zurücksetzen, `export` in `billing.server.ts` zurücknehmen.
2. **Cron:** `select cron.unschedule('y-dude-exclusive-drop-maturation');`
3. **Datenbank:** Migrationen 1–6 sind additiv. Empfohlener Rückweg ist eine
   Vorwärts-Migration, die `enforce_slang_tag_kind` und `can_use_slang_tag` auf die
   Vorversion setzt; die neuen Tabellen bleiben ungenutzt bestehen, damit bereits
   erworbene Bibliotheksrechte nicht verloren gehen.

---

## 🟢 RELEASE ABGESCHLOSSEN

Creator-Abo, Zugriffsstufen (kostenlos / Follower / Abonnenten), Exclusive
SlangDrops mit Kontingent und 3-Monats-Reifung sowie die dauerhafte
SlangTag-Bibliothek sind in Production aktiv. Das bestehende Business-Abo,
Market und Moderation blieben unverändert.
