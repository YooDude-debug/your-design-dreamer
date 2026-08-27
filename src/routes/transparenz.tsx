import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LegalPage } from "@/components/LegalPage";
import { buildTransparencyDoc } from "@/lib/legal/transparency-doc";
import { getTransparencyStats, type TransparencyStats } from "@/lib/transparency.functions";
import { useLang } from "@/lib/lang-context";

const EMPTY: TransparencyStats = {
  generatedAt: new Date(0).toISOString(),
  windowDays: 180,
  reports: 0,
  actions: 0,
  automatedActions: 0,
  removals: 0,
  hides: 0,
  warnings: 0,
  bans: 0,
  appeals: 0,
  appealsGranted: 0,
};

export const Route = createFileRoute("/transparenz")({
  head: () => ({
    meta: [
      { title: "Transparenzbericht — Y-Dude" },
      {
        name: "description",
        content:
          "Y-Dude Transparenzbericht: Meldungen, Moderationsmaßnahmen, Einsprüche sowie die Funktionsweise von Feed-Ranking und Werbung.",
      },
      { property: "og:title", content: "Transparenzbericht — Y-Dude" },
      {
        property: "og:description",
        content:
          "Aggregierte Moderationszahlen und Erklärung von Feed-Algorithmus und Werbeausrichtung nach DSA.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://y-dude.com/transparenz" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://y-dude.com/transparenz" }],
  }),
  component: TransparencyPage,
  errorComponent: () => <FallbackPage />,
  notFoundComponent: () => <FallbackPage />,
});

function FallbackPage() {
  const { lang } = useLang();
  const doc = buildTransparencyDoc(lang, { ...EMPTY, generatedAt: new Date().toISOString() });
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

function TransparencyPage() {
  const { lang } = useLang();
  const fetchStats = useServerFn(getTransparencyStats);
  const { data } = useQuery({
    queryKey: ["transparency-stats"],
    queryFn: () => fetchStats({}),
    staleTime: 5 * 60_000,
  });
  const doc = buildTransparencyDoc(lang, data ?? {
    ...EMPTY,
    generatedAt: new Date().toISOString(),
  });
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
