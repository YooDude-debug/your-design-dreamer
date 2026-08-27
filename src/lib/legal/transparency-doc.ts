import type { Lang } from "@/lib/i18n-dict";
import type { LegalSection } from "@/components/LegalPage";
import type { TransparencyStats } from "@/lib/transparency.functions";
import { LEGAL_DATE } from "./types";

type Doc = {
  title: string;
  version: string;
  date: string;
  intro: string;
  notice: string;
  sections: LegalSection[];
};

const num = (n: number) => n.toLocaleString("de-DE");

/**
 * Öffentlicher Transparenzbericht (DSA Art. 15/24 sowie Art. 26/27 für
 * Werbung und Empfehlungssysteme). Die Zahlen werden live aggregiert und
 * enthalten keine personenbezogenen Daten.
 */
export function buildTransparencyDoc(lang: Lang, s: TransparencyStats): Doc {
  const stats = (labels: string[]): string[] => labels;

  if (lang === "en") {
    return {
      title: "Transparency report",
      version: "3.1",
      date: LEGAL_DATE,
      notice:
        "Aggregated figures without personal data. They are calculated live from the platform database.",
      intro: `Reporting period: the last ${s.windowDays} days. Generated: ${new Date(s.generatedAt).toLocaleString("en-GB")}.`,
      sections: [
        {
          title: "1. Reports and moderation measures",
          bullets: stats([
            `Reports received: ${num(s.reports)}`,
            `Moderation measures taken: ${num(s.actions)}`,
            `Of these based on automated detection: ${num(s.automatedActions)}`,
            `Content removed: ${num(s.removals)}`,
            `Content hidden or restricted: ${num(s.hides)}`,
            `Warnings issued: ${num(s.warnings)}`,
            `Accounts suspended: ${num(s.bans)}`,
          ]),
        },
        {
          title: "2. Appeals (Art. 20 DSA)",
          bullets: stats([
            `Appeals submitted: ${num(s.appeals)}`,
            `Appeals successful (measure reversed): ${num(s.appealsGranted)}`,
          ]),
          paragraphs: [
            'Every measure can be appealed within 180 days in the account under "Moderation". Appeals are reviewed by a person, never solely automated.',
          ],
        },
        {
          title: "3. Automated detection",
          paragraphs: [
            "Uploaded images, audio recordings including transcripts, texts and profile data are pre-screened by AI services. The system can hold content back or flag it for review; final removals, warnings and account suspensions are confirmed manually.",
            "Error rate safeguards: automated holds expire if no manual review confirms them, and every automated measure is marked as such in the statement of reasons.",
          ],
        },
        {
          title: "4. Recommendation system (Art. 27 DSA)",
          paragraphs: [
            "The feed is not a purely chronological list. Ranking uses: recency, own connections and follows, region and language, topic interests derived from own interactions, engagement of the content, and diversity rules that limit how many items from the same author or topic appear in a row.",
            'Sensitive categories are not used as ranking criteria. The tabs "Local", "Global", "Trending" and "Following" allow you to choose a different logic at any time; "Following" is the option closest to a non-personalised order.',
            "Personalisation data can be reset in the settings; interest signals are deleted automatically after 90 to 180 days.",
          ],
        },
        {
          title: "5. Advertising (Art. 26 DSA)",
          paragraphs: [
            "Advertising in the feed is always labelled as such and states who paid for it. Targeting uses coarse criteria only: region, language and broad topic categories.",
            "Advertising is never based on special categories of personal data (e.g. health, religion, sexual orientation, political opinions). Profiling of minors for advertising does not take place.",
          ],
        },
        {
          title: "6. Points of contact",
          paragraphs: [
            "Reports, complaints and requests from authorities are handled via the contact address in the legal notice. Reports can also be submitted directly in the app on every post, profile, SlangTag, comment and Market listing.",
          ],
        },
      ],
    };
  }

  if (lang === "el") {
    return {
      title: "Έκθεση διαφάνειας",
      version: "3.1",
      date: LEGAL_DATE,
      notice:
        "Συγκεντρωτικά στοιχεία χωρίς προσωπικά δεδομένα, τα οποία υπολογίζονται σε πραγματικό χρόνο.",
      intro: `Περίοδος αναφοράς: οι τελευταίες ${s.windowDays} ημέρες. Δημιουργήθηκε: ${new Date(s.generatedAt).toLocaleString("el-GR")}.`,
      sections: [
        {
          title: "1. Αναφορές και μέτρα συντονισμού",
          bullets: stats([
            `Αναφορές που ελήφθησαν: ${num(s.reports)}`,
            `Μέτρα συντονισμού: ${num(s.actions)}`,
            `Από αυτά βάσει αυτόματης ανίχνευσης: ${num(s.automatedActions)}`,
            `Περιεχόμενο που αφαιρέθηκε: ${num(s.removals)}`,
            `Περιεχόμενο που αποκρύφθηκε ή περιορίστηκε: ${num(s.hides)}`,
            `Προειδοποιήσεις: ${num(s.warnings)}`,
            `Λογαριασμοί που αποκλείστηκαν: ${num(s.bans)}`,
          ]),
        },
        {
          title: "2. Ενστάσεις (άρθρο 20 DSA)",
          bullets: stats([
            `Ενστάσεις που υποβλήθηκαν: ${num(s.appeals)}`,
            `Ενστάσεις που έγιναν δεκτές: ${num(s.appealsGranted)}`,
          ]),
          paragraphs: [
            "Κάθε μέτρο μπορεί να προσβληθεί εντός 180 ημερών στον λογαριασμό, στην ενότητα «Συντονισμός». Οι ενστάσεις εξετάζονται από άνθρωπο.",
          ],
        },
        {
          title: "3. Αυτόματη ανίχνευση",
          paragraphs: [
            "Εικόνες, ηχογραφήσεις με απομαγνητοφώνηση, κείμενα και στοιχεία προφίλ ελέγχονται προκαταρκτικά από υπηρεσίες τεχνητής νοημοσύνης. Οι τελικές αφαιρέσεις, προειδοποιήσεις και αποκλεισμοί επιβεβαιώνονται χειροκίνητα.",
            "Κάθε αυτοματοποιημένο μέτρο επισημαίνεται ως τέτοιο στην αιτιολόγηση.",
          ],
        },
        {
          title: "4. Σύστημα προτάσεων (άρθρο 27 DSA)",
          paragraphs: [
            "Το feed δεν είναι αυστηρά χρονολογικό. Λαμβάνονται υπόψη: επικαιρότητα, συνδέσεις και ακολουθήσεις, περιοχή και γλώσσα, θεματικά ενδιαφέροντα από τις δικές σας αλληλεπιδράσεις, η απήχηση του περιεχομένου και κανόνες ποικιλομορφίας.",
            "Ευαίσθητες κατηγορίες δεδομένων δεν χρησιμοποιούνται. Οι καρτέλες «Τοπικό», «Παγκόσμιο», «Τάσεις» και «Ακολουθώ» επιτρέπουν άλλη λογική· η «Ακολουθώ» είναι η πιο κοντινή σε μη εξατομικευμένη σειρά.",
            "Τα δεδομένα εξατομίκευσης μπορούν να επαναφερθούν στις ρυθμίσεις και διαγράφονται αυτόματα μετά από 90 έως 180 ημέρες.",
          ],
        },
        {
          title: "5. Διαφημίσεις (άρθρο 26 DSA)",
          paragraphs: [
            "Οι διαφημίσεις στο feed επισημαίνονται πάντοτε και αναφέρουν ποιος τις πλήρωσε. Η στόχευση γίνεται μόνο με γενικά κριτήρια: περιοχή, γλώσσα και ευρείες θεματικές κατηγορίες.",
            "Δεν χρησιμοποιούνται ειδικές κατηγορίες προσωπικών δεδομένων και δεν γίνεται κατάρτιση προφίλ ανηλίκων για διαφημιστικούς σκοπούς.",
          ],
        },
        {
          title: "6. Σημεία επικοινωνίας",
          paragraphs: [
            "Αναφορές, καταγγελίες και αιτήματα αρχών διεκπεραιώνονται μέσω της διεύθυνσης επικοινωνίας. Αναφορές υποβάλλονται επίσης απευθείας στην εφαρμογή.",
          ],
        },
      ],
    };
  }

  return {
    title: "Transparenzbericht",
    version: "3.1",
    date: LEGAL_DATE,
    notice:
      "Aggregierte Zahlen ohne personenbezogene Daten. Sie werden live aus der Plattformdatenbank berechnet.",
    intro: `Berichtszeitraum: die letzten ${s.windowDays} Tage. Erstellt: ${new Date(s.generatedAt).toLocaleString("de-DE")}.`,
    sections: [
      {
        title: "1. Meldungen und Moderationsmaßnahmen",
        bullets: stats([
          `Eingegangene Meldungen: ${num(s.reports)}`,
          `Getroffene Moderationsmaßnahmen: ${num(s.actions)}`,
          `Davon auf Basis automatisierter Erkennung: ${num(s.automatedActions)}`,
          `Gelöschte Inhalte: ${num(s.removals)}`,
          `Ausgeblendete oder eingeschränkte Inhalte: ${num(s.hides)}`,
          `Ausgesprochene Verwarnungen: ${num(s.warnings)}`,
          `Gesperrte Konten: ${num(s.bans)}`,
        ]),
      },
      {
        title: "2. Einsprüche (Art. 20 DSA)",
        bullets: stats([
          `Eingelegte Einsprüche: ${num(s.appeals)}`,
          `Erfolgreiche Einsprüche (Maßnahme aufgehoben): ${num(s.appealsGranted)}`,
        ]),
        paragraphs: [
          "Gegen jede Maßnahme kann innerhalb von 180 Tagen im Konto unter „Moderation“ Einspruch eingelegt werden. Einsprüche werden von einer Person geprüft, nie ausschließlich automatisiert.",
        ],
      },
      {
        title: "3. Automatisierte Erkennung",
        paragraphs: [
          "Hochgeladene Bilder, Audioaufnahmen samt Transkript, Texte und Profilangaben werden durch KI-Dienste vorgeprüft. Das System kann Inhalte zurückhalten oder zur Prüfung markieren; endgültige Löschungen, Verwarnungen und Kontosperren werden manuell bestätigt.",
          "Zur Begrenzung von Fehlern verfallen automatische Zurückhaltungen ohne manuelle Bestätigung, und jede automatisierte Maßnahme wird in der Begründung als solche gekennzeichnet.",
        ],
      },
      {
        title: "4. Empfehlungssystem des Feeds (Art. 27 DSA)",
        paragraphs: [
          "Der Feed ist keine rein chronologische Liste. In das Ranking gehen ein: Aktualität, eigene Verbindungen und Follows, Region und Sprache, Themeninteressen aus den eigenen Interaktionen, die Resonanz eines Inhalts sowie Diversitätsregeln, die begrenzen, wie viele Inhalte derselben Person oder desselben Themas hintereinander erscheinen.",
          "Besondere Datenkategorien werden nicht als Ranking-Kriterium verwendet. Über die Reiter „Lokal“, „Global“, „Trending“ und „Folge ich“ kann jederzeit eine andere Logik gewählt werden; „Folge ich“ kommt einer nicht personalisierten Reihenfolge am nächsten.",
          "Personalisierungsdaten können in den Einstellungen zurückgesetzt werden; Interessensignale werden automatisch nach 90 bis 180 Tagen gelöscht.",
        ],
      },
      {
        title: "5. Werbung (Art. 26 DSA)",
        paragraphs: [
          "Werbung im Feed ist immer als solche gekennzeichnet und nennt, wer sie bezahlt hat. Die Ausrichtung erfolgt nur nach groben Kriterien: Region, Sprache und breite Themenkategorien.",
          "Werbung wird nicht auf Grundlage besonderer Kategorien personenbezogener Daten ausgerichtet (etwa Gesundheit, Religion, sexuelle Orientierung, politische Meinung). Ein Profiling von Minderjährigen für Werbezwecke findet nicht statt.",
        ],
      },
      {
        title: "6. Anlaufstellen",
        paragraphs: [
          "Meldungen, Beschwerden und behördliche Anfragen werden über die im Impressum genannte Kontaktadresse bearbeitet. Meldungen sind zusätzlich direkt in der Anwendung an jedem Beitrag, Profil, SlangTag, Kommentar und Market-Inserat möglich.",
        ],
      },
    ],
  };
}
