import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

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

const SECTIONS: LegalSection[] = [
  {
    title: "1. Geltungsbereich",
    paragraphs: [
      "Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Social-Media-Plattform Y-Dude durch registrierte und nicht registrierte Nutzer.",
      "Y-Dude ist eine Plattform zum Erstellen, Hochladen, Teilen und Entdecken von nutzergenerierten Inhalten, insbesondere Bildern, kurzen Audioaufnahmen („Slangtags“), Texten, Kommentaren und weiteren digitalen Inhalten.",
      "Mit der Registrierung oder Nutzung der Plattform akzeptiert der Nutzer diese AGB.",
    ],
  },
  {
    title: "2. Betreiber",
    paragraphs: [
      "Der Betreiber der Plattform wird im Impressum benannt.",
      "Bis zur Gründung eines Unternehmens erfolgt der Betrieb durch den im Impressum genannten Betreiber.",
    ],
  },
  {
    title: "3. Registrierung",
    paragraphs: ["Die Nutzung bestimmter Funktionen setzt die Erstellung eines Benutzerkontos voraus.", "Der Nutzer verpflichtet sich,"],
    bullets: [
      "wahrheitsgemäße Angaben zu machen,",
      "seine Zugangsdaten geheim zu halten,",
      "kein zweites Konto zur Umgehung einer Sperre anzulegen,",
      "ausschließlich eigene E-Mail-Adressen zu verwenden.",
    ],
  },
  {
    title: "3a. Ablehnung von Registrierungen",
    paragraphs: ["Der Betreiber kann Registrierungen ohne Angabe von Gründen ablehnen."],
  },
  {
    title: "4. Mindestalter",
    paragraphs: [
      "Nutzer müssen das nach den jeweils geltenden gesetzlichen Vorschriften erforderliche Mindestalter besitzen.",
      "Ist eine Zustimmung der Erziehungsberechtigten erforderlich, bestätigt der Nutzer mit der Registrierung, dass diese vorliegt.",
    ],
  },
  {
    title: "5. Inhalte der Nutzer",
    paragraphs: [
      "Nutzer dürfen Bilder, Texte, Audioaufnahmen und weitere Inhalte hochladen.",
      "Der Nutzer bestätigt, dass",
    ],
    bullets: [
      "er sämtliche erforderlichen Rechte besitzt,",
      "keine Rechte Dritter verletzt,",
      "keine Gesetze verletzt werden,",
      "sämtliche Inhalte den Community-Richtlinien entsprechen.",
    ],
  },
  {
    title: "5a. Verantwortlichkeit",
    paragraphs: ["Der Nutzer bleibt allein für seine Inhalte verantwortlich."],
  },
  {
    title: "6. Verbotene Inhalte",
    paragraphs: ["Nicht erlaubt sind insbesondere:"],
    bullets: [
      "Hassrede",
      "Diskriminierung",
      "Gewaltverherrlichung",
      "Terrorpropaganda",
      "Kindergefährdende Inhalte",
      "Pornografische Inhalte",
      "Spam",
      "Betrug",
      "Identitätsdiebstahl",
      "Malware",
      "Phishing",
      "Aufrufe zu Straftaten",
      "Doxxing",
      "Veröffentlichung personenbezogener Daten Dritter",
      "Volksverhetzung",
      "Verfassungsfeindliche Inhalte",
      "Illegale Waren oder Dienstleistungen",
      "Glücksspiel ohne Genehmigung",
      "Täuschende Werbung",
      "Massenhaft automatisiert erzeugte Inhalte ohne Kennzeichnung",
    ],
  },
  {
    title: "6a. Entfernung von Inhalten",
    paragraphs: ["Der Betreiber kann entsprechende Inhalte jederzeit entfernen."],
  },
  {
    title: "7. Audio-Uploads (Slangtags)",
    paragraphs: [
      "Y-Dude dient dem Austausch kurzer Sprachaufnahmen.",
      "Es dürfen ausschließlich Inhalte hochgeladen werden, für deren Nutzung der Nutzer sämtliche erforderlichen Rechte besitzt.",
      "Das Hochladen urheberrechtlich geschützter Musik ohne entsprechende Berechtigung ist untersagt.",
      "Der Betreiber kann Audioinhalte automatisch oder manuell prüfen.",
    ],
  },
  {
    title: "8. KI-Moderation",
    paragraphs: [
      "Zur Erhöhung der Sicherheit dürfen Inhalte automatisiert analysiert werden.",
      "Hierzu können insbesondere geprüft werden:",
    ],
    bullets: ["Bilder", "Audio", "Text", "Profilinformationen", "Kommentare"],
  },
  {
    title: "8a. Überprüfung automatisierter Entscheidungen",
    paragraphs: [
      "Automatisierte Entscheidungen können durch menschliche Moderatoren überprüft werden.",
      "Ein Anspruch auf automatische Freigabe besteht nicht.",
    ],
  },
  {
    title: "9. Meldesystem",
    paragraphs: [
      "Jeder Nutzer kann Inhalte melden.",
      "Gemeldete Inhalte werden geprüft.",
      "Der Betreiber entscheidet nach eigenem Ermessen über",
    ],
    bullets: ["Freigabe,", "Einschränkung,", "Entfernung,", "Sperrung des Kontos."],
  },
  {
    title: "10. Rechte des Betreibers",
    paragraphs: ["Der Betreiber ist berechtigt,"],
    bullets: [
      "Inhalte auszublenden,",
      "Inhalte zu löschen,",
      "Konten vorübergehend zu sperren,",
      "Konten dauerhaft zu sperren,",
      "Funktionen einzuschränken,",
      "Inhalte zur Prüfung zurückzuhalten.",
    ],
  },
  {
    title: "10a. Ankündigung",
    paragraphs: [
      "Hierauf besteht kein Anspruch auf vorherige Ankündigung, soweit gesetzlich zulässig.",
    ],
  },
  {
    title: "11. Nutzungsrechte",
    paragraphs: [
      "Der Nutzer behält sämtliche Rechte an seinen Inhalten.",
      "Mit dem Upload räumt der Nutzer dem Betreiber eine einfache, weltweite, nicht ausschließliche Lizenz ein, die Inhalte ausschließlich zum Betrieb, zur Darstellung, Speicherung, Verarbeitung und Bereitstellung innerhalb der Plattform zu nutzen.",
      "Diese Lizenz endet grundsätzlich mit der Löschung des Inhalts, soweit keine gesetzlichen Aufbewahrungspflichten bestehen.",
    ],
  },
  {
    title: "12. Werbung und Sponsoring",
    paragraphs: [
      "Y-Dude kann Werbung, gesponserte Inhalte oder Unternehmensprofile anzeigen.",
      "Gesponserte Inhalte werden, soweit erforderlich, als Werbung gekennzeichnet.",
    ],
  },
  {
    title: "13. Beta-Version",
    paragraphs: [
      "Während einer Beta-Phase können Funktionen unvollständig sein.",
      "Es können Fehler auftreten.",
      "Ein Anspruch auf jederzeitige Verfügbarkeit besteht während der Beta nicht.",
    ],
  },
  {
    title: "14. Haftung",
    paragraphs: [
      "Der Betreiber haftet im gesetzlichen Umfang.",
      "Für von Nutzern eingestellte Inhalte sind ausschließlich die jeweiligen Nutzer verantwortlich.",
    ],
  },
  {
    title: "15. Änderungen der AGB",
    paragraphs: [
      "Der Betreiber kann diese AGB ändern, soweit gesetzlich zulässig.",
      "Über wesentliche Änderungen werden registrierte Nutzer informiert.",
    ],
  },
  {
    title: "16. Schlussbestimmungen",
    paragraphs: [
      "Sollte eine Bestimmung dieser AGB unwirksam sein oder werden, bleiben die übrigen Bestimmungen unberührt.",
      "Es gilt das Recht der Bundesrepublik Deutschland, soweit keine zwingenden gesetzlichen Vorschriften entgegenstehen.",
    ],
  },
];

function AgbPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen (AGB)"
      intro="Allgemeine Geschäftsbedingungen für die Social-Media-Plattform Y-Dude (Entwurf)."
      sections={SECTIONS}
    />
  );
}
