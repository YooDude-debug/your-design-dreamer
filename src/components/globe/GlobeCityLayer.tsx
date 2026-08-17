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
/** Mindestabstand zweier Labels in Pixeln (Entzerrung, x deutlich breiter). */
const MIN_X = 74;
const MIN_Y = 22;
/** Wie viele Labels maximal gleichzeitig – zoomabhängig. */
const MIN_LABELS = 7;
const MAX_LABELS = 26;
/** Entzerrung nur alle N Frames neu berechnen (Positionen laufen pro Frame). */
const RECALC_EVERY = 4;
/** Weichzeichnung der Ein-/Ausblendung (pro Frame Richtung Zielwert). */
const FADE_STEP = 0.09;

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
    let frame = 0;

    // Arbeitsspeicher wird einmal angelegt (kein GC-Druck im Loop).
    const n = items.length;
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const face = new Float32Array(n);
    const score = new Float32Array(n);
    const target = new Float32Array(n); // Zielopazität (Entzerrung)
    const alpha = new Float32Array(n); // aktuelle Opazität (weich nachgezogen)
    const order = new Int32Array(n);
    for (let i = 0; i < n; i += 1) order[i] = i;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!engine.isVisible) return;

      // 1) Projektion pro Frame (Positionen folgen der Drehung ohne Verzug).
      for (let i = 0; i < n; i += 1) {
        const it = items[i]!;
        const p = engine.project(it.lat, it.lng, 1.004);
        px[i] = p.x;
        py[i] = p.y;
        face[i] = p.facing;
      }

      // 2) Auswahl/Entzerrung nur gelegentlich – abhängig von Zoom & Perspektive.
      if (frame % RECALC_EVERY === 0) {
        const zoom = engine.zoomProgress;
        const budget = Math.round(MIN_LABELS + (MAX_LABELS - MIN_LABELS) * Math.pow(zoom, 1.4));
        for (let i = 0; i < n; i += 1) {
          const it = items[i]!;
          // Priorität: Wichtigkeit (tier), vorhandene Slang-Daten, Blickmitte.
          score[i] =
            face[i] < FACE_MIN
              ? -1
              : (4 - it.tier) * 2 + Math.min(3, it.tags) + face[i] * 3;
          target[i] = 0;
        }
        const idx = Array.prototype.slice.call(order) as number[];
        idx.sort((a, b) => score[b]! - score[a]!);
        const takenX: number[] = [];
        const takenY: number[] = [];
        let taken = 0;
        for (const i of idx) {
          if (taken >= budget || score[i]! < 0) break;
          let clash = false;
          for (let k = 0; k < taken; k += 1) {
            if (Math.abs(px[i]! - takenX[k]!) < MIN_X && Math.abs(py[i]! - takenY[k]!) < MIN_Y) {
              clash = true;
              break;
            }
          }
          if (clash) continue;
          takenX.push(px[i]!);
          takenY.push(py[i]!);
          taken += 1;
          target[i] = 1;
        }
      }
      frame += 1;

      // 3) Styles setzen (weiche Fades, Optik unverändert).
      for (let i = 0; i < n; i += 1) {
        const node = nodes.current.get(items[i]!.key);
        if (!node) continue;
        const fade = face[i]! < FACE_MIN ? 0 : Math.min(1, (face[i]! - FACE_MIN) / 0.18);
        const want = target[i]! * fade;
        const cur = alpha[i]!;
        const next = cur + Math.max(-FADE_STEP, Math.min(FADE_STEP, want - cur));
        alpha[i] = next;
        if (next <= 0.01) {
          if (node.style.visibility !== "hidden") {
            node.style.visibility = "hidden";
            node.style.opacity = "0";
          }
          continue;
        }
        node.style.visibility = "visible";
        node.style.transform = `translate3d(${px[i]}px,${py[i]}px,0) translate(-50%,-50%)`;
        node.style.opacity = next.toFixed(2);
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
