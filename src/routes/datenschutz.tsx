import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { FeedResetSection } from "@/components/FeedResetSection";
import { PRIVACY_DOC } from "@/lib/legal";

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
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DatenschutzPage,
});

function DatenschutzPage() {
  return (
    <LegalPage
      title={PRIVACY_DOC.title}
      version={PRIVACY_DOC.version}
      date={PRIVACY_DOC.date}
      notice={PRIVACY_DOC.notice}
      intro={PRIVACY_DOC.intro}
      sections={PRIVACY_DOC.sections}
      footer={<FeedResetSection />}
    />
  );
}
