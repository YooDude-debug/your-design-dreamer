import {
  LEGAL_DATE_V31,
  LEGAL_NOTICE,
  REVIEW_LAWYER,
  REVIEW_TECH,
  type LegalDoc,
} from "./types";

/** AGB – beschreibt die tatsächlich vorhandene Plattform. */
export const TERMS_DOC: LegalDoc = {
  slug: "agb",
  title: "Allgemeine Geschäftsbedingungen (AGB)",
  version: "3.1",
  date: LEGAL_DATE_V31,
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
        "Y-Dude stellt eine Plattform bereit, auf der Nutzer eigene Inhalte veröffentlichen, Inhalte anderer entdecken sowie im integrierten Marktplatz „Y-Dude Market“ Artikel anbieten und kaufen können. Die Grundfunktionen sind unentgeltlich; einzelne Zusatzfunktionen sind kostenpflichtig (Abschnitt 3a). Zum Funktionsumfang gehören derzeit:",
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
        "Y-Dude Market: Inserate, Preisangebote, Kaufabwicklung, Zahlung, Versand oder Abholung (Abschnitte 3b bis 3j)",
        "kostenpflichtige Zusatzfunktionen: Hervorhebung von Inseraten im Market und Abonnements mit erweiterten Funktionen",
      ],
      // Änderungen des Funktionsumfangs siehe Abschnitt 14.
    },
    {
      title: "3a. Kostenlose Grundnutzung und kostenpflichtige Zusatzfunktionen",
      paragraphs: [
        "Die Registrierung sowie die Nutzung der sozialen Grundfunktionen (Profil, Beiträge, SlangTags, Feed, Interaktionen, Chats, Arena, Globe) sind unentgeltlich. Ein Anspruch auf dauerhafte Unentgeltlichkeit oder auf einen bestimmten Funktionsumfang besteht nicht.",
        "Kostenpflichtig sind derzeit ausschließlich: die zeitlich befristete Hervorhebung von Inseraten im Y-Dude Market (Abschnitt 3e) sowie Abonnements mit erweiterten Funktionen. Diese Zusatzfunktionen werden ausdrücklich als kostenpflichtig gekennzeichnet und erst nach Auswahl eines Pakets und Abschluss des Bezahlvorgangs wirksam.",
        "Preise, Laufzeiten und Leistungsumfang der jeweiligen Pakete werden im Bezahlvorgang angezeigt. Diese AGB legen keine Preise fest.",
        `Verbraucherinformationen, Vertragsschluss, Kündigung und Widerrufsrecht für diese entgeltlichen Zusatzfunktionen: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "3b. Y-Dude Market – Rolle der Plattform",
      paragraphs: [
        "Y-Dude Market ist ein in die Plattform integrierter Marktplatz. Nutzer können dort eigene Artikel als Inserat einstellen und Artikel anderer Nutzer kaufen.",
        "Y-Dude ist nicht Verkäufer der angebotenen Artikel und wird nicht Vertragspartei des Kaufvertrags. Der Kaufvertrag kommt ausschließlich zwischen dem inserierenden Nutzer (Verkäufer) und dem kaufenden Nutzer (Käufer) zustande. Y-Dude stellt die technische Infrastruktur für Inserat, Suche, Kontaktaufnahme, Preisangebote, Transaktionsabwicklung und Einleitung der Zahlung bereit.",
        "Inserate werden vor Veröffentlichung nicht auf Richtigkeit, Echtheit, Zustand, Verkehrsfähigkeit oder Rechtmäßigkeit geprüft. Alle Angaben zu Artikel, Preis, Zustand, Ort, Lieferart und Versandkosten stammen vom Verkäufer.",
        "Für die Erfüllung des Kaufvertrags, für Mängel, Gewährleistung, Eigentumsübertragung, Steuern und Abgaben sind ausschließlich Verkäufer und Käufer verantwortlich.",
        `Rechtliche Einordnung der Vermittlerrolle sowie Haftungsprivilegien für vermittelte Angebote: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "3c. Verkäuferangaben und Verkäuferprofil",
      paragraphs: [
        "Zu jedem Inserat werden das Nutzerprofil des Verkäufers und die vom Verkäufer eingegebenen Angaben angezeigt: Titel, Beschreibung, Bilder, Preis, Verhandlungsbereitschaft, Zustand, Lieferart sowie Ort und Postleitzahlbereich.",
        "Verkäufer können zusätzlich ein Verkäuferprofil anlegen und dort angeben, ob sie privat, gewerblich oder professionell verkaufen, sowie Firmenname, Beschreibung, Logo und Website hinterlegen.",
        "Wer gewerblich oder beruflich verkauft, handelt als Unternehmer und muss die für ihn geltenden gesetzlichen Informationspflichten (u. a. Identität, Anschrift, Kontaktdaten, Preisangaben, Gewährleistung, Widerrufsrecht) selbst erfüllen.",
        `Eine verpflichtende Abfrage der Unternehmereigenschaft, eine sichtbare Kennzeichnung im Inserat und eine Anzeige gesetzlicher Unternehmerangaben sind derzeit technisch nicht umgesetzt (Verkäufertyp ist eine freiwillige Selbstangabe im Verkäuferprofil): ${REVIEW_TECH}`,
      ],
    },
    {
      title: "3d. Kaufabwicklung, Preise und Zahlung im Market",
      paragraphs: [
        "Der Kauf wird über eine Transaktion mit eigener Referenznummer abgewickelt. In der Transaktion werden Artikelpreis, Versandkosten, Menge, Gesamtbetrag, Währung und die Art der Übergabe (Versand oder Abholung) verbindlich festgehalten.",
        "Preise legt der Verkäufer fest. Ist ein Artikel als verhandelbar gekennzeichnet, können Käufer ein Preisangebot abgeben; nimmt der Verkäufer es an, wird der vereinbarte Betrag in der Transaktion festgeschrieben.",
        "Die Zahlung erfolgt über den Zahlungsdienstleister Stripe. Der Käufer wird dazu in einen von Stripe bereitgestellten Bezahlvorgang geführt. Zahlungsmittel- und Kartendaten werden ausschließlich von Stripe verarbeitet; Y-Dude erhält und speichert keine vollständigen Zahlungsdaten (Abschnitt 3f).",
        "Eine Zahlung gilt erst dann als erfolgt, wenn Y-Dude eine signaturgeprüfte Bestätigung von Stripe erhält. Erst danach wechselt die Transaktion in den bezahlten Status, der Artikel wird als verkauft markiert und der Versand- bzw. Abholvorgang freigegeben.",
        "Solange keine bestätigte Zahlung vorliegt, besteht kein Anspruch auf Übergabe des Artikels.",
      ],
    },
    {
      title: "3e. Plattformgebühr und Hervorhebung von Inseraten",
      paragraphs: [
        "Für Transaktionen im Market kann eine Plattformgebühr anfallen. Sie wird beim Anlegen der Transaktion aus den hinterlegten Gebühreneinstellungen (prozentualer Anteil und/oder fester Betrag) berechnet und in der Transaktion getrennt ausgewiesen: Plattformgebühr, Zahlungsgebühr und der für den Verkäufer verbleibende Betrag.",
        "Die im Einzelfall geltenden Beträge werden in der Transaktionsübersicht angezeigt. Diese AGB legen keine Gebührensätze fest; die Gebühreneinstellungen können durch den Betreiber geändert werden und gelten für danach angelegte Transaktionen.",
        "Verkäufer können Inserate gegen Entgelt hervorheben. Hervorhebungspakete haben eine feste Laufzeit und einen im Bezahlvorgang angezeigten Preis; die Hervorhebung beginnt erst nach bestätigter Zahlung und endet automatisch mit Ablauf der Laufzeit.",
        "Hervorgehobene Inserate werden in Listen und Suchergebnissen bevorzugt einsortiert und mit dem Hinweis „Hervorgehoben“ gekennzeichnet. Die Zahl hervorgehobener Inserate pro Ergebnisseite ist begrenzt. Die Reihenfolge der übrigen Inserate richtet sich nach Suchtreffer, Aktualität und Entfernung.",
        `Auszahlung des Verkäuferanteils sowie Rechnungsstellung über Plattformgebühren und Hervorhebungen sind derzeit nicht automatisiert umgesetzt: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "3f. Zahlungsdienstleister und Zahlungsdaten",
      paragraphs: [
        "Zahlungen für Market-Käufe, Hervorhebungen und Abonnements werden über Stripe abgewickelt. Stripe ist insoweit eigenverantwortlicher Zahlungsdienstleister und verarbeitet die Zahlungsdaten nach seinen eigenen Bedingungen und Datenschutzhinweisen (abrufbar unter stripe.com).",
        "An Stripe werden dabei die für den Bezahlvorgang erforderlichen Angaben übermittelt: Betrag, Währung, Artikelbezeichnung, Transaktionsreferenz, Kundenkennung und E-Mail-Adresse.",
        "Y-Dude speichert zur Zahlung ausschließlich technische Nachweise: Vorgangs- und Zahlungskennung des Anbieters, Betrag, Währung, Zahlungsstatus und Zeitpunkt. Kartennummern, Kontodaten oder vollständige Zahlungsmitteldaten werden von Y-Dude nicht erhoben und nicht gespeichert.",
        "Zahlungsbestätigungen werden ausschließlich über eine signaturgeprüfte Benachrichtigung von Stripe verarbeitet; doppelte Benachrichtigungen bleiben ohne Wirkung.",
      ],
    },
    {
      title: "3g. Versand, Abholung und Abschluss",
      paragraphs: [
        "Bei Versand gibt der Käufer eine Lieferadresse an. Diese wird dem Verkäufer ausschließlich zur Erfüllung des Kaufvertrags zugänglich gemacht und darf nicht zu anderen Zwecken verwendet werden. Der Verkäufer kann Versanddienstleister und Sendungsnummer hinterlegen; Versandkosten legt der Verkäufer im Inserat fest.",
        "Bei Abholung erhält der Käufer nach bestätigter Zahlung einen einmalig verwendbaren Abholcode. Ort und Zeitpunkt der Übergabe vereinbaren Käufer und Verkäufer selbst.",
        "Versand, Zustellung, Empfangsbestätigung und Abschluss der Transaktion werden in der Transaktionsansicht bestätigt und protokolliert. Der Abschluss dient der Nachvollziehbarkeit und ersetzt keine gesetzlichen Ansprüche.",
        "Y-Dude schuldet keinen Transport und übernimmt kein Transportrisiko.",
      ],
    },
    {
      title: "3h. Widerrufsrecht im Market",
      paragraphs: [
        "Verkauft ein Nutzer als Unternehmer an einen Verbraucher, steht dem Verbraucher regelmäßig ein gesetzliches Widerrufsrecht zu. Der unternehmerische Verkäufer ist verpflichtet, darüber zu informieren und die gesetzlich vorgesehene Widerrufsbelehrung samt Muster-Widerrufsformular bereitzustellen.",
        "Bei Verkäufen zwischen Privatpersonen besteht kein gesetzliches Widerrufsrecht.",
        "Für die entgeltlichen Zusatzfunktionen des Betreibers (Hervorhebung, Abonnement) gelten die gesetzlichen Verbraucherrechte gegenüber dem Betreiber.",
        `Widerrufsbelehrung, Muster-Widerrufsformular, Hinweise zum vorzeitigen Erlöschen des Widerrufsrechts bei digitalen Leistungen sowie die technische Kennzeichnung unternehmerischer Verkäufer sind derzeit nicht umgesetzt: ${REVIEW_LAWYER}`,
      ],
    },
    {
      title: "3i. Rückabwicklung, Erstattungen und Streitfälle",
      paragraphs: [
        "Solange eine Zahlung nicht bestätigt ist, kann die Transaktion abgebrochen werden; das Inserat wird dann wieder freigegeben.",
        "Nach bestätigter Zahlung kann der Käufer in der Transaktionsansicht eine Erstattung beantragen und einen Grund angeben. Ebenso können Käufer und Verkäufer einen Streitfall mit Begründung melden.",
        "Erstattungsanträge und Streitfälle werden vom Betreiber geprüft und entschieden; Status und Entscheidung werden in der Transaktion protokolliert.",
        `Die tatsächliche Rückzahlung eines bewilligten Betrags wird nicht automatisch durch die Plattform ausgelöst, sondern muss über den Zahlungsdienstleister veranlasst werden; Fristen und Zuständigkeiten hierfür: ${REVIEW_TECH}`,
        "Eine Entscheidung des Betreibers über einen Erstattungsantrag ist eine plattforminterne Maßnahme und ersetzt keine gesetzlichen Ansprüche zwischen Käufer und Verkäufer.",
      ],
    },
    {
      title: "3j. Unzulässige Angebote und Meldung von Inseraten",
      paragraphs: [
        "Im Market dürfen nur Artikel angeboten werden, über die der Verkäufer verfügen darf und deren Verkauf gesetzlich zulässig ist. Unzulässig sind insbesondere:",
      ],
      bullets: [
        "gestohlene, unterschlagene oder aus Straftaten stammende Gegenstände",
        "gefälschte Waren sowie Verletzungen von Marken-, Urheber- oder Persönlichkeitsrechten",
        "Waffen, Munition, Sprengstoffe, Feuerwerk und verbotene Gegenstände nach Waffenrecht",
        "Betäubungsmittel, verschreibungspflichtige Arzneimittel, Dopingmittel sowie nicht verkehrsfähige Nahrungsergänzungsmittel",
        "Tabak, Alkohol und andere altersbeschränkte Waren ohne zulässige Altersprüfung",
        "lebende Tiere, geschützte Arten und Erzeugnisse daraus",
        "menschliche Organe, Blut, Körperteile und Körperflüssigkeiten",
        "pornografische Inhalte, sexuelle Dienstleistungen und jugendgefährdende Medien",
        "verfassungswidrige, extremistische oder volksverhetzende Gegenstände und Kennzeichen",
        "Zugangsdaten, Nutzerkonten, personenbezogene Datensätze sowie Software- und Medienlizenzen unter Verstoß gegen deren Bedingungen",
        "amtliche Dokumente, Ausweise, Urkunden, Uniformen und Dienstabzeichen",
        "Werkzeuge zum Öffnen von Schlössern, Manipulationsgeräte, Überwachungsgeräte und Schadsoftware",
        "Gefahrstoffe, Chemikalien und radioaktive Stoffe ohne erforderliche Erlaubnis",
        "Finanzprodukte, Zahlungsmittel, Kryptowerte und Gutscheine mit erkennbarem Betrugsrisiko",
        "erfundene oder nicht vorhandene Artikel, irreführende Preise sowie Inserate, die allein der Umgehung von Plattformgebühren dienen",
        "medizinische, heil- oder wirkungsbezogene Aussagen ohne zulässige Grundlage",
      ],
    },
    {
      title: "3k. Meldung problematischer Angebote und Maßnahmen",
      paragraphs: [
        "Problematische Inserate und Verkäufer können gemeldet werden; das Meldesystem der Plattform sieht dafür eigene Meldearten für Inserate und Verkäufer vor. Meldungen werden geprüft; Ergebnis und Maßnahme werden protokolliert.",
        `Eine Meldefunktion unmittelbar im Inserat und im Verkäuferprofil ist noch nicht umgesetzt; bis dahin sind Meldungen an die im Impressum genannte Kontaktadresse zu richten: ${REVIEW_TECH}`,
        "Bei Verstößen gegen diesen Abschnitt oder gegen die Community-Richtlinien können Inserate entfernt oder gesperrt, laufende Transaktionen angehalten und das Nutzerkonto gesperrt oder gelöscht werden. Die Abschnitte 9 bis 11a gelten entsprechend.",
        "Bei Verdacht auf Straftaten kann eine Weitergabe an zuständige Behörden erfolgen.",
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
        "Die Grundfunktionen der Plattform werden unentgeltlich bereitgestellt. Entgeltlich sind derzeit die Hervorhebung von Inseraten im Y-Dude Market und Abonnements mit erweiterten Funktionen; diese Verträge kommen zwischen dem Nutzer und dem Betreiber zustande und werden über Stripe abgerechnet (Abschnitte 3a, 3e, 3f).",
        "Kaufverträge über Artikel im Y-Dude Market kommen ausschließlich zwischen Käufer und Verkäufer zustande (Abschnitt 3b). Verbraucherinformationen einschließlich Widerrufsbelehrung hat der jeweilige Verkäufer bereitzustellen, soweit er als Unternehmer handelt (Abschnitte 3c, 3h).",
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
