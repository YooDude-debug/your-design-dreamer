/** Shared, browser-safe types for the standalone admin cockpit. */

export type AdminOverview = {
  users: number;
  activeUsers: number;
  posts: number;
  slangTags: number;
  comments: number;
  reportsOpen: number;
  reportsTotal: number;
  campaigns: number;
  adPausesMonth: number;
  feedbackOpen: number;
  auditEntries: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  /** E-Mail-Adresse aus dem Auth-System (nur für Admin sichtbar). */
  email: string | null;
  location: string;
  language: string;
  verified: boolean;
  level: number;
  createdAt: string;
  /** Letzter belastbarer Aktivitätszeitpunkt; null = unbekannt. */
  lastSeenAt: string | null;
  isAdmin: boolean;
  /** Creator-Status (Rolle `creator` in `user_roles`). */
  isCreator: boolean;
  /** Unternehmer-Status (Rolle `business` in `user_roles`). */
  isBusiness: boolean;
  banned: boolean;
  banReason: string;
  banExpiresAt: string | null;
  warnings: number;
  /** true = Konto registriert, aber noch ohne Profilzeile (nie eingeloggt). */
  pendingProfile?: boolean;
};

/** Sortieroptionen der Nutzerverwaltung. */
export type AdminUserSort =
  | "recent_activity"
  | "oldest_activity"
  | "newest_signup"
  | "oldest_signup";

export type ReportTargetType =
  | "post"
  | "slang_tag"
  | "comment"
  | "profile"
  | "message"
  | "market_item"
  | "market_seller";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type AdminReportRow = {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel: string;
  targetUsername: string;
  /** Ersteller des gemeldeten Inhalts – für Verwarnen / Sperren. */
  targetUserId: string | null;
  reporterUsername: string;
  reason: string;
  details: string;
  status: ReportStatus;
  reviewNote: string;
  createdAt: string;
};

export type AdminSlangTagRow = {
  id: string;
  name: string;
  kind: "community" | "creator";
  ownerUsername: string;
  region: string;
  language: string;
  meaning: string;
  audioUrl: string | null;
  playsCount: number;
  usesCount: number;
  likesCount: number;
  createdAt: string;
  deletedAt: string | null;
};

export type AdminPostRow = {
  id: string;
  title: string;
  description: string;
  username: string;
  region: string;
  visibility: string;
  imageUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
};

export type AdminCommentRow = {
  id: string;
  postId: string;
  postTitle: string;
  username: string;
  body: string;
  createdAt: string;
};

export type AdminCampaignRow = {
  id: string;
  name: string;
  kind: "campaign" | "company_slang_tag" | "creator_slang_tag";
  status: "draft" | "active" | "paused" | "ended";
  region: string;
  slangTagId: string | null;
  slangTagName: string;
  budgetCents: number;
  revenueCents: number;
  impressions: number;
  clicks: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type AdminAdPauseRow = {
  id: string;
  username: string;
  localDate: string;
  monthKey: string;
  timezone: string;
  endsAt: string;
  createdAt: string;
};

export type AdminActiveUserRow = {
  id: string;
  username: string;
  location: string;
  lastSeenAt: string;
  posts: number;
  online: boolean;
};

export type AdminAuditRow = {
  id: string;
  adminUsername: string;
  action: string;
  targetType: string;
  targetLabel: string;
  details: string;
  createdAt: string;
};

export type SeriesPoint = { date: string; value: number };

export type AdminStats = {
  users: SeriesPoint[];
  posts: SeriesPoint[];
  slangTags: SeriesPoint[];
  adPauses: SeriesPoint[];
  revenue: SeriesPoint[];
  regions: { label: string; value: number }[];
  languages: { label: string; value: number }[];
  revenueTotalCents: number;
  impressions: number;
  clicks: number;
};

export const ADMIN_SECTIONS = [
  { key: "users", label: "Nutzer", to: "/admin/users" },
  { key: "posts", label: "Beiträge", to: "/admin/posts" },
  { key: "slangtags", label: "SlangTags", to: "/admin/slangtags" },
  { key: "comments", label: "Kommentare", to: "/admin/comments" },
  { key: "reports", label: "Meldungen", to: "/admin/reports" },
  { key: "moderation", label: "Audio-Moderation", to: "/admin/moderation" },
  { key: "ads", label: "Werbekern", to: "/admin/ads" },
  { key: "active", label: "Aktive Nutzer", to: "/admin/active" },
  { key: "pauses", label: "Werbepausen", to: "/admin/pauses" },
  { key: "feedback", label: "Feedback", to: "/admin/feedback" },
  { key: "stats", label: "Statistiken", to: "/admin/stats" },

  { key: "log", label: "Sicherheitsprotokoll", to: "/admin/log" },
] as const;
