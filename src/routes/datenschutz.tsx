import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { FeedResetSection } from "@/components/FeedResetSection";

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
  // ---------------------------------------------------------------------------
  // OFFENE RECHTLICHE PRÜFUNG (Punkte 3–12 des Datenschutz-Hardenings):
  // Die folgenden Abschnitte beschreiben ausschliesslich den technisch im Code
  // vorhandenen Datenfluss. Rechtsgrundlagen, Speicherfristen, Angaben zu
  // Standardvertragsklauseln und die Bewertung von Drittlandtransfers sind
  // bewusst NICHT enthalten und werden nach anwaltlicher Prüfung ergänzt.
  // Technische Grundlage: docs/DATENSCHUTZ_TECHNIK.md
  // ---------------------------------------------------------------------------
  {
    title: "5b. Unbearbeitete Originalmedien",
    paragraphs: [
      "Wird ein Bild für einen Beitrag hochgeladen, speichern wir neben der für die Anzeige optimierten Fassung zusätzlich die unbearbeitete Originaldatei im geschützten Medienspeicher der Plattform.",
      "Zweck ist die Nachvollziehbarkeit bei Meldungen und Moderationsentscheidungen sowie die erneute Erzeugung der Anzeigefassungen.",
      "Der Zugriff ist technisch beschränkt: Nutzer haben Zugriff auf ihre eigenen Dateien, darüber hinaus ausschliesslich die Administration bzw. Moderation der Plattform. Bei Löschung des Beitrags bzw. des Kontos werden die Originaldateien mit gelöscht.",
    ],
  },
  {
    title: "6b. Übermittlung an externe KI-Dienste",
    paragraphs: [
      "Für die automatisierte Moderation werden Inhalte an externe KI-Dienste (OpenAI und/oder Google) übermittelt. Die Übermittlung findet statt, sobald ein Inhalt erstellt oder geändert wird und in die Moderationsprüfung eingeht.",
      "Übermittelt werden können:",
    ],
    bullets: [
      "Titel, Beschreibung und Text eines Beitrags oder Kommentars",
      "das hochgeladene Bild eines Beitrags",
      "die Audioaufnahme eines SlangTags sowie deren automatisch erzeugte Textfassung",
      "Angaben zum Inhaltstyp, die für die Prüfung erforderlich sind",
    ],
  },
  {
    title: "6c. Automatisierte Entscheidungen und menschliche Prüfung",
    paragraphs: [
      "Das Ergebnis der automatisierten Prüfung kann dazu führen, dass ein Inhalt freigegeben, zur Nachprüfung zurückgehalten oder gesperrt wird. Diese Entscheidung wird zunächst automatisiert getroffen.",
      "Zurückgehaltene und gemeldete Inhalte können zusätzlich durch die Moderation der Plattform manuell geprüft und die Entscheidung geändert werden.",
      "Die Moderationsentscheidungen werden protokolliert, damit sie nachvollziehbar bleiben.",
      "Da Inhalte personenbezogene Angaben enthalten können (etwa Bilder von Personen, Sprachaufnahmen oder Texte mit Namensbezug), können solche Angaben Teil der übermittelten Inhalte sein.",
    ],
  },
  {
    title: "9b. Cookies und clientseitige Speicher im Detail",
    paragraphs: [
      "Neben Cookies nutzt die Anwendung technisch notwendige Browser-Speicher. Tatsächlich verwendet werden:",
    ],
    bullets: [
      "LocalStorage für die Anmeldesitzung (Zugangs- und Erneuerungstoken der Authentifizierung)",
      "LocalStorage für Anzeige- und Bedieneinstellungen, zum Beispiel Sprache, Feed-Einstellungen und Hinweise, die bereits gesehen wurden",
      "LocalStorage-Zwischenspeicher für bereits geladene Inhalte und SlangTag-Audiodaten, damit diese nicht erneut übertragen werden müssen",
      "SessionStorage für kurzlebige Zustände innerhalb einer Sitzung",
      "eine Push-Registrierung des Browsers, sofern Benachrichtigungen aktiviert wurden",
    ],
  },
  {
    title: "10b. Chats und Nachrichten",
    paragraphs: [
      "Direktnachrichten und Chat-SlangTags werden auf den Servern der Plattform gespeichert, damit sie für die beteiligten Nutzer abrufbar sind. Der Zugriff ist technisch auf die Mitglieder der jeweiligen Unterhaltung beschränkt.",
      "Die Nachrichten sind nicht Ende-zu-Ende-verschlüsselt. Die Übertragung erfolgt verschlüsselt (HTTPS); ein technischer Zugriff durch den Plattformbetreiber ist – etwa bei Meldungen oder aus Sicherheitsgründen – nicht ausgeschlossen.",
    ],
  },
  {
    title: "11a. Eingesetzte Dienste (technische Übersicht)",
    paragraphs: [
      "Für den Betrieb der Plattform werden folgende externe Dienste technisch eingesetzt:",
    ],
    bullets: [
      "Lovable – Bereitstellung, Auslieferung und Betrieb der Anwendung sowie Versand von System- und Bestätigungs-E-Mails",
      "Supabase – Datenbank, Authentifizierung und Speicherung der Mediendateien",
      "Cloudflare – Netzwerkauslieferung und Bot-/Missbrauchsschutz (Turnstile)",
      "OpenAI und Google – automatisierte Moderation von Texten, Bildern und Audio",
      "BigDataCloud – Umwandlung von Koordinaten in Ortsangaben bei der Standortauswahl",
      "Push-Dienste der Browser- und Betriebssystemhersteller – Zustellung von Benachrichtigungen",
    ],
  },
  {
    title: "11b. Cloudflare Turnstile",
    paragraphs: [
      "Zum Schutz der Formulare für Registrierung, Anmeldung, Passwort-Zurücksetzen und die Notify-Me-Funktion wird Cloudflare Turnstile eingesetzt.",
      "Dabei wird im Browser ein Prüfskript von Cloudflare geladen. Technisch verarbeitet werden dabei insbesondere die IP-Adresse, Angaben zum Browser und zum Nutzungsverhalten der Prüfung sowie das erzeugte Prüf-Token.",
      "Das Prüf-Token wird anschliessend serverseitig gegen Cloudflare validiert. Ohne erfolgreiche serverseitige Prüfung wird der jeweilige Vorgang nicht ausgeführt.",
    ],
  },
  {
    title: "11c. Standortauswahl und Ortsermittlung",
    paragraphs: [
      "Wenn ein Nutzer die Standortauswahl mit automatischer Ortsermittlung verwendet, fragt der Browser die Standortfreigabe ab. Nur nach ausdrücklicher Freigabe werden die Koordinaten an BigDataCloud übermittelt, um daraus eine Ortsangabe zu erhalten.",
      "Zurückgeliefert werden Ortsangaben wie Stadt, Region und Land. Gespeichert wird ausschliesslich die daraus gebildete Ortsangabe im Profil bzw. Beitrag – nicht die genauen Koordinaten.",
      "Die Nutzung ist freiwillig: der Ort kann auch manuell eingegeben werden.",
    ],
  },
  {
    title: "11d. Push-Benachrichtigungen",
    paragraphs: [
      "Aktiviert ein Nutzer Benachrichtigungen, erzeugt der Browser eine Push-Registrierung beim Push-Dienst des jeweiligen Browser- bzw. Plattformanbieters. Diese Registrierung besteht aus einer Zustelladresse des Anbieters und den zugehörigen Schlüsseln.",
      "Wir speichern diese Registrierung zusammen mit einer Angabe zum verwendeten Browser, um Benachrichtigungen zustellen zu können. Die Zustellung selbst erfolgt technisch über den Push-Dienst des Anbieters.",
      "Die Registrierung wird gelöscht, wenn Benachrichtigungen deaktiviert werden, die Zustellung dauerhaft fehlschlägt oder das Konto gelöscht wird.",
    ],
  },
  {
    title: "12a. Technische Protokolle",
    paragraphs: [
      "Für Sicherheit, Missbrauchserkennung und Nachvollziehbarkeit von Moderationsentscheidungen werden technische Protokolle geführt, unter anderem zu Moderationsentscheidungen, administrativen Eingriffen sowie zu Datenexport- und Kontolöschungsanfragen.",
      "Für die automatisierte Bereinigung dieser Protokolle sind technische Löschläufe eingerichtet. Die konkreten Fristen werden festgelegt und anschliessend in dieser Erklärung benannt.",
    ],
  },
  {
    title: "14b. Widerspruch gegen Personalisierung",
    paragraphs: [
      "Die Reihenfolge der Inhalte im Feed und die Auswahl der eingeblendeten Werbung können auf Grundlage der eigenen Nutzung personalisiert werden.",
      "Am Ende dieser Seite kann die dafür gespeicherte Personalisierung zurückgesetzt werden. Damit werden die zur Personalisierung gespeicherten Signale und Interessenwerte des eigenen Kontos entfernt.",
    ],
  },
  {
    title: "15a. Mindestalter",
    paragraphs: [
      "Die Nutzung von Y-Dude ist erst ab 16 Jahren möglich. Bei der Registrierung wird das Geburtsdatum abgefragt und geprüft; unterhalb des Mindestalters kann die Registrierung technisch nicht abgeschlossen werden.",
      "Eine Prüfung mit Ausweisdokumenten findet nicht statt.",
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
