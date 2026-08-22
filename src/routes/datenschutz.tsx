import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { FeedResetSection } from "@/components/FeedResetSection";
import { PRIVACY_DOCS } from "@/lib/legal";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { name: "twitter:image", content: "https://y-dude.com/screenshots/feed-wide.jpg" },
      { title: "Datenschutzerklärung — Y-Dude" },
      {
        name: "description",
        content:
          "Wie Y-Dude personenbezogene Daten verarbeitet: Daten, KI-Moderation, Cookies, Speicherdauer und deine Rechte nach DSGVO.",
      },
      { property: "og:title", content: "Datenschutzerklärung — Y-Dude" },
      { property: "og:description", content: "Datenschutzhinweise und deine Rechte bei Y-Dude." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
