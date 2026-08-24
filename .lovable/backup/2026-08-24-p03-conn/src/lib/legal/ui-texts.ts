import type { Lang } from "@/lib/i18n-dict";

/** UI-Texte der Rechtsseiten (Impressum, AGB, Datenschutz, Richtlinien) je Sprache. */
export type LegalUiTexts = {
  backToHome: string;
  version: string;
  status: string;
  impressumTitle: string;
  impressumDescription: string;
  impressumOgDescription: string;
  agbDescription: string;
  agbOgDescription: string;
  datenschutzDescription: string;
  datenschutzOgDescription: string;
  richtlinienDescription: string;
  richtlinienOgDescription: string;
  navImpressum: string;
  navDatenschutz: string;
  navAgb: string;
  navRichtlinien: string;
  impressumSectionTitle: string;
  impressumResponsibleTitle: string;
  impressumOpenFieldsTitle: string;
  impressumOpenFieldsPhone: string;
  impressumOpenFieldsVat: string;
  impressumOpenFieldsDispute: string;
};

export const LEGAL_UI_TEXTS: Record<Lang, LegalUiTexts> = {
  de: {
    backToHome: "Zurück zur Startseite",
    version: "Version",
    status: "Stand",
    impressumTitle: "Impressum — Y-Dude",
    impressumDescription: "Impressum und Anbieterkennzeichnung von Y-Dude gemäß § 5 DDG.",
    impressumOgDescription: "Impressum und Anbieterkennzeichnung von Y-Dude.",
    agbDescription:
      "Allgemeine Geschäftsbedingungen für die Nutzung der Social-Media-Plattform Y-Dude.",
    agbOgDescription: "Allgemeine Geschäftsbedingungen der Plattform Y-Dude.",
    datenschutzDescription:
      "Wie Y-Dude personenbezogene Daten verarbeitet: Daten, KI-Moderation, Cookies, Speicherdauer und deine Rechte nach DSGVO.",
    datenschutzOgDescription: "Datenschutzhinweise und deine Rechte bei Y-Dude.",
    richtlinienDescription:
      "Was auf Y-Dude erlaubt ist und was nicht: Regeln für Beiträge, SlangTags, Chats und die Slang Arena.",
    richtlinienOgDescription: "Die Nutzungsregeln der Plattform Y-Dude in klarer Sprache.",
    navImpressum: "Impressum",
    navDatenschutz: "Datenschutzerklärung",
    navAgb: "AGB",
    navRichtlinien: "Community-Richtlinien",
    impressumSectionTitle: "Angaben gemäß § 5 DDG",
    impressumResponsibleTitle: "Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
    impressumOpenFieldsTitle: "Weitere Angaben (in Klärung)",
    impressumOpenFieldsPhone:
      "Telefonnummer bzw. alternativer unmittelbarer Kontaktweg: wird ergänzt.",
    impressumOpenFieldsVat: "Umsatzsteuer-Identifikationsnummer: wird ergänzt, sofern einschlägig.",
    impressumOpenFieldsDispute:
      "Angaben zur Verbraucherschlichtung/Streitbeilegung: werden ergänzt, sofern erforderlich.",
  },
  en: {
    backToHome: "Back to homepage",
    version: "Version",
    status: "As of",
    impressumTitle: "Legal Notice — Y-Dude",
    impressumDescription: "Legal notice and provider identification of Y-Dude pursuant to § 5 DDG.",
    impressumOgDescription: "Legal notice and provider identification of Y-Dude.",
    agbDescription: "Terms of Service for the use of the Y-Dude social media platform.",
    agbOgDescription: "Terms of Service of the Y-Dude platform.",
    datenschutzDescription:
      "How Y-Dude processes personal data: data, AI moderation, cookies, retention periods and your rights under the GDPR.",
    datenschutzOgDescription: "Privacy information and your rights on Y-Dude.",
    richtlinienDescription:
      "What is and isn't allowed on Y-Dude: rules for posts, SlangTags, chats and the Slang Arena.",
    richtlinienOgDescription: "The usage rules of the Y-Dude platform in plain language.",
    navImpressum: "Legal Notice",
    navDatenschutz: "Privacy Policy",
    navAgb: "Terms of Service",
    navRichtlinien: "Community Guidelines",
    impressumSectionTitle: "Information pursuant to § 5 DDG",
    impressumResponsibleTitle: "Responsible for content pursuant to § 18 (2) MStV",
    impressumOpenFieldsTitle: "Further information (pending)",
    impressumOpenFieldsPhone: "Phone number or alternative direct contact channel: to be added.",
    impressumOpenFieldsVat: "VAT identification number: to be added, where applicable.",
    impressumOpenFieldsDispute:
      "Information on consumer dispute resolution: to be added, where required.",
  },
  el: {
    backToHome: "Επιστροφή στην αρχική σελίδα",
    version: "Έκδοση",
    status: "Ενημέρωση",
    impressumTitle: "Στοιχεία Επικοινωνίας — Y-Dude",
    impressumDescription:
      "Στοιχεία επικοινωνίας και ταυτότητα παρόχου του Y-Dude σύμφωνα με το § 5 DDG.",
    impressumOgDescription: "Στοιχεία επικοινωνίας και ταυτότητα παρόχου του Y-Dude.",
    agbDescription: "Γενικοί Όροι Χρήσης για τη χρήση της πλατφόρμας κοινωνικής δικτύωσης Y-Dude.",
    agbOgDescription: "Γενικοί Όροι Χρήσης της πλατφόρμας Y-Dude.",
    datenschutzDescription:
      "Πώς επεξεργάζεται το Y-Dude δεδομένα προσωπικού χαρακτήρα: δεδομένα, συντονισμός με ΤΝ, cookies, περίοδοι διατήρησης και τα δικαιώματά σας βάσει του ΓΚΠΔ.",
    datenschutzOgDescription: "Πληροφορίες απορρήτου και τα δικαιώματά σας στο Y-Dude.",
    richtlinienDescription:
      "Τι επιτρέπεται και τι όχι στο Y-Dude: κανόνες για δημοσιεύσεις, SlangTags, συνομιλίες και τη Slang Arena.",
    richtlinienOgDescription: "Οι κανόνες χρήσης της πλατφόρμας Y-Dude σε απλή γλώσσα.",
    navImpressum: "Στοιχεία Επικοινωνίας",
    navDatenschutz: "Πολιτική Απορρήτου",
    navAgb: "Όροι Χρήσης",
    navRichtlinien: "Κανόνες Κοινότητας",
    impressumSectionTitle: "Στοιχεία σύμφωνα με το § 5 DDG",
    impressumResponsibleTitle: "Υπεύθυνος περιεχομένου σύμφωνα με το § 18 παρ. 2 MStV",
    impressumOpenFieldsTitle: "Περαιτέρω στοιχεία (υπό διευκρίνιση)",
    impressumOpenFieldsPhone:
      "Αριθμός τηλεφώνου ή εναλλακτικός άμεσος τρόπος επικοινωνίας: θα προστεθεί.",
    impressumOpenFieldsVat: "Αριθμός φορολογικού μητρώου ΦΠΑ: θα προστεθεί, εφόσον απαιτείται.",
    impressumOpenFieldsDispute:
      "Στοιχεία σχετικά με τη διαμεσολάβηση/επίλυση διαφορών καταναλωτών: θα προστεθούν, εφόσον απαιτείται.",
  },
};
