/**
 * Slang Globe – Stadt-Ebene (Level 2/3).
 *
 * Overlay über der 3D-Bühne, gleiche Technik wie der Satellitenlayer:
 * Positionen werden pro Frame imperativ über `engine.project()` gesetzt.
 *
 * Wichtig für die Performance: diese Ebene erzeugt **keine** React-Renders im
 * Animationsloop. Früher wurde pro Frame eine Sichtbarkeitsliste in den State
 * geschrieben (`setVisible`), sobald eine einzige Stadt den Rand der Kugel
 * überschritt – beim Drehen/Zoomen im Deutschland-/Europa-Zoom also praktisch
 * in jedem Frame, mit einem kompletten Re-Render aller Labels und einer
 * `includes()`-Suche pro Label (O(n²)). Genau das verursachte das sporadische
 * Hängen. Jetzt existiert die Liste einmal im DOM und Sichtbarkeit ist rein
 * ein Style-Update (`opacity`/`visibility`) – Optik unverändert.
 *
 * Progressiv: In der Weltansicht ist die Ebene komplett leer (kein DOM).
 * Mit zunehmendem Zoom kommen weitere Stufen hinzu (`cityTier`), beim
 * Herauszoomen verschwinden sie wieder.
 */
import { memo, useEffect, useMemo, useRef } from "react";
import type { GlobeEngine } from "@/lib/globe/globe-engine";
import type { GlobeRegion } from "@/lib/globe/types";
import { citiesForCountry, type GlobeCity } from "@/lib/globe/cities";

/** Ab diesem Wert gilt ein Punkt als sichtbar (Vorderseite). */
const FACE_MIN = 0.16;

type Item = GlobeCity & { key: string; tags: number };

export const GlobeCityLayer = memo(function GlobeCityLayer({
  engine,
  regions,
  countryCode,
  cityTier,
}: {
  engine: GlobeEngine | null;
  regions: GlobeRegion[];
  countryCode: string | null;
  cityTier: 0 | 1 | 2 | 3;
}) {
  /**
   * Nur die Städte der aktuellen Stufe – plus die Anzahl lokaler SlangTags,
   * falls es zu dieser Stadt bereits Slang-Daten gibt. Die Zuordnung läuft über
   * eine vorbereitete Map (früher: `find()` pro Stadt → O(Städte × Regionen)).
   */
  const items = useMemo<Item[]>(() => {
    if (!countryCode || cityTier === 0) return [];
    const list = citiesForCountry(countryCode, cityTier);
    if (!list.length) return [];
    const byCity = new Map<string, GlobeRegion>();
    for (const r of regions) {
      if (r.countryCode !== countryCode || !r.city) continue;
      byCity.set(r.city.toLowerCase(), r);
    }
    return list.map((c) => {
      const name = c.name.toLowerCase();
      let match = byCity.get(name);
      if (!match) {
        for (const [city, r] of byCity) {
          if (name.startsWith(city)) {
            match = r;
            break;
          }
        }
      }
      return { ...c, key: `${countryCode}:${c.name}`, tags: match?.slangTags ?? 0 };
    });
  }, [countryCode, cityTier, regions]);

  const nodes = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!engine || !items.length) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!engine.isVisible) return;
      for (const item of items) {
        const node = nodes.current.get(item.key);
        if (!node) continue;
        const p = engine.project(item.lat, item.lng, 1.004);
        if (p.facing < FACE_MIN) {
          if (node.style.visibility !== "hidden") {
            node.style.visibility = "hidden";
            node.style.opacity = "0";
          }
          continue;
        }
        const fade = Math.min(1, (p.facing - FACE_MIN) / 0.18);
        node.style.visibility = "visible";
        node.style.transform = `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;
        node.style.opacity = String(fade);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, items]);

  if (!items.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      {items.map((item) => (
        <div
          key={item.key}
          ref={(el) => {
            // Referenzen aufräumen: keine verwaisten Knoten im Speicher.
            if (el) nodes.current.set(item.key, el);
            else nodes.current.delete(item.key);
          }}
          className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border border-brand/30 bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/85 backdrop-blur-[2px]"
          style={{ opacity: 0, visibility: "hidden", willChange: "transform, opacity" }}
          title={item.region ? `${item.name} · ${item.region}` : item.name}
        >
          <span className="h-1 w-1 rounded-full bg-brand" />
          {item.name}
          {item.tags > 0 && <span className="text-brand">· {item.tags}</span>}
        </div>
      ))}
    </div>
  );
});
