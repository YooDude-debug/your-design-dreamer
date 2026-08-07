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
src/data/land-110m.json               Kontinent-Umrisse (Natural Earth 110m, Public Domain)
```

## Performance

- Ein einziger `requestAnimationFrame`-Loop; Rotation, Zoom und Puls laufen als
  GPU-Shader bzw. Matrix-Updates, nicht über React-State.
- Heatmap als ein `Points`-Objekt mit eigenem Shader (Farbverlauf grün → gelb → rot,
  weicher Puls, Rückseiten-Discard) – auch bei vielen Punkten ein Draw-Call.
- `devicePixelRatio` auf 2 begrenzt, Rendering pausiert bei versteckter Seite
  (`visibilitychange`) und außerhalb des Viewports (`IntersectionObserver`).
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
| Natural Earth 110m Land (`src/data/land-110m.json`) | Public Domain (Natural Earth) |

Alle Bestandteile sind kostenlos und kommerziell frei nutzbar; es werden keine
kostenpflichtigen Karten-, Textur- oder Font-Assets eingesetzt. Sterne, Atmosphäre
und Kontinentflächen werden zur Laufzeit generiert (kein Bildmaterial Dritter).
