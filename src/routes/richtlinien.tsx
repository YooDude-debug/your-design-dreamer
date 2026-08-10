import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { GUIDELINES_DOC } from "@/lib/legal";

export const Route = createFileRoute("/richtlinien")({
  head: () => ({
    meta: [
      { title: "Community-Richtlinien — Y-Dude" },
      {
        name: "description",
        content:
          "Was auf Y-Dude erlaubt ist und was nicht: Regeln für Beiträge, SlangTags, Chats und die Slang Arena.",
      },
      { property: "og:title", content: "Community-Richtlinien — Y-Dude" },
      {
        property: "og:description",
        content: "Die Nutzungsregeln der Plattform Y-Dude in klarer Sprache.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RichtlinienPage,
});

function RichtlinienPage() {
  return (
    <LegalPage
      title={GUIDELINES_DOC.title}
      version={GUIDELINES_DOC.version}
      date={GUIDELINES_DOC.date}
      notice={GUIDELINES_DOC.notice}
      intro={GUIDELINES_DOC.intro}
      sections={GUIDELINES_DOC.sections}
    />
  );
}
