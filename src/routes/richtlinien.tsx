import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { GUIDELINES_DOCS } from "@/lib/legal";
import { useLang } from "@/lib/lang-context";

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
  const { lang } = useLang();
  const doc = GUIDELINES_DOCS[lang];
  return (
    <LegalPage
      title={doc.title}
      version={doc.version}
      date={doc.date}
      notice={doc.notice}
      intro={doc.intro}
      sections={doc.sections}
    />
  );
}
