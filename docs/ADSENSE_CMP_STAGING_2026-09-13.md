# AdSense + Google-CMP – Staging-Prüfung (13.09.2026, 2. Durchgang)

Status: **Aktivierung weiterhin blockiert.** `VITE_ADSENSE_ENABLED` bleibt `false`.
Nur der echte TCF-Anschluss wurde ergänzt; keine simulierte Zustimmung.

## Messergebnis (Playwright)

| Prüfung | Ergebnis |
| --- | --- |
| CMP-Script `fundingchoicesmessages.google.com/i/pub-9048855502038895?ers=1` | HTTP 200, ~23 kB |
| Nach Laden im Staging (localhost:8080): `window.__tcfapi` | **undefined** – keine TCF-API, kein Consent-Dialog |
| `https://y-dude.com/` | kein CMP-Script eingebunden, `__tcfapi` undefined |
| `https://y-dude-staging.lovable.app/` | kein CMP-Script eingebunden, `__tcfapi` undefined |
| Flag `false`, Mobile 393×852 / Desktop 1280×900 | 0 Google-Requests, 0 `ins.adsbygoogle`, 0 Anzeigen-Scripts, keine Console-Fehler |

Fazit: Die in AdSense veröffentlichte Privacy-&-Messaging-Nachricht liefert für
diese Hosts **keine** TCF-API und damit keinen Consent-String. Mögliche Gründe
(außerhalb des Codes): Nachricht nur für `y-dude.com` freigegeben, Website in
AdSense noch nicht geprüft/genehmigt, Nachricht nicht für alle Regionen/Hosts
aktiv. Ohne TCF-Status bleibt das bestehende Gate zu (Prinzip: keine erfundene
Einwilligung).

## Neu (Staging)

- `src/lib/ads/tcf-consent.ts` – liest den echten TCF-Zustand (`__tcfapi`,
  `addEventListener`), lädt das Google-CMP-Script einmalig (nur bei
  Scharfschaltung), bildet TCData auf `AdsConsentState` ab:
  keine Entscheidung → `unknown`; ohne Zweck 1 oder ohne Google-Vendor (755)
  → `denied`; Zwecke 3+4 → personalisiert; sonst nicht personalisiert;
  `gdprApplies === false` → Auslieferung erlaubt.
- `src/lib/ads/use-ads-consent.ts` – Hook: gespeicherte CMP-Entscheidung +
  laufende TCF-Aktualisierung; speichert ausschließlich `fromCmp`-Zustände.
- `src/components/ads/FeedAdSenseSlot.tsx` – nutzt jetzt diesen Hook statt nur
  den gespeicherten Wert.
- `tests/adsense-tcf-consent.test.ts` – 7 Tests zur Abbildung.

Unverändert: `adsense-consent.ts`, `adsense-loader.ts`, `adsense.config.ts`,
`AdSenseSlot.tsx`, `AdSlot.tsx`, Feed-Renderzweig, Werbekernel/Registry/
Werbeplan, eigene Kampagnen, Market-Highlights, Videowerbung, Demo/Admin,
Datenbank, RLS, Auth, Messenger, Globe/Arena, Market, Profil, SlangTag, Push,
Übersetzung, Service Worker, Production.

## Fehlende Voraussetzungen

1. **CMP muss für die Staging-/Testdomain ausgeliefert werden.** Die Nachricht
   in AdSense („Datenschutz und Mitteilungen") gilt pro Website; Staging läuft
   unter `*.lovable.app`. Ohne Auslieferung dort ist kein Test mit echtem
   Consent möglich.
2. **AdSense-Websiteprüfung/Genehmigung für y-dude.com** – vorher liefert Google
   weder CMP-Nachricht noch Anzeigen.
3. **Consent-Transport zur serverseitigen Werbeplanung.** `registry.server.ts`
   erzeugt die AdSense-Quelle mit `DEFAULT_ADS_CONSENT`; der Kernel plant daher
   keinen `source: "adsense"`-Platz. Der Feed-Zweig ist vorbereitet, aber noch
   unerreicht. Änderung erst nach Freigabe (betrifft den Werbekernel).
4. Erst danach `VITE_ADSENSE_ENABLED=true` – ausschließlich Staging.

## Prüfungen

Typecheck ✅ · Lint ✅ (0 Fehler, 40 Altwarnungen) · Build ✅ ·
Tests 686/686 ✅ · Mobile/Desktop-Smoke ✅ · Network/Consent ✅.
Keine Migration, keine Veröffentlichung, Production unverändert.
