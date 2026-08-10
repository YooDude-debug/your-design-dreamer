import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_DOC } from "@/lib/legal";

export const Route = createFileRoute("/agb")({
  head: () => ({
    meta: [
      { title: "AGB — Y-Dude" },
      {
        name: "description",
        content:
          "Allgemeine Geschäftsbedingungen für die Nutzung der Social-Media-Plattform Y-Dude.",
      },
      { property: "og:title", content: "AGB — Y-Dude" },
      {
        property: "og:description",
        content: "Allgemeine Geschäftsbedingungen der Plattform Y-Dude.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgbPage,
});

function AgbPage() {
  return (
    <LegalPage
      title={TERMS_DOC.title}
      version={TERMS_DOC.version}
      date={TERMS_DOC.date}
      notice={TERMS_DOC.notice}
      intro={TERMS_DOC.intro}
      sections={TERMS_DOC.sections}
    />
  );
}
