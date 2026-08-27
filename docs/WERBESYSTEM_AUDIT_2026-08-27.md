# Y-Dude Werbesystem – Audit & Bereinigung

Stand: 27.08.2026. Grundlage: vollständige Durchsuchung von `src/`, `docs/`,
`public/`, Datenbank-Bestandsaufnahme. Der Werbekernel wurde **nicht**
deaktiviert und **nicht** umgebaut.

## A – Entfernte Test-/Demowerbung

Gefundener Demo-/Testbestand (bleibt als Code erhalten, wird aber nicht mehr
öffentlich ausgespielt):

| Ort                                | Inhalt                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/lib/ad-demo.ts`               | 8 erfundene Bildanzeigen (Aegean Blue Resorts, Kreuzberg Grill …) mit `https://example.com/...`-Ziel-URLs |
| `src/lib/ad-video-demo.ts`         | Videowerbung inkl. `video-ydude-selftest` / `video-ydude-feedtest` (reine Testclips)                      |
| `src/lib/ad-catalog.shared.ts`     | Videokatalog enthielt ausschließlich das Test-Werbemittel `video-ydude-feedtest`                          |
| `src/lib/ad-test-counter.ts`       | Testkarte nach 15/25 Interaktionen, gespeist aus `SPONSORED_ADS`                                          |
| `AdSlider` (feed), `SponsoredFeed` | zeigten den Demobestand allen angemeldeten Konten                                                         |
| DB `ad_test_events`                | 6.110 künstlich erzeugte Test-Impressionen/-Klicks/-Skips                                                 |
| DB `ad_test_settings.enabled`      | Werbe-Testmodus war dauerhaft aktiv                                                                       |

Maßnahmen:

1. **Eine zentrale Freigaberegel** (`src/lib/ads/demo-inventory.ts` +
   `demo-inventory.server.ts`): Demobestand nur für **Admin-Konten** und nur bei
   **aktivem Werbe-Testmodus**. Im Zweifel/Fehlerfall: nicht erlaubt.
2. `buildFeedAdPlan()` liefert ohne Freigabe einen **leeren Werbeplan** – der
   Kernel (Scoring, Abstände, Caps, Events, Verankerung) bleibt unverändert.
3. `AdSlider` (Feed-Variante) und `SponsoredFeed` (Werbefeed-Panel) laden den
   Demobestand nur mit derselben Freigabe; sonst greift der bestehende
   Leerzustand.
4. Datenbank: alle künstlichen Testereignisse gelöscht, Testmodus abgeschaltet
   (im Admin-Cockpit jederzeit reaktivierbar).

Nicht angetastet: `ad_campaigns` (0 Zeilen), `market_promotions` (0),
`market_ad_campaigns` (0) – dort existieren keine Testdaten.

## B – Bestehender Y-Dude Werbekernel

| Baustein            | Datei                                                                                                        | Status                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Katalog/Datenmodell | `ad-catalog.shared.ts` (`AdCatalogEntry`, `AdPlan`, `AdPlanSlot`)                                            | vorhanden                                           |
| Ad-Serving          | `ad-plan.server.ts` (`buildFeedAdPlan`)                                                                      | vorhanden, serverseitig, gewichtet-zufällig         |
| API-Schnittstelle   | `ads.functions.ts` → `getFeedAdPlan` (auth-pflichtig)                                                        | vorhanden                                           |
| Platzierung         | `use-feed-ad-plan.ts` (Slot→Beitrag, Verankerung, Dismiss)                                                   | vorhanden                                           |
| Targeting           | `ads/ad-targeting.shared.ts`, `ad_preferences`, `interest_confidence`, `user_interests`, `profiles.location` | vorhanden (grob: Themen-Slugs + DE/„“-Region)       |
| Frequency Capping   | Abstände 6–12 / 8–18, max. 14 Slots, `seen`-Dämpfung ×0,35, letzte 3 gesperrt                                | vorhanden                                           |
| Werbepause          | `ad-pause.ts` (3 Pausen/Monat), `AdsMasterSwitch` (`profiles.ads_enabled`)                                   | vorhanden                                           |
| Impression/Click    | `live-test.functions.ts` → `recordAdTestEvent` → `ad_test_events`                                            | **nur Testmessung**, keine produktive Abrechnung    |
| Kampagnenverwaltung | `admin.server.ts` + `/admin/ads` (CRUD auf `ad_campaigns`)                                                   | vorhanden, aber **nicht mit dem Serving verbunden** |
| Promotions          | `market-promo.server.ts`, `market_promotions`, `market_promotion_plans`                                      | vorhanden (Market-eigener Pfad)                     |
| Videoregeln         | Skip nach 2 s, Standard 15 s, Max 30 s, `ads/video-ad-playback.ts`                                           | vorhanden                                           |
| Environment Vars    | **keine werbebezogenen** Variablen im Projekt                                                                | –                                                   |
| Edge Functions      | keine (bewusst: TanStack Server Functions)                                                                   | –                                                   |

Mehrquellenfähigkeit: der Kernel hat **genau eine** Einspeisestelle (Poolbildung
in `buildFeedAdPlan`), was Mehrquellenbetrieb strukturell erlaubt. Die in
`docs/AD_KERNEL_AND_EXTERNAL_API.md` beschriebene Adapterdatei
`src/lib/ads/provider.shared.ts` existiert **nicht mehr** im Projekt – der
Adaptervertrag ist damit aktuell nur dokumentiert, nicht implementiert.

## C – Google AdSense: tatsächlicher Bestand

Volltextsuche nach `adsense`, `adsbygoogle`, `ca-pub`, `googletag`, `gpt.js`,
Publisher-/Client-/Ad-Unit-ID, AdSense-Env-Variablen, AdSense-Komponenten,
Konfigurationsdateien und entsprechenden TODOs:

**Kein einziger Treffer.** Es gibt keine AdSense-Integration, keine
vorbereiteten IDs, kein Script-Einbindung, keine Konfiguration und keine
zugehörigen TODOs. Der Verdacht einer bestehenden Vorbereitung ist damit
widerlegt. Vorbereitet ist ausschließlich der **anbieterneutrale** Gedanke einer
externen Werbequelle (Dokument, nicht Code).

## D – Produktionsreife für AdSense

**Bewertung: 40 % – teilweise vorbereitet.**

Dafür: zentrale serverseitige Auswahl, ein einziger Einspeisepunkt, sauber
getrennte Darstellungs-Ebene, Frequency Caps, Nutzersteuerung (Pause,
Werbeeinstellungen, Admin-Schalter), Interessen-/Regionssignale vorhanden.

Dagegen: kein Adaptervertrag im Code, keine Werbequelle-Kennzeichnung im
`AdPlanSlot`, keine Unterstützung für fremdgerenderte Werbeflächen (AdSense
rendert selbst im iFrame, liefert keine Creative-Daten), kein Consent-Signal,
keine Impressions-/Klickmessung für echte Werbung, `ad_campaigns` ohne
Serving-Anbindung.

## E – Fehlende Komponenten

1. `AdSource`-Feld (`internal | adsense | partner | market_promo`) im
   `AdPlanSlot` und eine Registry, die pro Platz die Quelle bestimmt.
2. Adaptervertrag im Code wiederherstellen (`src/lib/ads/provider.shared.ts`).
3. Slot-Typ „fremdgerendert“ (Container statt Creative-Daten) für AdSense.
4. AdSense-Publisher-ID als serverseitiges Secret + Kontofreigabe durch Google
   (Domainprüfung, `ads.txt` unter `public/`).
5. Produktive Impression-/Klick-Messung getrennt von `ad_test_events`.
6. Anbindung von `ad_campaigns` an die Poolbildung (eigene Kampagnen).
7. Consent-Signal (siehe F) als Parameter der Poolbildung.

## F – Datenschutz / Consent

Bestand: Personalisierung wird in der Datenschutzerklärung (Abschnitte 12/12a)
offengelegt, Werbeeinstellungen und Werbepause sind vorhanden, Werbung wird im
Feed als „GESPONSERT“ gekennzeichnet, die Auswahl passiert serverseitig ohne
Drittanbieter-Kommunikation, es gibt heute **keine Werbe-Cookies, keine
Ad-Identifier und keine Datenweitergabe an Dritte**.

Offene Aufgaben – ausschließlich für den Fall einer AdSense-Aktivierung
(bewusst noch nicht umgesetzt):

- **CMP/TCF v2.2 erforderlich**: Google verlangt für EU/EWR/UK/CH eine
  zertifizierte Consent-Plattform. Ohne Consent nur „nicht personalisierte
  Werbung“ (`requestNonPersonalizedAds`), Consent Mode v2 als Default „denied“.
- Cookie-/Local-Storage-Hinweis und Drittanbieterliste (Google Ireland Ltd.,
  Datenübermittlung USA, Art. 44 ff. DSGVO) in die Datenschutzerklärung.
- Widerrufsmöglichkeit („Einwilligungen ändern“) dauerhaft erreichbar.
- Kein Ausspielen personalisierter Werbung an Minderjährigen-Konten.

Keine bestehende Datenschutzmaßnahme wurde entfernt.

## G – Empfohlene Architektur

```text
Feed  →  getFeedAdPlan (Server Function, auth)
            │
            ▼
      Y-Dude Werbekernel  (Scoring, Abstände, Caps, Pause, Kennzeichnung)
            │  fragt Quellen an, entscheidet pro Platz
   ┌────────┼──────────────┬───────────────────┬──────────────────┐
   ▼        ▼              ▼                   ▼                  ▼
eigene   Market-        AdSense-Slot        weitere            interner
Kampagnen Promotions    (fremdgerendert)    Partner (API)      Demobestand
(ad_campaigns)(market_promotions)                              (nur Admin+Test)
```

Regeln: der Browser spricht nie direkt mit einem Werbeanbieter (Ausnahme: der
von AdSense selbst gerenderte Container), jede Quelle liefert `AdCatalogEntry`
plus Quellenkennung, das Ranking bleibt beim Kernel, AdSense wird **an genau
einer Stelle** als Slot-Typ eingebunden – nicht pro Seite. Reihenfolge der
Umsetzung: Quellenkennung → Adaptervertrag → eigene Kampagnen → CMP →
AdSense-Freigabe → AdSense-Slot.

**AdSense ist nicht aktiviert und wird ohne ausdrückliche Freigabe nicht
aktiviert.**

---

# Nachtrag 27.08.2026 – AdSense-Anschluss (vorbereitet, INAKTIV)

## Adaptervertrag

`src/lib/ads/provider.shared.ts`: `AdSource` (`internal` | `market_promotion` |
`adsense` | `demo`), `AdSlotRequest` (Art, Position, Interessen, Region,
gesehene IDs), `AdProvider` (`source`, `label`, `available()`, `fill()`) sowie
`fillSlot()` – die einzige Stelle, an der Quellen um einen Platz konkurrieren.
Reihenfolge: eigene Kampagnen → Market-Promotions → AdSense → Demobestand.
`AdPlanSlot` trägt jetzt `source`; fehlt sie (alte Pläne), gilt `demo`.
Registriert werden Quellen ausschließlich in `src/lib/ads/registry.server.ts`.

## AdSense im Kernel

`ad-plan.server.ts` fragt pro geplantem Platz zuerst die Quellen, danach – nur
mit Freigabe – den Demobestand. Ist keine Quelle bereit und der Demobestand
gesperrt, bleibt der Plan leer (heutiger Zustand für normale Nutzer).
`src/lib/ads/adsense-provider.ts` liefert einen **fremdgerenderten** Platz
(`adsense-feed`, Art `image`) und nur, wenn Konfiguration, Scharfschaltung und
Consent zusammen zutreffen.

## Publisher-ID

Öffentliche Build-Konfiguration, kein Secret (Google liefert sie ohnehin an jeden
Browser aus): `VITE_ADSENSE_CLIENT_ID=ca-pub-9048855502038895` in `.env`,
ausgelesen ausschließlich in `src/lib/ads/adsense.config.ts`. Scharfschalter:
`VITE_ADSENSE_ENABLED` (aktuell `false`).

## Loader

`src/lib/ads/adsense-loader.ts` ist der einzige Ort, der das Google-Script lädt:
ein Tag mit fester ID, geteilte Zusage bei Mehrfachaufrufen, Zustände
`idle | loading | ready | blocked | error`, kein Wurf bei Werbeblocker. Der von
Google gelieferte Snippet-Code steht nirgends in `index.html`, `__root.tsx` oder
einer Seite. `src/components/ads/AdSenseSlot.tsx` erzeugt genau ein
`adsbygoogle.push({})` pro Fläche; `src/components/ads/AdSlot.tsx` ist der
allgemeine Platz, den Seiten anfordern (Quelle bleibt für sie unsichtbar).

## Consent

`src/lib/ads/adsense-consent.ts`: Zustände `unknown | denied |
non_personalized | personalized` plus `fromCmp` und `minor`. Geladen wird nur bei
einer echten CMP-Entscheidung (`fromCmp === true`); personalisiert nie für
Minderjährige; `data-npa=1` in allen übrigen Fällen; Widerruf = `denied`.
Da Y-Dude **keine** zertifizierte CMP (TCF v2.2) hat, ist der Zustand `unknown`
→ AdSense lädt nicht und kontaktiert Google nicht. Es wird keine Einwilligung
simuliert.

## ads.txt

Google-Vorgabe (AdSense-Hilfe „Ads.txt guide"), eine Zeile pro autorisiertem
Verkäufer, Datei im Domain-Root:

```text
google.com, pub-9048855502038895, DIRECT, f08c47fec0942fa0
```

Speicherort: `public/ads.txt` → ausgeliefert unter `https://y-dude.com/ads.txt`
und `https://www.y-dude.com/ads.txt`. Angelegt. Nach Freigabe im AdSense-Konto
unter „Websites" prüfen, dass die Datei als gefunden gemeldet wird.

## Messung

Keine neue Messung, keine Wiederverwendung der gelöschten `ad_test_events`. Die
Testmessung (`recordAdTestEvent`) bleibt unverändert dem Werbe-Testmodus
zugeordnet. AdSense-Impressionen und -Klicks zählt ausschließlich Google; sie
werden nicht simuliert, nicht gespiegelt und nicht in Y-Dude-Tabellen erzeugt.

## Für die Aktivierung fehlt noch

1. Zertifizierte CMP mit TCF v2.2 und Consent Mode v2 (Default „denied"),
   Widerruf dauerhaft erreichbar.
2. Datenschutzerklärung: Google Ireland Ltd. als Empfänger, Cookies/Local
   Storage, Drittlandübermittlung (Art. 44 ff. DSGVO).
3. Google-Websiteprüfung des AdSense-Kontos abgeschlossen.
4. Anzeigenblöcke in AdSense anlegen und ihre `data-ad-slot`-IDs als
   Konfiguration hinterlegen (`AdSlot`-Eigenschaft `adsenseUnitId`).
5. ads.txt-Status im AdSense-Konto bestätigt.
6. Erst dann `VITE_ADSENSE_ENABLED=true`.

**AdSense bleibt bis dahin bewusst inaktiv.** Der Kernel funktioniert ohne
AdSense unverändert.
