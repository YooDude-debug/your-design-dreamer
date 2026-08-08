import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: "Impressum — Y-Dude" },
      {
        name: "description",
        content: "Impressum und Anbieterkennzeichnung von Y-Dude gemäß § 5 DDG.",
      },
      { property: "og:title", content: "Impressum — Y-Dude" },
      { property: "og:description", content: "Impressum und Anbieterkennzeichnung von Y-Dude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImpressumPage,
});

const SECTIONS: LegalSection[] = [
  {
    title: "Angaben gemäß § 5 DDG",
    paragraphs: ["Mario Jorde, Kienbergstraße 21, 12685 Berlin", "E-Mail: Tidymagic@gmail.com"],
  },
  {
    title: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
    paragraphs: ["Mario Jorde, Kienbergstraße 21, 12685 Berlin"],
  },
];

function ImpressumPage() {
  return <LegalPage title="Impressum" sections={SECTIONS} />;
}
