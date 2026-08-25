import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { FeedResetSection } from "@/components/FeedResetSection";
import { PRIVACY_DOCS } from "@/lib/legal";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: "Datenschutzerklärung — Y-Dude" },
      {
        name: "description",
        content:
          "Wie Y-Dude personenbezogene Daten verarbeitet: Daten, KI-Moderation, Cookies, Speicherdauer und deine Rechte nach DSGVO.",
      },
      { property: "og:title", content: "Datenschutzerklärung — Y-Dude" },
      { property: "og:description", content: "Datenschutzhinweise und deine Rechte bei Y-Dude." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://y-dude.com/datenschutz" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://y-dude.com/datenschutz" }],
  }),
  component: DatenschutzPage,
});

function DatenschutzPage() {
  const { lang } = useLang();
  const doc = PRIVACY_DOCS[lang];
  return (
    <LegalPage
      title={doc.title}
      version={doc.version}
      date={doc.date}
      notice={doc.notice}
      intro={doc.intro}
      sections={doc.sections}
      footer={<FeedResetSection />}
    />
  );
}
