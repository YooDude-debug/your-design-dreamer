import { createFileRoute } from "@tanstack/react-router";
import { useLang } from "@/lib/lang-context";
import { LEGAL_UI_TEXTS } from "@/lib/legal/ui-texts";
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

// OFFENE RECHTLICHE ANGABEN (Punkt 24 des Datenschutz-Hardenings):
// Die folgenden Felder sind technisch vorbereitet, aber inhaltlich noch nicht
// belegt. Sie werden erst nach rechtlicher Klärung mit echten Angaben gefüllt
// bzw. entfernt, falls sie nicht einschlägig sind. Es werden ausdrücklich
// keine Werte erfunden.
function ImpressumPage() {
  const { lang } = useLang();
  const u = LEGAL_UI_TEXTS[lang];
  const sections: LegalSection[] = [
    {
      title: u.impressumSectionTitle,
      paragraphs: ["Mario Jorde, Kienbergstraße 21, 12685 Berlin", "E-Mail: Tidymagic@gmail.com"],
    },
    {
      title: u.impressumResponsibleTitle,
      paragraphs: ["Mario Jorde, Kienbergstraße 21, 12685 Berlin"],
    },
    {
      title: u.impressumOpenFieldsTitle,
      paragraphs: [
        u.impressumOpenFieldsPhone,
        u.impressumOpenFieldsVat,
        u.impressumOpenFieldsDispute,
      ],
    },
  ];
  return <LegalPage title={u.navImpressum} sections={sections} />;
}
