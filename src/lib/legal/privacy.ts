import { LEGAL_DATE_V31, LEGAL_NOTICE, REVIEW_TECH, type LegalDoc } from "./types";

/**
 * Datenschutzerklärung – beschreibt den tatsächlich im Code umgesetzten
 * Datenfluss (siehe docs/DATENSCHUTZ_TECHNIK.md).
 * Rechtsgrundlagen, Fristen, SCC/Drittland und DSFA sind bewusst als
 * "zu prüfen" markiert und nicht erfunden.
 */
export const PRIVACY_DOC: LegalDoc = {
  slug: "datenschutz",
  title: "Datenschutzerklärung",
  version: "3.1",
  date: LEGAL_DATE_V31,
  notice: LEGAL_NOTICE,
  intro:
    "Diese Datenschutzerklärung beschreibt den technisch tatsächlich umgesetzten Datenfluss der Plattform Y-Dude. Angaben zu Rechtsgrundlagen, konkreten Speicherfristen, Auftragsverarbeitung, Drittlandtransfers und zur Erforderlichkeit einer Datenschutz-Folgenabschätzung sind ausdrücklich als zu prüfen gekennzeichnet.",
  sections: [
    {
      title: "1. Verantwortlicher",
      paragraphs: [
        "Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der Datenschutz-Grundverordnung (DSGVO) ist der im Impressum genannte Betreiber der Plattform Y-Dude: Y-Dude UG i.G., Wuhlestraße 7a, 12683 Berlin, Deutschland, Tidymagic@gmail.com.",
        `Benennung eines Datenschutzbeauftragten: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "2. Allgemeines und Rechtsgrundlagen",
      paragraphs: [
        "Wir verarbeiten personenbezogene Daten ausschließlich im Einklang mit den geltenden Datenschutzgesetzen, insbesondere der DSGVO.",
        `Die Zuordnung der einzelnen Verarbeitungen zu den Rechtsgrundlagen nach Art. 6 DSGVO (Vertragserfüllung, berechtigtes Interesse, Einwilligung, rechtliche Verpflichtung) ist noch abschließend festzulegen: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "3. Registrierung und Authentifizierung",
      paragraphs: [
        "Für ein Nutzerkonto verarbeiten wir die bei der Registrierung angegebenen Daten. Die Authentifizierung erfolgt über den Authentifizierungsdienst unseres Backend-Anbieters (Supabase).",
        "Verarbeitet werden dabei insbesondere:",
      ],
      bullets: [
        "Benutzername",
        "E-Mail-Adresse",
        "Passwort (ausschließlich als kryptografischer Hash gespeichert, nicht im Klartext)",
        "Geburtsdatum (Prüfung des Mindestalters von 16 Jahren, Speicherung im Profil)",
        "Bestätigungs- und Sitzungsinformationen (E-Mail-Bestätigung, Anmeldesitzung, Token zum Zurücksetzen des Passworts)",
        "Zeitpunkte von Registrierung, letzter Aktivität und Anwesenheitsstatus (online, beschäftigt, offline)",
      ],
    },
    {
      title: "4. Profildaten",
      paragraphs: [
        "Im Profil können freiwillig weitere Angaben gemacht werden. Für jedes dieser Felder kann im Profil eine Sichtbarkeit eingestellt werden (öffentlich, nur Verbindungen, privat). Verarbeitet werden können:",
      ],
      bullets: [
        "Anzeigename, Beschreibung (Bio), Pronomen, echter Name (optional, ausblendbar)",
        "Profil- und Titelbild",
        "Ort/Region, Herkunft, Sprachen, Reisepläne",
        "Interessen, Hobbys, Lieblingsmusik, -filme, -spiele, -sport",
        "Verlinkte externe Profile (Website, Instagram, TikTok, YouTube, Twitch, Discord)",
        "Level- und Erfahrungspunkte, Sichtbarkeits- und Anzeigeeinstellungen",
      ],
    },
    {
      title: "5. Beiträge, Medien und SlangTags",
      paragraphs: [
        "Nutzer können Inhalte erstellen. Diese werden gespeichert und – entsprechend der gewählten Sichtbarkeit – innerhalb der Plattform angezeigt. Dazu gehören:",
      ],
      bullets: [
        "Beiträge mit Titel, Beschreibung, Region, Hashtags",
        "Bilder und GIFs sowie deren Platzierungsdaten auf dem Beitragsbild",
        "SlangTags: kurze Audioaufnahmen mit Name, Bedeutung, Beispielsätzen, Region und Sprache",
        "Kommentare und Antworten",
        "Zähler zu Likes, Kommentaren, Shares, Aufrufen und Speicherungen",
      ],
    },
    {
      title: "5a. Unbearbeitete Originalmedien",
      paragraphs: [
        "Wird ein Bild für einen Beitrag hochgeladen, speichern wir neben der für die Anzeige optimierten Fassung zusätzlich die unbearbeitete Originaldatei im geschützten Medienspeicher der Plattform.",
        "Zweck ist die Nachvollziehbarkeit bei Meldungen und Moderationsentscheidungen sowie die erneute Erzeugung der Anzeigefassungen.",
        "Der Zugriff ist technisch beschränkt: Nutzer haben Zugriff auf ihre eigenen Dateien, darüber hinaus ausschließlich die Administration bzw. Moderation der Plattform. Bei Löschung des Beitrags bzw. des Kontos werden die Originaldateien mit gelöscht.",
      ],
    },
    {
      title: "6. Interaktionen: Likes, Votes, Plays, Speichern, Teilen",
      paragraphs: [
        "Interaktionen werden mit Bezug zum Konto gespeichert, damit Zähler korrekt geführt, Doppelbewertungen verhindert und eigene Interaktionen wieder zurückgenommen werden können. Erfasst werden:",
      ],
      bullets: [
        "Likes zu Beiträgen, Kommentaren und SlangTags",
        "Bewertungen (Up/Down) zu SlangTags",
        "Wiedergaben (Plays) von SlangTags und Arena-Beiträgen",
        "Speichern (Merken), Teilen und Aufrufe von Beiträgen",
        "Verbindungen (Anfragen, Annahme, Ablehnung) und Follower-Beziehungen",
      ],
      // Hinweis: Sichtbarkeit von Liker-Listen ist RLS-seitig eingeschränkt.
    },
    {
      title: "6a. Sichtbarkeit von Interaktionen",
      paragraphs: [
        "Wer einen Beitrag geliked hat, ist nur sichtbar, soweit der Beitrag für die anfragende Person sichtbar ist und die betroffenen Personen ihre Likes nicht auf privat gestellt haben. In der Slang Arena sind Stimmen, Likes und Wiedergaben auf die eigene Interaktion sowie auf die Ersteller bzw. das ausschreibende Unternehmen und die Moderation beschränkt.",
      ],
    },
    {
      title: "7. Chats und Nachrichten",
      paragraphs: [
        "Direktnachrichten und Chat-SlangTags werden auf den Servern der Plattform gespeichert, damit sie für die beteiligten Nutzer abrufbar sind. Der Zugriff ist technisch auf die Mitglieder der jeweiligen Unterhaltung beschränkt.",
        "Die Nachrichten sind nicht Ende-zu-Ende-verschlüsselt. Die Übertragung erfolgt verschlüsselt (HTTPS); ein technischer Zugriff durch den Plattformbetreiber ist – etwa bei Meldungen oder aus Sicherheitsgründen – nicht ausgeschlossen.",
        "Gespeichert werden Inhalt, Absender, Unterhaltung, Zeitpunkt sowie Zustell- und Lesezeitpunkt.",
      ],
    },
    {
      title: "8. Standortdaten und Ortsermittlung (Reverse Geocoding)",
      paragraphs: [
        "Ortsangaben in Profil und Beiträgen sind freiwillig und können manuell eingegeben werden.",
        "Wird die automatische Ortsermittlung genutzt, fragt der Browser die Standortfreigabe ab. Nur nach ausdrücklicher Freigabe werden die Koordinaten an BigDataCloud übermittelt, um daraus eine Ortsangabe zu erhalten. Zurückgeliefert werden Angaben wie Stadt, Region und Land.",
        "Gespeichert wird ausschließlich die daraus gebildete Ortsangabe – nicht die genauen Koordinaten. Die Sichtbarkeit des Ortes ist im Profil einstellbar (öffentlich, nur Verbindungen, privat).",
      ],
    },
    {
      title: "8a. Y-Dude Market: Inserate, Angebote und Transaktionen",
      paragraphs: [
        "Wer ein Inserat einstellt, veröffentlicht die dabei eingegebenen Angaben: Titel, Beschreibung, Bilder, Preis, Verhandlungsbereitschaft, Zustand, Kategorie sowie Ort und Postleitzahlbereich. Diese Angaben sind für angemeldete Nutzer sichtbar.",
        "Für einen Vorgang wird eine Transaktion gespeichert mit Referenznummer, Kennungen von Verkäufer und Käufer, Artikel, Menge, Artikelpreis, Gesamtbetrag, Währung, Übergabeart (Abholung) sowie Status mit Zeitpunkten.",
        "Zusätzlich werden Preisangebote, transaktionsbezogene Nachrichten, ein Ereignisprotokoll (z. B. Vorgang gestartet, Übergabe bestätigt, abgeschlossen) sowie Streitfälle mit Begründung gespeichert. Für die Abholung wird ein einmalig verwendbarer Abholcode erzeugt.",
        "Die Kaufpreiszahlung wird nicht über Y-Dude abgewickelt; Zahlungsdaten zu Market-Käufen werden daher nicht mehr erhoben. Zahlungs-, Versand- und Erstattungsdaten aus früheren, über die Plattform bezahlten Käufen bleiben als Nachweis gespeichert.",
        "Zwecke: Anbahnung und Dokumentation des zwischen Käufer und Verkäufer geschlossenen Kaufvertrags, Nachvollziehbarkeit des Vorgangs, Bearbeitung von Streitfällen sowie Missbrauchsabwehr. Rechtsgrundlagen: Vertrag bzw. Vertragsanbahnung und berechtigtes Interesse.",
        "Verkäufer und Käufer sehen jeweils die Daten des gemeinsamen Vorgangs sowie Nutzername und Anzeigename der anderen Partei. Y-Dude ist nicht Verkäufer der Artikel; die Rolle der Plattform ist in den AGB beschrieben.",
        `Aufbewahrungsfristen für Transaktions- und Zahlungsnachweise aufgrund handels- und steuerrechtlicher Pflichten: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "8b. Versanddaten im Market",
      paragraphs: [
        "Y-Dude organisiert keinen Versand. Im Market wird keine Lieferadresse erhoben und es werden keine Versandart, Versanddienstleister, Sendungsnummer oder Zustellzeitpunkte mehr gespeichert.",
        "Vereinbaren Käufer und Verkäufer einen Versand, tauschen sie die dafür nötigen Angaben – etwa die Anschrift – unmittelbar untereinander aus, zum Beispiel im Chat. Für diese Daten sind die Beteiligten selbst verantwortlich.",
        "Lieferadressen und Sendungsdaten aus früheren Vorgängen bleiben nach den unten genannten Fristen gespeichert bzw. anonymisiert. Sie werden nicht für Werbung verwendet und nicht an unbeteiligte Dritte übermittelt.",
      ],
    },
    {
      title: "8c. Market-Suche, gespeicherte Suchen und Statistik",
      paragraphs: [
        "Suchbegriffe und Filter im Market können auf ausdrücklichen Wunsch als gespeicherte Suche im Konto hinterlegt und dort wieder gelöscht werden.",
        "Für den Betrieb des Marktplatzes werden Ereignisse zu Inseraten erfasst, insbesondere Aufrufe, Merken (Favoriten), Kontaktaufnahmen und Angebote. Zwecke: Statistik für den jeweiligen Verkäufer, Sortierung von Ergebnissen sowie Erkennung von Missbrauch. Rechtsgrundlage: berechtigtes Interesse.",
        "In den angezeigten Verkäuferstatistiken werden ausschließlich zusammengefasste Zahlen ausgegeben.",
        "Verkäufer können freiwillig ein Verkäuferprofil veröffentlichen mit Angabe des Verkäufertyps (privat, gewerblich, professionell) sowie optional Firmenname, Beschreibung, Logo und Website.",
      ],
    },
    {
      title: "9. Automatisierte KI-Moderation",
      paragraphs: [
        "Zur Sicherheit der Plattform werden hochgeladene Inhalte automatisiert geprüft. Die Prüfung läuft über eine serverseitige Warteschlange, sobald ein Inhalt erstellt oder geändert wird.",
        "Geprüft wird insbesondere auf: rechtswidrige Inhalte, Hass, Gewalt und Drohungen, sexuelle und jugendgefährdende Inhalte, Belästigung, Spam, Betrug sowie sonstige Verstöße gegen die Community-Richtlinien.",
        "Das Ergebnis kann dazu führen, dass ein Inhalt freigegeben, zur Nachprüfung zurückgehalten oder gesperrt wird. Diese Entscheidung wird zunächst automatisiert getroffen.",
        "Zurückgehaltene und gemeldete Inhalte können zusätzlich durch die Moderation manuell geprüft und die Entscheidung geändert werden. Die Entscheidungen werden protokolliert, damit sie nachvollziehbar bleiben.",
        `Einordnung als automatisierte Entscheidung im Einzelfall im Sinne des Art. 22 DSGVO: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "9a. Übermittlung an externe KI-Dienste",
      paragraphs: [
        "Für die automatisierte Moderation werden Inhalte an externe KI-Dienste (OpenAI und/oder Google) übermittelt. Übermittelt werden können:",
      ],
      bullets: [
        "Titel, Beschreibung und Text eines Beitrags oder Kommentars",
        "das hochgeladene Bild eines Beitrags",
        "die Audioaufnahme eines SlangTags sowie deren automatisch erzeugte Textfassung (Transkript)",
        "Angaben zum Inhaltstyp, die für die Prüfung erforderlich sind",
      ],
    },
    {
      title: "9b. Personenbezug in geprüften Inhalten",
      paragraphs: [
        "Da Inhalte personenbezogene Angaben enthalten können (etwa Bilder von Personen, Sprachaufnahmen oder Texte mit Namensbezug), können solche Angaben Teil der übermittelten Inhalte sein.",
        "Transkripte von SlangTags werden gespeichert, um Moderation, Spam-Erkennung, Suche und Barrierefreiheit zu ermöglichen.",
      ],
    },
    {
      title: "10. Meldesystem und Moderationsprotokolle",
      paragraphs: [
        "Jeder Nutzer kann Inhalte melden. Gemeldete Inhalte werden gespeichert und geprüft. Dabei werden verarbeitet: gemeldeter Inhalt, meldende Person, Zeitpunkt, Bearbeitungsstatus, prüfende Person und Entscheidung samt Notiz.",
        "Zusätzlich werden Moderationsprotokolle geführt: automatisierte Moderationsergebnisse, Statusänderungen an SlangTags, Verwarnungen und Sperren sowie administrative Eingriffe (Admin-Protokoll).",
        "Zur Missbrauchsvermeidung gilt für Meldungen eine technische Begrenzung der Häufigkeit.",
      ],
    },
    {
      title: "11. Technische Protokolle und Serverlogs",
      paragraphs: [
        "Beim Betrieb der Plattform fallen technische Daten an, insbesondere IP-Adresse, Browsertyp, Betriebssystem, Gerätetyp, Zeitpunkt des Zugriffs, Anfragepfade sowie Fehlerprotokolle. Sie dienen dem Betrieb, der Sicherheit und der Fehleranalyse.",
        "In der Anwendung selbst werden protokolliert: Moderationsentscheidungen, administrative Eingriffe, sicherheitsrelevante Kontovorgänge (z. B. Export- und Löschanfragen, fehlgeschlagene Bestätigungen) sowie Interaktions- und Feed-Signale für die Personalisierung.",
        `Speicherdauer der Plattform- und Netzwerkprotokolle bei den eingesetzten Anbietern (Lovable, Supabase, Cloudflare): ${REVIEW_TECH}`,
      ],
    },
    {
      title: "12. Profiling und Ausspielung des Feeds",
      paragraphs: [
        "Die Reihenfolge der Inhalte im Feed wird auf Grundlage der eigenen Nutzung berechnet. Dafür werden Signale wie Aufrufe, Verweildauer, Likes, Kommentare, Shares, Verbindungen, gefolgte Konten und Interessenwerte verarbeitet und in Zwischenspeichern gehalten.",
        "Es findet eine Personalisierung (Profiling) statt. Diese dient der Sortierung der Inhalte und der Auswahl eingeblendeter Werbung.",
        `Rechtsgrundlage und Bewertung des Profilings sowie die Erforderlichkeit einer Datenschutz-Folgenabschätzung: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "12a. Werbung",
      paragraphs: [
        "In den Feed können Werbeinhalte (Bild- und Videowerbung, gesponserte SlangTags) eingemischt werden. Die Auswahl kann anhand der gespeicherten Interessenwerte und Werbeeinstellungen erfolgen. Werbeeinblendungen können im Profil bzw. in den Einstellungen abgeschaltet werden, soweit die jeweilige Funktion dies vorsieht.",
        "Zu Werbeinhalten werden aggregierte Kennzahlen erfasst (Einblendungen, Klicks, Reichweite). Eine Weitergabe personenbezogener Daten an Werbetreibende zur eigenständigen Nutzung findet nicht statt.",
      ],
    },
    {
      title: "12b. Widerspruch gegen Personalisierung",
      paragraphs: [
        "Am Ende dieser Seite kann die gespeicherte Personalisierung zurückgesetzt werden. Damit werden die zur Personalisierung gespeicherten Signale und Interessenwerte des eigenen Kontos entfernt.",
      ],
    },
    {
      title: "13. Push-Benachrichtigungen",
      paragraphs: [
        "Aktiviert ein Nutzer Benachrichtigungen, erzeugt der Browser eine Push-Registrierung beim Push-Dienst des jeweiligen Browser- bzw. Plattformanbieters. Diese Registrierung besteht aus einer Zustelladresse des Anbieters und den zugehörigen Schlüsseln.",
        "Wir speichern diese Registrierung zusammen mit einer Angabe zum verwendeten Browser, um Benachrichtigungen zustellen zu können. Zustelladressen werden technisch auf die Push-Dienste der Browser- und Betriebssystemhersteller begrenzt.",
        "Die Registrierung wird gelöscht, wenn Benachrichtigungen deaktiviert werden, die Zustellung dauerhaft fehlschlägt oder das Konto gelöscht wird.",
      ],
    },
    {
      title: "14. E-Mail-Kommunikation und Double-Opt-in",
      paragraphs: [
        "Im Rahmen der Nutzung versenden wir E-Mails zu Registrierung, E-Mail-Bestätigung, Passwort-Zurücksetzen, Sicherheitshinweisen sowie zu wesentlichen Änderungen der Nutzungsbedingungen oder dieser Erklärung.",
        "Die Start-Benachrichtigung („Notify Me“) ist freiwillig und erfolgt im Double-Opt-in-Verfahren: Nach Eintragung der E-Mail-Adresse wird eine Bestätigungs-E-Mail mit einem einmalig verwendbaren, zeitlich befristeten Bestätigungslink versendet. Ohne Bestätigung erfolgt kein weiterer Versand.",
        "Gespeichert werden E-Mail-Adresse, Sprache, Status, Zeitpunkt der Einwilligung sowie Bestätigungs- und Versandzeitpunkte. Die Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden.",
      ],
    },
    {
      title: "15. Cookies und clientseitige Speicher",
      paragraphs: [
        "Y-Dude verwendet technisch notwendige Cookies und Browser-Speicher. Tatsächlich verwendet werden:",
      ],
      bullets: [
        "LocalStorage für die Anmeldesitzung (Zugangs- und Erneuerungstoken der Authentifizierung)",
        "LocalStorage für Anzeige- und Bedieneinstellungen, z. B. Sprache, Feed-Einstellungen und bereits gesehene Hinweise",
        "LocalStorage-Zwischenspeicher für bereits geladene Inhalte sowie der bestehende SlangTag-Cache für Audiodaten, damit diese nicht erneut übertragen werden müssen",
        "SessionStorage für kurzlebige Zustände innerhalb einer Sitzung",
        "eine Push-Registrierung des Browsers, sofern Benachrichtigungen aktiviert wurden",
        "Cookies bzw. Prüfmechanismen von Cloudflare im Rahmen des Bot-Schutzes",
      ],
    },
    {
      title: "15a. Analyse- und Marketing-Cookies",
      paragraphs: [
        "Analyse- oder Marketing-Cookies Dritter werden derzeit nicht eingesetzt. Sollte sich dies ändern, erfolgt der Einsatz nur nach den gesetzlichen Vorgaben und wird hier ergänzt.",
      ],
    },
    {
      title: "16. Cloudflare Turnstile",
      paragraphs: [
        "Zum Schutz der Formulare für Registrierung, Anmeldung, Passwort-Zurücksetzen und die Notify-Me-Funktion wird Cloudflare Turnstile eingesetzt.",
        "Dabei wird im Browser ein Prüfskript von Cloudflare geladen. Technisch verarbeitet werden insbesondere die IP-Adresse, Angaben zum Browser und zum Nutzungsverhalten der Prüfung sowie das erzeugte Prüf-Token.",
        "Das Prüf-Token wird anschließend serverseitig gegen Cloudflare validiert. Ohne erfolgreiche serverseitige Prüfung wird der jeweilige Vorgang nicht ausgeführt.",
      ],
    },
    {
      title: "17. Eingesetzte Dienste (technische Übersicht)",
      paragraphs: ["Für den Betrieb werden folgende externe Dienste technisch eingesetzt:"],
      bullets: [
        "Lovable – Bereitstellung, Auslieferung und Betrieb der Anwendung sowie Versand von System- und Bestätigungs-E-Mails",
        "Supabase – Datenbank, Authentifizierung und Speicherung der Mediendateien",
        "Cloudflare – Netzwerkauslieferung und Bot-/Missbrauchsschutz (Turnstile)",
        "OpenAI und Google – automatisierte Moderation von Texten, Bildern und Audio",
        "BigDataCloud – Umwandlung von Koordinaten in Ortsangaben bei der Standortauswahl",
        "Stripe – Abwicklung von Zahlungen für Hervorhebungen von Inseraten und Abonnements (nicht für Market-Käufe)",
        "Push-Dienste der Browser- und Betriebssystemhersteller – Zustellung von Benachrichtigungen",
      ],
    },
    {
      title: "17a. Auftragsverarbeitung und Drittlandübermittlung",
      paragraphs: [
        "Ein Teil der genannten Dienste kann Daten außerhalb der Europäischen Union verarbeiten.",
        `Abschluss und Inhalt der Auftragsverarbeitungsverträge, Serverstandorte, Standardvertragsklauseln, Angemessenheitsbeschlüsse und ergänzende Schutzmaßnahmen: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "17b. Zahlungsabwicklung über Stripe",
      paragraphs: [
        "Zahlungen für die Hervorhebung von Inseraten und für Abonnements werden über den Zahlungsdienstleister Stripe abgewickelt. Kaufpreiszahlungen im Market laufen nicht über Stripe; sie werden zwischen Käufer und Verkäufer unmittelbar geregelt.",
        "An Stripe übermittelt werden die für den Bezahlvorgang erforderlichen Angaben: Betrag, Währung, Bezeichnung des Pakets, Vorgangsreferenz, Nutzerkennung sowie die E-Mail-Adresse zur Anlage oder Zuordnung eines Zahlungskundenkontos bei Stripe.",
        "Zahlungsmittel-, Karten- und Kontodaten werden ausschließlich von Stripe erhoben und verarbeitet. Y-Dude speichert dazu nur technische Nachweise: Vorgangs- und Zahlungskennung des Anbieters, Betrag, Währung, Zahlungsstatus, Umgebung (Test- oder Produktivbetrieb), Zeitpunkt sowie die Kennungen eingegangener Anbieter-Benachrichtigungen, um eine doppelte Verarbeitung auszuschließen.",
        "Bei Abonnements werden zusätzlich der Abo-Status, die Laufzeitdaten und die Kennung des gebuchten Pakets gespeichert.",
        "Stripe verarbeitet die Zahlungsdaten insoweit eigenverantwortlich. Informationen zur Verarbeitung durch Stripe einschließlich einer Übermittlung in Drittländer sind in den Datenschutzhinweisen von Stripe (stripe.com) beschrieben.",
        "Rechtsgrundlage: Erfüllung des jeweiligen Vertrags.",
        `Rollenverteilung mit dem Zahlungsdienstleister (Auftragsverarbeitung oder eigene Verantwortlichkeit) und ergänzende Schutzmaßnahmen: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "18. Öffentliche Schnittstellen und automatisierte Abläufe",
      paragraphs: [
        "Die Plattform betreibt technische Endpunkte für wiederkehrende Aufgaben (Moderationslauf, Push-Versand, Zählerabgleich, Testbetrieb, Löschläufe). Diese Endpunkte sind ausschließlich mit einem serverseitigen Geheimnis aufrufbar; Aufrufe ohne Autorisierung werden abgewiesen.",
        "Personenbezogene Daten werden über diese Endpunkte nicht öffentlich ausgegeben.",
      ],
    },
    {
      title: "19. Aufbewahrung und Löschung (Fristenübersicht)",
      paragraphs: [
        "Personenbezogene Daten werden nur so lange gespeichert, wie dies für den jeweiligen Zweck erforderlich oder gesetzlich vorgeschrieben ist. Für technische Protokolle, Signale und Zwischenspeicher sind automatisierte Löschläufe eingerichtet, die täglich laufen.",
        "Es gelten folgende Regelfristen, gerechnet ab Entstehung des Datensatzes:",
      ],
      bullets: [
        "Sicherheitsereignisse zu Export und Kontolöschung: 180 Tage.",
        "Moderationsprotokolle und Moderationsverlauf von SlangTags: 365 Tage.",
        "Begründete Moderationsentscheidungen und Einsprüche: 730 Tage (Einspruchs- und Nachweisphase).",
        "Meldungen von Inhalten und Profilen inklusive Entscheidung: 730 Tage.",
        "Administrative Eingriffe (Admin-Protokoll): 1.095 Tage.",
        "Moderationsaufträge in der Warteschlange: 90 Tage nach Abschluss.",
        "Feed-Signale: 90 Tage; Interaktionsereignisse: 180 Tage; berechnete Feed-Bewertungen: 30 Tage.",
        "Benachrichtigungen im Postfach: 180 Tage; Versandwarteschlange für Push: 30 Tage.",
        "Maschinelle Übersetzungen: Nachrichten 180 Tage, Beiträge 365 Tage.",
        "Messwerte des internen Werbe-Testmodus: 90 Tage.",
        "Technische Betriebsereignisse: 90 Tage; zusammengefasste Störungsmeldungen: 365 Tage.",
        "Bildvarianten-Warteschlange: 30 Tage; Zählerpuffer: 7 Tage.",
        "Market: Aufrufe, Favoriten und Kontakte zu Inseraten 400 Tage; gespeicherte Suchen 365 Tage; Kennungen verarbeiteter Zahlungsereignisse 180 Tage.",
        "Frühere Market-Lieferadressen und Sendungsdaten (aus der Zeit der Versandabwicklung über die Plattform): Anonymisierung nach 1.095 Tagen; die Transaktion selbst bleibt als Buchungsnachweis ohne Adresse erhalten. Neue Vorgänge enthalten keine Lieferadresse.",
        "Market-Transaktionen und Zahlungsnachweise: keine automatische Löschung – gesetzliche Aufbewahrungspflicht nach § 147 AO und § 257 HGB (bis zu 10 Jahre).",
      ],
    },
    {
      title: "20. Backups",
      paragraphs: [
        "Die Datenbank- und Speicher-Backups werden durch die eingesetzten Plattformanbieter erstellt und verwaltet. Gelöschte Daten können daher für die Dauer eines Backup-Zyklus noch in Sicherungskopien enthalten sein, bevor sie endgültig entfallen.",
        `Aufbewahrungsdauer, Speicherort und Zugriffsberechtigungen der Backups: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "21. Kontolöschung",
      paragraphs: [
        "Das Konto kann in den Einstellungen vollständig gelöscht werden. Die Löschung erfordert eine Bestätigung mit dem eigenen Passwort und ist durch eine Begrenzung der Versuche geschützt.",
        "Gelöscht werden dabei insbesondere Profil, Beiträge, Medien einschließlich Originaldateien, SlangTags, Kommentare, Interaktionen, Verbindungen, Nachrichten, Benachrichtigungen, Push-Registrierungen, Personalisierungsdaten, Market-Favoriten, gespeicherte Suchen, das Verkäuferprofil sowie das Anmeldekonto selbst. Anschließend wird die Sitzung im Browser beendet und der lokale Speicher geräumt.",
        "Market-Inserate ohne Kaufhistorie werden gelöscht. Inserate, zu denen ein Kauf zustande gekommen ist, bleiben als Buchungsnachweis erhalten; Titel, Beschreibung, Bilder und Ortsangaben werden dabei entfernt und das Inserat dauerhaft aus dem Market genommen.",
        "Nicht mit dem Konto gelöscht werden Nachweise zu Market-Transaktionen und Zahlungen, weil hierfür gesetzliche Aufbewahrungspflichten bestehen (§ 147 AO, § 257 HGB – bis zu 10 Jahre). Sicherheits- und moderationsbezogene Protokolle bleiben nur so lange erhalten, wie es die oben genannten Fristen zur Missbrauchsabwehr und Rechenschaft vorsehen.",
      ],
    },

    {
      title: "22. Datenexport (Datenübertragbarkeit)",
      paragraphs: [
        "In den Einstellungen kann ein Export der eigenen Daten angefordert werden. Der Export erfordert eine Bestätigung mit dem eigenen Passwort, ist in der Häufigkeit begrenzt und enthält ausschließlich Daten des eigenen Kontos in einem maschinenlesbaren Format.",
        "Anfragen für Export und Löschung werden protokolliert, um Missbrauch erkennen zu können.",
      ],
    },
    {
      title: "23. Rechte der betroffenen Personen",
      paragraphs: ["Sie haben das Recht auf:"],
      bullets: [
        "Auskunft",
        "Berichtigung",
        "Löschung",
        "Einschränkung der Verarbeitung",
        "Datenübertragbarkeit",
        "Widerspruch gegen die Verarbeitung",
        "Widerruf einer erteilten Einwilligung",
        "Beschwerde bei einer Datenschutz-Aufsichtsbehörde",
      ],
    },
    {
      title: "23a. Anfragen",
      paragraphs: [
        "Anfragen können an die im Impressum genannte Kontaktadresse gerichtet werden: Tidymagic@gmail.com. Auskunft, Export und Löschung stehen zusätzlich unmittelbar in den Kontoeinstellungen zur Verfügung.",
        `Zuständige Aufsichtsbehörde: ${REVIEW_TECH}`,
      ],
    },
    {
      title: "24. Datensicherheit",
      paragraphs: [
        "Wir setzen technische und organisatorische Maßnahmen ein, um personenbezogene Daten zu schützen. Umgesetzt sind unter anderem:",
      ],
      bullets: [
        "verschlüsselte Übertragung (HTTPS)",
        "Passwortspeicherung ausschließlich als Hash",
        "Zugriffsbeschränkungen auf Datenbankebene je Konto (Row Level Security)",
        "serverseitige Prüfung aller schreibenden Vorgänge und der Formularabsicherung",
        "Autorisierung der internen Aufgaben-Endpunkte mit Serverschlüsseln",
        "Begrenzung der Zustelladressen für Push-Nachrichten auf bekannte Push-Dienste",
        "Begrenzung der Häufigkeit sicherheitsrelevanter Vorgänge (z. B. Meldungen, Export, Löschung)",
        "Protokollierung administrativer und sicherheitsrelevanter Vorgänge",
      ],
    },
    {
      title: "25. Mindestalter",
      paragraphs: [
        "Die Nutzung von Y-Dude ist erst ab 16 Jahren möglich. Bei der Registrierung wird das Geburtsdatum abgefragt und serverseitig geprüft; unterhalb des Mindestalters kann die Registrierung technisch nicht abgeschlossen werden.",
        "Eine Prüfung mit Ausweisdokumenten findet nicht statt.",
      ],
    },
    {
      title: "26. Änderungen dieser Datenschutzerklärung",
      paragraphs: [
        "Wir behalten uns vor, diese Datenschutzerklärung anzupassen, wenn dies aufgrund technischer, rechtlicher oder organisatorischer Änderungen erforderlich wird.",
        "Die jeweils aktuelle Version ist auf der Plattform abrufbar; Version und Stand sind am Anfang dieses Dokuments angegeben.",
      ],
    },
  ],
};
