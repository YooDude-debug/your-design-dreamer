import { createFileRoute } from "@tanstack/react-router";

import { YDudeFlyerShowcase } from "@/components/flyers/YDudeFlyerShowcase";

const title = "Y-Dude Flyer-Konzepte | Kampagnenvergleich";
const description =
  "Drei Y-Dude-Flyer-Richtungen rund um SlangTags, Sound, Slang Globe und Community im direkten Formatvergleich.";

export const Route = createFileRoute("/flyer-konzepte")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: YDudeFlyerShowcase,
});