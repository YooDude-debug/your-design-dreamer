import { LEGAL_DATE, LEGAL_NOTICE, REVIEW_LAWYER, type LegalDoc } from "./types";

/** AGB – beschreibt die tatsächlich vorhandene Plattform. */
export const TERMS_DOC: LegalDoc = {
  slug: "agb",
  title: "Allgemeine Geschäftsbedingungen (AGB)",
  version: "3.0",
  date: LEGAL_DATE,
  notice: LEGAL_NOTICE,
  intro:
    "Diese Bedingungen regeln die Nutzung der Plattform Y-Dude. Sie beschreiben den tatsächlichen Funktionsumfang der Plattform. Rechtlich noch zu klärende Punkte sind ausdrücklich gekennzeichnet.",
  sections: [
    {
      title: "1. Geltungsbereich",
      paragraphs: [
        "Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der Plattform Y-Dude durch registrierte und nicht registrierte Nutzer.",
        "Y-Dude ist eine Plattform zum Erstellen, Hochladen, Teilen und Entdecken nutzergenerierter Inhalte, insbesondere Bildern und GIFs, kurzen Audioaufnahmen („SlangTags“), Texten, Kommentaren, Direktnachrichten sowie der Teilnahme an der Slang Arena und der Ansicht Slang Globe.",
        "Mit der Registrierung oder Nutzung der Plattform akzeptiert der Nutzer diese AGB.",
      ],
    },
    {
      title: "2. Betreiber",
      paragraphs: [
        "Betreiber der Plattform ist die im Impressum genannte Person. Bis zur Gründung eines Unternehmens erfolgt der Betrieb durch den im Impressum genannten Betreiber.",
      ],
    },
    {
      title: "3. Leistungsbeschreibung",
      paragraphs: [
        "Y-Dude stellt eine kostenlose Plattform bereit, auf der Nutzer eigene Inhalte veröffentlichen und Inhalte anderer entdecken können. Zum Funktionsumfang gehören derzeit:",
      ],
      bullets: [
        "Nutzerkonto mit Profil und einstellbarer Sichtbarkeit einzelner Profilangaben",
        "Beiträge mit Bild/GIF, Beschreibung, Hashtags und bis zu fünf platzierbaren SlangTags",
        "SlangTags: kurze Audioaufnahmen mit Bedeutung, Beispielen, Region und Sprache",
        "Feed mit lokaler, globaler, trendender und gefolgter Ansicht",
        "Likes, Kommentare, Speichern, Teilen, Verbindungen und Follower",
        "Direktnachrichten (Chats) einschließlich Chat-SlangTags",
        "Slang Arena (Community-Voting zu Ausschreibungen) und Slang Globe (Kartenansicht)",
        "Melden von Inhalten sowie automatisierte und manuelle Moderation",
        "optionale Push-Benachrichtigungen",
      ],
      // Änderungen des Funktionsumfangs siehe Abschnitt 14.
    },
    {
      title: "3a. Kostenlose Nutzung",
      paragraphs: [
        "Die Nutzung der beschriebenen Funktionen ist derzeit unentgeltlich. Ein Anspruch auf dauerhafte Unentgeltlichkeit oder auf einen bestimmten Funktionsumfang besteht nicht.",
        `Sollten künftig kostenpflichtige Funktionen angeboten werden, sind hierfür gesonderte Bedingungen und Verbraucherinformationen erforderlich: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "4. Mindestalter (16 Jahre)",
      paragraphs: [
        "Die Nutzung von Y-Dude ist erst ab einem Alter von 16 Jahren zulässig.",
        "Bei der Registrierung ist das Geburtsdatum anzugeben. Es wird serverseitig geprüft; liegt das Alter unter 16 Jahren, kann die Registrierung nicht abgeschlossen werden.",
        "Wer bei der Registrierung ein falsches Geburtsdatum angibt, verstößt gegen diese AGB; das Konto kann gesperrt und gelöscht werden.",
      ],
    },
    {
      title: "5. Registrierung und Nutzerkonto",
      paragraphs: [
        "Für die meisten Funktionen ist ein Nutzerkonto erforderlich. Der Nutzer verpflichtet sich,",
      ],
      bullets: [
        "wahrheitsgemäße Angaben zu machen, insbesondere zum Geburtsdatum,",
        "seine Zugangsdaten geheim zu halten und nicht weiterzugeben,",
        "kein weiteres Konto zur Umgehung einer Sperre anzulegen,",
        "ausschließlich eigene E-Mail-Adressen zu verwenden,",
        "keine automatisierten Konten (Bots) ohne ausdrückliche Erlaubnis des Betreibers zu betreiben.",
      ],
    },
    {
      title: "5a. Ablehnung von Registrierungen",
      paragraphs: [
        `Der Betreiber kann Registrierungen ablehnen, insbesondere bei Verstößen gegen diese AGB oder bei Anzeichen für Missbrauch: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "6. Nutzerinhalte",
      paragraphs: [
        "Nutzer können Bilder, GIFs, Audioaufnahmen, Texte, Kommentare, SlangTags und Nachrichten einstellen. Mit dem Einstellen bestätigt der Nutzer, dass",
      ],
      bullets: [
        "er über alle erforderlichen Rechte an dem Inhalt verfügt,",
        "keine Rechte Dritter verletzt werden (insbesondere Urheber-, Marken-, Persönlichkeits- und Datenschutzrechte),",
        "abgebildete oder hörbare Personen ihre Einwilligung erteilt haben, soweit erforderlich,",
        "der Inhalt nicht gegen Gesetze und nicht gegen die Community-Richtlinien verstößt.",
      ],
    },
    {
      title: "6a. Verantwortlichkeit für Inhalte",
      paragraphs: [
        "Der Nutzer bleibt für seine Inhalte verantwortlich. Die Community-Richtlinien sind Bestandteil dieser AGB und beschreiben verbindlich, welche Inhalte und Verhaltensweisen unzulässig sind.",
      ],
    },
    {
      title: "7. Audio-Uploads und SlangTags",
      paragraphs: [
        "SlangTags sind kurze Audioaufnahmen, die einem Beitragsbild zugeordnet und dort platziert werden können. Der technische Rahmen (insbesondere Länge und Anzahl je Beitrag) wird von der Plattform vorgegeben.",
        "Es dürfen ausschließlich Aufnahmen eingestellt werden, für die der Nutzer alle erforderlichen Rechte besitzt. Das Hochladen urheberrechtlich geschützter Musik ohne Berechtigung ist untersagt.",
        "SlangTags dürfen nicht dazu verwendet werden, verbotene Inhalte zu verschleiern, die Moderation zu umgehen, andere zu beleidigen oder zu bedrohen, private Daten zu verbreiten, rechtswidrige Inhalte zu transportieren, fremde geschützte Inhalte rechtswidrig zu übernehmen oder Arena- und Ranking-Systeme zu manipulieren.",
      ],
    },
    {
      title: "8. Chats",
      paragraphs: [
        "Direktnachrichten sind für die Kommunikation zwischen Nutzern bestimmt. Sie sind nicht Ende-zu-Ende-verschlüsselt; Näheres regelt die Datenschutzerklärung.",
        "Die Regeln zu unzulässigen Inhalten gelten auch in Chats. Gemeldete Nachrichten können geprüft werden.",
      ],
    },
    {
      title: "9. Moderation",
      paragraphs: [
        "Inhalte können automatisiert (auch mithilfe externer KI-Dienste) und manuell geprüft werden. Geprüft werden insbesondere Bilder, Audioaufnahmen samt Transkript, Texte, Profilangaben und Kommentare.",
        "Ergebnis der Prüfung kann die Freigabe, die vorläufige Zurückhaltung oder die Sperrung eines Inhalts sein. Ein Anspruch auf automatische Freigabe oder auf eine bestimmte Prüfdauer besteht nicht.",
        "Automatisierte Entscheidungen können durch die Moderation überprüft und korrigiert werden. Betroffene können sich über die im Impressum genannte Kontaktadresse an den Betreiber wenden.",
      ],
    },
    {
      title: "10. Melden von Inhalten",
      paragraphs: [
        "Jeder Nutzer kann Beiträge, SlangTags, Kommentare, Profile und Nachrichten melden. Meldungen werden gespeichert und geprüft.",
        "Missbräuchliche Meldungen sind unzulässig; die Häufigkeit von Meldungen ist technisch begrenzt.",
        `Zusätzliche Anforderungen an Melde- und Beschwerdeverfahren (u. a. Digital Services Act): ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "11. Maßnahmen bei Verstößen",
      paragraphs: [
        "Bei Verstößen gegen diese AGB, die Community-Richtlinien oder gegen Gesetze kann der Betreiber – abgestuft nach Schwere – insbesondere:",
      ],
      bullets: [
        "Inhalte ausblenden, einschränken oder löschen,",
        "Inhalte zur Prüfung zurückhalten,",
        "Verwarnungen aussprechen,",
        "Funktionen einschränken,",
        "das Konto vorübergehend oder dauerhaft sperren,",
        "das Konto löschen.",
      ],
    },
    {
      title: "11a. Information und Widerspruch",
      paragraphs: [
        "Betroffene werden über wesentliche Maßnahmen zu ihren Inhalten in der Anwendung informiert und können sich über die im Impressum genannte Kontaktadresse dagegen wenden.",
        `Umfang der Begründungs- und Informationspflichten sowie Fristen: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "12. Rechte an Nutzerinhalten",
      paragraphs: [
        "Der Nutzer behält sämtliche Rechte an seinen Inhalten.",
        "Mit dem Einstellen räumt der Nutzer dem Betreiber eine einfache, nicht ausschließliche, nicht übertragbare und unentgeltliche Lizenz ein, die Inhalte ausschließlich zum Betrieb der Plattform zu nutzen, insbesondere zu speichern, technisch zu bearbeiten (z. B. Formatumwandlung und Vorschaubilder), zu moderieren und den nach den Sichtbarkeitseinstellungen berechtigten Nutzern anzuzeigen.",
        "Eine Nutzung der Inhalte für eigene Werbung des Betreibers oder eine Weitergabe an Dritte zu deren eigenen Zwecken findet nicht statt.",
        "Die Lizenz endet mit der Löschung des Inhalts bzw. des Kontos; ausgenommen sind technisch bedingte Sicherungskopien für die Dauer des Backup-Zyklus sowie Moderationsprotokolle zur Nachvollziehbarkeit.",
        "Nimmt ein Nutzer freiwillig an einer Ausschreibung in der Slang Arena teil, gelten für den Einreichungsbeitrag zusätzlich die dort angezeigten Teilnahmebedingungen des ausschreibenden Unternehmens. Eine Rechteübertragung erfolgt nur, soweit dort ausdrücklich beschrieben und vom Nutzer akzeptiert.",
      ],
    },
    {
      title: "13. Rechte des Betreibers an der Plattform",
      paragraphs: [
        "Die Plattform selbst, ihre Software, Gestaltung, Marken, Logos und Bezeichnungen (insbesondere „Y-Dude“, „SlangTag“, „Slang Arena“, „Slang Globe“) sind geschützt. Eine Nutzung außerhalb der bestimmungsgemäßen Nutzung der Plattform ist ohne Zustimmung nicht zulässig.",
      ],
    },
    {
      title: "14. Verfügbarkeit, Beta-Phase und Änderungen der Plattform",
      paragraphs: [
        "Die Plattform befindet sich in einer Beta-Phase. Funktionen können unvollständig sein, Fehler auftreten und Daten der Testphase entfernt werden.",
        "Der Betreiber kann Funktionen weiterentwickeln, ändern oder einstellen, soweit dies für den Nutzer zumutbar ist. Über wesentliche Änderungen werden registrierte Nutzer informiert.",
        "Ein Anspruch auf ständige Verfügbarkeit besteht nicht; Wartungsarbeiten und Störungen sind möglich.",
      ],
    },
    {
      title: "15. Beendigung der Nutzung",
      paragraphs: [
        "Der Nutzer kann die Nutzung jederzeit beenden und sein Konto in den Einstellungen vollständig löschen. Die Löschung erfordert die Bestätigung mit dem eigenen Passwort und entfernt Profil, Inhalte, Medien, Interaktionen, Nachrichten und das Anmeldekonto.",
        "Vor der Löschung kann ein Export der eigenen Daten angefordert werden.",
        `Kündigungsrechte des Betreibers, Fristen und Vorgaben zur Kündigungserklärung: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "16. Haftung",
      paragraphs: [
        "Für von Nutzern eingestellte Inhalte sind ausschließlich die jeweiligen Nutzer verantwortlich. Der Betreiber ist nicht verpflichtet, Inhalte vor Veröffentlichung allgemein zu überwachen; die eingesetzte automatisierte Prüfung ersetzt keine vollständige Kontrolle.",
        `Umfang, Begrenzung und Freistellung der Haftung sowie die Haftung für Datenverlust: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "17. Verbraucherinformationen",
      paragraphs: [
        "Die Plattform wird derzeit unentgeltlich und ohne Abschluss eines entgeltlichen Vertrags bereitgestellt.",
        `Erforderliche Verbraucherinformationen einschließlich Widerrufsrecht, Streitbeilegung und Verbraucherschlichtungsstelle: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "18. Änderungen dieser AGB",
      paragraphs: [
        "Der Betreiber kann diese AGB ändern, soweit dies erforderlich und für den Nutzer zumutbar ist. Über wesentliche Änderungen werden registrierte Nutzer informiert.",
        `Verfahren, Fristen und Zustimmungserfordernisse für Änderungen: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "19. Schlussbestimmungen",
      paragraphs: [
        "Sollte eine Bestimmung dieser AGB unwirksam sein oder werden, bleiben die übrigen Bestimmungen unberührt.",
        `Anwendbares Recht und Gerichtsstand: ${REVIEW_LAWYER}`,
      ],
    },
  ],
};
