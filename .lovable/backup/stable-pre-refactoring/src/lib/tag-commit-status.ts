/**
 * Statusphasen fuer das freundliche Pruef-Widget beim Veroeffentlichen neuer
 * SlangTags. Waehrend "upload" und "moderation" werden keine Fehlermeldungen
 * angezeigt – erst ein echter Fehler fuehrt zu "error"/"rejected".
 */
export type TagCommitPhase = "upload" | "moderation" | "success" | "error" | "rejected";

export type TagCommitStatus = {
  phase: TagCommitPhase;
  /** Zusatztext bei Ablehnung oder technischem Fehler. */
  detail?: string;
};

export type TagCommitOptions = {
  /** Unterdrueckt Toast-Meldungen, solange nur verarbeitet/geprueft wird. */
  silent?: boolean;
  onStatus?: (status: TagCommitStatus) => void;
};
