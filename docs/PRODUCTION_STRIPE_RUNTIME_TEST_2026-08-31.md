# Y-Dude – Production Stripe Runtime Test (Creator Subscription V1 + Business Campaigns V1)

Datum: 2026-08-31 · Umfang: kontrollierter Runtime-Test
**Keine Codeänderung, keine DB-Migration, kein Refactoring, keine neuen Features, keine manuelle Datenkorrektur.**

Voraussetzung erfüllt: Post-Release-Difference-Audit vom 2026-08-31 = 🟢 DIFFERENCES VERIFIED – NO LOGIC CHANGE.

---

## ABSCHLUSSSTATUS

🟡 **SANDBOX TEST REQUIRED – NO LIVE PAYMENT PERFORMED**

Begründung in einem Satz: Die **Production-Umgebung akzeptiert ausschließlich LIVE-Zahlungen**; ein Testmodus ist auf den Production-Hosts konstruktionsbedingt gesperrt. Es wurde daher – wie vorgegeben – **kein Zahlungsvorgang ausgelöst**. Alle nicht-zahlungsgebundenen Prüfungen wurden lesend durchgeführt und sind unten dokumentiert.

---

## 1. Stripe-Modus in Production – eindeutige Feststellung

| Merkmal | Ergebnis |
| --- | --- |
| Öffentlicher Zahlungs-Token in `.env.production` | Präfix `pk_live_` → **LIVE** |
| Öffentlicher Zahlungs-Token in `.env.development` (Vorschau) | Präfix `pk_test_` → **Testmodus** |
| Go-Live-Status | alle 5 Schritte abgeschlossen, Live-Konto aktiv |
| Server-Regel `allowedPaymentsModes('production')` | `['live']` (weil Live-Schlüssel vorhanden) |
| Server-Regel `allowedPaymentsModes('staging'/'development')` | `['sandbox']` |
| Verhalten bei Testmeldung an Production | Webhook wird verworfen („environment mismatch") + kritisches Security-Ops-Ereignis |

**Konsequenz:** Auf `y-dude.com` / `www.y-dude.com` / `y-dude.lovable.app` ist ein Checkout **immer eine echte Zahlung mit echtem Geld**. Ein Testkauf ist dort technisch nicht vorgesehen und wurde nicht durchgeführt.
Der Testmodus ist ausschließlich in der Vorschau-/Staging-Umgebung zulässig — das ist die vorgesehene Sicherheitsarchitektur, kein Fehler.

### Registrierte Zahlungs-Endpunkte (beide Modi geprüft, lesend)

| Modus | App-Endpunkt | Ereignisse |
| --- | --- | --- |
| live | `…lovable.app/api/public/payments/webhook?env=live` | 8 (subscription created/updated/deleted, checkout completed, async succeeded/failed, invoice paid, invoice payment_failed) |
| sandbox | `…-dev.lovable.app/api/public/payments/webhook?env=sandbox` | dieselben 8 |

Zusätzlich existiert je Modus der Analyse-Endpunkt von Lovable (`api.lovable.dev/...`). Beide Endpunkte sind erforderlich und wurden **nicht** verändert.

### Preiskatalog (beide Modi identisch, lesend geprüft)

`business_monthly` 14,90 € · `business_yearly` 149,00 € · `business_pro_monthly` 39,00 € · `business_pro_yearly` 390,00 € · `promo_featured_3/7/30`. Creator-Abos nutzen keinen Katalogpreis, sondern einen dynamischen Monatspreis des Creators.

---

## 2. TEIL A – CREATOR ABO

Testkonto @community (bestehend, kein neues Konto).

| Schritt | Ergebnis |
| --- | --- |
| Creator-Profil `/profile/creator` geöffnet | ✅ erreichbar |
| „Creator abonnieren" sichtbar | ❌ **nein** – Anzeige: „Dieser Creator bietet noch kein Abo an." |
| Aktueller Creator-Monatspreis | **nicht konfiguriert** (`creator_subscription_prices` = 0 Zeilen) |
| Stripe Checkout | nicht erreichbar (kein Preis → serverseitig `creator_price_missing`) |
| Testzahlung | **nicht durchgeführt** (Production = LIVE) |

**Ursache – zwei Vorbedingungen fehlen, nicht ein Fehler:**
1. @creator hat noch **keinen Abopreis** hinterlegt (2,99 €–99,99 € wären erlaubt).
2. @creator hat **keine Creator-SlangTags** veröffentlicht (`slang_tags` für diesen Eigentümer = 0 Zeilen).

Beides ist reine Creator-Konfiguration/Inhalt. Es wurde bewusst **nichts angelegt**, um keine Testdaten und keine Inhalte in Production zu erzeugen.

**Ergebnis Teil A:** offen – nicht durchführbar ohne Live-Zahlung und ohne Creator-Konfiguration.
**Ergebnis Teil A2 (Subscriber-Berechtigung, SlangTag Box):** offen – setzt A voraus, zusätzlich fehlt ein Abonnenten-SlangTag.
**Ergebnis Teil A3 (Kündigung):** offen – setzt A voraus.

Lesend bestätigt (Logik ist vorhanden und autoritativ serverseitig):
- Freischaltung ausschließlich über `claim_creator_slang_tag` (SECURITY DEFINER, Ausführung nur `authenticated`/`service_role`).
- `slang_tag_library` besitzt **nur** eine SELECT-Policy für den Eigentümer – **keine** UPDATE/DELETE-Rechte, auch nicht für den Creator. Ein übernommener SlangTag kann folglich weder durch Kündigung noch durch den Creator verschwinden.
- Kündigung erfolgt als `cancel_at_period_end` (Zugang bis Periodenende), nicht als Sofortentzug.

---

## 3. TEIL B – BUSINESS ABO

Testkonto @unternehmer (Rolle `business` in `public.user_roles` bestätigt).

| Schritt | Ergebnis |
| --- | --- |
| Business-Bereich `/business` geöffnet | ✅ erreichbar |
| Aktueller Plan | **Kein aktives Abo** (`subscriptions` = 0 Zeilen) |
| Vier Pläne korrekt angezeigt | ✅ 14,90 € / 149,00 € / 39,00 € / 390,00 € |
| Kampagnenbereich | ✅ korrekt gesperrt: „Für Kampagnen wird ein Unternehmerkonto mit aktivem Business-Abo benötigt." |
| Stripe Checkout ausgelöst | ❌ **nein** (Production = LIVE) |

**Ergebnis Teil B:** offen – Zahlung wäre live.
**Ergebnis Teil B2 (2 Kampagnen ✅ / 3. ❌):** nicht laufzeitgetestet, da ohne aktives Abo das Limit serverseitig bereits 0 ist. Aktueller Bestand: 0 Kampagnen für alle drei Testkonten.
**Ergebnis Teil B3 (Business Pro 5/6):** **F4 teilweise offen** – ein sicherer Planwechsel war nicht möglich, es wurde nichts simuliert.

Lesend bestätigt (Limitdurchsetzung liegt in der Datenbank, nicht in der Oberfläche):
- `business_campaign_limit`: free 0 · business 2 · business_pro 5 (Definition unverändert, md5 `c2bc76ff…`).
- Trigger `enforce_business_campaign_limit` läuft BEFORE INSERT **und** UPDATE auf `ad_campaigns` und wirft `business_role_required`, `business_subscription_required`, `campaign_limit_reached`.
- `business_plan_tier` ist ausschließlich für `service_role` ausführbar und leitet die Stufe allein aus `public.subscriptions` inkl. `current_period_end` ab.
- Ein direkter API-Aufruf kann das Limit daher nicht umgehen; die Oberfläche ist nur die zweite Schicht.
- Diese Kette ist zusätzlich durch die 68 Datenbank-Integrationstests des Releases abgedeckt (u. a. T1–T9 Kampagnenlimits).

---

## 4. TEIL C – WEBHOOK (lesend geprüft, keine Daten verändert)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Signaturvalidierung | ✅ HMAC-SHA256 über `t.body`, alle `v1`-Signaturen werden geprüft, Zeitfenster 5 Minuten, Secret je Modus getrennt |
| Idempotenz | ✅ Ereignis-ID wird vor der Verarbeitung festgeschrieben; Unique-Index `market_payment_webhook_events(provider, event_id)` verhindert Doppelverbuchung |
| Umgebungsschutz | ✅ `paymentsModeAllowed` verwirft modus-fremde Meldungen und meldet sie als kritisches Sicherheitsereignis |
| Zuordnung Creator vs. Business | ✅ Trennung über `metadata.kind = "creator_subscription"` → `creator_subscriptions`; sonst `subscriptions` |
| Korrekter Nutzer / Creator | ✅ `metadata.userId` + `metadata.creatorId` werden auf Session, Subscription und Customer gesetzt |
| Status/Periode | ✅ Status und Periodenende aus der Meldung (Item-Feld mit Fallback auf Subscription) |
| Auth-Haltung des Endpunkts | ✅ öffentlich unter `/api/public/...`, Absicherung ausschließlich über Signatur (korrekt für Stripe) |
| Bisher verarbeitete Ereignisse | 0 Zeilen in `market_payment_webhook_events` – konsistent damit, dass noch nie eine Zahlung lief |

**Nicht verifizierbar ohne Zahlung:** der tatsächliche Ereignisdurchlauf (Checkout → Webhook → Statuszeile). Die Kette ist implementiert und statisch geprüft, aber nicht laufzeitbewiesen.

---

## 5. TEIL D – FEHLGESCHLAGENE ZAHLUNG

Nicht durchgeführt. Ein Fehlzustand hätte nur über eine echte Live-Zahlung erzeugt werden können. Lesend bestätigt: `invoice.payment_failed` ist abonniert; `past_due` gilt weiterhin als aktiv (Mahnlauf), `canceled` nur bis Periodenende, danach Entzug – Kampagnenlimit fällt dann automatisch auf 0, weil `business_plan_tier` `current_period_end` auswertet.

---

## 6. TEIL E – SECURITY (lesend, autoritative Zustände)

| Prüfpunkt | Ergebnis |
| --- | --- |
| Creator-Abo per Frontend aktivierbar? | ❌ nein – `creator_subscriptions` hat **nur** eine SELECT-Policy; Schreiben ausschließlich über den signaturgeprüften Webhook (Serverdienst) |
| Business-Tier per Frontend erhöhbar? | ❌ nein – `subscriptions` hat **nur** SELECT für den Eigentümer; `business_plan_tier` nur `service_role` |
| Kampagnenlimit erhöhbar? | ❌ nein – DB-Trigger vor jedem INSERT/UPDATE, `ad_campaigns` mit RLS und 8 Policies |
| Subscriber-SlangTag freischaltbar? | ❌ nein – nur `claim_creator_slang_tag` (SECURITY DEFINER) entscheidet; Abo bzw. Follower-Bindung wird dort geprüft |
| Anonyme Rechte auf Abo-/Kampagnentabellen | keine (`anon`/`PUBLIC` ohne jedes Recht auf `subscriptions`, `creator_subscriptions`, `creator_subscription_prices`, `slang_tag_library`, `ad_campaigns`, `market_payment_webhook_events`) |
| Secrets im Frontend | keine – im Browser liegt nur der öffentliche Zahlungs-Token (`pk_…`); Anbieter-Schlüssel und Webhook-Secrets werden ausschließlich in Handlern gelesen |
| Zählermanipulation Kampagnen | `increment_campaign_metric` nur `service_role`, Sperrtabelle ohne Nutzerrechte |

**Ergebnis Teil E: ✅ bestanden** – serverseitige Zustände sind autoritativ.

---

## 7. TEIL F – REGRESSION (ohne Zahlung)

| Konto | Prüfung | Ergebnis |
| --- | --- | --- |
| @community | Login, Feed, Creator-Profil, Follow/Connection-Anzeige, SlangTag-Dialog | ✅ funktioniert, keine JS-Fehler außer einer 400-Antwort einer Hintergrundabfrage (siehe Beobachtung) |
| @community | Creator-Abo | ⚪ nicht anwendbar (kein Preis beim Creator) |
| @creator | Profil, Creator-SlangTag-Dialog, Abo-Konfiguration erreichbar | ✅ Bereich vorhanden, aber **leer/unkonfiguriert** |
| @unternehmer | Business-Bereich, Planübersicht, Kampagnenbereich, Limit-Hinweis | ✅ korrekt, Kampagnen erwartungsgemäß gesperrt |
| Alle | Rollen in `public.user_roles` | ✅ `creator` bzw. `business` unverändert |

**Beobachtung (keine Änderung vorgenommen):** Auf beiden Profilseiten erscheint im Browserprotokoll je eine `400`-Antwort einer Hintergrundabfrage, ohne sichtbare Auswirkung auf die Oberfläche. Nicht Teil dieses Tests, nicht angefasst – Empfehlung: separat prüfen.

---

## 8. Hinterlassene Testdaten

**Keine.** Es wurden keine Zahlungen, keine Abos, keine Kampagnen, keine Preise, keine SlangTags und keine Bibliothekseinträge erzeugt. Es wurde nichts gelöscht und nichts archiviert. Reine Lese- und Oberflächenprüfung.

---

## 9. Was für einen vollständigen Nachweis nötig ist (Empfehlung, nicht ausgeführt)

Damit die beiden Ketten laufzeitbewiesen werden können, ohne echtes Geld zu bewegen, wäre der Test in der **Vorschau-/Staging-Umgebung** zu fahren – dort ist der Testmodus zulässig, der Testmodus-Endpunkt registriert und der Preiskatalog vorhanden. Erforderliche Vorbereitung, jeweils durch die Testkonten selbst:

1. @creator: Abopreis setzen (z. B. 2,99 €) und mindestens einen Creator-SlangTag mit Stufe „Für Abonnenten" veröffentlichen.
2. @community: Creator-Abo im Testmodus mit Testkarte abschließen → Webhook, Status, Freischaltung, Übernahme in die Bibliothek, Kündigung prüfen.
3. @unternehmer: `business_monthly` im Testmodus abschließen → Kampagne 1 ✅, 2 ✅, 3 ❌ (serverseitige Ablehnung), danach Wechsel auf `business_pro_monthly` → 1–5 ✅, 6 ❌.
4. Anschließend Testkampagnen archivieren und Test-Abos kündigen.

Zu beachten: Vorschau und Production teilen denselben Datenbestand; Testmodus-Zeilen werden über die Spalte `environment = 'sandbox'` getrennt geführt und beeinflussen die Live-Berechtigungen nicht. Diese Freigabe liegt bewusst nicht bei mir – sie wird auf ausdrückliche Anweisung durchgeführt.

---

## Zusammenfassung

| Bereich | Status |
| --- | --- |
| Stripe-Modus Production | LIVE (Testmodus dort gesperrt) |
| Creator-Abo Laufzeittest | 🟡 offen (keine Live-Zahlung; Creator unkonfiguriert) |
| Creator-Berechtigung / Bibliothek | 🟡 offen (setzt Abo voraus) · Logik & Löschschutz lesend bestätigt |
| Business-Abo Laufzeittest | 🟡 offen (keine Live-Zahlung) |
| Kampagnenlimit 2/5 · 3./6. Kampagne | 🟡 nicht laufzeitgetestet · DB-Durchsetzung bestätigt (F4 teilweise offen) |
| Webhook Signatur & Idempotenz | ✅ bestätigt (statisch + DB-Constraint) |
| Security / keine Frontend-Manipulation | ✅ bestätigt |
| Regression | ✅ unauffällig |
| Hinterlassene Testdaten | keine |

🟡 **SANDBOX TEST REQUIRED – NO LIVE PAYMENT PERFORMED**
