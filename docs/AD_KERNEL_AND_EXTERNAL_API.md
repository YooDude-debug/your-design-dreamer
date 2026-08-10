# Y-Dude Werbekernel – Analyse, Architektur & API-Anbindung

Stand: 09.08.2026. Dieses Dokument **beschreibt** den bestehenden Werbekernel.
Es wurde nichts an der Ranking- oder Werbelogik geändert. Neu hinzugefügt wurde
ausschließlich eine bisher fehlende, inaktive Adapter-Schnittstelle
(`src/lib/ads/provider.shared.ts`).

## 1. Bestandsaufnahme – Dateien

| Datei | Rolle |
|---|---|
| `src/lib/ad-catalog.shared.ts` | Werbekatalog-Metadaten (id, kind, filters, regionCode), Video-Regeln (Skip 2 s, 15/30 s), Typen `AdPlan`/`AdPlanSlot` |
| `src/lib/ad-demo.ts` | Internes Bildwerbe-Format `SponsoredAd` (Firma, Headline, Body, CTA, Bild, URL, SlangDrop) + Filterliste |
| `src/lib/ad-video-demo.ts` | Internes Videoformat `VideoAd` (Poster + Videoquelle) |
| `src/lib/ad-plan.server.ts` | **Der Algorithmus**: lädt Nutzersignale, gewichtet, erzeugt den Werbeplan |
| `src/lib/ads.functions.ts` | Server Function `getFeedAdPlan` (auth-pflichtig) |
| `src/lib/use-feed-ad-plan.ts` | Client: Plan → Feedpositionen, Dismiss, „seen“-Rückmeldung |
| `src/lib/ad-test-counter.ts` | Live-Test-Zähler (15/25 Interaktionen) + Event-Logging |
| `src/lib/live-test.{shared,server,functions}.ts` | Testmodus, Ereignisarten, Metriken |
| `src/lib/ad-pause.ts` | Werbepause (3 pro Kalendermonat, bis 24:00 Ortszeit) |
| `src/components/feed/FeedAdCard.tsx` / `FeedVideoAdCard.tsx` | Darstellung + Events |
| `src/lib/interest-engine/*` | Interessen-/Profilsystem, Quelle der Personalisierung |

## 2. Wie der Algorithmus heute funktioniert

### 2.1 Verwendete Nutzerdaten/Signale
`loadViewer()` in `ad-plan.server.ts` liest genau drei Dinge – RLS-konform als
angemeldeter Nutzer:

1. `interest_confidence` (confidence ≥ 0.2, Top 20, absteigend) → Interessen-Slugs
2. `user_interests` (selbst gewählte Interessen, Top 20) → Interessen-Slugs
3. `profiles.location` → grobe Region; heute wird daraus nur `"DE"` oder `""` abgeleitet

Mehr Nutzerdaten fließen **nicht** in die Werbeauswahl. Keine Klarnamen, keine
E-Mail, keine Nachrichteninhalte, keine Präzisionskoordinaten.

### 2.2 Berücksichtigte Interessen
Die Slugs aus der Interest Engine (`travel`, `hotels`, `food`, `events`,
`language`, `shopping`, …). Die Engine selbst bildet sie aus Interaktionen
(`points.*` in `interest-engine/config.ts`), mit Confidence-Schwelle
(`confidence.threshold`, `min_events`, `min_days`) und Zeitverfall
(`decay.half_life_days = 21`).

### 2.3 Faktoren des Ad-Scores (`weightFor`)
Startgewicht `w = 1`, dann:

- **+3 pro Themen-Treffer** zwischen `entry.filters` und Interessen-Slug
  (bidirektionaler `includes`-Match)
- **+2 Regionstreffer**, wenn `regionCode` ≠ `*` und exakt der Nutzerregion entspricht
- **Fatigue-Dämpfung**: bereits gesehene Ad-IDs → `w = max(0.35, w * 0.35)`
- Zusätzlich hart ausgeschlossen: die letzten 3 ausgelieferten IDs (`recent`)

### 2.4 Auswahl einer Werbung
1. `nextKind()` bestimmt die Werbeart: Video mit `VIDEO_SHARE = 0.35`, jedoch
   niemals drei gleiche Arten in Folge.
2. Aus dem passenden Pool (`IMAGE_AD_CATALOG` / `VIDEO_AD_CATALOG`) zieht
   `weightedPick()` gewichtet-zufällig (Roulette-Wheel über die Score-Summe).
3. Positionierung: erster Slot nach `6–12` Beiträgen, danach Abstände `8–18`.
   Insgesamt `SLOTS = 14` geplante Plätze. Der Zufall entsteht serverseitig.
4. Der Client (`use-feed-ad-plan.ts`) bildet `afterIndex` auf Feedpositionen ab;
   weggeklickte Werbung bleibt am Beitrag verankert.

### 2.5 Frequency Caps
Es gibt drei voneinander unabhängige Mechanismen:

- **Abstands-Cap**: variable Lücken 6–12 / 8–18 Beiträge, max. 14 Slots pro Plan.
- **Wiederholungs-Cap**: `seenIds` (Client sendet die letzten 20) dämpft auf 35 %;
  `recent` (letzte 3) sperrt hart; nie zwei identische Arten dreimal hintereinander.
- **Live-Test-Cap**: `ad-test-counter.ts` bindet die Testkarte an genau einen
  Beitrag, sobald 15 bzw. 25 echte Feed-Interaktionen erreicht sind.
- **Werbepause**: `ad-pause.ts`, 3 Pausen pro Kalendermonat bis 24:00 Ortszeit;
  zusätzlich der globale Admin-Schalter (`profiles.ads_enabled`).

### 2.6 Rückfließende Events
`AD_TEST_KINDS` in `live-test.shared.ts`: `ad_scheduled`, `ad_impression`,
`ad_click`, `ad_slangtag_play`, `ad_skip`, `feed_impression`, `feed_step`.
Geschrieben von `FeedAdCard`/`FeedVideoAdCard` über `recordAdTestEvent` in
`ad_test_events`; ausgewertet in `live-test.server.ts` (Impressionen, Klicks,
Skips, Ø Interaktionen, Ø Position) und im Admin-Cockpit `/admin/livetest`.
Zusätzlich meldet der Client jede gezeigte Ad-ID als `seen` zurück → wirkt
direkt auf die Fatigue-Dämpfung des nächsten Plans.

### 2.7 Wo das Ranking stattfindet
Ausschließlich serverseitig in `buildFeedAdPlan()` (`ad-plan.server.ts`),
aufgerufen über die auth-pflichtige Server Function `getFeedAdPlan`. Der Client
rankt nicht, er platziert nur.

## 3. Anbindungspunkt für eine externe Werbe-API

Genau **eine** Stelle: die Pool-Bildung in `buildFeedAdPlan()`.

```
const pool = kind === "video" ? VIDEO_AD_CATALOG : IMAGE_AD_CATALOG;
```

Künftig wird dieser Pool ergänzt (nicht ersetzt) durch die aus der externen API
normalisierten Einträge. Alles danach – `weightFor`, `weightedPick`,
`nextKind`, Abstände, Caps, Events – bleibt unangetastet, weil externe Creatives
in denselben `AdCatalogEntry`-Typ übersetzt werden.

Die dafür nötige Schnittstelle liegt neu in `src/lib/ads/provider.shared.ts`
(`AdProvider`, `AdTargetingSignal`, `ExternalAdCreative`, `toCatalogEntry`,
`nullAdProvider`). Sie ist noch **nicht verdrahtet**: heute liefert
`nullAdProvider` bewusst nichts, der interne Katalog bleibt einzige Quelle.

## 4. Entwickleranleitung: echte externe Werbe-API anschließen

### Schritt 1 – Provider implementieren
Neue Datei `src/lib/ads/provider-<name>.server.ts`, Implementierung des
`AdProvider`-Vertrags. `fetchAds()` darf **nie werfen** – bei Fehler/Timeout
`{ creatives: [] }` zurückgeben.

```ts
export const acmeProvider: AdProvider = {
  id: "acme",
  fetchAds: async (signal) => {
    const key = process.env["ACME_ADS_API_KEY"]; // nur im Handler lesen
    if (!key) return { providerId: "acme", creatives: [], ttlSeconds: 60 };
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 800); // hartes Budget
    try {
      const res = await fetch("https://api.acme.example/v1/ads", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          audience: signal.interests,      // max. 3 Slugs
          country: signal.regionCode,      // grobe Region
          lang: signal.language,
          formats: signal.kinds,
          personalized: signal.personalized,
          limit: signal.limit,
          request_id: signal.pseudoId,     // rotierendes Pseudonym
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) return { providerId: "acme", creatives: [], ttlSeconds: 30 };
      const json = await res.json();
      return { providerId: "acme", creatives: mapAcme(json), ttlSeconds: 300 };
    } catch {
      return { providerId: "acme", creatives: [], ttlSeconds: 30 };
    } finally {
      clearTimeout(t);
    }
  },
};
```

### Schritt 2 – API-Key sicher speichern
Der Key wird als serverseitiges Secret über die Secret-Verwaltung von Lovable
angelegt (`ACME_ADS_API_KEY`) und ausschließlich mit `process.env[...]`
**innerhalb** eines Handlers gelesen. Nie `VITE_`-Präfix, nie im Client-Bundle,
nie im Repository. Das Modul heißt `*.server.ts`, damit es nicht ins
Client-Bundle gelangen kann.

### Schritt 3 – Server Function als Vermittler
Der Browser spricht **niemals** direkt mit dem Werbeanbieter. Vermittler ist die
bestehende Server Function `getFeedAdPlan` (`src/lib/ads.functions.ts`) mit
`requireSupabaseAuth`. Sie ruft weiterhin nur `buildFeedAdPlan()`. Innerhalb von
`buildFeedAdPlan()` wird der Provider dynamisch geladen:

```ts
const { acmeProvider } = await import("./ads/provider-acme.server");
const ext = await acmeProvider.fetchAds(signalFromViewer(viewer));
const extEntries = ext.creatives.map((c) => toCatalogEntry(ext.providerId, c));
// Pool ergänzen, Rest der Funktion unverändert:
const pool = [...(kind === "video" ? VIDEO_AD_CATALOG : IMAGE_AD_CATALOG),
              ...extEntries.filter((e) => e.kind === kind)];
```

Für Webhooks/Callbacks eines Anbieters (z. B. Abrechnungs-Pings) wird eine
TanStack-Server-Route unter `src/routes/api/public/…` genutzt, mit
Signaturprüfung im Handler.

### Schritt 4 – Antwort ins interne Format übersetzen
Zwei Ebenen:

1. **Ranking-Ebene** – `toCatalogEntry()` erzeugt aus dem Creative einen
   `AdCatalogEntry` (`id`, `kind`, `filters`, `regionCode`). Damit greift der
   bestehende Score (Themen-Treffer +3, Region +2, Fatigue ×0.35) unverändert.
2. **Darstellungs-Ebene** – Bildwerbung wird auf `SponsoredAd` (`ad-demo.ts`),
   Videowerbung auf `VideoAd` (`ad-video-demo.ts`) abgebildet:
   `company`, `headline`, `body`, `cta`, `url → clickUrl`, `image/video → mediaUrl`,
   `poster → posterUrl`. Fehlt ein Pflichtfeld, wird das Creative verworfen –
   keine halb gefüllten Karten. Die IDs tragen das Präfix `ext:<provider>:<id>`
   (`externalAdId()`), damit interne Demo-IDs kollisionsfrei bleiben.

### Schritt 5 – Nutzerdaten/Interessen an den Algorithmus übergeben
Die Quelle bleibt `loadViewer()`. Daraus wird ein `AdTargetingSignal` gebaut:
Top‑3 Interessen-Slugs, `regionCode` (Land), Sprache, Werbearten, Limit,
`personalized`-Flag und `pseudoId`. `pseudoId` ist ein **rotierendes** HMAC über
User-ID + Tages-Salt (Server-Secret), niemals die echte User-ID.

### Schritt 6 – Welche Daten überhaupt übertragen werden dürfen
| Übertragbar (minimal) | Bleibt intern |
|---|---|
| max. 3 Interessen-Slugs | vollständiges Interessenprofil, Confidence-Werte |
| Ländercode (`DE`) | `profiles.location`, Ortsangaben, Koordinaten |
| Sprachcode | Username, echter Name, E-Mail, Avatar |
| Werbeart, Limit | Beiträge, SlangTags, Nachrichten, Connections |
| rotierendes Pseudonym | User-ID, Session, Tokens, IP wenn vermeidbar |

### Schritt 7 – Impressionen und Klicks zurückmelden
Der Client feuert weiterhin nur die bestehenden Events (`ad_impression`,
`ad_click`, `ad_skip`) über `recordAdTestEvent`. Die Weitergabe an den Anbieter
erfolgt **serverseitig** über `AdProvider.reportEvent()` mit den opaken
`impressionToken`/`clickToken`. Vorteil: keine Drittanbieter-Requests aus dem
Browser, keine Tracking-Pixel, keine IP-Weitergabe.

### Schritt 8 – Fehler, Timeouts, keine Werbung
- Timeout-Budget ≤ 800 ms pro Anfrage (`AbortController`).
- Jeder Fehlerpfad liefert eine leere Liste → der interne Katalog trägt den Plan.
  Der Feed ist damit nie leer und wirft nie.
- Ist der Pool nach Filterung leer, greift die bestehende Zeile
  `if (pool.length === 0) break;` – der Plan endet einfach früher.
- Circuit Breaker: nach n Fehlern in Folge den Provider für einige Minuten
  überspringen (Zähler in der Datenbank oder im Cache, nicht im Modulzustand –
  Server-Worker sind zustandslos).

### Schritt 9 – Caching und Rate-Limits
- Antworten pro `(pseudoId, interests, regionCode, kind)` für `ttlSeconds`
  cachen (bestehendes Muster: die serverseitige 60‑s‑Cache-Schicht von
  `bootstrap_user_state()` bzw. `cachedClientRead` clientseitig).
- Der Werbeplan hält 14 Slots; ein Plan pro Sitzung reicht – dadurch bereits
  heute nur ~1 externer Aufruf pro Feed-Sitzung.
- Serverseitiges Rate-Limit pro Nutzer (z. B. ≤ 6 Provider-Aufrufe/Stunde) über
  die bestehende Rate-Limit-Tabelle; bei Überschreitung: Cache oder interner
  Katalog.

## 5. Datenschutz – technische Prüfstellen

Keine Aussage zur rechtlichen Konformität; hier nur die technischen Punkte:

- **Intern bleibt**: Interest Engine (Scores, Confidence, Verfall),
  Interaktionsprotokolle, Standortfeld, Profil-, Post- und Messenger-Daten,
  `ad_test_events`.
- **Ggf. übertragen**: die Tabelle aus Schritt 6 – Slugs, Ländercode, Sprache,
  Format, Pseudonym, Event-Token.
- **Consent-Prüfstelle**: genau ein Ort, `signalFromViewer()` bzw. direkt vor
  `fetchAds()`. Ohne Einwilligung wird `personalized: false` gesetzt **und** das
  Feld `interests` geleert; der Provider erhält dann nur Land, Sprache, Format.
  Der Consent-Zustand gehört in ein Profilfeld (z. B. `ads_personalization`) und
  ist serverseitig zu prüfen – nie nur im Client.
- **Trennung personalisiert / nicht personalisiert**: dieselbe Pipeline, zwei
  Signalformen. Nicht personalisierte Auslieferung nutzt weiterhin den internen
  Algorithmus (Region/Sprache), nur ohne Interessen-Treffer.
- **Datenminimierung**: Slug-Kappung auf 3, Region nur auf Landesebene,
  rotierendes Pseudonym, kein Weiterleiten von IP/User-Agent, serverseitige
  Event-Meldung statt Browser-Pixel, TTL-Caching statt Einzelaufrufe.
- **Löschung**: Pseudonyme rotieren täglich; der bestehende DSGVO-Export/-Löschpfad
  (`account.server.ts`) betrifft nur interne Tabellen – externe Anbieter erhalten
  keine dauerhaften Identifikatoren, an denen eine Löschung nötig würde.

## 6. Test

Es wird **keine** neue Testarchitektur gebaut. Vorhandene Mittel:

- Live-Testmodus (`live-test.functions.ts`, Admin-Cockpit `/admin/livetest`):
  Bots, Intervall 1/3 min, Ad-Frequenz 15/25, Metriken zu Impressionen, Klicks,
  Skips, Ø Position, Ø Interaktionen.
- `ad_test_events` als Messgrundlage – ein externer Provider wird über die
  `ext:<provider>:<id>`-IDs in genau diesen Zahlen sichtbar.
- Admin-Werbeschalter (`profiles.ads_enabled`) und Werbepause zum Gegentest.

## Video-Ad-Abspiellogik (zentral, gilt fuer alle Videoanzeigen)

Die komplette Steuerung liegt in `src/lib/ads/video-ad-playback.ts` und wird von
`FeedVideoAdCard` (Huelle) und `FeedVideoAdOverlay` (Darstellung) genutzt. Es gibt
keine anzeigenspezifische Zweitlogik.

Ablauf fuer jede Videowerbung mit `AdPlanSlot.kind === "video"`:

```text
Karte ≥50% sichtbar → Impression → scroll-snap (block: center)
→ Feed friert ein (freezeFeed) → Autostart stumm nach snapDelayMs
→ Lauter/Leiser/Stumm → Skip gesperrt bis skipAfter (Countdown)
→ Videoende oder Skip (bzw. maxLength) → Overlay zu → Feed exakt freigegeben
```

Standards: `VIDEO_AD_DEFAULT_POLICY` (skipAfter/maxLength aus
`ad-catalog.shared.ts`, snapDelayMs 420, visibleRatio 0.5, volumeStep 0.2).

Neue Kampagne hinzufuegen = nur Konfiguration:
1. Eintrag in `VIDEO_ADS` (`src/lib/ad-video-demo.ts`) mit Medien, Aspect und
   optional `skipAfter` / `maxLength` (ueberschreiben die Kernel-Standards).
2. Eintrag mit gleicher ID in `VIDEO_AD_CATALOG` (`src/lib/ad-catalog.shared.ts`)
   mit Filtern/Region.

Kein weiterer Code notwendig – Einrasten, Feed-Pause, Autostart, Ton, Skip-Gate
und Freigabe gelten automatisch.
