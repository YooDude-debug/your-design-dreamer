/**
 * Slang Globe – Stadt-Ebene (Level 2/3).
 *
 * Overlay über der 3D-Bühne, gleiche Technik wie der Satellitenlayer:
 * Positionen werden pro Frame imperativ über `engine.project()` gesetzt,
 * React rendert nur, wenn sich die sichtbare Liste ändert.
 *
 * Progressiv: In der Weltansicht ist die Ebene komplett leer (kein DOM).
 * Mit zunehmendem Zoom kommen weitere Stufen hinzu (`cityTier`), beim
 * Herauszoomen verschwinden sie wieder. Punkte auf der Rückseite der Kugel
 * werden nicht gerendert.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
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
   * falls es zu dieser Stadt bereits Slang-Daten gibt (Wiederverwendung der
   * bereits geladenen Regionen, keine zusätzliche Abfrage).
   */
  const items = useMemo<Item[]>(() => {
    if (!countryCode || cityTier === 0) return [];
    const list = citiesForCountry(countryCode, cityTier);
    if (!list.length) return [];
    return list.map((c) => {
      const match = regions.find(
        (r) =>
          r.countryCode === countryCode &&
          r.city &&
          (r.city.toLowerCase() === c.name.toLowerCase() ||
            c.name.toLowerCase().startsWith(r.city.toLowerCase())),
      );
      return { ...c, key: `${countryCode}:${c.name}`, tags: match?.slangTags ?? 0 };
    });
  }, [countryCode, cityTier, regions]);

  const nodes = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    if (!engine || !items.length) {
      setVisible([]);
      return;
    }
    let raf = 0;
    let lastKey = "";
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!engine.isVisible) return;
      const shown: string[] = [];
      for (const item of items) {
        const p = engine.project(item.lat, item.lng, 1.004);
        const node = nodes.current.get(item.key);
        if (p.facing < FACE_MIN) {
          if (node) node.style.opacity = "0";
          continue;
        }
        shown.push(item.key);
        if (!node) continue;
        const fade = Math.min(1, (p.facing - FACE_MIN) / 0.18);
        node.style.transform = `translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%)`;
        node.style.opacity = String(fade);
      }
      const key = shown.join("|");
      if (key !== lastKey) {
        lastKey = key;
        setVisible(shown);
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
            nodes.current.set(item.key, el);
          }}
          hidden={!visible.includes(item.key)}
          className="absolute left-0 top-0 flex items-center gap-1 whitespace-nowrap rounded-full border border-brand/30 bg-black/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground/85 backdrop-blur-[2px]"
          style={{ opacity: 0, willChange: "transform, opacity" }}
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
