/** Browser-safe Typen und Texte für die SlangTag-Audio-Moderation. */

export type ModerationStatus = "pending" | "approved" | "review" | "blocked";

/** Kategorien, die die KI-Prüfung erkennen soll. */
export const MODERATION_CATEGORIES = [
  "hate_speech",
  "discrimination",
  "racism",
  "extremism",
  "violence_threat",
  "terrorism",
  "bullying",
  "harassment",
  "sexual_content",
  "pornography",
  "child_abuse",
  "self_harm",
  "suicide_promotion",
  "fraud",
  "phishing",
  "identity_theft",
  "spam",
  "crime_incitement",
  "drug_trade",
  "weapon_trade",
  "dangerous_instructions",
  "illegal_content",
  "other_guideline_violation",
] as const;

export type ModerationCategory = (typeof MODERATION_CATEGORIES)[number];

/** Deutsche Beschriftungen für das Moderations-Dashboard. */
export const CATEGORY_LABELS: Record<string, string> = {
  hate_speech: "Hassrede",
  discrimination: "Diskriminierung",
  racism: "Rassismus",
  extremism: "Extremismus",
  violence_threat: "Gewaltandrohung",
  terrorism: "Terrorismus",
  bullying: "Mobbing",
  harassment: "Belästigung",
  sexual_content: "Sexuelle Inhalte",
  pornography: "Pornografie",
  child_abuse: "Kindesmissbrauch",
  self_harm: "Selbstverletzung",
  suicide_promotion: "Suizidförderung",
  fraud: "Betrug",
  phishing: "Phishing",
  identity_theft: "Identitätsdiebstahl",
  spam: "Spam",
  crime_incitement: "Aufruf zu Straftaten",
  drug_trade: "Drogenhandel",
  weapon_trade: "Waffenhandel",
  dangerous_instructions: "Gefährliche Anleitungen",
  illegal_content: "Rechtswidrige Inhalte",
  other_guideline_violation: "Sonstiger Richtlinienverstoß",
  music: "Musik",
  singing: "Gesang",
  copyrighted_music: "Urheberrechtlich geschützte Musik",
  known_recording: "Bekannte Tonaufnahme",
  transcription_failed: "Transkription fehlgeschlagen",
  analysis_failed: "Analyse fehlgeschlagen",
};

export const STATUS_LABELS: Record<ModerationStatus, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  review: "Manuelle Prüfung",
  blocked: "Gesperrt",
};

/** Ergebnis eines Moderationsdurchlaufs (an den Client zurückgegeben). */
export type ModerationResult = {
  status: ModerationStatus;
  reason: string;
  labels: string[];
  isMusic: boolean;
  confidence: number;
  transcript: string;
  /** Nutzerfreundliche Meldung in Deutsch. */
  message: string;
};

export type ModerationEventRow = {
  id: string;
  actorType: string;
  actorUsername: string;
  action: string;
  fromStatus: ModerationStatus | null;
  toStatus: ModerationStatus | null;
  reason: string;
  createdAt: string;
};

export type ModerationReportRow = {
  id: string;
  reporterUsername: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
};

/** Ein Eintrag in der Moderations-Warteschlange. */
export type ModerationQueueRow = {
  id: string;
  name: string;
  kind: "community" | "creator";
  ownerType: string;
  ownerUserId: string | null;
  ownerUsername: string;
  audioUrl: string | null;
  duration: string;
  transcript: string;
  status: ModerationStatus;
  reason: string;
  labels: string[];
  isMusic: boolean;
  confidence: number;
  ai: Record<string, unknown>;
  createdAt: string;
  moderatedAt: string | null;
  deletedAt: string | null;
  reports: ModerationReportRow[];
  events: ModerationEventRow[];
};

export type ModerationQueueFilter = "open" | "blocked" | "reported" | "all";

export type ModerationDecision = "approve" | "block" | "delete" | "recheck";

export function statusMessage(result: {
  status: ModerationStatus;
  isMusic: boolean;
  labels: string[];
}): string {
  if (result.status === "approved") return "SlangTag freigegeben.";
  if (result.status === "blocked" && result.isMusic)
    return "Dieser SlangTag enthält überwiegend Musik oder Gesang und kann nicht veröffentlicht werden.";
  if (result.status === "blocked")
    return "Dieser SlangTag verstößt gegen unsere Community-Richtlinien und wurde gesperrt.";
  return "Dieser SlangTag wird von unserer Moderation geprüft und ist noch nicht veröffentlicht.";
}
