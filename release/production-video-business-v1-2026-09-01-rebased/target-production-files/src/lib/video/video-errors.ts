/**
 * Klartextmeldungen der Videoprüfung in DE / EN / EL.
 * Bewusst ohne technische Details – Ursachen stehen im Serverprotokoll.
 */
import type { Lang } from "@/lib/i18n-dict";
import type { VideoErrorCode } from "./video-file";

const MESSAGES: Record<VideoErrorCode, Record<Lang, string>> = {
  unsupported_format: {
    de: "Dieses Videoformat wird nicht unterstützt. Erlaubt sind MP4 und MOV.",
    en: "This video format is not supported. Allowed formats are MP4 and MOV.",
    el: "Αυτή η μορφή βίντεο δεν υποστηρίζεται. Επιτρέπονται MP4 και MOV.",
  },
  too_long: {
    de: "Videos dürfen maximal 60 Sekunden lang sein.",
    en: "Videos may be no longer than 60 seconds.",
    el: "Τα βίντεο δεν επιτρέπεται να ξεπερνούν τα 60 δευτερόλεπτα.",
  },
  invalid_file: {
    de: "Die Videodatei konnte nicht gelesen werden.",
    en: "The video file could not be read.",
    el: "Δεν ήταν δυνατή η ανάγνωση του αρχείου βίντεο.",
  },
  too_large: {
    de: "Die Videodatei ist zu groß. Erlaubt sind bis zu 50 MB.",
    en: "The video file is too large. Up to 50 MB are allowed.",
    el: "Το αρχείο βίντεο είναι πολύ μεγάλο. Επιτρέπονται έως 50 MB.",
  },
  processing_failed: {
    de: "Das Video konnte nicht verarbeitet werden. Bitte erneut versuchen.",
    en: "The video could not be processed. Please try again.",
    el: "Δεν ήταν δυνατή η επεξεργασία του βίντεο. Δοκιμάστε ξανά.",
  },
  storage_error: {
    de: "Das Video konnte nicht gespeichert werden. Bitte erneut versuchen.",
    en: "The video could not be stored. Please try again.",
    el: "Δεν ήταν δυνατή η αποθήκευση του βίντεο. Δοκιμάστε ξανά.",
  },
};

export function videoErrorMessage(code: VideoErrorCode, lang: Lang): string {
  return MESSAGES[code][lang];
}

export const VIDEO_ERROR_CODES = Object.keys(MESSAGES) as VideoErrorCode[];
