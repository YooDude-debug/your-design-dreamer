import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

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

const SECTIONS: LegalSection[] = [
  {
    title: "1. Verantwortlicher",
    paragraphs: [
      "Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der Datenschutz-Grundverordnung (DSGVO) ist der im Impressum genannte Betreiber der Plattform Y-Dude: Mario Jorde, Kienbergstraße 21, 12685 Berlin, Tidymagic@gmail.com.",
    ],
  },
  {
    title: "2. Allgemeines",
    paragraphs: [
      "Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Wir verarbeiten personenbezogene Daten ausschließlich im Einklang mit den geltenden Datenschutzgesetzen, insbesondere der Datenschutz-Grundverordnung (DSGVO).",
    ],
  },
  {
    title: "3. Welche Daten wir verarbeiten",
    paragraphs: [
      "Bei der Nutzung von Y-Dude können unter anderem folgende Daten verarbeitet werden:",
    ],
    bullets: [
      "Benutzername",
      "E-Mail-Adresse",
      "Passwort (ausschließlich verschlüsselt gespeichert)",
      "Profilbild",
      "Profilbeschreibung",
      "Spracheinstellungen",
      "Freiwillig angegebene Profildaten",
    ],
  },
  {
    title: "4. Automatisch erhobene Daten",
    paragraphs: [
      "Beim Besuch der Plattform können automatisch folgende technische Informationen verarbeitet werden:",
    ],
    bullets: [
      "IP-Adresse",
      "Browsertyp",
      "Betriebssystem",
      "Gerätetyp",
      "Datum und Uhrzeit des Zugriffs",
      "Logdateien",
      "Fehlerprotokolle",
    ],
  },
  {
    title: "4a. Zweck der technischen Daten",
    paragraphs: ["Diese Daten dienen der Sicherheit, Fehleranalyse und dem Betrieb der Plattform."],
  },
  {
    title: "5. Von Nutzern hochgeladene Inhalte",
    paragraphs: ["Nutzer können Inhalte hochladen, insbesondere:"],
    bullets: ["Bilder", "Audioaufnahmen (Slangtags)", "Texte", "Kommentare", "Profilinformationen"],
  },
  {
    title: "5a. Veröffentlichung der Inhalte",
    paragraphs: [
      "Diese Inhalte werden gespeichert und innerhalb der Plattform veröffentlicht, sofern sie den Nutzungsbedingungen entsprechen.",
    ],
  },
  {
    title: "6. Automatisierte KI-Moderation",
    paragraphs: [
      "Zur Sicherheit der Plattform können hochgeladene Inhalte automatisiert analysiert werden. Hierzu können unter anderem Bilder, Texte und Audioaufnahmen verarbeitet werden.",
      "Die automatisierte Prüfung dient insbesondere der Erkennung von:",
    ],
    bullets: [
      "Hassrede",
      "Gewalt",
      "Belästigung",
      "Spam",
      "Betrug",
      "pornografischen Inhalten",
      "jugendgefährdenden Inhalten",
      "sonstigen Verstößen gegen unsere Community-Richtlinien",
    ],
  },
  {
    title: "6a. Zurückhaltung von Inhalten",
    paragraphs: [
      "Inhalte können bei Auffälligkeiten vorübergehend zurückgehalten und zusätzlich von Moderatoren geprüft werden.",
    ],
  },
  {
    title: "7. Sprachaufnahmen",
    paragraphs: ["Slangtags können automatisch transkribiert werden, um:"],
    bullets: [
      "Inhalte moderieren zu können,",
      "Spam zu erkennen,",
      "Missbrauch zu verhindern,",
      "die Suchfunktion zu verbessern,",
      "Barrierefreiheit zu unterstützen.",
    ],
  },
  {
    title: "8. Meldesystem",
    paragraphs: [
      "Gemeldete Inhalte werden gespeichert und durch Moderatoren überprüft. Dabei können verarbeitet werden:",
    ],
    bullets: ["gemeldeter Inhalt,", "meldender Nutzer,", "Zeitpunkt,", "Moderationsentscheidung."],
  },
  {
    title: "9. Cookies",
    paragraphs: ["Y-Dude verwendet technisch notwendige Cookies. Diese dienen insbesondere:"],
    bullets: [
      "der Anmeldung,",
      "der Sicherheit,",
      "der Sitzungsverwaltung,",
      "der Speicherung notwendiger Einstellungen.",
    ],
  },
  {
    title: "9a. Analyse- und Marketing-Cookies",
    paragraphs: [
      "Sollten Analyse- oder Marketing-Cookies eingesetzt werden, erfolgt dies entsprechend den gesetzlichen Vorgaben.",
    ],
  },
  {
    title: "10. Kommunikation",
    paragraphs: [
      "Bei der Registrierung oder Nutzung der Plattform können E-Mails versendet werden, beispielsweise:",
    ],
    bullets: [
      "Registrierung",
      "E-Mail-Bestätigung",
      "Passwort zurücksetzen",
      "Sicherheitsmeldungen",
      "wichtige Informationen zur Plattform",
      "Benachrichtigungen zu Änderungen der Nutzungsbedingungen oder Datenschutzerklärung",
      "Informationen über den offiziellen Start (Launch) der Plattform",
      "Informationen über neue Funktionen, Updates oder Beta-Phasen, sofern Nutzer die „Notify Me“-Funktion oder vergleichbare Benachrichtigungsdienste freiwillig nutzen oder einer entsprechenden Kommunikation zugestimmt haben.",
    ],
  },
  {
    title: "10a. Notify Me",
    paragraphs: [
      "Die Nutzung der „Notify Me“-Funktion ist freiwillig. Die dabei angegebene E-Mail-Adresse wird ausschließlich für den jeweiligen Benachrichtigungszweck verwendet. Soweit gesetzlich erforderlich, erfolgt der Versand solcher Informationen nur auf Grundlage einer entsprechenden Einwilligung, die jederzeit mit Wirkung für die Zukunft widerrufen werden kann.",
    ],
  },
  {
    title: "11. Weitergabe personenbezogener Daten",
    paragraphs: [
      "Personenbezogene Daten werden grundsätzlich nicht verkauft. Eine Weitergabe erfolgt nur, soweit dies erforderlich ist, beispielsweise an:",
    ],
    bullets: [
      "Hosting-Anbieter",
      "Cloud-Dienstleister",
      "E-Mail-Dienstleister",
      "Sicherheits- und Moderationsdienste",
      "gesetzlich berechtigte Behörden",
    ],
  },
  {
    title: "12. Speicherdauer",
    paragraphs: [
      "Personenbezogene Daten werden nur so lange gespeichert, wie dies für den jeweiligen Zweck erforderlich oder gesetzlich vorgeschrieben ist.",
      "Gelöschte Konten können im Rahmen gesetzlicher Aufbewahrungspflichten teilweise weiterhin gespeichert werden.",
    ],
  },
  {
    title: "13. Datensicherheit",
    paragraphs: [
      "Wir setzen angemessene technische und organisatorische Maßnahmen ein, um personenbezogene Daten vor Verlust, Missbrauch oder unbefugtem Zugriff zu schützen. Hierzu gehören unter anderem:",
    ],
    bullets: [
      "verschlüsselte Datenübertragung (HTTPS)",
      "verschlüsselte Passwortspeicherung",
      "Zugriffsbeschränkungen",
      "Sicherheitsprotokolle",
    ],
  },
  {
    title: "14. Rechte der betroffenen Personen",
    paragraphs: ["Sie haben das Recht auf:"],
    bullets: [
      "Auskunft",
      "Berichtigung",
      "Löschung",
      "Einschränkung der Verarbeitung",
      "Datenübertragbarkeit",
      "Widerspruch gegen die Verarbeitung",
      "Widerruf einer erteilten Einwilligung",
    ],
  },
  {
    title: "14a. Anfragen",
    paragraphs: ["Anfragen können an die im Impressum genannte Kontaktadresse gerichtet werden."],
  },
  {
    title: "15. Minderjährige",
    paragraphs: [
      "Soweit gesetzlich erforderlich, dürfen Minderjährige die Plattform nur mit Zustimmung ihrer Erziehungsberechtigten nutzen.",
    ],
  },
  {
    title: "16. Änderungen dieser Datenschutzerklärung",
    paragraphs: [
      "Wir behalten uns vor, diese Datenschutzerklärung anzupassen, wenn dies aufgrund technischer, rechtlicher oder organisatorischer Änderungen erforderlich wird.",
      "Die jeweils aktuelle Version ist jederzeit auf der Plattform abrufbar.",
    ],
  },
  {
    title: "17. Kontakt",
    paragraphs: [
      "Fragen zum Datenschutz können an die im Impressum genannte Kontaktadresse gerichtet werden: Tidymagic@gmail.com.",
    ],
  },
];

function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung" sections={SECTIONS} footer={<FeedResetSection />} />
  );
}
