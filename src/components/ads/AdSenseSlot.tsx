/**
 * Fremdgerenderte AdSense-Fläche.
 *
 * Einzige Stelle im Projekt, an der eine AdSense-Fläche im DOM entsteht.
 * Ohne Konfiguration, Scharfschaltung oder Consent rendert die Komponente
 * NICHTS und nimmt keinen Kontakt zu Google auf.
 */

import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT_ID, isAdsenseConfigured } from "@/lib/ads/adsense.config";
import {
  adsenseLoadAllowed,
  adsenseNonPersonalizedFlag,
  type AdsConsentState,
} from "@/lib/ads/adsense-consent";
import { loadAdsense, type AdsenseLoadState } from "@/lib/ads/adsense-loader";

type Props = {
  consent: AdsConsentState;
  /** AdSense-Anzeigenblock (data-ad-slot); ohne ihn wird nichts gerendert. */
  unitId?: string;
  className?: string;
};

export function AdSenseSlot({ consent, unitId, className }: Props) {
  const ref = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const [state, setState] = useState<AdsenseLoadState>("idle");
  const allowed = isAdsenseConfigured() && adsenseLoadAllowed(consent) && Boolean(unitId);

  useEffect(() => {
    if (!allowed) {
      setState("blocked");
      return;
    }
    let alive = true;
    void loadAdsense(true).then((next) => {
      if (!alive) return;
      setState(next);
      if (next !== "ready" || pushed.current || !ref.current) return;
      // Genau ein Push pro Fläche – doppelte Initialisierung zählt doppelt.
      pushed.current = true;
      try {
        const w = window as unknown as { adsbygoogle?: unknown[] };
        w.adsbygoogle = w.adsbygoogle ?? [];
        w.adsbygoogle.push({});
      } catch {
        setState("error");
      }
    });
    return () => {
      alive = false;
    };
  }, [allowed]);

  if (!allowed || state === "blocked" || state === "error") return null;

  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={unitId}
      data-ad-format="auto"
      data-full-width-responsive="true"
      data-npa={adsenseNonPersonalizedFlag(consent)}
      aria-label="Werbung"
    />
  );
}
