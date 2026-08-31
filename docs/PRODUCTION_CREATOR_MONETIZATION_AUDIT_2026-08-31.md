# Y-Dude – PRODUCTION CREATOR / UNTERNEHMER MONETARISIERUNG – AUDIT

Datum: 2026-08-31 · Modus: **rein lesend** (keine Migration, kein Deploy, keine RLS-/Stripe-Änderung)
Grundlage: tatsächlicher Production-Code, Production-Datenbank (Tabellen, Enums, Rollen), Preis-Katalog im Code.

---

## 1. Production-Ausgangszustand

| Bereich | Status | Nachweis |
| --- | --- | --- |
| Rollen `creator` / `business` | 🟢 vorhanden | `public.user_roles` + `has_role`; Testkonten: @creator → `creator`, @unternehmer → `business`, @community → keine Rolle |
| Creator-Eligibility (10 Connections **oder** 10 Follower) | 🟢 vorhanden | `src/lib/creator-eligibility.ts`, `creator-eligibility.server.ts`, `BecomeCreatorMenuItem.tsx` |
| Creator-Bereich `/creator` | 🟡 teilweise | `src/routes/_authenticated/creator.tsx` – Dashboard + Statistiken echt, Drops-Ansichten sind Platzhalter („Struktur vorbereitet“) |
| Abo-System allgemein | 🟡 teilweise | Es existiert **nur** das Verkäufer-/Business-Abo (`/business`), kein Abo *zwischen* Nutzern |
| Öffentliches Profil | 🟢 vorhanden, ohne Abo | `src/routes/_authenticated/profile.$username.tsx`: nur Folgen/Entfolgen, Connection, Nachricht – kein Subscribe-Element |

---

## 2. Creator-Abo (Community abonniert Creator)

| Punkt | Status | Nachweis |
| --- | --- | --- |
| Creator Subscription (Datenmodell) | 🔴 nicht vorhanden | keine Tabelle `creator_subscriptions` in Production |
| Creator Subscription Price | 🔴 nicht vorhanden | Preis-Katalog `src/lib/billing-plans.ts` enthält ausschließlich `business_monthly/yearly`, `business_pro_monthly/yearly` und `promo_featured_*` |
| Stripe Checkout für Creator-Abo | 🔴 nicht vorhanden | `src/lib/billing.functions.ts` kennt nur `createSubscriptionCheckout` (Business-Preise), `createPromotionCheckout`, Portal |
| Webhook-Verarbeitung Creator-Abo | 🔴 nicht vorhanden | `src/routes/api/public/payments/webhook.ts` schreibt nur `subscriptions` (nutzereigenes Business-Abo) und Market-Zahlungen |
| Subscription Status pro Creator | 🔴 nicht vorhanden | `subscriptions` hat `user_id`, `price_id`, `environment` – keine Spalte für einen abonnierten Creator |
| Creator-Profil mit Abo-CTA | 🔴 nicht vorhanden | Profilroute enthält keinen Subscribe-Button/-Dialog |
| Community-Zugriff auf Creator-Inhalte per Abo | 🔴 nicht vorhanden | Freischaltung läuft ausschließlich über `unlock_type` (`open, follow, challenge, event, premium`) und `slang_tag_grants` |
| SlangTag-Freischaltung per Abo | 🔴 nicht vorhanden | `data.tsx`: Grants gelten „solange gefolgt wird“ – Folge-, keine Abo-Logik |
| SlangTag Box | 🟢 vorhanden (ohne Abo-Bezug) | SlangBox zeigt eigene + gegrantete Tags |

**Fazit Creator-Abo: 🔴 nicht vorhanden.**

---

## 3. Unternehmer-Abo

Zwei klar getrennte Dinge:

| Punkt | Status | Nachweis |
| --- | --- | --- |
| Eigenes Verkäufer-Abo (Unternehmer *zahlt selbst*) | 🟢 vorhanden | `/business` (`src/routes/_authenticated/business.tsx`), `BUSINESS_PLANS`, Checkout/Wechsel/Kündigung/Portal in `billing.functions.ts`, Webhook schreibt `subscriptions` |
| Unternehmer-Abo **durch Community-Nutzer** (Fan abonniert Unternehmen) | 🔴 nicht vorhanden | kein Preis, kein CTA, kein Datenmodell; Kanal-Mitgliedschaft ist explizit als „später“ markiert (`channels.server.ts:334`) |
| Unternehmer-Drops | 🔴 nicht vorhanden (nur UI-Platzhalter) | `creator.tsx?view=bizdrops` zeigt Erklärtext + Hinweis „Struktur vorbereitet“ |

**Fazit: Unternehmer-Abo im Sinne „Community abonniert Unternehmen“: 🔴 nicht vorhanden. Verkäufer-Abo für Unternehmen selbst: 🟢 vorhanden.**

---

## 4. Creator Drops

| Punkt | Status | Nachweis |
| --- | --- | --- |
| Exclusive SlangDrops | 🟡 nur Datenfelder | `slang_tags.drop_release_date, drop_limit, drop_expires, drop_rarity`; Typ `SlangTagDrop` ist kommentiert „noch nicht aktiv“ |
| Subscriber-only Drops | 🔴 nicht vorhanden | kein Subscriber-Begriff im Freischaltpfad; `unlock_type` hat kein `subscription` |
| Limitierung | 🟡 Feld vorhanden, ohne Durchsetzung | `drop_limit` wird gelesen, aber nicht als Kontingent geprüft |
| Drop-Freischaltung | 🟡 teilweise | `slang_tag_grants` + `has_slang_tag_grant`/`can_use_slang_tag`; Bindung an Folgen, nicht an Abo |
| 3-Monats-Regel | 🔴 nicht vorhanden | keine Fundstelle im Code/DB |
| Dauerhafte Bibliotheksrechte | 🔴 nicht vorhanden | keine Bibliothekstabelle; Grant endet bei Entfolgen/Ablauf |

---

## 5. SlangTag Library

🔴 **nicht vorhanden.** Keine Tabelle `slang_tag_library`. Funktional ersetzt die SlangBox (eigene Tags + aktive Grants) die Anzeige, ohne dauerhaften Besitzanspruch.

---

## 6. Stripe

| Punkt | Status | Nachweis |
| --- | --- | --- |
| Integration allgemein | 🟢 vorhanden | `billing.server.ts` (Checkout, Plan-Wechsel, Kündigung, Portal), Webhook mit Signaturprüfung und Idempotenz |
| Creator-Subscription-Produkt/Preis | 🔴 nicht vorhanden | Katalog nur Business + Promotion |
| Creator-Zuordnung (welcher Creator wird bezahlt) | 🔴 nicht vorhanden | keine Metadaten/Spalte für Empfänger-Creator; keine Auszahlungslogik (kein Connect/Payout-Pfad für Creator-Abos) |
| Subscription State | 🟢 vorhanden (nur eigenes Abo) | Tabelle `subscriptions` mit `environment`-Trennung; aktuell **0 Zeilen** in Production |

---

## 7. RLS / Security

| Anforderung | Status | Nachweis |
| --- | --- | --- |
| Community kann Creator-Profil sehen | 🟢 | `can_view_profile` / Profil-Sichtbarkeitsfelder |
| Community kann Abo-CTA sehen | 🔴 | CTA existiert nicht (keine Rechtefrage) |
| Subscription nicht per Frontend manipulierbar | 🟢 | `subscriptions` nur lesbar für Eigentümer; Schreibpfad ausschließlich signaturgeprüfter Webhook / Serverfunktion |
| Creator verwaltet nur eigene Abo-Einstellungen | 🔴 n/a | Es gibt keine Creator-Abo-Einstellungen |
| Nutzer verwaltet nur eigene Bibliothek | 🔴 n/a | keine Bibliothek |
| Fremde Bibliothek unveränderbar | 🔴 n/a | keine Bibliothek |

Keine Rechte verändert.

---

## 8. Rollen (echte Production-Konten, keine Perspektivensimulation)

| Konto | Rolle in `user_roles` |
| --- | --- |
| @community | – (keine) |
| @creator | `creator` |
| @unternehmer | `business` |
| Admin | separat über `admin_owners`/`user_roles.admin`, unverändert |

---

## 9. Fehlender Subscribe-Button

Auf `/profile/$username` existieren als Aktionen ausschließlich: Folgen/Entfolgen, Connection anfragen, Nachricht, Teilen. Es gibt **keine** ausgeblendete oder bedingte Subscribe-Komponente – weder Rolle, Eligibility, Following-Status, Feature-Flag noch RLS blenden etwas aus.

## 10. Root Cause

**Das Creator-Abo ist nicht nach Production migriert: UI-Komponente, Preis-Katalog-Einträge, Server-Funktionen, Webhook-Zweig und Datenmodell (`creator_subscription_prices`, `creator_subscriptions`, `slang_tag_library`) fehlen vollständig.** Der Button fehlt also nicht wegen einer falschen Prüfung, sondern weil das Feature in Production nicht existiert.

---

## 11. Staging vs. Production

In diesem Production-Checkout existiert **kein** Staging-Audit-Dokument und kein Creator-Abo-Code; ein Datei-für-Datei-Vergleich ist von hier aus nicht belegbar. Belegbar ist nur: Production enthält keinen der in Staging beschriebenen Bausteine (Preise, Tabellen, CTA, Drops-Logik). Für einen echten Diff wird das Staging-Release-Paket benötigt.

## 12. Offene Migrationen (nur Dokumentation, nichts angelegt)

1. Tabellen `creator_subscription_prices`, `creator_subscriptions`, `slang_tag_library` inkl. GRANTs + RLS.
2. Preis-Katalog-Erweiterung + Stripe-Produkte/Preise für Creator-Abos inkl. Creator-Zuordnung und Auszahlungsweg.
3. Webhook-Zweig für Creator-Abos (Status, Idempotenz, `environment`).
4. Subscribe-CTA auf dem Profil + Abo-Verwaltung für Creator.
5. Drops-Durchsetzung: `unlock_type` „subscription“, Limit-Kontingent, 3-Monats-Regel, dauerhafte Bibliotheksrechte.
6. Entscheidung, ob Unternehmer-Abos denselben Mechanismus nutzen.

---

## 🟢 AUDIT COMPLETE

- **Creator-Abo in Production noch nicht vorhanden.**
- **Unternehmer-Abo (Community abonniert Unternehmen): nicht vorhanden** – vorhanden ist nur das eigene Verkäufer-/Business-Abo unter `/business`.
- **Grund für fehlenden Subscribe-Button:** Das Feature ist in Production nicht implementiert/migriert – es existiert keine Subscribe-UI, kein Creator-Abo-Preis, keine Server-/Webhook-Logik und kein Datenmodell; es wird nichts durch Rolle, Eligibility, Following oder RLS versteckt.

Keine Änderungen vorgenommen.
