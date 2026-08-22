import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMS_DOCS } from "@/lib/legal";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/agb")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { name: "twitter:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
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
  const { lang } = useLang();
  const doc = TERMS_DOCS[lang];
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
