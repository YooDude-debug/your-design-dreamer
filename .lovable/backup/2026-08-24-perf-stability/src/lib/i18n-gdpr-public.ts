import type { Lang } from "@/lib/i18n-dict";

/** Texte der öffentlichen DSGVO-Seiten (Kontolöschung / Datenanforderung). */

export type GdprTexts = {
  identifierLabel: string;
  identifierPlaceholder: string;
  passwordLabel: string;
  passwordHint: string;
  forgot: string;
  privacyTitle: string;
  privacyPoints: string[];
  invalid: string;
  rateLimit: string;
  failed: string;
  submitting: string;
  del: {
    title: string;
    lead: string;
    listTitle: string;
    list: string[];
    irreversible: string;
    confirm: string;
    submit: string;
    doneTitle: string;
    doneText: string;
  };
  data: {
    title: string;
    lead: string;
    listTitle: string;
    list: string[];
    submit: string;
    doneTitle: string;
    doneText: string;
    download: string;
  };
};

const de: GdprTexts = {
  identifierLabel: "E-Mail-Adresse oder Benutzername",
  identifierPlaceholder: "du@beispiel.de oder benutzername",
  passwordLabel: "Passwort deines Y-Dude-Kontos",
  passwordHint:
    "Zur Identitätsprüfung benötigen wir dein Kontopasswort. Es wird ausschließlich zur Prüfung verwendet und nicht gespeichert.",
  forgot: "Passwort vergessen?",
  privacyTitle: "Datenschutz und Sicherheit",
  privacyPoints: [
    "Jede Anfrage erfordert eine Identitätsprüfung. Ohne bestätigte Identität wird keine Anfrage ausgeführt.",
    "Es werden keine personenbezogenen Daten an nicht autorisierte Personen herausgegeben oder angezeigt.",
    "Die Anfrage wird verschlüsselt übertragen und sicher verarbeitet; jeder Vorgang wird protokolliert.",
    "Wir geben niemals bekannt, ob eine E-Mail-Adresse oder ein Benutzername bei Y-Dude existiert.",
  ],
  invalid: "Identität konnte nicht bestätigt werden. Bitte prüfe deine Angaben.",
  rateLimit: "Zu viele Versuche. Bitte versuche es später erneut.",
  failed: "Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es später erneut.",
  submitting: "Wird verarbeitet …",
  del: {
    title: "Y-Dude-Konto löschen",
    lead: "Hier kannst du die Löschung deines Y-Dude-Kontos beantragen. Nach bestätigter Identitätsprüfung wird dein Konto vollständig und unwiderruflich gelöscht.",
    listTitle: "Diese Daten werden gelöscht:",
    list: [
      "Konto und Anmeldedaten (E-Mail, Passwort, Sitzungen)",
      "Profil, Einstellungen, Privatsphäre-Einstellungen und Interessen",
      "Beiträge, Kommentare, Likes, gespeicherte und geteilte Inhalte",
      "Eigene SlangTags samt Statistiken und Bewertungen",
      "Follower/Gefolgte, Verbindungen, Unterhaltungen und Nachrichten",
      "Alle hochgeladenen Medien (Bilder, Videos, Audio)",
    ],
    irreversible:
      "Die Löschung kann nicht rückgängig gemacht werden. Gesetzliche Aufbewahrungspflichten (z. B. Protokolle zu Missbrauchsmeldungen) bleiben unberührt.",
    confirm: "Ich möchte mein Y-Dude-Konto und alle zugehörigen Daten endgültig löschen.",
    submit: "Konto endgültig löschen",
    doneTitle: "Konto gelöscht",
    doneText:
      "Dein Y-Dude-Konto und die zugehörigen Daten wurden gelöscht. Du bist damit überall abgemeldet. Eine Anmeldung ist nicht mehr möglich.",
  },
  data: {
    title: "Meine Y-Dude-Daten anfordern",
    lead: "Hier kannst du eine Kopie der zu deinem Konto gespeicherten personenbezogenen Daten anfordern (DSGVO Art. 15/20). Nach bestätigter Identitätsprüfung erhältst du einen persönlichen, zeitlich befristeten Download-Link.",
    listTitle: "Die Datenkopie enthält:",
    list: [
      "Profil, Einstellungen und Privatsphäre-Einstellungen",
      "Beiträge, Kommentare, Likes, gespeicherte und geteilte Inhalte",
      "Eigene SlangTags samt Bewertungen und Statistiken",
      "Follower/Gefolgte, Verbindungen und Benachrichtigungen",
      "Kontodaten (Registrierung, letzte Anmeldung, Geräte – ohne Tokens)",
      "Deine hochgeladenen Medien im Original",
    ],
    submit: "Datenkopie anfordern",
    doneTitle: "Anfrage bestätigt",
    doneText:
      "Deine Anfrage wurde erfasst und die Datenkopie erstellt. Der Download-Link ist ausschließlich für dich bestimmt und läuft nach einer Stunde ab. Danach kannst du hier jederzeit eine neue Kopie anfordern.",
    download: "Datenkopie herunterladen (ZIP)",
  },
};

const en: GdprTexts = {
  identifierLabel: "Email address or username",
  identifierPlaceholder: "you@example.com or username",
  passwordLabel: "Password of your Y-Dude account",
  passwordHint:
    "We need your account password to verify your identity. It is used for verification only and never stored.",
  forgot: "Forgot your password?",
  privacyTitle: "Privacy and security",
  privacyPoints: [
    "Every request requires identity verification. Without a verified identity no request is carried out.",
    "No personal data is shown or handed to unauthorised persons.",
    "Requests are transmitted encrypted, processed securely and every action is logged.",
    "We never reveal whether an email address or username exists on Y-Dude.",
  ],
  invalid: "We could not verify your identity. Please check your details.",
  rateLimit: "Too many attempts. Please try again later.",
  failed: "The request could not be processed. Please try again later.",
  submitting: "Processing …",
  del: {
    title: "Delete your Y-Dude account",
    lead: "Request the deletion of your Y-Dude account here. Once your identity is verified, your account is deleted completely and permanently.",
    listTitle: "The following data will be deleted:",
    list: [
      "Account and login data (email, password, sessions)",
      "Profile, settings, privacy settings and interests",
      "Posts, comments, likes, saved and shared content",
      "Your own SlangTags including stats and ratings",
      "Followers/following, connections, conversations and messages",
      "All uploaded media (images, videos, audio)",
    ],
    irreversible:
      "Deletion cannot be undone. Statutory retention obligations (e.g. abuse report logs) remain unaffected.",
    confirm: "I want to permanently delete my Y-Dude account and all related data.",
    submit: "Delete account permanently",
    doneTitle: "Account deleted",
    doneText:
      "Your Y-Dude account and its data have been deleted. You are signed out everywhere and can no longer sign in.",
  },
  data: {
    title: "Request my Y-Dude data",
    lead: "Request a copy of the personal data stored for your account (GDPR Art. 15/20). After identity verification you receive a personal, time-limited download link.",
    listTitle: "The data copy contains:",
    list: [
      "Profile, settings and privacy settings",
      "Posts, comments, likes, saved and shared content",
      "Your own SlangTags including ratings and stats",
      "Followers/following, connections and notifications",
      "Account data (sign-up, last sign-in, devices – without tokens)",
      "Your uploaded media in original quality",
    ],
    submit: "Request data copy",
    doneTitle: "Request confirmed",
    doneText:
      "Your request was recorded and the data copy was created. The download link is meant for you only and expires after one hour. You can request a new copy here at any time.",
    download: "Download data copy (ZIP)",
  },
};

const el: GdprTexts = {
  identifierLabel: "Διεύθυνση email ή όνομα χρήστη",
  identifierPlaceholder: "esy@paradeigma.gr ή όνομα χρήστη",
  passwordLabel: "Κωδικός του λογαριασμού σου στο Y-Dude",
  passwordHint:
    "Χρειαζόμαστε τον κωδικό σου για την επαλήθευση ταυτότητας. Χρησιμοποιείται μόνο για τον έλεγχο και δεν αποθηκεύεται.",
  forgot: "Ξέχασες τον κωδικό;",
  privacyTitle: "Προστασία δεδομένων και ασφάλεια",
  privacyPoints: [
    "Κάθε αίτημα απαιτεί επαλήθευση ταυτότητας. Χωρίς επαλήθευση δεν εκτελείται κανένα αίτημα.",
    "Δεν εμφανίζονται ούτε παραδίδονται προσωπικά δεδομένα σε μη εξουσιοδοτημένα πρόσωπα.",
    "Το αίτημα μεταδίδεται κρυπτογραφημένα, επεξεργάζεται με ασφάλεια και καταγράφεται.",
    "Δεν αποκαλύπτουμε ποτέ αν ένα email ή όνομα χρήστη υπάρχει στο Y-Dude.",
  ],
  invalid: "Δεν μπορέσαμε να επαληθεύσουμε την ταυτότητά σου. Έλεγξε τα στοιχεία σου.",
  rateLimit: "Πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.",
  failed: "Το αίτημα δεν μπόρεσε να επεξεργαστεί. Δοκίμασε ξανά αργότερα.",
  submitting: "Επεξεργασία …",
  del: {
    title: "Διαγραφή λογαριασμού Y-Dude",
    lead: "Εδώ μπορείς να ζητήσεις τη διαγραφή του λογαριασμού σου στο Y-Dude. Μετά την επαλήθευση ταυτότητας ο λογαριασμός διαγράφεται πλήρως και οριστικά.",
    listTitle: "Θα διαγραφούν τα εξής δεδομένα:",
    list: [
      "Λογαριασμός και στοιχεία σύνδεσης (email, κωδικός, συνεδρίες)",
      "Προφίλ, ρυθμίσεις, ρυθμίσεις ιδιωτικότητας και ενδιαφέροντα",
      "Δημοσιεύσεις, σχόλια, likes, αποθηκευμένα και κοινοποιημένα",
      "Τα δικά σου SlangTags με στατιστικά και αξιολογήσεις",
      "Ακόλουθοι/ακολουθείς, συνδέσεις, συνομιλίες και μηνύματα",
      "Όλα τα αρχεία που ανέβασες (εικόνες, βίντεο, ήχος)",
    ],
    irreversible:
      "Η διαγραφή δεν μπορεί να αναιρεθεί. Νομικές υποχρεώσεις διατήρησης (π.χ. αναφορές κατάχρησης) παραμένουν.",
    confirm: "Θέλω να διαγράψω οριστικά τον λογαριασμό μου και όλα τα δεδομένα του.",
    submit: "Οριστική διαγραφή λογαριασμού",
    doneTitle: "Ο λογαριασμός διαγράφηκε",
    doneText:
      "Ο λογαριασμός σου και τα δεδομένα του διαγράφηκαν. Έχεις αποσυνδεθεί από παντού και δεν είναι πλέον δυνατή η σύνδεση.",
  },
  data: {
    title: "Αίτημα για τα δεδομένα μου στο Y-Dude",
    lead: "Εδώ μπορείς να ζητήσεις αντίγραφο των προσωπικών δεδομένων του λογαριασμού σου (GDPR Άρθρα 15/20). Μετά την επαλήθευση λαμβάνεις προσωπικό σύνδεσμο λήψης με περιορισμένη διάρκεια.",
    listTitle: "Το αντίγραφο περιέχει:",
    list: [
      "Προφίλ, ρυθμίσεις και ρυθμίσεις ιδιωτικότητας",
      "Δημοσιεύσεις, σχόλια, likes, αποθηκευμένα και κοινοποιημένα",
      "Τα δικά σου SlangTags με αξιολογήσεις και στατιστικά",
      "Ακόλουθοι/ακολουθείς, συνδέσεις και ειδοποιήσεις",
      "Στοιχεία λογαριασμού (εγγραφή, τελευταία σύνδεση, συσκευές – χωρίς tokens)",
      "Τα αρχεία που ανέβασες στην αρχική τους ποιότητα",
    ],
    submit: "Αίτημα αντιγράφου δεδομένων",
    doneTitle: "Το αίτημα καταγράφηκε",
    doneText:
      "Το αίτημά σου καταγράφηκε και το αντίγραφο δημιουργήθηκε. Ο σύνδεσμος λήψης προορίζεται μόνο για εσένα και λήγει μετά από μία ώρα. Μπορείς να ζητήσεις νέο αντίγραφο οποτεδήποτε.",
    download: "Λήψη αντιγράφου (ZIP)",
  },
};

export const gdprTexts: Record<Lang, GdprTexts> = { de, en, el };
