/**
 * Business → Kampagnen: eigener Kampagnenbereich mit vollständigem Editor.
 *
 * Der Bereich ist auch ohne aktives Business-Abo nutzbar. Rolle, Abo und
 * Limit werden ausschliesslich serverseitig geprüft.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { CampaignBuilder } from "@/components/business/CampaignBuilder";

export const Route = createFileRoute("/_authenticated/business_/campaigns")({
  head: () => ({
    meta: [
      { title: "Kampagnen — Y-Dude Business" },
      {
        name: "description",
        content:
          "Kampagnen für den Y-Dude Feed anlegen: Grunddaten, Medien, SlangTag, Drops, Vorschau und Statistiken.",
      },
      { property: "og:title", content: "Kampagnen — Y-Dude Business" },
      {
        property: "og:description",
        content: "Kampagnen anlegen, bearbeiten und in der Feed-Vorschau prüfen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const navigate = useNavigate();
  return <CampaignBuilder onChoosePlan={() => void navigate({ to: "/business" })} />;
}
