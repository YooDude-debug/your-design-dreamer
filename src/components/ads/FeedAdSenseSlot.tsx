/**
 * Feed-Werbeplatz für die AdSense-Quelle.
 *
 * Dünne Klammer zwischen Feed und der bestehenden AdSense-Integration:
 *   - Platzierung kommt unverändert vom Werbekernel (`ad-plan.server.ts`),
 *   - Rendern übernimmt der vorhandene Dispatcher `AdSlot` → `AdSenseSlot`,
 *   - Anzeigenblock ist die zentrale Feed-Ad-Unit aus `adsense.config.ts`.
 *
 * Der Consent-Zustand kommt ausschließlich aus der veröffentlichten Google-CMP
 * (TCF-API, siehe `use-ads-consent.ts`). Ohne gültige Entscheidung rendert
 * `AdSenseSlot` nichts und lädt kein Anzeigen-Script.
 */

import { AdSlot } from "./AdSlot";
import type { AdPlanSlot } from "@/lib/ad-catalog.shared";
import { ADSENSE_FEED_SLOT_ID } from "@/lib/ads/adsense.config";
import { useAdsConsent } from "@/lib/ads/use-ads-consent";

export function FeedAdSenseSlot({ slot }: { slot: AdPlanSlot }) {
  const consent = useAdsConsent();

  return (
    <AdSlot
      slot={slot}
      consent={consent}
      adsenseUnitId={ADSENSE_FEED_SLOT_ID}
      renderInternal={() => null}
    />
  );
}
