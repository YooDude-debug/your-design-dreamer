import type { Lang } from "@/lib/i18n-dict";

/**
 * Zusätzliches Wörterbuch für Feed, Beiträge, Profil-Dialoge, Werbe-Overlays
 * und Systemmeldungen. Ergänzt `i18n-dict.ts` / `i18n-profile.ts`, ohne deren
 * Schlüssel zu duplizieren.
 */

const de = {
  // ---- Allgemeine Meldungen ----
  errorGeneric: "Fehler",
  privatePostsNotShareable: "Private Beiträge können nicht geteilt werden.",
  postNotAvailableTitle: "Beitrag nicht verfügbar",
  postNotAvailableBody: "Dieser Beitrag ist privat oder nur für ausgewählte Personen sichtbar.",
  postLoading: "Beitrag wird geladen…",
  postOpening: "Beitrag wird geöffnet…",
  toFeed: "Zum Feed",
  toHome: "Zur Startseite",

  // ---- AdsMasterSwitch ----
  adsMasterEl: "Διαφήμιση",
  adsOnEl: "ΕΝΕΡΓΟ",
  adsOffEl: "ΑΝΕΝΕΡΓΟ",
  adsMasterHintEl:
    "Μόνιμος έλεγχος διαχειριστή χωρίς χρονικό όριο. Η κατάσταση παραμένει έως ότου την αλλάξεις χειροκίνητα.",
  adsMasterOnEl: "Οι διαφημίσεις προβάλλονται κανονικά.",
  adsMasterOffEl: "Οι διαφημίσεις είναι πλήρως απενεργοποιημένες.",
  adsMasterFailedEl: "Η αλλαγή απέτυχε",

  // ---- LocationPicker ----
  locationRemoveDefault: "Standort entfernen",

  // ---- NotificationsPanel ----
  markAllRead: "Alle gelesen",
  pushNotifications: "Push-Benachrichtigungen",
  pushUnsupported: "Auf diesem Gerät nicht verfügbar.",
  pushBlocked: "Im Browser blockiert – bitte dort erlauben.",
  pushActiveHint: "Aktiv auf diesem Gerät.",
  pushInactiveHint: "Aus – du erhältst nur In-App-Hinweise.",

  // ---- PostStatsBar / LikersSheet ----
  likesTitle: "Likes",
  closeAction: "Schließen",
  noLikesYet: "Noch keine Likes.",
  likePrivacyActive: "Dieser Nutzer hat seine Like-Privatsphäre aktiviert.",

  // ---- ProfileEditDialog ----
  usernameTaken: "Dieser Benutzername ist bereits vergeben.",
  usernameReservedError: "Dieser Username kann nicht verwendet werden. Bitte wähle einen anderen.",
  usernameInvalidFormat: "Benutzername: 3–24 Zeichen, nur Buchstaben, Zahlen, _ . -",
  usernameCooldownError: "Der Benutzername kann derzeit noch nicht geändert werden.",
  displayModeCooldownError: "Die Namensanzeige kann derzeit noch nicht geändert werden.",
  displayNameLegend: "Wie soll dein Name auf Y-Dude angezeigt werden?",
  displayModeUsernameOnly: "Nur Username anzeigen",
  displayModeRealName: "Richtigen Namen anzeigen",
  displayModeBoth: "Username + richtigen Namen anzeigen",
  publiclyVisible: "Öffentlich sichtbar:",
  changeAgainFrom: (date: string) => `Änderung wieder möglich ab ${date}.`,
  usernameChecking: "⟳ Username wird geprüft …",
  usernameCooldownHint: (days: number) =>
    `Nach einer Änderung ist der nächste Wechsel erst nach ${days} Tagen möglich.`,
  registrationDataTitle: "Registrierungsdaten",
  registrationDataDesc:
    "Vorname, Nachname und Geburtsdatum sind feste Registrierungsdaten und hier nicht änderbar. Eine Korrektur ist nur über den Support möglich.",
  registrationDataName: (name: string) => `Hinterlegter Name: ${name}`,

  // ---- ReportDialog ----
  moreOptions: "Weitere Optionen",
  reportContentMenu: "🚩 Inhalt melden",
  reportContentTitle: "Inhalt melden",
  reportContentTypePost: "Beitrag",
  reportContentTypeTag: "SlangTag",
  reportContentSubtitle: (type: string) => `${type} · Warum meldest du diesen Inhalt?`,
  reportMoreInfo: "Weitere Informationen (optional)",
  reportDetailsPh: "Beschreibe kurz, was das Problem ist …",
  reportSend: "Meldung senden",
  reportSignInFirst: "Bitte melde dich an, um Inhalte zu melden.",
  reportAlreadyReported: "Du hast diesen Inhalt bereits gemeldet.",
  reportTooMany: "Zu viele Meldungen in kurzer Zeit. Bitte später erneut versuchen.",
  reportSendFailed: "Meldung konnte nicht gesendet werden.",
  reportSuccess: "Vielen Dank. Deine Meldung wurde erfolgreich an das Moderationsteam gesendet.",
  reasonSpam: "Spam",
  reasonHate: "Beleidigung oder Hassrede",
  reasonHarassment: "Belästigung",
  reasonViolence: "Gewalt oder gefährliche Inhalte",
  reasonSexual: "Sexuelle Inhalte",
  reasonCopyright: "Urheberrechtsverletzung",
  reasonMisinformation: "Falsche Informationen",
  reasonScam: "Betrug oder Scam",
  reasonOther: "Sonstiges",

  // ---- ShareSheet ----
  linkCopiedSuccess: "Link erfolgreich kopiert.",
  linkCopyFailed: "Link konnte nicht kopiert werden.",
  copyLink: "Link kopieren",
  shareWithOtherApps: "Mit anderen Apps teilen",

  // ---- SlangTagCanvas ----
  zoomOut: "Verkleinern",
  zoomIn: "Vergrößern",
  resetView: "Ansicht zurücksetzen",
  switchVariant: "Variante wechseln",
  deleteAction: "Löschen",
  scaleAndRotate: "Skalieren und drehen",
  removeTagAria: (name: string) => `$${name} entfernen`,

  // ---- SlangTagInput ----
  businessTagActive: "🔵 Unternehmer-SlangTag aktiv",
  closeSlangTagWindow: "SlangTag-Fenster schließen",

  // ---- TagCommitWidget ----
  tcUploadTitle: "📤 SlangTag wird hinzugefügt...",
  tcUploadText: "Der SlangTag wird sicher hochgeladen und verarbeitet.",
  tcModerationTitle: "🤖 SlangTag wird von der KI geprüft...",
  tcModerationText: "Die Moderation prüft den Inhalt automatisch. Das dauert nur einen Moment.",
  tcSuccessTitle: "✅ SlangTag erfolgreich geprüft",
  tcSuccessText:
    "Dein SlangTag ist bereit und wurde deiner SlangBox hinzugefügt. Der Beitrag wird jetzt veröffentlicht.",
  tcErrorTitle: "❌ Upload fehlgeschlagen",
  tcErrorText: "Bitte versuche es in einem Moment erneut.",
  tcRejectedTitle: "⚠️ Der SlangTag konnte nicht freigegeben werden.",
  tcRejectedText: "Bitte überprüfe den Inhalt und versuche es erneut.",

  // ---- TestBotBadge ----
  testBotTitle: "Dieses Konto ist ein Testbot (nur Entwicklungsmodus)",
  testBotLabel: "Testbot",

  // ---- SponsoredFeed Aria-Labels ----
  likeAria: "Like",
  shareAria: "Share",
  sendAria: "Send",

  // ---- NavDragHandle ----
  backToFeedHandle: "Zurück zum Feed",
  feedWord: "Feed",

  // ---- Feed-Werbekarten ----
  adPosition: "Position",
  adSkip: "Werbung überspringen",
  adSponsoring: "Sponsoring",
  adTestModeNotice: "Testmodus – keine echte Kampagne, keine Abrechnung.",
  videoAdLabel: "Videowerbung",
  playVideoAd: "Werbevideo abspielen",
  ad: "Werbung",
  volumeDown: "Leiser",
  volumeUp: "Lauter",
  unmute: "Ton an",
  mute: "Ton aus",
  skip: "Überspringen",
  skipIn: (s: number) => `Überspringen in ${s}s`,

  // ---- dev.tsx (Feed) ----
  liveFeedLabel: "Live-Feed",
  newPost: (n: number) => (n === 1 ? "1 neuer Beitrag" : `${n} neue Beiträge`),
  backToTop: "Zurück zum Anfang",

  // ---- hashtag.$name.tsx ----
  hashtagNotFound: "Hashtag nicht gefunden.",
  hashtagActionFailed: "Aktion fehlgeschlagen.",
  postsAndTopic: (count: string) => `${count} Beiträge · Thema des Beitrags`,
  unfollowHashtag: "Nicht mehr folgen",
  followHashtag: "Hashtag folgen",
  searchHashtagsPh: "Hashtags suchen …",
  trendingHashtags: "Trending Hashtags",
  noVisiblePostsForTag: (tag: string) => `Noch keine sichtbaren Beiträge zu #${tag}.`,

  // ---- Logout-Dialog (route.tsx) ----
  logoutConfirmTitle: "Abmelden?",
  logoutConfirmMessage: "Möchtest du dich wirklich von Y-Dude abmelden?",
  logoutConfirmButton: "Abmelden",

  // ---- Öffentliche Beitragsseite (post.$postId.tsx) ----
  publicPostShare: "Teilen",
  publicPostMoreTitle: "Mehr davon auf Y-Dude",
  publicPostMoreBody:
    "Melde dich an oder registriere dich kostenlos, um Beiträge zu liken, zu kommentieren und eigene SlangTags zu erstellen.",
  publicPostSignIn: "Anmelden",
  publicPostSignUp: "Kostenlos registrieren",
};

const en: typeof de = {
  errorGeneric: "Error",
  privatePostsNotShareable: "Private posts cannot be shared.",
  postNotAvailableTitle: "Post not available",
  postNotAvailableBody: "This post is private or only visible to selected people.",
  postLoading: "Loading post…",
  postOpening: "Opening post…",
  toFeed: "To the feed",
  toHome: "To the homepage",

  adsMasterEl: "Advertising",
  adsOnEl: "ON",
  adsOffEl: "OFF",
  adsMasterHintEl:
    "Permanent admin control without any time limit. The state stays until you change it manually.",
  adsMasterOnEl: "Ads are served normally.",
  adsMasterOffEl: "Ads are fully disabled.",
  adsMasterFailedEl: "Change failed",

  locationRemoveDefault: "Remove location",

  markAllRead: "Mark all read",
  pushNotifications: "Push notifications",
  pushUnsupported: "Not available on this device.",
  pushBlocked: "Blocked in the browser – please allow it there.",
  pushActiveHint: "Active on this device.",
  pushInactiveHint: "Off – you'll only get in-app notices.",

  likesTitle: "Likes",
  closeAction: "Close",
  noLikesYet: "No likes yet.",
  likePrivacyActive: "This user has enabled like privacy.",

  usernameTaken: "This username is already taken.",
  usernameReservedError: "This username cannot be used. Please choose another one.",
  usernameInvalidFormat: "Username: 3–24 characters, letters, numbers, _ . - only",
  usernameCooldownError: "The username can't be changed right now.",
  displayModeCooldownError: "The name display can't be changed right now.",
  displayNameLegend: "How should your name be shown on Y-Dude?",
  displayModeUsernameOnly: "Show username only",
  displayModeRealName: "Show real name",
  displayModeBoth: "Show username + real name",
  publiclyVisible: "Publicly visible:",
  changeAgainFrom: (date: string) => `Can be changed again from ${date}.`,
  usernameChecking: "⟳ Checking username …",
  usernameCooldownHint: (days: number) =>
    `After a change, the next one is possible only after ${days} days.`,
  registrationDataTitle: "Registration data",
  registrationDataDesc:
    "First name, last name and date of birth are fixed registration data and cannot be changed here. A correction is only possible via support.",
  registrationDataName: (name: string) => `Registered name: ${name}`,

  moreOptions: "More options",
  reportContentMenu: "🚩 Report content",
  reportContentTitle: "Report content",
  reportContentTypePost: "Post",
  reportContentTypeTag: "SlangTag",
  reportContentSubtitle: (type: string) => `${type} · Why are you reporting this content?`,
  reportMoreInfo: "Additional information (optional)",
  reportDetailsPh: "Briefly describe the issue …",
  reportSend: "Send report",
  reportSignInFirst: "Please sign in to report content.",
  reportAlreadyReported: "You already reported this content.",
  reportTooMany: "Too many reports in a short time. Please try again later.",
  reportSendFailed: "The report could not be sent.",
  reportSuccess: "Thank you. Your report was successfully sent to the moderation team.",
  reasonSpam: "Spam",
  reasonHate: "Hate speech or insults",
  reasonHarassment: "Harassment",
  reasonViolence: "Violence or dangerous content",
  reasonSexual: "Sexual content",
  reasonCopyright: "Copyright infringement",
  reasonMisinformation: "Misinformation",
  reasonScam: "Fraud or scam",
  reasonOther: "Other",

  linkCopiedSuccess: "Link copied successfully.",
  linkCopyFailed: "The link could not be copied.",
  copyLink: "Copy link",
  shareWithOtherApps: "Share with other apps",

  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  resetView: "Reset view",
  switchVariant: "Switch variant",
  deleteAction: "Delete",
  scaleAndRotate: "Scale and rotate",
  removeTagAria: (name: string) => `Remove $${name}`,

  businessTagActive: "🔵 Business SlangTag active",
  closeSlangTagWindow: "Close SlangTag window",

  tcUploadTitle: "📤 Adding SlangTag...",
  tcUploadText: "The SlangTag is being securely uploaded and processed.",
  tcModerationTitle: "🤖 SlangTag is being reviewed by AI...",
  tcModerationText: "Moderation checks the content automatically. This only takes a moment.",
  tcSuccessTitle: "✅ SlangTag successfully reviewed",
  tcSuccessText: "Your SlangTag is ready and was added to your SlangBox. The post is now being published.",
  tcErrorTitle: "❌ Upload failed",
  tcErrorText: "Please try again in a moment.",
  tcRejectedTitle: "⚠️ The SlangTag could not be approved.",
  tcRejectedText: "Please check the content and try again.",

  testBotTitle: "This account is a test bot (development mode only)",
  testBotLabel: "Test bot",

  likeAria: "Like",
  shareAria: "Share",
  sendAria: "Send",

  backToFeedHandle: "Back to feed",
  feedWord: "Feed",

  adPosition: "Position",
  adSkip: "Skip ad",
  adSponsoring: "Sponsoring",
  adTestModeNotice: "Test mode — no real campaign, no billing.",
  videoAdLabel: "Video ad",
  playVideoAd: "Play video ad",
  ad: "Ad",
  volumeDown: "Volume down",
  volumeUp: "Volume up",
  unmute: "Unmute",
  mute: "Mute",
  skip: "Skip",
  skipIn: (s: number) => `Skip in ${s}s`,

  liveFeedLabel: "Live feed",
  newPost: (n: number) => (n === 1 ? "1 new post" : `${n} new posts`),
  backToTop: "Back to top",

  hashtagNotFound: "Hashtag not found.",
  hashtagActionFailed: "Action failed.",
  postsAndTopic: (count: string) => `${count} posts · Post topic`,
  unfollowHashtag: "Unfollow",
  followHashtag: "Follow hashtag",
  searchHashtagsPh: "Search hashtags …",
  trendingHashtags: "Trending Hashtags",
  noVisiblePostsForTag: (tag: string) => `No visible posts for #${tag} yet.`,

  logoutConfirmTitle: "Log out?",
  logoutConfirmMessage: "Do you really want to log out of Y-Dude?",
  logoutConfirmButton: "Log out",

  publicPostShare: "Share",
  publicPostMoreTitle: "More of this on Y-Dude",
  publicPostMoreBody:
    "Sign in or register for free to like posts, comment and create your own SlangTags.",
  publicPostSignIn: "Sign in",
  publicPostSignUp: "Sign up for free",
};

const el: typeof de = {
  errorGeneric: "Σφάλμα",
  privatePostsNotShareable: "Οι ιδιωτικές δημοσιεύσεις δεν μπορούν να κοινοποιηθούν.",
  postNotAvailableTitle: "Η δημοσίευση δεν είναι διαθέσιμη",
  postNotAvailableBody: "Αυτή η δημοσίευση είναι ιδιωτική ή ορατή μόνο σε επιλεγμένα άτομα.",
  postLoading: "Η δημοσίευση φορτώνει…",
  postOpening: "Η δημοσίευση ανοίγει…",
  toFeed: "Στη ροή",
  toHome: "Στην αρχική",

  adsMasterEl: "Διαφήμιση",
  adsOnEl: "ΕΝΕΡΓΟ",
  adsOffEl: "ΑΝΕΝΕΡΓΟ",
  adsMasterHintEl:
    "Μόνιμος έλεγχος διαχειριστή χωρίς χρονικό όριο. Η κατάσταση παραμένει έως ότου την αλλάξεις χειροκίνητα.",
  adsMasterOnEl: "Οι διαφημίσεις προβάλλονται κανονικά.",
  adsMasterOffEl: "Οι διαφημίσεις είναι πλήρως απενεργοποιημένες.",
  adsMasterFailedEl: "Η αλλαγή απέτυχε",

  locationRemoveDefault: "Αφαίρεση τοποθεσίας",

  markAllRead: "Σήμανση όλων ως αναγνωσμένα",
  pushNotifications: "Ειδοποιήσεις push",
  pushUnsupported: "Δεν είναι διαθέσιμο σε αυτή τη συσκευή.",
  pushBlocked: "Αποκλείστηκε στο πρόγραμμα περιήγησης – επίτρεψέ το εκεί.",
  pushActiveHint: "Ενεργό σε αυτή τη συσκευή.",
  pushInactiveHint: "Ανενεργό – θα λαμβάνεις μόνο ειδοποιήσεις εντός της εφαρμογής.",

  likesTitle: "Likes",
  closeAction: "Κλείσιμο",
  noLikesYet: "Κανένα like ακόμα.",
  likePrivacyActive: "Αυτός ο χρήστης έχει ενεργοποιήσει το απόρρητο των likes.",

  usernameTaken: "Αυτό το όνομα χρήστη χρησιμοποιείται ήδη.",
  usernameReservedError: "Αυτό το username δεν μπορεί να χρησιμοποιηθεί. Επίλεξε άλλο.",
  usernameInvalidFormat: "Όνομα χρήστη: 3–24 χαρακτήρες, μόνο γράμματα, αριθμοί, _ . -",
  usernameCooldownError: "Το όνομα χρήστη δεν μπορεί να αλλάξει αυτή τη στιγμή.",
  displayModeCooldownError: "Η εμφάνιση ονόματος δεν μπορεί να αλλάξει αυτή τη στιγμή.",
  displayNameLegend: "Πώς θέλεις να εμφανίζεται το όνομά σου στο Y-Dude;",
  displayModeUsernameOnly: "Εμφάνιση μόνο username",
  displayModeRealName: "Εμφάνιση πραγματικού ονόματος",
  displayModeBoth: "Εμφάνιση username + πραγματικού ονόματος",
  publiclyVisible: "Δημόσια ορατό:",
  changeAgainFrom: (date: string) => `Νέα αλλαγή δυνατή από ${date}.`,
  usernameChecking: "⟳ Έλεγχος username …",
  usernameCooldownHint: (days: number) =>
    `Μετά από μια αλλαγή, η επόμενη είναι δυνατή μόνο μετά από ${days} ημέρες.`,
  registrationDataTitle: "Στοιχεία εγγραφής",
  registrationDataDesc:
    "Το όνομα, το επώνυμο και η ημερομηνία γέννησης είναι σταθερά στοιχεία εγγραφής και δεν αλλάζουν εδώ. Διόρθωση είναι δυνατή μόνο μέσω υποστήριξης.",
  registrationDataName: (name: string) => `Καταχωρημένο όνομα: ${name}`,

  moreOptions: "Περισσότερες επιλογές",
  reportContentMenu: "🚩 Αναφορά περιεχομένου",
  reportContentTitle: "Αναφορά περιεχομένου",
  reportContentTypePost: "Δημοσίευση",
  reportContentTypeTag: "SlangTag",
  reportContentSubtitle: (type: string) => `${type} · Γιατί αναφέρεις αυτό το περιεχόμενο;`,
  reportMoreInfo: "Επιπλέον πληροφορίες (προαιρετικό)",
  reportDetailsPh: "Περιέγραψε σύντομα το πρόβλημα …",
  reportSend: "Αποστολή αναφοράς",
  reportSignInFirst: "Συνδέσου για να αναφέρεις περιεχόμενο.",
  reportAlreadyReported: "Έχεις ήδη αναφέρει αυτό το περιεχόμενο.",
  reportTooMany: "Πολλές αναφορές σε σύντομο διάστημα. Δοκίμασε ξανά αργότερα.",
  reportSendFailed: "Η αναφορά δεν μπόρεσε να σταλεί.",
  reportSuccess: "Ευχαριστούμε. Η αναφορά σου στάλθηκε στην ομάδα συντονισμού.",
  reasonSpam: "Ανεπιθύμητο περιεχόμενο",
  reasonHate: "Προσβολή ή ρητορική μίσους",
  reasonHarassment: "Παρενόχληση",
  reasonViolence: "Βία ή επικίνδυνο περιεχόμενο",
  reasonSexual: "Σεξουαλικό περιεχόμενο",
  reasonCopyright: "Παραβίαση πνευματικών δικαιωμάτων",
  reasonMisinformation: "Ψευδείς πληροφορίες",
  reasonScam: "Απάτη",
  reasonOther: "Άλλο",

  linkCopiedSuccess: "Ο σύνδεσμος αντιγράφηκε με επιτυχία.",
  linkCopyFailed: "Ο σύνδεσμος δεν μπόρεσε να αντιγραφεί.",
  copyLink: "Αντιγραφή συνδέσμου",
  shareWithOtherApps: "Κοινοποίηση με άλλες εφαρμογές",

  zoomOut: "Σμίκρυνση",
  zoomIn: "Μεγέθυνση",
  resetView: "Επαναφορά προβολής",
  switchVariant: "Αλλαγή παραλλαγής",
  deleteAction: "Διαγραφή",
  scaleAndRotate: "Κλιμάκωση και περιστροφή",
  removeTagAria: (name: string) => `Αφαίρεση $${name}`,

  businessTagActive: "🔵 Επιχειρηματικό SlangTag ενεργό",
  closeSlangTagWindow: "Κλείσιμο παραθύρου SlangTag",

  tcUploadTitle: "📤 Το SlangTag προστίθεται...",
  tcUploadText: "Το SlangTag ανεβαίνει και επεξεργάζεται με ασφάλεια.",
  tcModerationTitle: "🤖 Το SlangTag ελέγχεται από το AI...",
  tcModerationText: "Ο έλεγχος περιεχομένου γίνεται αυτόματα. Θα διαρκέσει λίγες στιγμές.",
  tcSuccessTitle: "✅ Το SlangTag ελέγχθηκε με επιτυχία",
  tcSuccessText:
    "Το SlangTag σου είναι έτοιμο και προστέθηκε στο SlangBox σου. Η δημοσίευση δημοσιεύεται τώρα.",
  tcErrorTitle: "❌ Η μεταφόρτωση απέτυχε",
  tcErrorText: "Δοκίμασε ξανά σε λίγο.",
  tcRejectedTitle: "⚠️ Το SlangTag δεν εγκρίθηκε.",
  tcRejectedText: "Έλεγξε το περιεχόμενο και δοκίμασε ξανά.",

  testBotTitle: "Αυτός ο λογαριασμός είναι δοκιμαστικό bot (μόνο λειτουργία ανάπτυξης)",
  testBotLabel: "Testbot",

  likeAria: "Like",
  shareAria: "Κοινοποίηση",
  sendAria: "Αποστολή",

  backToFeedHandle: "Πίσω στη ροή",
  feedWord: "Ροή",

  adPosition: "Θέση",
  adSkip: "Παράλειψη διαφήμισης",
  adSponsoring: "Χορηγία",
  adTestModeNotice: "Δοκιμαστική λειτουργία – καμία πραγματική καμπάνια, καμία χρέωση.",
  videoAdLabel: "Βιντεοδιαφήμιση",
  playVideoAd: "Αναπαραγωγή βιντεοδιαφήμισης",
  ad: "Διαφήμιση",
  volumeDown: "Πιο σιγά",
  volumeUp: "Πιο δυνατά",
  unmute: "Ενεργοποίηση ήχου",
  mute: "Σίγαση",
  skip: "Παράλειψη",
  skipIn: (s: number) => `Παράλειψη σε ${s}δ`,

  liveFeedLabel: "Ζωντανή ροή",
  newPost: (n: number) => (n === 1 ? "1 νέα δημοσίευση" : `${n} νέες δημοσιεύσεις`),
  backToTop: "Επιστροφή στην αρχή",

  hashtagNotFound: "Το hashtag δεν βρέθηκε.",
  hashtagActionFailed: "Η ενέργεια απέτυχε.",
  postsAndTopic: (count: string) => `${count} δημοσιεύσεις · Θέμα δημοσίευσης`,
  unfollowHashtag: "Διακοπή παρακολούθησης",
  followHashtag: "Παρακολούθηση hashtag",
  searchHashtagsPh: "Αναζήτηση hashtags …",
  trendingHashtags: "Δημοφιλή Hashtags",
  noVisiblePostsForTag: (tag: string) => `Δεν υπάρχουν ακόμη ορατές δημοσιεύσεις για #${tag}.`,

  logoutConfirmTitle: "Αποσύνδεση;",
  logoutConfirmMessage: "Θέλεις σίγουρα να αποσυνδεθείς από το Y-Dude;",
  logoutConfirmButton: "Αποσύνδεση",

  publicPostShare: "Κοινοποίηση",
  publicPostMoreTitle: "Περισσότερα στο Y-Dude",
  publicPostMoreBody:
    "Συνδέσου ή εγγράψου δωρεάν για να κάνεις like, να σχολιάζεις και να δημιουργείς τα δικά σου SlangTags.",
  publicPostSignIn: "Σύνδεση",
  publicPostSignUp: "Δωρεάν εγγραφή",
};

export type UiDict = typeof de;

export const uiTexts: Record<Lang, UiDict> = { de, en, el };
