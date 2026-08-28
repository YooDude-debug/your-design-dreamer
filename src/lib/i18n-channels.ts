import type { Lang } from "@/lib/i18n-dict";

/**
 * Texte für den gesamten Channel-Bereich (Übersicht, Verwaltung, Moderation,
 * Team, Follower, Einstellungen, Kategorie-Auswahl). Eigenes Wörterbuch,
 * damit das Kernwörterbuch (`i18n-dict.ts`) übersichtlich bleibt.
 *
 * Regel: Jeder sichtbare Text existiert in de/en/el. Kein Fallback auf
 * Deutsch. Nutzerinhalte (Channel-Namen, Beschreibungen) werden nicht
 * übersetzt.
 */

const de = {
  // ---- Übersicht ----
  channelsTitle: "Channels",
  back: "Zurück",
  createChannel: "Channel erstellen",
  myChannelsHeading: "Meine Channels",
  manageChannels: "Channels verwalten",
  manageChannelsTitle: "Channels verwalten",
  followedHeading: "Gefolgte Channels",
  loading: "Wird geladen…",
  noManagedChannels: "Du verwaltest noch keine Channels. Erstelle deinen ersten Channel.",
  noFollowedChannels: "Du folgst noch keinen Channels.",
  searchPlaceholder: "Channel suchen…",
  searching: "Suche…",
  noResults: "Keine Channels gefunden.",
  channelsLoadFailed: "Channels konnten nicht geladen werden.",
  notFound: "Nicht gefunden.",
  discoverChannels: "Channels entdecken",

  // ---- Rollen & Meta ----
  roleOwner: "Eigentümer",
  roleModerator: "Moderator",
  noCategory: "Ohne Kategorie",
  followersSuffix: "Follower",
  postsSuffix: "Beiträge",
  deactivatedSuffix: "deaktiviert",

  // ---- Aktionen in der Liste ----
  openChannel: "Channel öffnen",
  moderatePosts: "Beiträge moderieren",
  editChannel: "Bearbeiten",
  manageModerators: "Moderatoren verwalten",
  follow: "Folgen",
  followingLabel: "Folge ich",
  followed: "Channel gefolgt",
  unfollowed: "Channel entfolgt",
  actionFailed: "Aktion nicht möglich",

  // ---- Dialog: Channel erstellen ----
  close: "Schließen",
  namePlaceholder: "Name des Channels",
  iconPlaceholder: "Symbol (z. B. 📺)",
  descriptionPlaceholder: "Beschreibung (optional)",
  channelCreated: "Channel erstellt",
  channelCreateFailed: "Channel konnte nicht erstellt werden",
  cancel: "Abbrechen",

  // ---- Kategorie-Auswahl ----
  categoryLabel: "Kategorie",
  subcategoryLabel: "Unterkategorie",
  categorySearchPlaceholder: "Kategorie suchen…",
  noCategoryFound: "Keine Kategorie gefunden.",
  noneOption: "Keine",
  selectedLabel: "Gewählt",

  // ---- Detailseite: Kopf & Reiter ----
  manageChannelTitle: "Channel verwalten",
  channelLoading: "Channel wird geladen…",
  channelLoadFailed: "Channel konnte nicht geladen werden.",
  channelNotFound: "Channel nicht gefunden.",
  tabModerate: "Beiträge moderieren",
  tabSettings: "Channel verwalten",
  tabTeam: "Moderatoren",
  tabFollowers: "Follower",

  // ---- Moderation ----
  moderationHint:
    "„Aus Channel entfernen“ löscht keinen Beitrag. Der Beitrag und seine SlangTags bleiben im normalen Feed vollständig erhalten – nur die Channel-Zuordnung wird gelöst.",
  postsLoading: "Beiträge werden geladen…",
  noPostsInChannel: "Diesem Channel sind noch keine Beiträge zugeordnet.",
  userFallback: "Nutzer",
  pinnedBadge: "angepinnt",
  approvedBadge: "zugelassen",
  approveBtn: "Zulassen",
  pinBtn: "Anpinnen",
  unpinBtn: "Nicht anpinnen",
  removeFromChannelBtn: "Aus Channel entfernen",
  banUserBtn: "Nutzer sperren",
  unbanUserBtn: "Sperre aufheben",
  loadMorePosts: "Weitere Beiträge laden",
  removedToast: "Aus Channel entfernt – Beitrag bleibt im Feed erhalten",
  approvedToast: "Beitrag im Channel zugelassen",
  pinnedToast: "Beitrag angepinnt",
  unpinnedToast: "Anpinnen aufgehoben",
  bannedToast: "Nutzer für diesen Channel gesperrt",
  unbannedToast: "Sperre aufgehoben",

  // ---- Team ----
  addModerator: "Moderator hinzufügen",
  moderatorAdded: "Moderator hinzugefügt",
  moderatorAddFailed: "Nutzer nicht gefunden oder keine Berechtigung",
  moderatorRemoved: "Moderator entfernt",
  removeBtn: "Entfernen",
  bannedUsersHeading: "Gesperrte Nutzer",

  // ---- Follower ----
  noFollowers: "Noch keine Follower.",
  loadMoreFollowers: "Weitere Follower laden",

  // ---- Einstellungen ----
  fieldName: "Channel-Name",
  fieldDescription: "Beschreibung",
  fieldIcon: "Icon (Emoji)",
  fieldImageUrl: "Bild-URL",
  fieldCategory: "Kategorie & Unterkategorie",
  publicToggle: "Öffentlich sichtbar und auswählbar",
  activeToggle: "Channel aktiv",
  deleteHint:
    "Zur Löschung vorbereiten: Channel deaktivieren und auf „nicht öffentlich“ stellen. Bestehende Beiträge und SlangTags bleiben unverändert erhalten.",
  save: "Speichern",
  savedToast: "Channel gespeichert",
  saveFailed: "Speichern nicht möglich",

  // ---- Metadaten (head) ----
  metaOverviewTitle: "Meine Channels — Y-Dude",
  metaOverviewDesc:
    "Zentrale Y-Dude Channel-Verwaltung: eigene und moderierte Channels, gefolgte Channels und neue Channels erstellen.",
  metaManageTitle: "Channel verwalten — Y-Dude",
  metaManageDesc:
    "Eigenen Y-Dude Channel verwalten, Beiträge moderieren und Moderatoren einsetzen.",
};

export type ChannelsDict = typeof de;

const en: ChannelsDict = {
  channelsTitle: "Channels",
  back: "Back",
  createChannel: "Create channel",
  myChannelsHeading: "My channels",
  manageChannels: "Manage channels",
  manageChannelsTitle: "Manage channels",
  followedHeading: "Followed channels",
  loading: "Loading…",
  noManagedChannels: "You don't manage any channels yet. Create your first channel.",
  noFollowedChannels: "You don't follow any channels yet.",
  searchPlaceholder: "Search channel…",
  searching: "Searching…",
  noResults: "No channels found.",
  channelsLoadFailed: "Channels could not be loaded.",
  notFound: "Not found.",
  discoverChannels: "Discover channels",

  roleOwner: "Owner",
  roleModerator: "Moderator",
  noCategory: "No category",
  followersSuffix: "followers",
  postsSuffix: "posts",
  deactivatedSuffix: "deactivated",

  openChannel: "Open channel",
  moderatePosts: "Moderate posts",
  editChannel: "Edit",
  manageModerators: "Manage moderators",
  follow: "Follow",
  followingLabel: "Following",
  followed: "Channel followed",
  unfollowed: "Channel unfollowed",
  actionFailed: "Action not possible",

  close: "Close",
  namePlaceholder: "Channel name",
  iconPlaceholder: "Icon (e.g. 📺)",
  descriptionPlaceholder: "Description (optional)",
  channelCreated: "Channel created",
  channelCreateFailed: "Channel could not be created",
  cancel: "Cancel",

  categoryLabel: "Category",
  subcategoryLabel: "Subcategory",
  categorySearchPlaceholder: "Search category…",
  noCategoryFound: "No category found.",
  noneOption: "None",
  selectedLabel: "Selected",

  manageChannelTitle: "Manage channel",
  channelLoading: "Loading channel…",
  channelLoadFailed: "Channel could not be loaded.",
  channelNotFound: "Channel not found.",
  tabModerate: "Moderate posts",
  tabSettings: "Manage channel",
  tabTeam: "Moderators",
  tabFollowers: "Followers",

  moderationHint:
    "“Remove from channel” does not delete a post. The post and its SlangTags stay fully available in the normal feed – only the channel assignment is removed.",
  postsLoading: "Loading posts…",
  noPostsInChannel: "No posts are assigned to this channel yet.",
  userFallback: "User",
  pinnedBadge: "pinned",
  approvedBadge: "approved",
  approveBtn: "Approve",
  pinBtn: "Pin",
  unpinBtn: "Unpin",
  removeFromChannelBtn: "Remove from channel",
  banUserBtn: "Ban user",
  unbanUserBtn: "Lift ban",
  loadMorePosts: "Load more posts",
  removedToast: "Removed from channel – the post stays in the feed",
  approvedToast: "Post approved in the channel",
  pinnedToast: "Post pinned",
  unpinnedToast: "Post unpinned",
  bannedToast: "User banned from this channel",
  unbannedToast: "Ban lifted",

  addModerator: "Add moderator",
  moderatorAdded: "Moderator added",
  moderatorAddFailed: "User not found or not permitted",
  moderatorRemoved: "Moderator removed",
  removeBtn: "Remove",
  bannedUsersHeading: "Banned users",

  noFollowers: "No followers yet.",
  loadMoreFollowers: "Load more followers",

  fieldName: "Channel name",
  fieldDescription: "Description",
  fieldIcon: "Icon (emoji)",
  fieldImageUrl: "Image URL",
  fieldCategory: "Category & subcategory",
  publicToggle: "Publicly visible and selectable",
  activeToggle: "Channel active",
  deleteHint:
    "Prepare for deletion: deactivate the channel and set it to “not public”. Existing posts and SlangTags stay unchanged.",
  save: "Save",
  savedToast: "Channel saved",
  saveFailed: "Saving not possible",

  metaOverviewTitle: "My channels — Y-Dude",
  metaOverviewDesc:
    "Central Y-Dude channel management: your own and moderated channels, followed channels and creating new channels.",
  metaManageTitle: "Manage channel — Y-Dude",
  metaManageDesc: "Manage your Y-Dude channel, moderate posts and appoint moderators.",
};

const el: ChannelsDict = {
  channelsTitle: "Κανάλια",
  back: "Πίσω",
  createChannel: "Δημιουργία καναλιού",
  myChannelsHeading: "Τα κανάλια μου",
  manageChannels: "Διαχείριση καναλιών",
  manageChannelsTitle: "Διαχείριση καναλιών",
  followedHeading: "Κανάλια που ακολουθώ",
  loading: "Φορτώνει…",
  noManagedChannels: "Δεν διαχειρίζεσαι κανάλια ακόμη. Δημιούργησε το πρώτο σου κανάλι.",
  noFollowedChannels: "Δεν ακολουθείς κανάλια ακόμη.",
  searchPlaceholder: "Αναζήτηση καναλιού…",
  searching: "Αναζήτηση…",
  noResults: "Δεν βρέθηκαν κανάλια.",
  channelsLoadFailed: "Τα κανάλια δεν μπόρεσαν να φορτωθούν.",
  notFound: "Δεν βρέθηκε.",
  discoverChannels: "Ανακάλυψε κανάλια",

  roleOwner: "Ιδιοκτήτης",
  roleModerator: "Συντονιστής",
  noCategory: "Χωρίς κατηγορία",
  followersSuffix: "ακόλουθοι",
  postsSuffix: "δημοσιεύσεις",
  deactivatedSuffix: "απενεργοποιημένο",

  openChannel: "Άνοιγμα καναλιού",
  moderatePosts: "Συντονισμός δημοσιεύσεων",
  editChannel: "Επεξεργασία",
  manageModerators: "Διαχείριση συντονιστών",
  follow: "Ακολούθησε",
  followingLabel: "Ακολουθώ",
  followed: "Ακολουθείς το κανάλι",
  unfollowed: "Σταμάτησες να ακολουθείς",
  actionFailed: "Η ενέργεια δεν είναι δυνατή",

  close: "Κλείσιμο",
  namePlaceholder: "Όνομα καναλιού",
  iconPlaceholder: "Σύμβολο (π.χ. 📺)",
  descriptionPlaceholder: "Περιγραφή (προαιρετικό)",
  channelCreated: "Το κανάλι δημιουργήθηκε",
  channelCreateFailed: "Το κανάλι δεν μπόρεσε να δημιουργηθεί",
  cancel: "Άκυρο",

  categoryLabel: "Κατηγορία",
  subcategoryLabel: "Υποκατηγορία",
  categorySearchPlaceholder: "Αναζήτηση κατηγορίας…",
  noCategoryFound: "Δεν βρέθηκε κατηγορία.",
  noneOption: "Καμία",
  selectedLabel: "Επιλογή",

  manageChannelTitle: "Διαχείριση καναλιού",
  channelLoading: "Το κανάλι φορτώνει…",
  channelLoadFailed: "Το κανάλι δεν μπόρεσε να φορτωθεί.",
  channelNotFound: "Το κανάλι δεν βρέθηκε.",
  tabModerate: "Συντονισμός δημοσιεύσεων",
  tabSettings: "Διαχείριση καναλιού",
  tabTeam: "Συντονιστές",
  tabFollowers: "Ακόλουθοι",

  moderationHint:
    "Η «Αφαίρεση από το κανάλι» δεν διαγράφει δημοσίευση. Η δημοσίευση και τα SlangTags της παραμένουν κανονικά στο feed – αφαιρείται μόνο η σύνδεση με το κανάλι.",
  postsLoading: "Οι δημοσιεύσεις φορτώνουν…",
  noPostsInChannel: "Δεν έχουν αντιστοιχιστεί δημοσιεύσεις σε αυτό το κανάλι ακόμη.",
  userFallback: "Χρήστης",
  pinnedBadge: "καρφιτσωμένο",
  approvedBadge: "εγκεκριμένο",
  approveBtn: "Έγκριση",
  pinBtn: "Καρφίτσωμα",
  unpinBtn: "Ξεκαρφίτσωμα",
  removeFromChannelBtn: "Αφαίρεση από το κανάλι",
  banUserBtn: "Αποκλεισμός χρήστη",
  unbanUserBtn: "Άρση αποκλεισμού",
  loadMorePosts: "Φόρτωση περισσότερων δημοσιεύσεων",
  removedToast: "Αφαιρέθηκε από το κανάλι – η δημοσίευση παραμένει στο feed",
  approvedToast: "Η δημοσίευση εγκρίθηκε στο κανάλι",
  pinnedToast: "Η δημοσίευση καρφιτσώθηκε",
  unpinnedToast: "Το καρφίτσωμα αφαιρέθηκε",
  bannedToast: "Ο χρήστης αποκλείστηκε από αυτό το κανάλι",
  unbannedToast: "Ο αποκλεισμός άρθηκε",

  addModerator: "Προσθήκη συντονιστή",
  moderatorAdded: "Ο συντονιστής προστέθηκε",
  moderatorAddFailed: "Ο χρήστης δεν βρέθηκε ή δεν επιτρέπεται",
  moderatorRemoved: "Ο συντονιστής αφαιρέθηκε",
  removeBtn: "Αφαίρεση",
  bannedUsersHeading: "Αποκλεισμένοι χρήστες",

  noFollowers: "Δεν υπάρχουν ακόλουθοι ακόμη.",
  loadMoreFollowers: "Φόρτωση περισσότερων ακολούθων",

  fieldName: "Όνομα καναλιού",
  fieldDescription: "Περιγραφή",
  fieldIcon: "Εικονίδιο (emoji)",
  fieldImageUrl: "URL εικόνας",
  fieldCategory: "Κατηγορία & υποκατηγορία",
  publicToggle: "Δημόσια ορατό και επιλέξιμο",
  activeToggle: "Κανάλι ενεργό",
  deleteHint:
    "Προετοιμασία διαγραφής: απενεργοποίησε το κανάλι και όρισέ το σε «μη δημόσιο». Οι υπάρχουσες δημοσιεύσεις και τα SlangTags παραμένουν αμετάβλητα.",
  save: "Αποθήκευση",
  savedToast: "Το κανάλι αποθηκεύτηκε",
  saveFailed: "Η αποθήκευση δεν είναι δυνατή",

  metaOverviewTitle: "Τα κανάλια μου — Y-Dude",
  metaOverviewDesc:
    "Κεντρική διαχείριση καναλιών Y-Dude: δικά σου και συντονιζόμενα κανάλια, κανάλια που ακολουθείς και δημιουργία νέων.",
  metaManageTitle: "Διαχείριση καναλιού — Y-Dude",
  metaManageDesc:
    "Διαχειρίσου το κανάλι σου στο Y-Dude, συντόνισε δημοσιεύσεις και όρισε συντονιστές.",
};

export const channelTexts: Record<Lang, ChannelsDict> = { de, en, el };

/** Sprachabhängiger Kategoriename; Slug/ID bleiben sprachunabhängig. */
export function categoryLabel(
  lang: Lang,
  names: { name: string; nameEn?: string | null; nameEl?: string | null },
): string {
  if (lang === "en") return names.nameEn?.trim() || names.name;
  if (lang === "el") return names.nameEl?.trim() || names.name;
  return names.name;
}
