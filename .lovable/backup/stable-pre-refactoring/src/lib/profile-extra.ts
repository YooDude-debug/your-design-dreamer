import { supabase } from "@/integrations/supabase/client";

/**
 * Erweiterte Profilfelder.
 *
 * Die Werte liegen in `public.profiles`, sind aber für andere Nutzer NICHT
 * direkt lesbar (keine Spalten-Leserechte). Gelesen wird ausschließlich über
 * die Serverfunktion `profile_details`, die jedes Feld einzeln nach der
 * gewählten Sichtbarkeit maskiert. Geschrieben werden darf nur das eigene
 * Profil (Row-Level-Security + Spaltenrechte).
 */

/** Sichtbarkeit eines einzelnen Feldes. */
export type FieldVisibility = "public" | "followers" | "private";

export const FIELD_VISIBILITIES: FieldVisibility[] = ["public", "followers", "private"];

export type ProfileFieldKind = "text" | "tags" | "date" | "url" | "handle";
export type ProfileFieldGroup = "personal" | "interests" | "social";

export type ProfileFieldKey =
  | "origin"
  | "languages"
  | "birthday"
  | "pronouns"
  | "interestTags"
  | "hobbies"
  | "music"
  | "games"
  | "movies"
  | "sports"
  | "website"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "twitch"
  | "discord";

export type ProfileFieldSpec = {
  key: ProfileFieldKey;
  column: string;
  kind: ProfileFieldKind;
  group: ProfileFieldGroup;
  /** Standard-Sichtbarkeit, wenn der Nutzer nichts gewählt hat. */
  defaultVisibility: FieldVisibility;
  max?: number;
};

export const PROFILE_FIELDS: ProfileFieldSpec[] = [
  {
    key: "origin",
    column: "origin",
    kind: "text",
    group: "personal",
    defaultVisibility: "public",
    max: 80,
  },
  {
    key: "languages",
    column: "languages",
    kind: "tags",
    group: "personal",
    defaultVisibility: "public",
  },
  {
    key: "birthday",
    column: "birthday",
    kind: "date",
    group: "personal",
    defaultVisibility: "private",
  },
  {
    key: "pronouns",
    column: "pronouns",
    kind: "text",
    group: "personal",
    defaultVisibility: "public",
    max: 40,
  },
  {
    key: "interestTags",
    column: "interest_tags",
    kind: "tags",
    group: "interests",
    defaultVisibility: "public",
  },
  {
    key: "hobbies",
    column: "hobbies",
    kind: "tags",
    group: "interests",
    defaultVisibility: "public",
  },
  {
    key: "music",
    column: "fav_music",
    kind: "tags",
    group: "interests",
    defaultVisibility: "public",
  },
  {
    key: "games",
    column: "fav_games",
    kind: "tags",
    group: "interests",
    defaultVisibility: "public",
  },
  {
    key: "movies",
    column: "fav_movies",
    kind: "tags",
    group: "interests",
    defaultVisibility: "public",
  },
  {
    key: "sports",
    column: "fav_sports",
    kind: "tags",
    group: "interests",
    defaultVisibility: "public",
  },
  {
    key: "website",
    column: "website",
    kind: "url",
    group: "social",
    defaultVisibility: "public",
    max: 200,
  },
  {
    key: "instagram",
    column: "instagram",
    kind: "handle",
    group: "social",
    defaultVisibility: "public",
    max: 60,
  },
  {
    key: "tiktok",
    column: "tiktok",
    kind: "handle",
    group: "social",
    defaultVisibility: "public",
    max: 60,
  },
  {
    key: "youtube",
    column: "youtube",
    kind: "handle",
    group: "social",
    defaultVisibility: "public",
    max: 80,
  },
  {
    key: "twitch",
    column: "twitch",
    kind: "handle",
    group: "social",
    defaultVisibility: "public",
    max: 60,
  },
  {
    key: "discord",
    column: "discord",
    kind: "handle",
    group: "social",
    defaultVisibility: "private",
    max: 60,
  },
];

export const FIELD_BY_KEY = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, f])) as Record<
  ProfileFieldKey,
  ProfileFieldSpec
>;

export type ProfileDetails = {
  [K in ProfileFieldKey]?: string | string[] | null;
} & { fieldVisibility?: Partial<Record<ProfileFieldKey, FieldVisibility>> };

export type ProfileStats = {
  memberSince: string;
  posts: number;
  comments: number;
  likesReceived: number;
  followers: number;
  following: number;
  slangTags: number;
  slangTagUses: number;
  slangTagRank: number;
  verified: boolean;
  level: number;
  xp: number;
};

/** Sichtbarkeit eines Feldes inklusive Standardwert. */
export function visibilityOf(
  details: ProfileDetails | null,
  key: ProfileFieldKey,
): FieldVisibility {
  return details?.fieldVisibility?.[key] ?? FIELD_BY_KEY[key].defaultVisibility;
}

export function asList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((x): x is string => typeof x === "string" && !!x.trim());
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Lädt die maskierten Detailfelder für ein oder mehrere Profile. */
export async function loadProfileDetails(ids: string[]): Promise<Record<string, ProfileDetails>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("profile_details", { _ids: ids });
  if (error) {
    console.warn("[profile] details failed", error.message);
    return {};
  }
  const out: Record<string, ProfileDetails> = {};
  for (const row of data ?? []) {
    out[row.user_id as string] = (row.details ?? {}) as ProfileDetails;
  }
  return out;
}

/** Lädt Profilstatistiken (Mitglied seit, Beiträge, Likes, Follower, Rang …). */
export async function loadProfileStats(ids: string[]): Promise<Record<string, ProfileStats>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.rpc("profile_stats", { _ids: ids });
  if (error) {
    console.warn("[profile] stats failed", error.message);
    return {};
  }
  const out: Record<string, ProfileStats> = {};
  for (const row of data ?? []) {
    out[row.user_id as string] = row.stats as unknown as ProfileStats;
  }
  return out;
}

function normalizeTags(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const v = raw.trim().replace(/\s+/g, " ").slice(0, 40);
    const key = v.toLowerCase();
    if (!v || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= 20) break;
  }
  return out;
}

/** Speichert die erweiterten Felder und deren Sichtbarkeit für das eigene Profil. */
export async function saveProfileDetails(
  userId: string,
  values: ProfileDetails,
  visibility: Partial<Record<ProfileFieldKey, FieldVisibility>>,
): Promise<void> {
  const update: Record<string, unknown> = {};

  for (const spec of PROFILE_FIELDS) {
    if (!(spec.key in values)) continue;
    const raw = values[spec.key];
    if (spec.kind === "tags") {
      update[spec.column] = normalizeTags(asList(raw));
    } else if (spec.kind === "date") {
      const v = asText(raw).trim();
      update[spec.column] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    } else {
      update[spec.column] = asText(raw)
        .trim()
        .slice(0, spec.max ?? 120);
    }
  }

  const vis: Record<string, FieldVisibility> = {};
  for (const spec of PROFILE_FIELDS) {
    const v = visibility[spec.key];
    if (v && FIELD_VISIBILITIES.includes(v)) vis[spec.key] = v;
  }
  update.field_visibility = vis;

  const { error } = await supabase
    .from("profiles")
    .update(update as never)
    .eq("id", userId);
  if (error) throw new Error(error.message);
}
