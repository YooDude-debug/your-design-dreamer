/**
 * Allgemeiner Werbeplatz.
 *
 * Seiten und Feeds fordern nur einen Platz an und müssen NICHT wissen, ob dort
 * eine eigene Y-Dude-Kampagne, eine Market-Hervorhebung, AdSense oder (für
 * Admins im Testmodus) Demobestand erscheint. Die Quelle steht im Werbeplan des
 * Kernels; hier findet ausschließlich das Rendern statt.
 */

import type { ReactNode } from "react";
import type { AdPlanSlot, AdSource } from "@/lib/ad-catalog.shared";
import type { AdsConsentState } from "@/lib/ads/adsense-consent";
import { AdSenseSlot } from "./AdSenseSlot";

type Props = {
  slot: AdPlanSlot;
  consent: AdsConsentState;
  /** AdSense-Anzeigenblock, sobald in AdSense angelegt. */
  adsenseUnitId?: string;
  /**
   * Darstellung der Y-Dude-eigenen Quellen (eigene Kampagnen, Market-Promotion,
   * Demobestand) – unverändert die bestehenden Feed-Werbekarten.
   */
  renderInternal: (slot: AdPlanSlot) => ReactNode;
};

/** Quelle eines Platzes; alte Pläne ohne Kennung gelten als Demobestand. */
export function slotSource(slot: AdPlanSlot): AdSource {
  return slot.source ?? "demo";
}

export function AdSlot({ slot, consent, adsenseUnitId, renderInternal }: Props) {
  if (slotSource(slot) === "adsense") {
    return <AdSenseSlot consent={consent} unitId={adsenseUnitId} />;
  }
  return <>{renderInternal(slot)}</>;
}
