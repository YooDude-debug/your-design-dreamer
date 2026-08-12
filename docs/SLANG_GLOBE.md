# Slang Globe – eigenständiges Modul

Interaktive 3D-Weltkugel (`/globe`) als Grundlage für die künftige weltweite
Slang-Karte. Vollständig getrennt von Feed, Arena und Datenbank.

## Struktur

```
src/routes/_authenticated/globe.tsx   Seite (lazy + ClientOnly, kein SSR von three.js)
src/components/globe/GlobeStage.tsx   Bühne: Filter, Suche, Overlay, Engine-Lifecycle
src/components/globe/GlobeFilterBar.tsx
src/components/globe/GlobeSearch.tsx
src/components/globe/RegionOverlay.tsx
src/lib/globe/globe-engine.ts         three.js-Engine (ein RAF-Loop, keine React-Renders pro Frame)
src/lib/globe/demo-data.ts            Simulierte Daten hinter `GlobeDataSource`
src/lib/globe/types.ts                Typen inkl. Datenquellen-Abstraktion
src/data/land-50m.json                Umrisse LOD 1 (Natural Earth 50m, Public Domain)
src/data/land-10m.json                Umrisse LOD 2 (Natural Earth 10m, lazy nachgeladen)
```

## SlangTag-Satelliten

- `src/lib/globe/satellites.ts` – Auswahl-/Datenlogik: aus den (gefilterten)
  Regionen werden pro Region die relevantesten SlangTags als Kandidaten mit
  Lat/Lng, Umlaufhöhe und Phase gebildet. Live-Daten mit eigener Geoposition
  benötigen nur eine Anpassung von `buildCandidates`.
- `src/components/globe/GlobeSatelliteLayer.tsx` – Overlay: Ankerpunkt auf der
  Kugel, schwebende Bubble (SlangTag, Mini-Waveform, Land) und pulsierender
  neon-grüner Connect-Strahl. Positionen kommen pro Frame aus
  `GlobeEngine.project(lat, lng, radius)`; React rendert nur bei Auswahlwechsel.
- Sichtbarkeit rein rotationsabhängig (`facing`): Einblenden ab 0.5, Entfernen
  unter 0.22, maximal 8 gleichzeitig, höchstens ein neuer Tag pro ~0,85 s
  (zeitversetztes Erscheinen). `prefers-reduced-motion` deaktiviert Bahn- und
  Pulsbewegung. Klick öffnet die bestehende SlangTag-/Arena-Ansicht.

## Performance

- Ein einziger `requestAnimationFrame`-Loop; Rotation, Zoom und Puls laufen als
  GPU-Shader bzw. Matrix-Updates, nicht über React-State.
- Heatmap als ein `Points`-Objekt mit eigenem Shader (Farbverlauf grün → gelb → rot,
  weicher Puls, Rückseiten-Discard) – auch bei vielen Punkten ein Draw-Call.
- `devicePixelRatio` auf 2 begrenzt, Rendering pausiert bei versteckter Seite
  (`visibilitychange`) und außerhalb des Viewports (`IntersectionObserver`).
- Steuerung: 1:1-Drag (Pixel → Bogenmaß über FOV/Distanz), Trägheit mit
  exponentieller Dämpfung, Auto-Rotation pausiert bei Berührung und läuft nach
  3 s Ruhe sanft wieder an; Pinch/Wheel gedämpft.
- LOD: 50m-Textur (bis 4096 px) als Basis, 10m-Textur (bis 8192 px) wird beim
  Hineinzoomen einmalig nachgeladen.
- Engine wird per `lazy()` erst im Browser geladen; `dispose()` gibt Geometrien,
  Materialien und den WebGL-Kontext frei.

## Navigation

Spiegelbildlich zur SlangTag Arena. Im Feed:
- leicht links → deutlich rechts: Arena (unverändert)
- leicht rechts → deutlich links: Slang Globe (neu)
- Edge Peek: rechter Rand = Arena (unverändert), linker Rand = Slang Globe

## Erweiterbarkeit

`GlobeDataSource` kapselt die Datenherkunft. Für Live-Daten, Echtzeit-Heatmap,
Zeitreise, Ausbreitung einzelner SlangTags, Audio, KI-Auswertungen, Statistiken
oder Ranglisten genügt eine weitere Implementierung dieser Schnittstelle plus
optionale UI-Ebenen über der Bühne – die Engine bleibt unverändert.

## Lizenzen

| Baustein | Lizenz |
| --- | --- |
| three (0.185) | MIT |
| @types/three | MIT |
| lucide-react (Icons, bestehend) | ISC |
| React, TanStack Router/Start (bestehend) | MIT |
| Tailwind CSS (bestehend) | MIT |
| Natural Earth Land 110m/50m/10m (`src/data/land-*.json`) | Public Domain (Natural Earth) |

Alle Bestandteile sind kostenlos und kommerziell frei nutzbar; es werden keine
kostenpflichtigen Karten-, Textur- oder Font-Assets eingesetzt. Sterne, Atmosphäre
und Kontinentflächen werden zur Laufzeit generiert (kein Bildmaterial Dritter).

## Bedeutung in der Profilsprache (Globe → Arena)

- `src/lib/globe/tag-meanings.ts` – kurze Bedeutung je SlangTag in DE/EN/EL
  (`tagMeaning`) plus Zuordnung der im Profil gespeicherten Sprache auf den
  bestehenden `Lang`-Code (`profileLang`). Weitere Sprachen: Schlüssel in den
  Tupeln ergänzen.
- `src/components/globe/RegionOverlay.tsx` – zeigt unter dem Originalbegriff die
  Bedeutung in der Profilsprache plus Land; jede Zeile verlinkt auf die
  bestehende SlangTag-/Arena-Ansicht (`/slangtag/$name`). Fehlt eine Bedeutung,
  erscheint ein neutraler Hinweis; der Originalbegriff bleibt immer sichtbar.
- `src/routes/_authenticated/slangtag.$name.tsx` – zusätzliche Zeile
  „Bedeutung“ in der Profilsprache (Rückfall: gespeicherte `meaning` aus der
  Datenbank). Audio, Stats, Voting und Kommentare unverändert.
- `src/lib/i18n-arena.ts` – neue Schlüssel `meaningLabel`, `openInArena`,
  `noMeaningYet` in DE/EN/EL.

Maßgeblich ist `profiles.language`; die Oberflächensprache greift nur als
Rückfall. Es wird keine zweite Übersetzungsarchitektur eingeführt.
