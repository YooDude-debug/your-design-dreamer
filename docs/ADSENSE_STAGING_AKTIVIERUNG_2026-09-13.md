# AdSense – Staging-Aktivierung: Vorbereitung (13.09.2026)

Status: **Aktivierung blockiert.** Es wurden ausschließlich die technisch
notwendigen Vorbereitungen umgesetzt. `VITE_ADSENSE_ENABLED` bleibt `false`.

## Geändert (nur Staging)

- `src/lib/ads/adsense.config.ts` – echter Anzeigenblock „Y-Dude Feed":
  `ADSENSE_FEED_SLOT_ID` (`VITE_ADSENSE_FEED_SLOT`, Standard `9614962640`),
  plus `isValidAdsenseSlotId()`.
- `.env` – `VITE_ADSENSE_FEED_SLOT=9614962640` ergänzt;
  `VITE_ADSENSE_ENABLED=false` unverändert, Publisher-ID unverändert.
- `src/components/ads/FeedAdSenseSlot.tsx` (neu) – dünne Klammer Feed →
  vorhandener `AdSlot` → `AdSenseSlot`, Consent aus `readStoredAdsConsent()`,
  Startwert `DEFAULT_ADS_CONSENT` (kein SSR-Opt-in).
- `src/routes/_authenticated/feed.tsx` – Renderzweig für `slot.source ===
  "adsense"` an der bereits vorgesehenen Kernel-Position; Platzierung,
  Frequency Caps, Werbepause, Testmodus und alle übrigen Quellen unverändert.
- `tests/adsense-provider.test.ts` – Test für Anzeigenblock-Kennung.

Unverändert: `AdSenseSlot.tsx`, `AdSlot.tsx`, `adsense-loader.ts`,
`adsense-consent.ts`, `adsense-provider.ts`, `registry.server.ts`,
`ad-plan.server.ts`, eigener Werbekernel (Kampagnen, Market-Highlights,
Videowerbung, Demo/Admin), DB, RLS, Auth, Messenger, Globe/Arena, Market,
Profil, SlangTag, Push, Translation, Service Worker.

## Fehlende Voraussetzungen für die Scharfschaltung

1. **Zertifizierte CMP (TCF v2.2).** `adsenseLoadAllowed()` verlangt
   `fromCmp === true`; ohne CMP bleibt der Zustand `unknown` → kein Script,
   kein Google-Request, kein gerenderter Platz.
2. **Consent-Transport zum Server.** `registry.server.ts` erzeugt die
   AdSense-Quelle mit `DEFAULT_ADS_CONSENT`; solange der Server keine
   CMP-Entscheidung kennt, plant der Kernel keinen `source: "adsense"`-Platz.
   Der Feed-Renderzweig ist damit vorbereitet, aber noch unerreicht.
3. Erst danach `VITE_ADSENSE_ENABLED=true` – ausschließlich in Staging.
