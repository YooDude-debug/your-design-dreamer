/**
 * Slang Globe – progressives Level-of-Detail für Geodaten.
 *
 * Ablauf (Welt → Land → Bundesländer → Städte):
 * 1. Weltansicht: nichts wird nachgeladen, keine zusätzliche Ebene in der Szene.
 * 2. Sobald ein Land betrachtet wird (Länderfilter oder Zoom), wird genau für
 *    dieses Land die Verwaltungsebene 1 einmal nachgeladen (`detail-geo.ts`
 *    cached modulweit) und als eigene Linien-Ebene an den Globe gehängt.
 * 3. Beim Herauszoomen wird die Ebene ausgeblendet und aus der Szene entfernt –
 *    sie erzeugt danach keine Draw-Calls mehr. Die Daten bleiben im Cache,
 *    ein erneutes Hineinzoomen lädt also nichts nachträglich.
 *
 * Das Land in der Bildmitte wird nur bewertet, wenn Zoom und Kamerafahrt ruhen
 * (`engine.isSettled`) und höchstens ~3x pro Sekunde – nicht pro Frame.
 */
import { useEffect, useRef, useState } from "react";
import type { GlobeDetail, GlobeEngine } from "./globe-engine";
import type { GlobeRegion } from "./types";
import { hasAdmin1, loadAdmin1 } from "./detail-geo";
import { SubdivisionLayer } from "./subdivision-layer";
import { europeCountryAt } from "./europe";


const DEG = Math.PI / 180;
/** Maximaler Winkelabstand (Grad), damit ein Land als „betrachtet“ gilt. */
const FOCUS_RADIUS_DEG = 14;

function angleDeg(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const s =
    Math.sin(aLat * DEG) * Math.sin(bLat * DEG) +
    Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * Math.cos((aLng - bLng) * DEG);
  return Math.acos(Math.min(1, Math.max(-1, s))) / DEG;
}

export type ProgressiveGeo = {
  /** Land im Fokus (ISO-Code) oder null in der Weltansicht. */
  focusCode: string | null;
  /** Land im Fokus (Anzeigename) oder null. */
  focusCountry: string | null;
  /** Bis zu welcher Stadtstufe eingeblendet werden darf (0 = keine). */
  cityTier: 0 | 1 | 2 | 3;
};

export function useProgressiveGeo(
  engine: GlobeEngine | null,
  regions: GlobeRegion[],
  selectedCountry: string,
  detail: GlobeDetail,
): ProgressiveGeo {
  const [focus, setFocus] = useState<{ code: string; country: string } | null>(null);
  const [cityTier, setCityTier] = useState<0 | 1 | 2 | 3>(0);

  // Aktuelle Werte für den rAF-Loop ohne Neuaufbau des Effekts.
  const regionsRef = useRef(regions);
  regionsRef.current = regions;
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const selectedRef = useRef(selectedCountry);
  selectedRef.current = selectedCountry;

  // Fokus bestimmen (Filter hat Vorrang, sonst Bildmitte).
  useEffect(() => {
    if (!engine) return;
    let raf = 0;
    let acc = 0;
    let last = performance.now();

    const evaluate = () => {
      const list = regionsRef.current;
      if (detailRef.current === "world") {
        setFocus(null);
        return;
      }
      const picked = selectedRef.current;
      if (picked !== "all") {
        const hit = list.find((r) => r.country === picked);
        if (hit) {
          setFocus((f) =>
            f?.code === hit.countryCode ? f : { code: hit.countryCode, country: hit.country },
          );
          return;
        }
      }
      const { lat, lng } = engine.centerLatLng();
      let best: GlobeRegion | null = null;
      let bestD = Infinity;
      for (const r of list) {
        const d = angleDeg(lat, lng, r.lat, r.lng);
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      if (best && bestD <= FOCUS_RADIUS_DEG) {
        const next = best;
        setFocus((f) =>
          f?.code === next.countryCode ? f : { code: next.countryCode, country: next.country },
        );
        return;
      }
      // Level 2/3 Europa: auch ohne vorhandene Slang-Region wird das Land
      // unter der Bildmitte erkannt (nur Metadaten, keine Geometrie).
      const eu = europeCountryAt(lat, lng, engine.zoomProgress);
      if (eu) {
        setFocus((f) => (f?.code === eu.code ? f : { code: eu.code, country: eu.name }));
        return;
      }
      setFocus(null);

    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      acc += (now - last) / 1000;
      last = now;
      if (acc < 0.3) return;
      acc = 0;
      if (!engine.isVisible) return;
      if (detailRef.current !== "world" && !engine.isSettled) return;
      evaluate();
      // Stadtstufe folgt dem Zoom (0 = Weltansicht).
      const z = engine.zoomProgress;
      const tier: 0 | 1 | 2 | 3 =
        detailRef.current === "world" ? 0 : z > 0.82 ? 3 : z > 0.62 ? 2 : 1;
      setCityTier((t) => (t === tier ? t : tier));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  // Detail-Ebene laden, anhängen, zoomabhängig einblenden, wieder entfernen.
  const isWorld = detail === "world";
  const focusCode = focus?.code ?? null;
  useEffect(() => {
    const code = focusCode;
    if (!engine || !code || isWorld || !hasAdmin1(code)) return;
    let cancelled = false;
    const layer = new SubdivisionLayer();
    let raf = 0;
    let last = performance.now();
    let attached = false;

    void loadAdmin1(code).then((lines) => {
      if (cancelled || !lines) return;
      layer.setLines(lines);
      engine.attachOverlay(layer.group);
      attached = true;
    });

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!attached || !engine.isVisible) return;
      // Sanftes Erscheinen während der Kamerafahrt: ab mittlerem Zoom sichtbar.
      const z = engine.zoomProgress;
      const target = Math.min(0.9, Math.max(0, (z - 0.28) / 0.32) * 0.9);
      layer.fade(target, dt);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (attached) engine.detachOverlay(layer.group);
      layer.dispose();
    };
  }, [engine, focusCode, isWorld]);

  return {
    focusCode: detail === "world" ? null : (focus?.code ?? null),
    focusCountry: detail === "world" ? null : (focus?.country ?? null),
    cityTier: detail === "world" ? 0 : cityTier,
  };
}
