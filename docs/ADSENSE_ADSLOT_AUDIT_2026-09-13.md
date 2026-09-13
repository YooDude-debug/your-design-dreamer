# AdSense / AdSlot – Audit (13.09.2026)

Nur Analyse, keine Änderungen. Geprüft: `src/components/ads/AdSenseSlot.tsx`,
`src/components/ads/AdSlot.tsx`, `src/lib/ads/adsense-loader.ts`.

## Gesamtbild

Y-Dude hat einen eigenen Werbekernel: Quellen-Registry
(`src/lib/ads/registry.server.ts`) mit Priorität
`internal | market_promotion | adsense | demo`
(`src/lib/ads/provider.shared.ts`), serverseitiger Werbeplan
(`src/lib/ad-plan.server.ts`), Feed-Rendering in
`src/routes/_authenticated/feed.tsx` (eigene Kampagnen, Market-Promotions,
Videowerbung via `FeedVideoAdCard`/`FeedVideoAdOverlay`, Demobestand,
Admin-Testmodus).

AdSense ist in diesen Kernel **bewusst und dokumentiert deaktiviert**
eingebaut – kein Dead Code, sondern abgeschaltete, getestete Infrastruktur:

- `VITE_ADSENSE_CLIENT_ID=ca-pub-9048855502038895` in `.env` gesetzt,
  `VITE_ADSENSE_ENABLED=false` (Scharfschalter aus).
- `registry.server.ts` Kommentar: „`adsense` registriert, aber bewusst
  inaktiv (keine Scharfschaltung…)"; Provider wird mit
  `DEFAULT_ADS_CONSENT` erzeugt und liefert nie Plätze.
- `adsense-consent.ts`: Laden nur bei echter CMP-Entscheidung (TCF v2.2);
  Y-Dude hat keine zertifizierte CMP → Zustand `unknown` → kein Laden,
  kein Google-Kontakt.
- Feed rendert `source === "adsense_preview"` als visuellen Platzhalter
  (`AdSenseDevSlot`, nur Admin/Demo) – exakt an der Position, an der später
  ein echter AdSense-Platz läge.
- Doku: `docs/WERBESYSTEM_AUDIT_2026-08-27.md` beschreibt Loader, Slot,
  Consent und Scharfschalter ausdrücklich als Zielarchitektur.
- Tests: `tests/adsense-provider.test.ts` deckt u. a. den Loader ab
  (`loadAdsense`, `blocked` ohne Consent/Konfiguration, geteilte Zusage).

## Datei 1: `src/lib/ads/adsense-loader.ts`

- **Status:** bewusst deaktiviert, aktiv getestet.
- **Aktuell verwendet:** indirekt – einziger Import außerhalb ist
  `AdSenseSlot.tsx`; zusätzlich direkt in `tests/adsense-provider.test.ts`.
- **Direkte Referenzen:** `AdSenseSlot.tsx`, Test.
- **Indirekte Referenzen:** keine Routen/Layouts; kein Google-Script in
  `index.html`/`__root.tsx`.
- **Abhängigkeiten:** `adsense.config.ts` (Client-ID, Script-URL,
  Scharfschalter).
- **Was macht die Datei:** lädt das AdSense-Script genau einmal pro Seite
  (feste Script-ID, geteilte Promise, Zustände
  `idle|loading|ready|blocked|error`, Fehler als Zustand statt Wurf –
  werbeblockersicher).
- **Ersetzt?** Nein – kein anderer Loader existiert.
- **Bewusst deaktiviert?** Ja (`VITE_ADSENSE_ENABLED=false`, Consent-Gate).
- **Risiko beim Entfernen:** Test bricht; Reaktivierung müsste den
  werbeblockersicheren Einmal-Loader neu bauen; Doku verliert Bezug.
- **Empfehlung:** 🟡 BEHALTEN.

## Datei 2: `src/components/ads/AdSenseSlot.tsx`

- **Status:** fertige, aber unerreichbare Renderer-Komponente.
- **Aktuell verwendet:** nur von `AdSlot.tsx` (der selbst nirgends
  eingebunden ist).
- **Direkte Referenzen:** `AdSlot.tsx`.
- **Indirekte Referenzen:** keine; Feed hat keinen Renderzweig für
  `source === "adsense"`.
- **Abhängigkeiten:** `adsense.config`, `adsense-consent`, `adsense-loader`.
- **Was macht die Datei:** rendert die eigentliche `<ins class="adsbygoogle">`-
  Fläche mit Client-ID, Slot-ID, `data-npa`-Flag; genau ein
  `adsbygoogle.push({})` pro Fläche; ohne Konfiguration/Consent/Slot-ID
  rendert sie nichts und kontaktiert Google nicht.
- **Ersetzt?** Nein – `AdSenseDevSlot` ist nur ein visueller Platzhalter,
  kein Ersatz.
- **Bewusst deaktiviert?** Ja – über dieselbe Scharfschaltung.
- **Risiko beim Entfernen:** Reaktivierung bräuchte einen neuen,
  consent-konformen Renderer; Verlust der Ein-Push-Logik (Doppelinitialisierung
  würde Impressionen doppelt zählen).
- **Empfehlung:** 🟡 BEHALTEN.

## Datei 3: `src/components/ads/AdSlot.tsx`

- **Status:** geplanter allgemeiner Dispatcher, aktuell nirgends importiert.
- **Aktuell verwendet:** nein (kein Import in `src/`, nur Erwähnung in
  `docs/WERBESYSTEM_AUDIT_2026-08-27.md`).
- **Direkte Referenzen:** keine.
- **Indirekte Referenzen:** keine (kein dynamischer Import, kein
  String-Pfad).
- **Abhängigkeiten:** `ad-catalog.shared` (Typen), `adsense-consent` (Typ),
  `AdSenseSlot`.
- **Was macht die Datei:** allgemeiner Werbeplatz – Seiten fordern einen Platz
  an, ohne die Quelle zu kennen; bei `source === "adsense"` rendert er
  `AdSenseSlot`, sonst die bestehende interne Karte (`renderInternal`).
- **Ersetzt?** Teilweise – der Feed rendert Plätze heute inline
  (`feed.tsx`), ohne diesen Dispatcher.
- **Bewusst deaktiviert?** Ja – er ist das vorgesehene Bindeglied für die
  AdSense-Aktivierung (Doku: „der allgemeine Platz, den Seiten anfordern").
- **Risiko beim Entfernen:** Reaktivierung bräuchte eine neue
  Quellen-Dispatcher-Komponente; gering, aber bezweckt.
- **Empfehlung:** 🟡 BEHALTEN.

## Zusatzfrage: Reaktivierbarkeit

Ja, technisch sinnvoll reaktivierbar – die Integration ist fertig gebaut.

**Bereits vorhanden:** Publisher-ID in `.env`; Scharfschalter; Consent-Gate
(inkl. Minderjährigen-/NPA-Logik); einmaliger Script-Loader; Renderer mit
Ein-Push-Logik; Kernel-Provider (`adsense-provider.ts`), der bei
Scharfschaltung + CMP-Consent automatisch `source: "adsense"`-Plätze plant;
Dev-Platzhalter im Feed an der exakten Zielposition; Tests; Doku.

**Was fehlen würde:**
1. Zertifizierte CMP (TCF v2.2) – ohne sie bleibt das Consent-Gate bewusst
   zu; das ist die größte fehlende externe Voraussetzung.
2. `VITE_ADSENSE_ENABLED=true` (Build-Konfiguration, kein Secret).
3. Echte AdSense-Anzeigenblock-ID (`unitId`/`data-ad-slot`) aus dem
   AdSense-Konto – heute nur Platzhalter-Kennung `adsense-feed`.
4. Renderzweig im Feed für `source === "adsense"` über `AdSlot` (bzw.
   `AdSenseSlot`) – betroffen: `src/routes/_authenticated/feed.tsx`.

**DB-/Backend-Änderung nötig?** Nein. Der Werbeplan läuft serverseitig
bereits über die Registry; AdSense-Plätze benötigen keine Tabellen, RLS-
oder Auth-Änderungen.

## Entscheidung

1. `AdSenseSlot.tsx` → 🟡 BEHALTEN
2. `AdSlot.tsx` → 🟡 BEHALTEN
3. `adsense-loader.ts` → 🟡 BEHALTEN

**Empfohlener nächster Schritt:** behalten. Kein Löschen – die Dateien sind
dokumentiert abgeschaltete Zielarchitektur mit Tests, kein Dead Code.
Aktivierung erst, wenn eine TCF-v2.2-CMP angebunden ist; dann als eigener
Schritt: Scharfschalter, Slot-ID, Feed-Renderzweig (4 kleine Punkte, keine
DB-Änderung).
