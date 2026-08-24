import { LEGAL_DATE, LEGAL_NOTICE, type LegalDoc } from "./types";

/** Community-/Nutzungsrichtlinien – bewusst einfach formuliert. */
export const GUIDELINES_DOC: LegalDoc = {
  slug: "richtlinien",
  title: "Community- und Nutzungsrichtlinien",
  version: "1.0",
  date: LEGAL_DATE,
  notice: LEGAL_NOTICE,
  intro:
    "Y-Dude lebt von Stimmen, Slang und Regionen. Diese Richtlinien erklären in klarer Sprache, was auf Y-Dude erlaubt ist und was nicht. Sie gelten für Beiträge, Bilder und GIFs, SlangTags, Kommentare, Profile, Chats und die Slang Arena. Sie sind Bestandteil der AGB.",
  sections: [
    {
      title: "1. Grundregel",
      paragraphs: [
        "Behandle andere so, wie du selbst behandelt werden willst. Slang darf frech, laut und regional sein – aber niemand darf dadurch verletzt, bedroht oder blossgestellt werden.",
        "Die Regeln gelten für alles, was du auf Y-Dude einstellst: Text, Bild, GIF, Audio, Profilangaben und Nachrichten.",
      ],
    },
    {
      title: "2. Verbotene Inhalte",
      paragraphs: ["Nicht erlaubt sind:"],
      bullets: [
        "Rechtswidrige Inhalte jeder Art",
        "Gewaltdarstellungen, Gewaltverherrlichung und Aufrufe zu Straftaten",
        "Drohungen gegen Personen oder Gruppen",
        "Hass und Herabwürdigung wegen Herkunft, Hautfarbe, Religion, Behinderung, Geschlecht, sexueller Orientierung oder Alter",
        "extremistische und terroristische Inhalte, Symbole oder Propaganda",
        "pornografische und sexualisierte Inhalte",
        "jede Darstellung von Minderjährigen in sexualisiertem Zusammenhang – solche Inhalte werden entfernt, das Konto wird gesperrt und der Fall wird den zuständigen Behörden gemeldet",
        "intime Aufnahmen ohne Einverständnis der abgebildeten Person",
        "Selbstverletzung oder Suizid als Aufforderung, Anleitung oder Verherrlichung",
      ],
    },
    {
      title: "2a. Krisen-Hinweis",
      paragraphs: [
        "Wenn es dir schlecht geht, wende dich an professionelle Hilfe in deiner Region. Y-Dude ist kein Krisendienst.",
      ],
    },
    {
      title: "3. Umgang miteinander",
      paragraphs: ["Nicht erlaubt sind:"],
      bullets: [
        "Belästigung, Mobbing, Stalking und gezieltes Hinterherposten",
        "Beleidigungen und herabwürdigende Zuschreibungen gegen einzelne Personen",
        "Doxxing: das Veröffentlichen privater Daten anderer, etwa Adresse, Telefonnummer, Arbeitsplatz, Ausweis- oder Kontodaten",
        "das Weiterleiten privater Chats oder Sprachnachrichten ohne Einverständnis",
        "Aufrufe, andere gemeinsam anzugreifen oder zu melden",
      ],
    },
    {
      title: "4. Identität und Echtheit",
      paragraphs: ["Nicht erlaubt sind:"],
      bullets: [
        "sich als eine andere Person, Marke oder Behörde ausgeben",
        "Profile, die echte Personen imitieren und dadurch täuschen",
        "falsche Angaben beim Geburtsdatum, um das Mindestalter von 16 Jahren zu umgehen",
        "Konten, die nach einer Sperre neu angelegt werden",
      ],
    },
    {
      title: "5. Betrug, Spam und technischer Missbrauch",
      paragraphs: ["Nicht erlaubt sind:"],
      bullets: [
        "Betrug, betrügerische Angebote, Schneeballsysteme, gefälschte Gewinnspiele",
        "Phishing und das Abfragen von Zugangsdaten",
        "Links zu Schadsoftware oder manipulierten Dateien",
        "Spam: massenhaft gleiche oder sinnlose Beiträge, Kommentare, Nachrichten oder SlangTags",
        "verdeckte Werbung ohne Kennzeichnung",
        "Bots, Skripte oder automatisierte Zugriffe ohne Erlaubnis des Betreibers",
        "Angriffe auf die Plattform, Umgehen von Sicherheits- oder Begrenzungsmechanismen, Zugriff auf Daten anderer Konten",
      ],
    },
    {
      title: "6. Fremde Inhalte und Urheberrecht",
      paragraphs: [
        "Stelle nur ein, was dir gehört oder wofür du die Erlaubnis hast. Das gilt besonders für Musik, Filmausschnitte, Fotos, Grafiken und Aufnahmen anderer Stimmen.",
        "Wenn Personen zu sehen oder zu hören sind, brauchst du deren Einverständnis.",
        "Bei Urheberrechtsbeschwerden kannst du dich über die im Impressum genannte Kontaktadresse melden; betroffene Inhalte können entfernt werden.",
      ],
    },
    {
      title: "7. Besondere Regeln für SlangTags",
      paragraphs: [
        "SlangTags sind das Herz von Y-Dude: kurze Audioaufnahmen, die auf einem Bild platziert werden. Genau deshalb gelten sie nicht als „Schlupfloch“. Ein SlangTag darf nicht dazu genutzt werden,",
      ],
      bullets: [
        "verbotene Inhalte zu verstecken oder zu verschleiern,",
        "die Moderation zu umgehen (z. B. verbotene Aussagen nur als Audio zu sagen),",
        "andere gezielt zu beleidigen, zu bedrohen oder lächerlich zu machen,",
        "private Daten anderer Personen weiterzugeben,",
        "rechtswidrige Inhalte zu transportieren,",
        "geschützte Musik oder fremde Aufnahmen ohne Erlaubnis zu übernehmen,",
        "Arena-, Ranking- oder Trendsysteme zu manipulieren.",
      ],
    },
    {
      title: "7a. Audio wird mitgeprüft",
      paragraphs: [
        "SlangTags werden automatisiert geprüft. Dazu kann die Aufnahme in Text umgewandelt und mitbewertet werden. Ein SlangTag, dessen Inhalt gegen diese Richtlinien verstösst, wird entfernt – unabhängig davon, wie harmlos das Bild dazu aussieht.",
      ],
    },
    {
      title: "8. Faires Voting in der Slang Arena",
      paragraphs: ["Nicht erlaubt sind:"],
      bullets: [
        "Mehrfachkonten, um mehrfach zu stimmen oder zu liken",
        "Absprachen, Stimmenkauf oder Stimmentausch",
        "automatisierte Stimmen, Likes oder Wiedergaben",
        "künstliches Hochzählen von Plays, Aufrufen oder Shares",
        "Aufrufe, gegen bestimmte Einreichungen gezielt zu stimmen, um sie zu schädigen",
      ],
    },
    {
      title: "8a. Folgen von Manipulation",
      paragraphs: [
        "Manipulierte Stimmen und Reichweiten können entfernt, Einreichungen ausgeschlossen und Konten gesperrt werden.",
      ],
    },
    {
      title: "9. Regeln in Chats",
      paragraphs: [
        "Private Nachrichten sind kein rechtsfreier Raum. Drohungen, Belästigung, unerwünschte sexuelle Inhalte und Betrugsversuche sind auch dort verboten.",
        "Chats sind nicht Ende-zu-Ende-verschlüsselt. Gemeldete Nachrichten können von der Moderation geprüft werden.",
      ],
    },
    {
      title: "10. Wie moderiert wird",
      paragraphs: [
        "Neue Inhalte werden automatisiert geprüft. Auffällige Inhalte können zurückgehalten und zusätzlich von Menschen geprüft werden.",
        "Jeder kann Inhalte über die Meldefunktion melden. Missbräuchliche Meldungen sind selbst ein Verstoss.",
        "Je nach Schwere folgen: Hinweis, Entfernen des Inhalts, Verwarnung, Einschränkung von Funktionen, zeitweise Sperre oder dauerhafte Sperre und Löschung des Kontos.",
      ],
    },
    {
      title: "11. Wenn du nicht einverstanden bist",
      paragraphs: [
        "Wurde ein Inhalt entfernt oder dein Konto eingeschränkt und du hältst das für falsch, melde dich über die im Impressum genannte Kontaktadresse. Entscheidungen werden dann erneut geprüft.",
      ],
    },
    {
      title: "12. Änderungen dieser Richtlinien",
      paragraphs: [
        "Diese Richtlinien werden weiterentwickelt, wenn neue Funktionen entstehen oder neue Formen von Missbrauch auftreten. Version und Stand stehen am Anfang dieses Dokuments.",
      ],
    },
  ],
};
