import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { DataContext, type CreateTagInput, type DataCtx } from "@/lib/data-context";
import { toast } from "sonner";
import { useLang } from "@/lib/lang-context";
import { supabase } from "@/integrations/supabase/client";
import { moderateNewSlangTag } from "@/lib/moderation.functions";
import { deleteOwnPost } from "@/lib/posts.functions";
import { createModeratedPost, updateModeratedPost } from "@/lib/post-moderation.functions";
import { kickModerationWorker } from "@/lib/moderation-kick";
import {
  ensureSharePreview,
  removeUploads,
  sharePreviewPath,
  signPaths,
  uploadDataUrl,
  uploadPostImage,
  uploadShortVideo,
  variantPath,
} from "@/lib/media";
import { cachedClientRead, idsKey, invalidateClientCache } from "@/lib/client-cache";
import { clearSessionBootstrap, loadSessionBootstrap } from "@/lib/session-bootstrap";

import { checkSlangTagName, isSlangTagUsable } from "@/lib/slangtag-rules";
import { slangTagMaxSeconds } from "@/lib/audio-format";
import type {
  Post,
  PostVisibility,
  PostModerationStatus,
  PostComment,
  Profile,
  SlangTag,
  SlangTagKind,
  SlangTagOwnerType,
  SlangTagCtaType,
  SlangTagPlacement,
  SlangTagUnlockType,
  SortKey,
  VerificationStatus,
} from "@/lib/types";

type Row = Record<string, unknown>;

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// Rabattcode, Gutschein, Telefonnummer, Adresse, Oeffnungszeiten und Unternehmens-Link
// sind auf DB-Ebene nicht breit lesbar; sie kommen ueber die geprueft freigebende
// Funktion slang_tag_business_info.
const SLANG_TAG_COLUMNS =
  "id,name,audio_url,duration,creator_id,region,language,meaning,examples,plays_count,likes_count,uses_count,shares_count,saves_count,comments_count,created_at,updated_at,kind,owner_id,owner_type,company,verification_status,unlock_type,follow_required,released_at,drop_release_date,drop_limit,drop_expires,drop_rarity,deleted_at,moderation_status,sponsored,logo_url,description,cta_type,cta_url,clicks_count,conversion_count,reach_count,transcript,community_shared,normalized_name";

// Der Standort ist auf DB-Ebene nicht breit lesbar und kommt ueber profile_locations.
const PROFILE_COLUMNS =
  "id,username,display_name,display_name_mode,bio,location_visibility,profile_visibility,presence_status,language,theme,avatar_url,cover_url,verified,level,xp,created_at,updated_at,last_seen_at";

/**
 * Feed-Seitengröße (P-02).
 *
 * Der Feed lädt serverseitig seitenweise: zuerst 20 Beiträge, danach jeweils
 * 20 weitere beim Erreichen des Feed-Endes (Keyset/Cursor auf
 * `created_at` + `id`, also stabil und ohne große OFFSET-Werte). Neues kommt
 * weiterhin über `runCheckNewPosts` oben nach.
 */
const POSTS_PAGE_SIZE = 20;
/**
 * Profilverzeichnis (nur auf Anforderung, P-03): Die Personensuche läuft
 * serverseitig und begrenzt. Es wird nie das gesamte Verzeichnis geladen.
 * `PROFILES_SEARCH_LIMIT` deckt die in der Ansicht angezeigten 20 Treffer,
 * `PROFILES_SUGGEST_LIMIT` die Vorschlagsliste ohne Suchbegriff (12 sichtbar).
 */
const PROFILES_SEARCH_LIMIT = 20;
const PROFILES_SUGGEST_LIMIT = 24;
/** Kurzer Ergebnis-Cache pro Suchbegriff (schnelles Tippen, erneutes Öffnen). */
const DIRECTORY_CACHE_MS = 30_000;

async function withProfileLocations(rows: Row[]): Promise<Row[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.id as string);
  // Standortdaten ändern sich selten: kurzzeitig zwischenspeichern, damit
  // wiederholte Ladevorgänge die RPC nicht erneut aufrufen.
  const map = await cachedClientRead(`profile-locations:${idsKey(ids)}`, async () => {
    const { data, error } = await supabase.rpc("profile_locations", { _ids: ids });
    if (error) {
      console.error("[data] profile locations failed", error.message);
      return null;
    }
    const next = new Map<string, string>();
    ((data ?? []) as Row[]).forEach((r) =>
      next.set(r.user_id as string, (r.location as string) ?? ""),
    );
    return next;
  });
  if (!map) return rows;
  return rows.map((r) => ({ ...r, location: map.get(r.id as string) ?? "" }));
}

async function withBusinessInfo(rows: Row[]): Promise<Row[]> {
  const ids = rows.filter((r) => r.owner_type === "company").map((r) => r.id as string);
  if (ids.length === 0) return rows;
  const map = await cachedClientRead(`slangtag-business:${idsKey(ids)}`, async () => {
    const { data, error } = await supabase.rpc("slang_tag_business_info", { _tag_ids: ids });
    if (error) {
      console.error("[data] business info failed", error.message);
      return null;
    }
    const next = new Map<string, Row>();
    ((data ?? []) as Row[]).forEach((r) => next.set(r.tag_id as string, r));
    return next;
  });
  if (!map) return rows;
  return rows.map((r) => {
    const extra = map.get(r.id as string);
    return extra
      ? {
          ...r,
          discount_code: extra.discount_code,
          voucher: extra.voucher,
          phone: extra.phone,
          location: extra.location,
          opening_hours: extra.opening_hours,
          company_url: extra.company_url,
        }
      : r;
  });
}

function mapProfile(row: Row, urls: Record<string, string>): Profile {
  const avatarPath = (row.avatar_url as string | null) ?? null;
  const coverPath = (row.cover_url as string | null) ?? null;
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: (row.display_name as string) || (row.username as string),
    bio: (row.bio as string) ?? "",
    // Echter Name kommt nur bei eigenen Profil-Abfragen mit; öffentliche
    // Abfragen lesen die Spalte nicht (bleibt daher undefined).
    ...(row.real_name !== undefined ? { realName: (row.real_name as string) ?? "" } : {}),
    ...(row.real_name_hidden !== undefined
      ? { realNameHidden: Boolean(row.real_name_hidden) }
      : {}),
    ...(row.display_name_mode !== undefined
      ? { displayNameMode: row.display_name_mode as NonNullable<Profile["displayNameMode"]> }
      : {}),
    location: (row.location as string) ?? "",
    locationVisibility: ((row.location_visibility as string) ??
      "public") as Profile["locationVisibility"],
    profileVisibility: ((row.profile_visibility as string) ??
      "public") as Profile["profileVisibility"],
    presenceStatus: ((row.presence_status as string) ?? "online") as Profile["presenceStatus"],
    language: (row.language as string) ?? "Deutsch",
    theme: ((row.theme as string) ?? "aktuell") as NonNullable<Profile["theme"]>,
    avatarPath,
    avatar: avatarPath ? (urls[avatarPath] ?? null) : null,
    avatarThumb: avatarPath ? (urls[variantPath(avatarPath, "thumb") ?? ""] ?? null) : null,
    coverPath,
    cover: coverPath ? (urls[coverPath] ?? null) : null,
    coverMedium: coverPath ? (urls[variantPath(coverPath, "medium") ?? ""] ?? null) : null,

    verified: Boolean(row.verified),
    level: (row.level as number) ?? 1,
    xp: (row.xp as number) ?? 0,
    pushEnabled: Boolean(row.push_enabled),
  };
}

const ts = (v: unknown): number | null => (v ? new Date(v as string).getTime() : null);

function mapTag(
  row: Row,
  urls: Record<string, string>,
  profiles: Record<string, Profile>,
): SlangTag {
  const audioPath = (row.audio_url as string | null) ?? null;
  const ownerId = ((row.owner_id as string | null) ?? (row.creator_id as string)) as string;
  return {
    id: row.id as string,
    name: row.name as string,
    audioPath,
    audio: audioPath ? (urls[audioPath] ?? null) : null,
    duration: (row.duration as string) ?? "0:02",
    creatorId: row.creator_id as string,
    creator: profiles[row.creator_id as string]?.username ?? "unbekannt",
    createdAt: new Date(row.created_at as string).getTime(),
    region: (row.region as string) ?? "",
    language: (row.language as string) ?? "",
    meaning: (row.meaning as string) ?? "",
    transcript: (row.transcript as string) ?? "",
    examples: asArray<string>(row.examples),
    stats: {
      plays: (row.plays_count as number) ?? 0,
      likes: (row.likes_count as number) ?? 0,
      uses: (row.uses_count as number) ?? 0,
      shares: (row.shares_count as number) ?? 0,
      saves: (row.saves_count as number) ?? 0,
      comments: (row.comments_count as number) ?? 0,
      clicks: (row.clicks_count as number) ?? 0,
      conversions: (row.conversion_count as number) ?? 0,
      reach: (row.reach_count as number) ?? 0,
    },
    kind: ((row.kind as string) ?? "community") as SlangTagKind,
    moderationStatus: ((row.moderation_status as string) ?? "approved") as
      | "pending"
      | "approved"
      | "blocked",
    deletedAt: ts(row.deleted_at),
    ownerId,
    communityShared: Boolean(row.community_shared),
    ownerType: ((row.owner_type as string) ?? "user") as SlangTagOwnerType,
    company: (row.company as string) ?? "",
    verificationStatus: ((row.verification_status as string) ?? "none") as VerificationStatus,
    unlockType: ((row.unlock_type as string) ?? "open") as SlangTagUnlockType,
    followRequired: Boolean(row.follow_required),
    sponsored: (row.owner_type as string) === "company" && Boolean(row.sponsored),
    companyInfo:
      (row.owner_type as string) === "company"
        ? {
            name: (row.company as string) ?? "",
            logo: (row.logo_url as string | null) ?? null,
            description: (row.description as string) ?? "",
            ctaType: ((row.cta_type as string | null) ?? null) as SlangTagCtaType | null,
            ctaUrl: (row.cta_url as string | null) ?? null,
            discountCode: (row.discount_code as string) ?? "",
            voucher: (row.voucher as string) ?? "",
            location: (row.location as string) ?? "",
            openingHours: (row.opening_hours as string) ?? "",
            phone: (row.phone as string) ?? "",
            url: (row.company_url as string) ?? "",
          }
        : null,
    releasedAt: ts(row.released_at) ?? new Date(row.created_at as string).getTime(),
    drop: {
      releaseDate: ts(row.drop_release_date),
      limit: (row.drop_limit as number | null) ?? null,
      expires: ts(row.drop_expires),
      rarity: (row.drop_rarity as string | null) ?? null,
    },
  };
}

/**
 * Teilen-Vorschau (`__s.webp`) existiert ausschließlich für Beiträge mit
 * SlangTag-Platzierungen. Ohne Platzierungen darf der Pfad gar nicht erst
 * angefordert werden – sonst schlägt das Signieren zwangsläufig fehl.
 */
function taggedSharePath(row: { placements?: unknown; image_url?: unknown }): string | null {
  const placements = asArray<SlangTagPlacement>(row.placements);
  if (placements.length === 0) return null;
  return sharePreviewPath((row.image_url as string | null) ?? null);
}

function mapPost(row: Row, urls: Record<string, string>, profiles: Record<string, Profile>): Post {
  const imagePath = (row.image_url as string | null) ?? null;
  const audioPath = (row.audio_url as string | null) ?? null;
  const videoPath = (row.video_url as string | null) ?? null;
  const author = profiles[row.user_id as string];
  return {
    id: row.id as string,
    userId: row.user_id as string,
    author: {
      id: row.user_id as string,
      username: author?.username ?? "unbekannt",
      displayName: author?.displayName ?? "Unbekannt",
      // N-03: Kleine Avatare (32 px) laden das 300×300-Thumbnail; das Original
      // dient nur als Notnagel, wenn keine Variante existiert.
      avatar: author?.avatarThumb ?? author?.avatar ?? null,

      verified: author?.verified ?? false,
    },
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    region: (row.region as string) ?? "",
    hashtags: asArray<string>(row.hashtags),
    channelId: (row.channel_id as string | null) ?? null,
    image: imagePath ? (urls[imagePath] ?? null) : null,
    imageThumb: imagePath ? (urls[variantPath(imagePath, "thumb") ?? ""] ?? null) : null,
    imageMedium: imagePath ? (urls[variantPath(imagePath, "medium") ?? ""] ?? null) : null,
    // Verpixelte Teilen-Vorschau (nur für Share Sheet / Social-Preview).
    imageShare: urls[taggedSharePath(row) ?? ""] ?? null,
    imagePath,
    // SlangTag Video (Short) – stumme Bildspur, Ton ist der SlangTag.
    video: videoPath ? (urls[videoPath] ?? null) : null,
    videoKind: ((row.video_kind as string | null) ?? "shot") as "shot" | "post",
    videoDurationMs: (row.video_duration_ms as number | null) ?? null,
    audio: audioPath ? (urls[audioPath] ?? null) : null,
    duration: (row.duration as string) ?? "0:02",
    placements: asArray<SlangTagPlacement>(row.placements),
    slangTagIds: asArray<string>(row.slang_tag_ids),
    slangtagOrderLocked: (row.slangtag_order_locked as boolean | null) ?? true,
    visibility: ((row.visibility as string) ?? "public") as PostVisibility,
    stats: {
      likes: (row.likes_count as number) ?? 0,
      comments: (row.comments_count as number) ?? 0,
      shares: (row.shares_count as number) ?? 0,
      views: (row.views_count as number) ?? 0,
      saves: (row.saves_count as number) ?? 0,
      videoViews: (row.video_views_count as number) ?? 0,
    },
    createdAt: new Date(row.created_at as string).getTime(),
    // Prüfstand kommt direkt aus der Datenbank – nach jedem Neuladen korrekt.
    moderationStatus: ((row.moderation_status as string) ?? "pending") as PostModerationStatus,
    moderationReason: (row.moderation_reason as string | null) ?? "",
  };
}

export type CreatePostInput = {
  title: string;
  description: string;
  region: string;
  hashtags: string[];
  /** Zusätzlich gewählter Channel (`posts.channel_id`) oder null. */
  channelId?: string | null;
  imageDataUrl: string | null;
  audioPath: string | null;
  duration: string;
  placements: SlangTagPlacement[];
  slangTagIds: string[];
  /** Schloss der Abspielreihenfolge (Standard: geschlossen). */
  slangtagOrderLocked?: boolean;
  visibility?: PostVisibility;
  /**
   * SlangTag Video (Short): bereits stumm aufbereitete Bildspur, max. 5 s.
   * Der Ton bleibt der SlangTag – es wird nie eine Videotonspur gespeichert.
   */
  videoBlob?: Blob | null;
  /** Länge des Shorts in Millisekunden (max. 5000). */
  videoDurationMs?: number | null;
  /**
   * Video-Beitrag V1: bereits hochgeladenes und serverseitig abgenommenes
   * Video (`media_video_assets`). Es wird nichts erneut hochgeladen.
   */
  videoPath?: string | null;
  /** Thumbnail des Video-Beitrags (Speicherpfad, keine URL). */
  videoThumbnailPath?: string | null;
};

/** Felder, die beim Bearbeiten eines eigenen Beitrags geändert werden dürfen. */
export type UpdatePostInput = {
  title?: string;
  description?: string;
  region?: string;
  hashtags?: string[];
  /** undefined = Bild unverändert lassen, null = Bild entfernen */
  imageDataUrl?: string | null;
  placements?: SlangTagPlacement[];
  slangTagIds?: string[];
  slangtagOrderLocked?: boolean;
  visibility?: PostVisibility;
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  // Wörterbuch als Ref, damit Sprachwechsel keine Callback-Identitäten ändert.
  const { t } = useLang();
  const tRef = useRef(t);
  tRef.current = t;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const profilesRef = useRef<Record<string, Profile>>({});
  profilesRef.current = profiles;

  const [posts, setPosts] = useState<Post[]>([]);
  const postsRef = useRef<Post[]>([]);
  postsRef.current = posts;

  const [tags, setTags] = useState<SlangTag[]>([]);
  const tagsRef = useRef<SlangTag[]>([]);
  tagsRef.current = tags;

  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [sharedPosts, setSharedPosts] = useState<string[]>([]);
  const [likedTags, setLikedTags] = useState<string[]>([]);
  const [savedTags, setSavedTags] = useState<string[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [following, setFollowing] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  /** Interne Testrollen: Creator und Unternehmer (aus `user_roles`). */
  const [isCreator, setIsCreator] = useState(false);
  const [isBusiness, setIsBusiness] = useState(false);
  // Temporaere SlangTags eines Beitrags-Entwurfs: nur lokal, kein Upload,
  // kein Datenbankeintrag. Werden erst beim Veroeffentlichen dauerhaft.
  const [drafts, setDrafts] = useState<{ tag: SlangTag; input: CreateTagInput }[]>([]);
  const userIdRef = useRef<string | null>(null);
  const playThrottle = useRef<Record<string, number>>({});
  /** Merkt sich einen bewussten Logout, damit laufende Ladevorgaenge verstummen. */
  const signedOutRef = useRef(false);
  /** Erster Sitzungsstart nutzt den gemeinsamen Bootstrap, spätere Ladevorgänge holen ihn frisch. */
  const bootLoadedRef = useRef(false);

  /** Letzter Stammdatenstand der SlangTags inkl. Version (Anzahl + Änderung). */
  const tagSnapshotRef = useRef<{ version: string; rows: Row[] } | null>(null);
  /** Zeitstempel des neuesten bereits geladenen Beitrags (für Live-Prüfung). */
  const newestPostAtRef = useRef<string | null>(null);
  /** Bereits geladene, aber noch nicht eingefügte neue Beiträge. */
  const pendingPostsRef = useRef<Post[]>([]);
  /** Läuft eine Live-Prüfung, wird keine zweite parallel gestartet. */
  const checkInFlightRef = useRef<Promise<number> | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);

  /**
   * IDs der in dieser Sitzung nachträglich eingefügten Beiträge – sie werden
   * im Feed immer oben gehalten (created_at DESC) und nie vom Algorithmus
   * zwischen bestehende Beiträge einsortiert.
   */
  const [freshPostIds, setFreshPostIds] = useState<string[]>([]);

  /**
   * P-02 – seitenweises Laden des Feeds.
   * `postCursorRef` ist der Keyset-Cursor (ältester geladener Beitrag),
   * `moreInFlightRef` verhindert doppelte Anfragen bei schnellem Scrollen.
   */
  const postCursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  const moreInFlightRef = useRef<Promise<void> | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  /**
   * Personensuche (P-03): pro Suchbegriff wird das Ergebnis kurz
   * zwischengespeichert, damit schnelles Tippen und wiederholtes Öffnen keine
   * zusätzlichen Datenbankabfragen auslösen.
   */
  const directoryQueriesRef = useRef<Map<string, { at: number; run: Promise<void> }>>(new Map());

  /** Setzt alle nutzerbezogenen Daten zurueck (Logout = normaler Zustand). */
  const resetUserData = useCallback(() => {
    tagSnapshotRef.current = null;
    postCursorRef.current = null;
    directoryQueriesRef.current.clear();

    setHasMorePosts(false);
    setLoadingMorePosts(false);
    invalidateClientCache();
    // Beim Abmelden darf kein Bootstrap-Stand des alten Kontos übrig bleiben.
    clearSessionBootstrap();

    setProfiles({});
    setPosts([]);
    setTags([]);
    setLikedPosts([]);
    setSavedPosts([]);
    setSharedPosts([]);
    setLikedTags([]);
    setSavedTags([]);
    setCommentsByPost({});
    setFollowing([]);
    setDrafts([]);
    setIsAdmin(false);
    setIsModerator(false);
    setIsCreator(false);
    setIsBusiness(false);
    setLoading(false);
  }, []);

  const me = user ? (profiles[user.id] ?? null) : null;

  /**
   * Exklusive $$-SlangTags duerfen ausschliesslich Konten mit Creator- oder
   * Unternehmer-Status anlegen (Spiegel der Datenbank-Pruefung
   * `enforce_slang_tag_kind`). Adminrechte allein genuegen bewusst NICHT.
   */
  const canCreateBusinessTag = isCreator || isBusiness;
  /**
   * Badge „Creator / Unternehmer“ – bewusst OHNE Adminrolle: ein Admin ohne
   * Creator-/Unternehmer-Status besitzt das Badge nicht.
   */
  const isCreatorAccount = isCreator || isBusiness;
  /** Laengeres Audio (10 s) fuer Admins, Creator, Unternehmer und verifizierte Konten. */
  const canUseExtendedAudio = canCreateBusinessTag || isAdmin || Boolean(me?.verified);

  /**
   * Legt beim ersten Login automatisch ein Profil an.
   *
   * Wichtig: der bei der Registrierung gewählte Benutzername steht in den
   * Konto-Metadaten. Er ist die einzige gültige Quelle für den Handle – er
   * darf NIE aus der E-Mail-Adresse abgeleitet werden. Die Anlage läuft
   * deshalb ausschliesslich über die Serverfunktion, die den gewünschten
   * Namen aus den Metadaten übernimmt.
   */
  const ensureProfile = useCallback(async (u: User) => {
    const { data } = await supabase.from("profiles").select("id").eq("id", u.id).maybeSingle();
    if (data) return;
    try {
      const { ensureProfile: ensureProfileServer } = await import("@/lib/account.functions");
      await ensureProfileServer({ data: {} });
    } catch (e) {
      console.error("[data] profile create failed", (e as Error).message);
    }
  }, []);

  /**
   * Lädt fehlende Profile gezielt über ihre User-ID nach (z. B. Connection-
   * Gegenüber, das nicht im Grundstock der letzten Profile steckt) und mischt
   * sie in den vorhandenen Bestand – nie ersetzend.
   */
  const ensureProfiles = useCallback(async (idList: string[]) => {
    const known = profilesRef.current;
    const missing = [...new Set(idList.filter((id) => !!id && !known[id]))];
    if (missing.length === 0) return;
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", missing);
    if (error) {
      console.error("[data] ensureProfiles failed", error.code ?? "", error.message);
      return;
    }
    const rows = await withProfileLocations((data ?? []) as Row[]);
    if (rows.length === 0) return;
    const urls = await signPaths(
      rows.flatMap((p) => [
        p.avatar_url as string | null,
        variantPath(p.avatar_url as string | null, "thumb"),
      ]),
    );
    setProfiles((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        const p = mapProfile(r, urls);
        next[p.id] = p;
      });
      return next;
    });
  }, []);

  const loadAllRaw = useCallback(async () => {
    const uid = userIdRef.current;
    // Nach dem Abmelden gibt es keine Sitzung mehr: dann wird nichts geladen
    // und "keine Daten" ist der normale Zustand, kein Fehler.
    if (!uid) {
      signedOutRef.current = true;
      resetUserData();
      return;
    }
    signedOutRef.current = false;
    // Sitzungsstart: Inhalte plus ein einziger Aufruf für alle persönlichen
    // Zustände (Likes, Merklisten, Shares, SlangTag-Likes/-Merklisten,
    // Gefolgte, Rollen, Profilstatus, Testbot-Schalter).
    //
    // SlangTags sind Stammdaten: sie werden nur erneut vollständig geladen,
    // wenn sich Anzahl oder letzte Änderung unterscheiden. Sonst wird der
    // vorhandene Stand weiterverwendet (spart die größte Abfrage komplett).
    const haveTagSnapshot = tagSnapshotRef.current !== null;
    // Der Bootstrap-Aufruf ist gemeinsam: Social-Layer, SlangTag-Freigaben und
    // Werbepausen nutzen dasselbe Ergebnis, statt eigene Einzelabfragen zu
    // stellen (ein Aufruf statt sechs). Beim erneuten Laden wird er erneuert.
    const bootPromise = loadSessionBootstrap(uid, bootLoadedRef.current);
    bootLoadedRef.current = true;

    const [postRes, bootRes, tagVersionRes, firstTagRes] = await Promise.all([
      // P-02: erste Feed-Seite (20 Beiträge). Weitere Seiten kommen über
      // `loadMorePosts` beim Scrollen.
      supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(POSTS_PAGE_SIZE),

      bootPromise,
      supabase
        .from("slang_tags")
        .select("updated_at", { count: "exact" })
        .order("updated_at", { ascending: false })
        .limit(1),
      haveTagSnapshot
        ? Promise.resolve(null)
        : supabase
            .from("slang_tags")
            .select(SLANG_TAG_COLUMNS)
            .order("created_at", { ascending: false }),
    ]);

    const tagVersion = `${tagVersionRes.count ?? -1}:${
      ((tagVersionRes.data ?? []) as Row[])[0]?.updated_at ?? ""
    }`;
    let tagRes = firstTagRes;
    let reusedTags = false;
    if (haveTagSnapshot) {
      if (tagSnapshotRef.current?.version === tagVersion) {
        reusedTags = true;
      } else {
        tagRes = await supabase
          .from("slang_tags")
          .select(SLANG_TAG_COLUMNS)
          .order("created_at", { ascending: false });
      }
    }

    const boot = (bootRes ?? {}) as {
      liked_posts?: string[];
      saved_posts?: string[];
      shared_posts?: string[];
      liked_tags?: string[];
      saved_tags?: string[];
      following?: string[];
      roles?: string[];
    };

    // Wurde waehrend des Ladens abgemeldet, werden Ergebnisse und Fehler
    // verworfen – kein Toast, kein Schreiben in den State.
    if (signedOutRef.current || !userIdRef.current) return;

    // Datenbankfehler duerfen nicht als "keine Daten" gelten: sie werden
    // protokolliert und dem Nutzer verstaendlich gemeldet.
    const failures: string[] = [];
    const check = (label: string, err: { message: string; code?: string } | null) => {
      if (!err) return false;
      console.error(`[data] load ${label} failed`, err.code ?? "", err.message);
      failures.push(label);
      return true;
    };
    const tagFailed = check("SlangTags", tagRes?.error ?? null);
    const postFailed = check("Beitraege", postRes.error);
    if (!bootRes) check("Einstellungen", { message: "bootstrap_user_state lieferte keine Daten" });

    const postRows = (postRes.data ?? []) as Row[];

    const rawTagRows = reusedTags
      ? (tagSnapshotRef.current?.rows ?? [])
      : ((tagRes?.data ?? []) as Row[]);

    /**
     * P-02: Profile werden gezielt geladen – nur die Autoren der geladenen
     * Feed-Seite, die Besitzer/Ersteller der SlangTag-Stammdaten und das eigene
     * Konto. Kein pauschaler Grundstock mehr beim Sitzungsstart.
     */
    const neededProfileIds = [
      ...new Set(
        [
          uid,
          ...postRows.map((r) => r.user_id as string),
          ...rawTagRows.flatMap((r) => [r.owner_id as string, r.creator_id as string]),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    const profRes = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .in("id", neededProfileIds);
    const profFailed = check("Profile", profRes.error);
    const allProfRows = (profRes.data ?? []) as Row[];

    if (failures.length > 0) {
      toast.error(`Daten konnten nicht geladen werden: ${failures.join(", ")}.`);
    }

    // Zusatzdaten (Standort, Unternehmensinfos) parallel statt nacheinander.
    const [profRows, tagRows] = await Promise.all([
      withProfileLocations(allProfRows),
      withBusinessInfo(rawTagRows),
    ]);
    if (!tagFailed) tagSnapshotRef.current = { version: tagVersion, rows: rawTagRows };

    const urls = await signPaths([
      ...profRows.flatMap((p) => [
        p.avatar_url as string | null,
        variantPath(p.avatar_url as string | null, "thumb"),
        p.cover_url as string | null,
        variantPath(p.cover_url as string | null, "medium"),
      ]),

      ...tagRows.map((t) => t.audio_url as string | null),
      ...postRows.flatMap((p) => [
        p.image_url as string | null,
        variantPath(p.image_url as string | null, "thumb"),
        variantPath(p.image_url as string | null, "medium"),
        taggedSharePath(p),
        p.audio_url as string | null,
        p.video_url as string | null,
      ]),
    ]);

    const profileMap: Record<string, Profile> = {};
    profRows.forEach((r) => {
      const p = mapProfile(r, urls);
      profileMap[p.id] = p;
    });

    // Bei einem Fehler bleibt der letzte gute Stand erhalten statt geleert zu werden.
    // Gezielt nachgeladene Profile (z. B. Connections) bleiben erhalten.
    if (!profFailed) setProfiles((prev) => ({ ...prev, ...profileMap }));
    if (!tagFailed) setTags(tagRows.map((r) => mapTag(r, urls, profileMap)));
    if (!postFailed) {
      setPosts(postRows.map((r) => mapPost(r, urls, profileMap)));
      // Vollständiger Neustand: Live-Prüfung setzt hier neu an.
      newestPostAtRef.current = (postRows[0]?.created_at as string | null) ?? null;
      pendingPostsRef.current = [];
      setNewPostsCount(0);
      setFreshPostIds([]);
      // P-02: Cursor der ersten Seite (Keyset) merken; weitere Seiten folgen
      // erst beim Scrollen.
      const last = postRows[postRows.length - 1];
      postCursorRef.current = last
        ? { createdAt: last.created_at as string, id: last.id as string }
        : null;
      setHasMorePosts(postRows.length >= POSTS_PAGE_SIZE);
    }

    // Alle persönlichen Zustände kommen aus dem einen Bootstrap-Aufruf oben.
    const ids = (value: unknown) => (Array.isArray(value) ? (value as string[]) : []);
    setLikedPosts(ids(boot.liked_posts));
    setSavedPosts(ids(boot.saved_posts));
    setSharedPosts(ids(boot.shared_posts));
    setLikedTags(ids(boot.liked_tags));
    setSavedTags(ids(boot.saved_tags));
    setFollowing(ids(boot.following));
    const roleList = ids(boot.roles);
    setIsAdmin(roleList.includes("admin"));
    setIsModerator(roleList.includes("moderator"));
    setIsCreator(roleList.includes("creator"));
    setIsBusiness(roleList.includes("business"));
  }, [resetUserData]);

  /**
   * Live-Feed: prüft ausschließlich auf Beiträge, die neuer als der bereits
   * geladene Stand sind. Nichts Bestehendes wird ersetzt oder neu gerendert;
   * die Treffer landen in einem Zwischenspeicher und werden erst durch
   * `applyNewPosts` in den Feed übernommen.
   */
  const runCheckNewPosts = useCallback(async (): Promise<number> => {
    const uid = userIdRef.current;
    if (!uid) return 0;
    const since = newestPostAtRef.current;
    let query = supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    // Überlappungsfenster von 5 s: Beiträge, die minimal später committen,
    // gehen nicht verloren. Doppelte werden über die ID-Prüfung entfernt.
    if (since) query = query.gt("created_at", new Date(Date.parse(since) - 5_000).toISOString());
    const { data, error } = await query;
    if (error || !data || data.length === 0) return pendingPostsRef.current.length;

    const knownPostIds = new Set([
      ...postsRef.current.map((p) => p.id),
      ...pendingPostsRef.current.map((p) => p.id),
    ]);
    const rows = (data as Row[]).filter((r) => !knownPostIds.has(r.id as string));
    newestPostAtRef.current = ((data as Row[])[0]?.created_at as string | null) ?? since;
    if (rows.length === 0) return pendingPostsRef.current.length;

    const profilesNow = profilesRef.current;
    // Fehlende Autorenprofile nachladen (z. B. neue Testbots).
    const missingAuthors = [
      ...new Set(rows.map((r) => r.user_id as string).filter((id) => !profilesNow[id])),
    ];
    let profileMap = profilesNow;

    if (missingAuthors.length > 0) {
      const { data: profData } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .in("id", missingAuthors);
      const extraRows = await withProfileLocations((profData ?? []) as Row[]);
      const extraUrls = await signPaths(
        extraRows.flatMap((p) => [
          p.avatar_url as string | null,
          variantPath(p.avatar_url as string | null, "thumb"),
        ]),
      );
      profileMap = { ...profiles };
      extraRows.forEach((r) => {
        const p = mapProfile(r, extraUrls);
        profileMap[p.id] = p;
      });
      setProfiles(profileMap);
    }

    const usable = rows.filter((r) => Boolean(profileMap[r.user_id as string]));
    if (usable.length === 0) return pendingPostsRef.current.length;

    // Neue SlangTags der Beiträge ergänzen (nur zusätzliche Einträge).
    const known = new Set(tagsRef.current.map((t) => t.id));
    const missingTags = [
      ...new Set(
        usable.flatMap((r) => ((r.slang_tag_ids ?? []) as string[]).filter((id) => !known.has(id))),
      ),
    ];
    if (missingTags.length > 0) {
      const { data: tagData } = await supabase
        .from("slang_tags")
        .select(SLANG_TAG_COLUMNS)
        .in("id", missingTags);
      const tagRows = await withBusinessInfo((tagData ?? []) as Row[]);
      const tagUrls = await signPaths(tagRows.map((t) => t.audio_url as string | null));
      const mapped = tagRows.map((r) => mapTag(r, tagUrls, profileMap));
      if (mapped.length > 0) {
        setTags((prev) => {
          const seen = new Set(prev.map((t) => t.id));
          return [...mapped.filter((t) => !seen.has(t.id)), ...prev];
        });
      }
    }

    const urls = await signPaths(
      usable.flatMap((p) => [
        p.image_url as string | null,
        variantPath(p.image_url as string | null, "thumb"),
        variantPath(p.image_url as string | null, "medium"),
        taggedSharePath(p),
        p.audio_url as string | null,
        p.video_url as string | null,
      ]),
    );
    const fresh = usable.map((r) => mapPost(r, urls, profileMap));
    const pendingIds = new Set(pendingPostsRef.current.map((p) => p.id));
    pendingPostsRef.current = [
      ...fresh.filter((p) => !pendingIds.has(p.id)),
      ...pendingPostsRef.current,
    ];
    setNewPostsCount(pendingPostsRef.current.length);
    return pendingPostsRef.current.length;
    // Stabil: alle Lesezugriffe laufen über Refs, damit das 10-s-Intervall
    // im Feed nicht bei jeder Profil-/Tag-Änderung neu aufgesetzt wird.
  }, []);

  /**
   * Stabile, gegen Parallelläufe geschützte Live-Prüfung. Mehrere Auslöser
   * (Intervall, Tab-Fokus) teilen sich denselben laufenden Aufruf.
   */
  const checkNewPosts = useCallback(async (): Promise<number> => {
    if (checkInFlightRef.current) return checkInFlightRef.current;
    const run = runCheckNewPosts().finally(() => {
      checkInFlightRef.current = null;
    });
    checkInFlightRef.current = run;
    return run;
  }, [runCheckNewPosts]);

  /** Vorgeladene Beiträge sichtbar machen (bewusste Nutzeraktion oder Feed-Anfang). */
  const applyNewPosts = useCallback(() => {
    const fresh = pendingPostsRef.current;
    pendingPostsRef.current = [];
    setNewPostsCount(0);
    if (fresh.length === 0) return;
    setPosts((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...fresh.filter((p) => !seen.has(p.id)), ...prev];
    });
    // Neue Beiträge bleiben als eigener oberster Feed-Block erkennbar.
    setFreshPostIds((prev) => {
      const known = new Set(prev);
      return [...fresh.map((p) => p.id).filter((id) => !known.has(id)), ...prev];
    });
  }, []);

  /**
   * P-02: nächste Feed-Seite (20 Beiträge) per Keyset-Cursor nachladen.
   *
   * - Cursor = ältester geladener Beitrag (`created_at`, `id`) – stabile
   *   Reihenfolge, keine großen OFFSET-Werte, keine übersprungenen Beiträge.
   * - Parallelläufe teilen sich denselben Aufruf; bereits geladene Beiträge
   *   werden nie erneut abgerufen und beim Anhängen dedupliziert.
   * - Profile werden ausschließlich für die neuen Autoren nachgeholt.
   */
  const loadMorePosts = useCallback(async () => {
    if (moreInFlightRef.current) return moreInFlightRef.current;
    const uid = userIdRef.current;
    const cursor = postCursorRef.current;
    if (!uid || !cursor) return;

    const run = (async () => {
      setLoadingMorePosts(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .or(
            `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(POSTS_PAGE_SIZE);
        if (error) {
          console.error("[data] load more posts failed", error.code ?? "", error.message);
          return;
        }
        if (signedOutRef.current || !userIdRef.current) return;
        const rows = (data ?? []) as Row[];
        setHasMorePosts(rows.length >= POSTS_PAGE_SIZE);
        if (rows.length === 0) return;

        const last = rows[rows.length - 1];
        postCursorRef.current = {
          createdAt: last.created_at as string,
          id: last.id as string,
        };

        // Nur fehlende Autorenprofile nachholen – vorhandene werden wiederverwendet.
        const known = profilesRef.current;
        const missing = [
          ...new Set(rows.map((r) => r.user_id as string).filter((id) => !!id && !known[id])),
        ];
        let profileMap: Record<string, Profile> = { ...known };
        const newProfiles: Record<string, Profile> = {};

        const [profRows, urls] = await Promise.all([
          missing.length > 0
            ? supabase
                .from("profiles")
                .select(PROFILE_COLUMNS)
                .in("id", missing)
                .then((res) => withProfileLocations((res.data ?? []) as Row[]))
            : Promise.resolve([] as Row[]),
          // Bildvarianten (P-01) bleiben unverändert: Thumb + Medium + Original.
          signPaths(
            rows.flatMap((p) => [
              p.image_url as string | null,
              variantPath(p.image_url as string | null, "thumb"),
              variantPath(p.image_url as string | null, "medium"),
              taggedSharePath(p),
              p.audio_url as string | null,
              p.video_url as string | null,
            ]),
          ),
        ]);

        if (profRows.length > 0) {
          const avatarUrls = await signPaths(
            profRows.flatMap((p) => [
              p.avatar_url as string | null,
              variantPath(p.avatar_url as string | null, "thumb"),
              p.cover_url as string | null,
              variantPath(p.cover_url as string | null, "medium"),
            ]),
          );
          profRows.forEach((r) => {
            const p = mapProfile(r, avatarUrls);
            newProfiles[p.id] = p;
          });
          profileMap = { ...profileMap, ...newProfiles };
          setProfiles((prev) => ({ ...prev, ...newProfiles }));
        }

        const mapped = rows.map((r) => mapPost(r, urls, profileMap));
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const next = mapped.filter((p) => !seen.has(p.id));
          return next.length === 0 ? prev : [...prev, ...next];
        });
      } finally {
        setLoadingMorePosts(false);
      }
    })().finally(() => {
      moreInFlightRef.current = null;
    });

    moreInFlightRef.current = run;
    return run;
  }, []);

  /**
   * Profilverzeichnis auf Anforderung (Personensuche, Profilseiten).
   *
   * P-03: Es werden nie mehr alle Profile geladen. Die Suche läuft
   * serverseitig (Nutzername/Anzeigename, indexgestützt) und ist serverseitig
   * begrenzt. Ohne Suchbegriff kommt nur die kleine Vorschlagsliste
   * (neueste Profile). Ergebnisse pro Suchbegriff werden kurz
   * zwischengespeichert, damit schnelles Tippen keine Lastspitzen erzeugt.
   * Sichtbarkeits- und Sicherheitsregeln bleiben unverändert (Filterung wie
   * bisher in `searchProfiles`).
   */
  const ensureProfileDirectory = useCallback(async (query?: string) => {
    const term = (query ?? "")
      .trim()
      .slice(0, 40)
      // Zeichen mit Sonderbedeutung im Filterausdruck entfernen.
      .replace(/[,()%*\\]/g, " ")
      .trim();
    const key = term.toLowerCase();
    const cache = directoryQueriesRef.current;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < DIRECTORY_CACHE_MS) return cached.run;

    const run = (async () => {
      // Anmeldung kann beim Öffnen noch laden – kurz darauf warten, statt
      // die Suche für die ganze Sitzung leer zu lassen.
      let uid = userIdRef.current;
      for (let i = 0; !uid && i < 30; i += 1) {
        await new Promise((r) => setTimeout(r, 300));
        uid = userIdRef.current;
      }
      if (!uid) {
        cache.delete(key);
        return;
      }
      let request = supabase.from("profiles").select(PROFILE_COLUMNS);
      if (term) {
        request = request
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
          .limit(PROFILES_SEARCH_LIMIT);
      } else {
        request = request.order("created_at", { ascending: false }).limit(PROFILES_SUGGEST_LIMIT);
      }
      const { data, error } = await request;
      if (error) {
        console.error("[data] profile directory failed", error.code ?? "", error.message);
        cache.delete(key);
        return;
      }
      const rows = await withProfileLocations((data ?? []) as Row[]);
      if (rows.length === 0) return;
      const urls = await signPaths(
        rows.flatMap((p) => [
          p.avatar_url as string | null,
          variantPath(p.avatar_url as string | null, "thumb"),
          p.cover_url as string | null,
          variantPath(p.cover_url as string | null, "medium"),
        ]),
      );
      setProfiles((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          const p = mapProfile(r, urls);
          next[p.id] = p;
        });
        return next;
      });
    })();
    cache.set(key, { at: Date.now(), run });
    return run;
  }, []);

  /**
   * Gebündeltes Laden: identische Anfragen werden zusammengefasst.
   *
   * - Läuft bereits ein Ladevorgang, wird dessen Ergebnis mitgenutzt
   *   (keine doppelten SELECTs).
   * - Ohne `force` wird höchstens alle `MIN_LOAD_GAP_MS` neu geladen,
   *   damit viele kleine Auslöser keine Lastspitzen erzeugen.
   */
  const MIN_LOAD_GAP_MS = 20_000;
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadRef = useRef(0);

  const loadAll = useCallback(
    async (opts?: { force?: boolean }) => {
      if (inFlightRef.current) return inFlightRef.current;
      if (!opts?.force && Date.now() - lastLoadRef.current < MIN_LOAD_GAP_MS) return;
      const run = loadAllRaw().finally(() => {
        lastLoadRef.current = Date.now();
        inFlightRef.current = null;
      });
      inFlightRef.current = run;
      return run;
    },
    [loadAllRaw],
  );

  /** Aktualisiert nur, wenn die vorhandenen Daten älter als `maxAgeMs` sind. */
  const syncIfStale = useCallback(
    (maxAgeMs: number) => {
      if (Date.now() - lastLoadRef.current < maxAgeMs) return;
      void loadAll({ force: true });
    },
    [loadAll],
  );

  // Auth + Initial-Load
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user ?? null;
      setUser(u);
      userIdRef.current = u?.id ?? null;
      if (u) await ensureProfile(u);
      await loadAll({ force: true });
      if (!cancelled) setLoading(false);
    };
    void init();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const u = session?.user ?? null;
      setUser(u);
      userIdRef.current = u?.id ?? null;
      // Logout: Zustand leeren und keine weiteren Anfragen stellen.
      if (event === "SIGNED_OUT" || !u) {
        signedOutRef.current = true;
        setUser(null);
        resetUserData();
        return;
      }
      signedOutRef.current = false;
      // Auch bei SIGNED_IN sicherstellen, dass ein Profil existiert.
      void (async () => {
        await ensureProfile(u);
        await loadAll({ force: true });
      })();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [ensureProfile, loadAll, resetUserData]);

  // Fehler-Rückfall: schlägt ein optimistischer Schreibvorgang fehl, wird der
  // echte Stand einmalig gebündelt nachgeladen (kein Realtime nötig).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void loadAll({ force: true }), 800);
  }, [loadAll]);

  const loadComments = useCallback(async (postId: string) => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as Row[];
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: rows.map((r) => ({
        id: r.id as string,
        postId,
        userId: r.user_id as string,
        username: "",
        avatar: null,
        body: r.body as string,
        slangTagIds: asArray<string>(r.slang_tag_ids),
        createdAt: new Date(r.created_at as string).getTime(),
      })),
    }));
  }, []);

  /**
   * Punktuelle Synchronisierung eines einzelnen Beitrags.
   *
   * Wird beim Öffnen der Detailansicht genutzt: einmal die echten Zähler
   * des Beitrags und der verwendeten SlangTags holen, danach lokal
   * weiterarbeiten – ohne dauerhafte Live-Verbindung.
   */
  const syncPost = useCallback(
    async (postId: string) => {
      const { data } = await supabase
        .from("posts")
        .select(
          "id, slang_tag_ids, likes_count, comments_count, shares_count, views_count, saves_count, video_views_count",
        )
        .eq("id", postId)
        .maybeSingle();
      const row = data as Row | null;
      if (!row) return;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                stats: {
                  ...p.stats,
                  likes: Number(row.likes_count ?? p.stats.likes),
                  comments: Number(row.comments_count ?? p.stats.comments),
                  shares: Number(row.shares_count ?? p.stats.shares),
                  views: Number(row.views_count ?? p.stats.views),
                  saves: Number(row.saves_count ?? p.stats.saves),
                  videoViews: Number(row.video_views_count ?? p.stats.videoViews),
                },
              }
            : p,
        ),
      );

      const tagIds = asArray<string>(row.slang_tag_ids);
      if (tagIds.length > 0) {
        const { data: tagRows } = await supabase
          .from("slang_tags")
          .select(
            "id, plays_count, likes_count, uses_count, shares_count, saves_count, comments_count",
          )
          .in("id", tagIds);
        const byId = new Map(((tagRows ?? []) as Row[]).map((r) => [r.id as string, r]));
        if (byId.size > 0) {
          setTags((prev) =>
            prev.map((t) => {
              const r = byId.get(t.id);
              if (!r) return t;
              return {
                ...t,
                stats: {
                  ...t.stats,
                  plays: Number(r.plays_count ?? t.stats.plays),
                  likes: Number(r.likes_count ?? t.stats.likes),
                  uses: Number(r.uses_count ?? t.stats.uses),
                  shares: Number(r.shares_count ?? t.stats.shares),
                  saves: Number(r.saves_count ?? t.stats.saves),
                  comments: Number(r.comments_count ?? t.stats.comments),
                },
              };
            }),
          );
        }
      }

      await loadComments(postId);
    },
    [loadComments],
  );

  /**
   * Bedarfsgerechte Hintergrundaktualisierung statt Dauer-Realtime.
   *
   * - beim Zurückkehren in die App (Sichtbarkeit/Fokus), wenn Daten veraltet
   * - in ruhigen Intervallen, solange der Tab sichtbar ist
   */
  useEffect(() => {
    const BACKGROUND_MS = 120_000;
    const STALE_MS = 60_000;

    const onVisible = () => {
      if (document.visibilityState === "visible") syncIfStale(STALE_MS);
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") syncIfStale(BACKGROUND_MS);
    }, BACKGROUND_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(timer);
    };
  }, [syncIfStale]);

  /**
   * Prüfstand eigener Beiträge nachziehen.
   *
   * Die Veröffentlichung wartet nie auf die KI-Prüfung. Solange ein eigener
   * Beitrag noch nicht freigegeben ist, wird ausschließlich dessen Prüfstand
   * (kleine Abfrage, nur betroffene Zeilen) im Hintergrund aktualisiert. Es
   * entstehen dabei keine neuen Beiträge – nur Statusfelder werden ersetzt.
   */
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    let alive = true;
    let busy = false;

    const openIds = () =>
      postsRef.current
        .filter((p) => p.userId === uid && (p.moderationStatus ?? "pending") === "pending")
        .map((p) => p.id);

    let runs = 0;

    const tick = async () => {
      if (!alive || busy || document.visibilityState !== "visible") return;
      const ids = openIds();
      if (ids.length === 0) return;
      busy = true;
      runs += 1;
      try {
        // Hintergrund-Worker nur gelegentlich anstoßen (erster Lauf, danach
        // jeder dritte). Ein Dauerfeuer alle 6 s belastete den Server ohne
        // Nutzen, weil die Prüfung selbst länger braucht.
        if (runs === 1 || runs % 3 === 0) kickModerationWorker();
        // … und den gespeicherten Stand lesen.
        const { data } = await supabase
          .from("posts")
          .select("id,moderation_status,moderation_reason")
          .in("id", ids);
        const rows = (data ?? []) as {
          id: string;
          moderation_status: string | null;
          moderation_reason: string | null;
        }[];
        if (!alive || rows.length === 0) return;
        const byId = new Map(rows.map((r) => [r.id, r]));
        setPosts((prev) => {
          let changed = false;
          const next = prev.map((p) => {
            const row = byId.get(p.id);
            if (!row) return p;
            const status = (row.moderation_status ?? "pending") as PostModerationStatus;
            const reason = row.moderation_reason ?? "";
            if (
              status === (p.moderationStatus ?? "pending") &&
              reason === (p.moderationReason ?? "")
            )
              return p;
            changed = true;
            return { ...p, moderationStatus: status, moderationReason: reason };
          });
          // Unveränderte Liste behält ihre Identität: der Feed rendert nicht neu.
          return changed ? next : prev;
        });
      } catch {
        /* Prüfstand wird beim nächsten Durchlauf erneut gelesen. */
      } finally {
        busy = false;
      }
    };

    /**
     * Sanft wachsender Abstand: erst schnell (6 s), dann ruhiger bis 60 s.
     * So bleibt die Anzeige zügig, ohne bei langen Prüfungen dauerhaft alle
     * 6 Sekunden zu fragen.
     */
    let delay = 6_000;
    let timer = 0;
    const loop = () => {
      timer = window.setTimeout(async () => {
        await tick();
        delay = Math.min(delay * 1.5, 60_000);
        if (alive) loop();
      }, delay);
    };

    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    void tick();
    loop();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);

  // ---------- SlangTags ----------
  /**
   * Ausdrücklich freigegebene fremde SlangTags (Grants/Drops). Sie dürfen wie
   * eigene Varianten in neuen Beiträgen verwendet werden – follow-gebundene
   * Drops jedoch nur solange dem Eigentümer gefolgt wird. Serverseitig gilt
   * dieselbe Regel (has_slang_tag_grant), die UI spiegelt sie nur.
   */
  const [grants, setGrants] = useState<
    { tagId: string; ownerId: string; requiresFollow: boolean }[]
  >([]);
  useEffect(() => {
    if (!user) {
      setGrants([]);
      return;
    }
    let alive = true;
    const run = async () => {
      const { data } = await supabase
        .from("slang_tag_grants")
        .select("tag_id,owner_id,requires_follow")
        .eq("grantee_id", user.id);
      if (!alive) return;
      setGrants(
        (
          (data ?? []) as { tag_id: string; owner_id: string; requires_follow: boolean | null }[]
        ).map((g) => ({
          tagId: g.tag_id,
          ownerId: g.owner_id,
          requiresFollow: Boolean(g.requires_follow),
        })),
      );
    };
    void run();
    return () => {
      alive = false;
    };
  }, [user]);

  /**
   * Aktuell gültige Freigaben: Drop noch aktiv (SlangTag vorhanden und nicht
   * abgelaufen) und – falls follow-gebunden – aktives Folgen des Eigentümers.
   * Entfolgen entfernt den $$-Drop dadurch sofort aus der SlangBox; bereits
   * veröffentlichte Beiträge bleiben unverändert.
   */
  const grantedTagIds = useMemo(() => {
    if (!user) return [] as string[];
    return grants
      .filter((g) => {
        const tag = tags.find((t) => t.id === g.tagId);
        if (!tag) return false;
        const expires = tag.drop?.expires ?? null;
        if (expires && expires <= Date.now()) return false;
        if (g.requiresFollow || tag.followRequired) return following.includes(g.ownerId);
        return true;
      })
      .map((g) => g.tagId);
  }, [grants, tags, following, user]);

  /**
   * Persönliche SlangTags des angemeldeten Kontos (User, Creator oder
   * Unternehmen) plus Freigaben. Grundlage für Vorschläge und Namensprüfung:
   * ein SlangTag ist eine persönliche Variante, fremde Varianten sind keine
   * Auswahlquelle.
   */
  const myTags = useMemo(
    () =>
      user
        ? tags.filter(
            (t) =>
              // Gesperrte oder geloeschte SlangTags sind keine Auswahlquelle:
              // sonst landen sie im Beitrag und werden dort abgelehnt.
              isSlangTagUsable(t) &&
              (t.ownerId === user.id || t.creatorId === user.id || grantedTagIds.includes(t.id)),
          )
        : [],
    [tags, user, grantedTagIds],
  );

  const getTag = useCallback<DataCtx["getTag"]>(
    (idOrName) => {
      const key = idOrName.replace(/^\$\$?/, "").toLowerCase();
      const byName = (t: SlangTag) => t.name.toLowerCase() === key;
      // 1) Identität ist immer die konkrete SlangTag-ID.
      const byId =
        tags.find((t) => t.id === idOrName) ?? drafts.find((d) => d.tag.id === idOrName)?.tag;
      if (byId) return byId;
      // 2) Namensauflösung nur als Rückfall – eigene Variante hat Vorrang,
      //    weil derselbe Name künftig mehreren Besitzern gehören kann.
      return myTags.find(byName) ?? drafts.find((d) => byName(d.tag))?.tag ?? tags.find(byName);
    },
    [tags, drafts, myTags],
  );

  const searchTags = useCallback<DataCtx["searchTags"]>(
    (q) => {
      const key = q
        .replace(/^\$\$?/, "")
        .trim()
        .toLowerCase();
      if (!key) return [...myTags].sort((a, b) => b.stats.uses - a.stats.uses).slice(0, 8);
      return myTags
        .filter(
          (t) =>
            t.name.toLowerCase().includes(key) ||
            t.region.toLowerCase().includes(key) ||
            t.language.toLowerCase().includes(key) ||
            t.creator.toLowerCase().includes(key) ||
            t.transcript.toLowerCase().includes(key),
        )
        .slice(0, 12);
    },
    [myTags],
  );

  const sortedTags = useCallback<DataCtx["sortedTags"]>(
    (key, filter) => {
      const list = filter ? tags.filter(filter) : [...tags];
      const cmp: Record<SortKey, (a: SlangTag, b: SlangTag) => number> = {
        newest: (a, b) => b.createdAt - a.createdAt,
        uses: (a, b) => b.stats.uses - a.stats.uses,
        likes: (a, b) => b.stats.likes - a.stats.likes,
        plays: (a, b) => b.stats.plays - a.stats.plays,
      };
      return [...list].sort(cmp[key]);
    },
    [tags],
  );

  const createTag = useCallback<DataCtx["createTag"]>(
    async (input, opts) => {
      const silent = opts?.silent === true;
      const status = opts?.onStatus;
      if (!user || !me) return null;
      const check = checkSlangTagName(input.name, myTags);
      if (!check.ok) {
        console.warn("[data] createTag rejected", check.error);
        return null;
      }
      const kind: SlangTagKind = input.kind ?? "community";
      // Creator-/Unternehmer-SlangTags nur fuer berechtigte Konten.
      if (kind === "creator" && !canCreateBusinessTag) return null;

      // Community 5 Sekunden, Creator-/Unternehmer-SlangTags 10 Sekunden.
      const maxSeconds = slangTagMaxSeconds(kind, canUseExtendedAudio);
      const durationSeconds = Number(
        String(input.duration ?? "0:02")
          .split(":")
          .pop(),
      );
      if (Number.isFinite(durationSeconds) && durationSeconds > maxSeconds) {
        const msg = `SlangTags dieses Typs duerfen maximal ${maxSeconds} Sekunden lang sein.`;
        if (silent) status?.({ phase: "error", detail: msg });
        else toast.error(msg);
        return null;
      }

      status?.({ phase: "upload" });
      const audioPath = await uploadDataUrl(user.id, input.audioDataUrl, "audio");
      const { data, error } = await supabase
        .from("slang_tags")
        .insert({
          name: check.value,
          audio_url: audioPath,
          duration: input.duration ?? "0:02",
          creator_id: user.id,
          owner_id: user.id,
          kind,
          owner_type: kind === "creator" ? (input.ownerType ?? "creator") : "user",
          company: input.company ?? "",
          sponsored: input.ownerType === "company" ? Boolean(input.sponsored) : false,
          logo_url: input.logoUrl ?? null,
          description: input.description ?? "",
          cta_type: input.ctaType ?? null,
          cta_url: input.ctaUrl ?? null,
          discount_code: input.discountCode ?? "",
          voucher: input.voucher ?? "",
          location: input.location ?? "",
          opening_hours: input.openingHours ?? "",
          phone: input.phone ?? "",
          company_url: input.companyUrl ?? "",
          region: input.region,
          language: input.language ?? me.language,
          meaning: input.meaning ?? "",
        } as never)
        .select(SLANG_TAG_COLUMNS)
        .maybeSingle();
      if (error || !data) {
        console.error("[data] createTag failed", error?.code ?? "", error?.message);
        // Rollback: bereits hochgeladenes Audio wieder entfernen.
        await removeUploads([audioPath]);
        if (silent) status?.({ phase: "error", detail: error?.message ?? undefined });
        else
          toast.error(
            error?.message
              ? `${tRef.current.tagSaveFailed} ${error.message}`
              : tRef.current.tagSaveFailed,
          );
        return null;
      }

      // Audio-Moderation: Speech-to-Text, KI-Inhaltspruefung und Musikerkennung.
      // Nur freigegebene SlangTags werden veroeffentlicht.
      const tagId = (data as Row).id as string;
      let published = true;
      status?.({ phase: "moderation" });
      try {
        const result = await moderateNewSlangTag({ data: { tagId } });
        published = result.status === "approved";
        if (!published) {
          const localized =
            result.status === "blocked"
              ? result.isMusic
                ? tRef.current.tagBlockedMusic
                : tRef.current.tagBlockedGuidelines
              : tRef.current.tagInModeration;
          if (silent) status?.({ phase: "rejected", detail: localized });
          else toast.error(localized);
        }
      } catch (e) {
        console.error("[data] moderation failed", e);
        published = false;
        if (silent) status?.({ phase: "rejected" });
        else toast.error(tRef.current.tagInModeration);
      }
      if (!published) return null;
      status?.({ phase: "success" });

      const urls = await signPaths([audioPath]);
      const tag = mapTag(data as Row, urls, profiles);
      setTags((prev) => [tag, ...prev]);
      return tag;
    },
    [user, me, canCreateBusinessTag, canUseExtendedAudio, profiles, myTags],
  );

  // ---------- Temporaere SlangTags (Beitrags-Entwurf) ----------
  const isDraftTag = useCallback<DataCtx["isDraftTag"]>((id) => id.startsWith("draft_"), []);

  /**
   * Neuer SlangTag im Composer: bleibt zunaechst rein lokal. Es wird nichts
   * hochgeladen und nichts gespeichert – erst `commitDraftTags` macht ihn
   * dauerhaft (beim Veroeffentlichen des Beitrags).
   */
  const addDraftTag = useCallback<DataCtx["addDraftTag"]>(
    (input) => {
      if (!user || !me) return null;
      const check = checkSlangTagName(input.name, [...myTags, ...drafts.map((d) => d.tag)]);
      if (!check.ok) {
        console.warn("[data] addDraftTag rejected", check.error);
        return null;
      }
      const kind: SlangTagKind = input.kind ?? "community";
      // Creator-/Unternehmer-SlangTags nur fuer berechtigte Konten.
      if (kind === "creator" && !canCreateBusinessTag) return null;

      // Community 5 Sekunden, Creator-/Unternehmer-SlangTags 10 Sekunden.
      const maxSeconds = slangTagMaxSeconds(kind, canUseExtendedAudio);
      const durationSeconds = Number(
        String(input.duration ?? "0:02")
          .split(":")
          .pop(),
      );
      if (Number.isFinite(durationSeconds) && durationSeconds > maxSeconds) {
        toast.error(`SlangTags dieses Typs duerfen maximal ${maxSeconds} Sekunden lang sein.`);
        return null;
      }

      const now = new Date().toISOString();
      const row: Row = {
        id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: check.value,
        audio_url: null,
        duration: input.duration ?? "0:02",
        creator_id: user.id,
        owner_id: user.id,
        kind,
        owner_type: kind === "creator" ? (input.ownerType ?? "creator") : "user",
        company: input.company ?? "",
        region: input.region,
        language: input.language ?? me.language,
        meaning: input.meaning ?? "",
        created_at: now,
        released_at: now,
      };
      const tag: SlangTag = { ...mapTag(row, {}, profiles), audio: input.audioDataUrl };
      setDrafts((prev) => [...prev, { tag, input: { ...input, name: check.value } }]);
      return tag;
    },
    [user, me, canCreateBusinessTag, canUseExtendedAudio, profiles, myTags, drafts],
  );

  const discardDraftTags = useCallback<DataCtx["discardDraftTags"]>((ids) => {
    setDrafts((prev) => (ids ? prev.filter((d) => !ids.includes(d.tag.id)) : []));
  }, []);

  /**
   * Speichert die im Beitrag verwendeten Entwuerfe dauerhaft und liefert die
   * Zuordnung Entwurfs-ID → echte ID. Bei einem Fehler wird `null` geliefert;
   * der Entwurf bleibt dann erhalten, damit nichts verloren geht.
   */
  const commitDraftTags = useCallback<DataCtx["commitDraftTags"]>(
    async (ids, opts) => {
      const map: Record<string, string> = {};
      const committed: string[] = [];
      for (const id of ids) {
        const draft = drafts.find((d) => d.tag.id === id);
        if (!draft) continue;
        const saved = await createTag(draft.input, opts);
        if (!saved) return null;
        map[id] = saved.id;
        committed.push(id);
      }
      if (committed.length > 0) discardDraftTags(committed);
      return map;
    },
    [drafts, createTag, discardDraftTags],
  );

  // ---------- Folgen / Freischaltung ----------
  const isFollowing = useCallback<DataCtx["isFollowing"]>(
    (userId) => following.includes(userId),
    [following],
  );

  /**
   * Persönliche SlangTag-Architektur: für eigene neue Beiträge sind nur die
   * eigenen Varianten und ausdrückliche Freigaben nutzbar. Fremde Varianten
   * bleiben in veröffentlichten Beiträgen abspielbar, aber nicht auswählbar.
   */
  const canUseTag = useCallback<DataCtx["canUseTag"]>(
    (tag) => {
      if (!user) return false;
      return tag.ownerId === user.id || tag.creatorId === user.id || grantedTagIds.includes(tag.id);
    },
    [user, grantedTagIds],
  );

  const isTagLocked = useCallback<DataCtx["isTagLocked"]>((tag) => !canUseTag(tag), [canUseTag]);

  const follow = useCallback<DataCtx["follow"]>(
    async (userId) => {
      if (!user || userId === user.id || following.includes(userId)) return true;
      setFollowing((prev) => [...prev, userId]);
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: userId } as never);
      if (error && error.code !== "23505") {
        setFollowing((prev) => prev.filter((i) => i !== userId));
        console.error("[data] follow failed", error.message);
        return false;
      }
      return true;
    },
    [user, following],
  );

  const unfollow = useCallback<DataCtx["unfollow"]>(
    async (userId) => {
      if (!user) return false;
      setFollowing((prev) => prev.filter((i) => i !== userId));
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);
      if (error) {
        setFollowing((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
        return false;
      }
      return true;
    },
    [user],
  );

  // ---------- Beiträge ----------
  /**
   * Beitrag anlegen. Der Eintrag entsteht ausschließlich serverseitig und wird
   * sofort gespeichert – der Beitrag erscheint unmittelbar im Feed und im
   * Profil. Die KI-Moderation läuft danach entkoppelt im Hintergrund.
   */
  const createPost = useCallback<DataCtx["createPost"]>(
    async (input) => {
      console.info("[post] post_create_started");
      if (!user) {
        console.warn("[post] post_validation_failed no_session");
        toast.error(tRef.current.publishFailed);
        return false;
      }
      // Veröffentlichte Version mit eingebrannter Verpixelung + privates Original.
      console.info("[post] post_media_upload_started");
      let imagePath: string | null = null;
      let originalPath: string | null = null;
      // Video-Beitrag V1: das Video liegt bereits geprüft im Speicher.
      const videoKind: "shot" | "post" = input.videoPath ? "post" : "shot";
      let videoPath: string | null = input.videoPath ?? null;
      try {
        const up = await uploadPostImage(user.id, input.imageDataUrl, input.placements);
        imagePath = up.imagePath;
        originalPath = up.originalPath;
        // SlangTag Video (Short): stumme Bildspur separat speichern.
        if (videoKind === "shot")
          videoPath = await uploadShortVideo(user.id, input.videoBlob ?? null);
      } catch (err) {
        console.error("[post] post_media_upload_error", (err as Error).message);
        await removeUploads([imagePath, originalPath]);
        toast.error(tRef.current.publishFailed);
        return false;
      }
      if (input.videoBlob && !videoPath) {
        console.error("[post] post_media_upload_error video_missing");
        await removeUploads([imagePath, originalPath]);
        toast.error(tRef.current.publishFailed);
        return false;
      }
      console.info("[post] post_media_upload_success");
      let result: Awaited<ReturnType<typeof createModeratedPost>>;
      try {
        result = await createModeratedPost({
          data: {
            title: input.title,
            description: input.description,
            region: input.region,
            hashtags: input.hashtags,
            channelId: input.channelId ?? null,
            imagePath,
            originalImagePath: originalPath,
            audioPath: input.audioPath,
            duration: input.duration,
            placements: input.placements as never,
            slangTagIds: input.slangTagIds,
            slangtagOrderLocked: input.slangtagOrderLocked ?? true,
            visibility: input.visibility ?? "public",
            videoPath,
            videoKind,
            videoDurationMs: input.videoDurationMs ?? null,
          },
        });
      } catch (err) {
        console.error("[post] post_insert_error", (err as Error).message);
        await removeUploads([imagePath, originalPath, videoPath]);
        toast.error(tRef.current.modFailed);
        return false;
      }
      if (result.ok) console.info("[post] post_insert_success");

      if (!result.ok || !result.post) {
        if (result.decision === "block") await removeUploads([imagePath, originalPath, videoPath]);
        toast.error(
          result.decision === "block"
            ? tRef.current.modBlocked
            : result.decision === "review"
              ? tRef.current.modReview
              : tRef.current.modFailed,
        );
        return false;
      }

      // Verpixelte Teilen-Vorschau erzeugen (gleiche Verpixelungslogik wie der Beitrag).
      await ensureSharePreview(imagePath, input.placements, input.imageDataUrl);

      const urls = await signPaths([
        imagePath,
        variantPath(imagePath, "thumb"),
        variantPath(imagePath, "medium"),
        input.placements.length ? sharePreviewPath(imagePath) : null,
        input.audioPath,
        videoPath,
      ]);
      setPosts((prev) => [mapPost(result.post as Row, urls, profiles), ...prev]);
      // KI-Prüfung im Hintergrund anstoßen (nicht blockierend).
      kickModerationWorker();
      scheduleRefresh();
      return true;
    },
    [user, profiles, scheduleRefresh],
  );

  /**
   * Eigenen Beitrag bearbeiten. Änderungen werden sofort übernommen; die
   * Prüfung erfolgt anschließend im Hintergrund. Ursprünglicher Hinweis:
   * damit ein bereits veröffentlichter Beitrag nicht nachträglich in einen
   * regelwidrigen Inhalt umgewandelt werden kann.
   */
  const updatePost = useCallback<DataCtx["updatePost"]>(
    async (postId, input) => {
      if (!user) return false;
      let imagePath: string | null | undefined;
      let originalPath: string | null = null;
      if (input.imageDataUrl !== undefined) {
        const up = await uploadPostImage(user.id, input.imageDataUrl, input.placements ?? []);
        imagePath = up.imagePath;
        originalPath = up.originalPath;
      }

      let result: Awaited<ReturnType<typeof updateModeratedPost>>;
      try {
        result = await updateModeratedPost({
          data: {
            postId,
            title: input.title,
            description: input.description,
            region: input.region,
            hashtags: input.hashtags,
            imagePath,
            originalImagePath: imagePath === undefined ? undefined : originalPath,
            placements: input.placements as never,
            slangTagIds: input.slangTagIds,
            slangtagOrderLocked: input.slangtagOrderLocked,
            visibility: input.visibility,
          },
        });
      } catch (err) {
        console.error("[data] updatePost failed", (err as Error).message);
        if (imagePath) await removeUploads([imagePath, originalPath]);
        toast.error(tRef.current.modFailed);
        return false;
      }

      if (!result.ok || !result.post) {
        if (result.decision === "block" && imagePath)
          await removeUploads([imagePath, originalPath]);
        toast.error(
          result.decision === "block"
            ? tRef.current.modBlocked
            : result.decision === "review"
              ? tRef.current.modReview
              : tRef.current.modFailed,
        );
        return false;
      }

      const row = result.post as Row;
      const imgPath = row.image_url as string | null;
      // Teilen-Vorschau nachziehen: SlangTags können nachträglich gesetzt werden.
      await ensureSharePreview(
        imgPath,
        (input.placements ?? asArray<SlangTagPlacement>(row.placements)) as SlangTagPlacement[],
        input.imageDataUrl,
      );
      const urls = await signPaths([
        imgPath,
        variantPath(imgPath, "thumb"),
        variantPath(imgPath, "medium"),
        taggedSharePath(row),
        row.audio_url as string | null,
      ]);
      const mapped = mapPost(row, urls, profiles);
      setPosts((prev) => prev.map((p) => (p.id === postId ? mapped : p)));
      kickModerationWorker();
      return true;
    },
    [user, profiles],
  );

  /**
   * Beitrag löschen – Likes/Kommentare etc. hängen per FK-Cascade daran.
   * Zuerst direkt per RLS (Eigentümer). Wenn dabei keine Zeile entfernt wurde
   * (z. B. Admin bei fremdem Beitrag oder abgelaufene Session), übernimmt die
   * serverseitige Prüfung (Eigentümer oder Administrator).
   */
  const deletePost = useCallback<DataCtx["deletePost"]>(
    async (postId) => {
      if (!user) return false;

      const { data: removed, error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", user.id)
        .select("id");

      if (error || !removed || removed.length === 0) {
        if (error) console.error("[data] deletePost direct failed", error.message);
        try {
          await deleteOwnPost({ data: { postId } });
        } catch (e) {
          console.error("[data] deletePost failed", e);
          return false;
        }
      }

      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      return true;
    },
    [user],
  );

  /** Darf ich diesen SlangTag löschen? Spiegelt die Prüfung in der Datenbank. */
  const canDeleteTag = useCallback<DataCtx["canDeleteTag"]>(
    (tag) => !!user && (isAdmin || tag.creatorId === user.id || tag.ownerId === user.id),
    [user, isAdmin],
  );

  /**
   * SlangTag löschen. Die Rechteprüfung (Besitzer/Ersteller oder Admin) und das
   * Entfernen aller Verweise passieren serverseitig in `delete_slang_tag`.
   */
  const deleteTag = useCallback<DataCtx["deleteTag"]>(
    async (tagId) => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("delete_slang_tag", { _tag_id: tagId });
      if (error || data !== true) {
        console.error("[data] deleteTag failed", error?.message ?? "not allowed");
        return false;
      }
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setLikedTags((prev) => prev.filter((i) => i !== tagId));
      setSavedTags((prev) => prev.filter((i) => i !== tagId));
      setPosts((prev) =>
        prev.map((p) =>
          p.slangTagIds.includes(tagId) || p.placements.some((pl) => pl.tagId === tagId)
            ? {
                ...p,
                slangTagIds: p.slangTagIds.filter((i) => i !== tagId),
                placements: p.placements.filter((pl) => pl.tagId !== tagId),
              }
            : p,
        ),
      );
      return true;
    },
    [user],
  );

  const bumpPost = (postId: string, key: keyof Post["stats"], by: number) =>
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, stats: { ...p.stats, [key]: Math.max(0, p.stats[key] + by) } }
          : p,
      ),
    );

  const bumpTag = (tagId: string, key: keyof SlangTag["stats"], by: number) =>
    setTags((prev) =>
      prev.map((t) =>
        t.id === tagId ? { ...t, stats: { ...t.stats, [key]: Math.max(0, t.stats[key] + by) } } : t,
      ),
    );

  const togglePostLike = useCallback<DataCtx["togglePostLike"]>(
    async (postId) => {
      if (!user) return;
      const on = likedPosts.includes(postId);
      setLikedPosts((prev) => (on ? prev.filter((i) => i !== postId) : [...prev, postId]));
      bumpPost(postId, "likes", on ? -1 : 1);
      const q = on
        ? supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
        : supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      const { error } = await q;
      if (error) scheduleRefresh();
    },
    [user, likedPosts, scheduleRefresh],
  );

  const togglePostSave = useCallback<DataCtx["togglePostSave"]>(
    async (postId) => {
      if (!user) return;
      const on = savedPosts.includes(postId);
      setSavedPosts((prev) => (on ? prev.filter((i) => i !== postId) : [...prev, postId]));
      bumpPost(postId, "saves", on ? -1 : 1);
      const q = on
        ? supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", user.id)
        : supabase.from("post_saves").insert({ post_id: postId, user_id: user.id });
      const { error } = await q;
      if (error) scheduleRefresh();
    },
    [user, savedPosts, scheduleRefresh],
  );

  const sharePost = useCallback<DataCtx["sharePost"]>(
    async (postId) => {
      if (!user || sharedPosts.includes(postId)) return;
      setSharedPosts((prev) => [...prev, postId]);
      bumpPost(postId, "shares", 1);
      const { error } = await supabase
        .from("post_shares")
        .insert({ post_id: postId, user_id: user.id });
      if (error) scheduleRefresh();
    },
    [user, sharedPosts, scheduleRefresh],
  );

  /**
   * Aufrufe werden serverseitig über einen eindeutigen Schlüssel je Nutzer und
   * Beitrag gezählt. Ein zweiter Versuch in derselben Sitzung wurde bisher
   * trotzdem gesendet und lief in einen Konflikt (409). Ein Merker verhindert
   * diese wirkungslosen Anfragen – die Zählweise selbst bleibt unverändert.
   */
  const viewedRef = useRef<Set<string>>(new Set());
  const videoViewedRef = useRef<Set<string>>(new Set());

  /**
   * Sammelbecken für Aufrufe: Beiträge, die innerhalb eines kurzen Fensters
   * sichtbar werden, gehen als EIN Upsert (mehrere Zeilen) zur Datenbank.
   * Sicherheit bleibt unverändert: derselbe angemeldete Client, dieselbe
   * RLS-Regel (`user_id = auth.uid()` und `can_view_post`), dieselbe
   * Konflikt-Semantik. Kein Admin-/service_role-Pfad.
   */
  const viewQueueRef = useRef<string[]>([]);
  const viewTimerRef = useRef<number | undefined>(undefined);

  /** Einzelnen Aufruf schreiben (Fallback, wenn ein Batch abgelehnt wird). */
  const writeView = useCallback(
    async (postId: string, userId: string) => {
      const { error } = await supabase
        .from("post_views")
        .upsert(
          { post_id: postId, user_id: userId },
          { onConflict: "post_id,user_id", ignoreDuplicates: true },
        );
      if (!error) bumpPost(postId, "views", 1);
    },
    // bumpPost ist eine stabile lokale Funktion über setPosts
    [],
  );

  const flushViews = useCallback(async () => {
    if (viewTimerRef.current !== undefined) {
      window.clearTimeout(viewTimerRef.current);
      viewTimerRef.current = undefined;
    }
    const ids = viewQueueRef.current;
    viewQueueRef.current = [];
    if (!user || ids.length === 0) return;
    if (ids.length === 1) {
      await writeView(ids[0]!, user.id);
      return;
    }
    const rows = ids.map((post_id) => ({ post_id, user_id: user.id }));
    const { error } = await supabase
      .from("post_views")
      .upsert(rows, { onConflict: "post_id,user_id", ignoreDuplicates: true });
    if (!error) {
      for (const id of ids) bumpPost(id, "views", 1);
      return;
    }
    // Lehnt die Datenbank eine Zeile ab (z. B. fehlende Sichtbarkeit), scheitert
    // die gesamte Anweisung. Dann einzeln nachziehen – jede Zeile wird weiterhin
    // von derselben RLS-Regel geprüft, ungültige IDs bleiben abgelehnt.
    for (const id of ids) await writeView(id, user.id);
  }, [user, writeView]);

  const registerView = useCallback<DataCtx["registerView"]>(
    async (postId) => {
      if (!user || viewedRef.current.has(postId)) return;
      viewedRef.current.add(postId);
      viewQueueRef.current.push(postId);
      if (viewTimerRef.current === undefined) {
        viewTimerRef.current = window.setTimeout(() => {
          viewTimerRef.current = undefined;
          void flushViews();
        }, 700);
      }
    },
    [user, flushViews],
  );

  /** Beim Verlassen der Seite offene Aufrufe noch wegschreiben. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushViews();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (viewTimerRef.current !== undefined) window.clearTimeout(viewTimerRef.current);
    };
  }, [flushViews]);

  /** Videoaufruf eines SlangTag-Videos zählen (einmal pro Nutzer und Beitrag). */
  const registerVideoView = useCallback<DataCtx["registerVideoView"]>(
    async (postId) => {
      if (!user || videoViewedRef.current.has(postId)) return;
      videoViewedRef.current.add(postId);
      const { error } = await supabase
        .from("post_video_views")
        .upsert(
          { post_id: postId, user_id: user.id },
          { onConflict: "post_id,user_id", ignoreDuplicates: true },
        );
      if (!error) bumpPost(postId, "videoViews", 1);
    },
    [user],
  );

  const addComment = useCallback<DataCtx["addComment"]>(
    async (postId, body, slangTagIds = []) => {
      if (!user || !body.trim()) return;
      const { error } = await supabase.from("comments").insert({
        post_id: postId,
        user_id: user.id,
        body: body.trim(),
        slang_tag_ids: slangTagIds,
      });
      if (error) {
        console.error("[data] addComment failed", error.message);
        return;
      }
      bumpPost(postId, "comments", 1);
      await loadComments(postId);
    },
    [user, loadComments],
  );

  // ---------- SlangTag-Interaktionen ----------
  const toggleTagLike = useCallback<DataCtx["toggleTagLike"]>(
    async (tagId) => {
      if (!user) return;
      const on = likedTags.includes(tagId);
      setLikedTags((prev) => (on ? prev.filter((i) => i !== tagId) : [...prev, tagId]));
      bumpTag(tagId, "likes", on ? -1 : 1);
      const q = on
        ? supabase.from("slang_tag_likes").delete().eq("tag_id", tagId).eq("user_id", user.id)
        : supabase.from("slang_tag_likes").insert({ tag_id: tagId, user_id: user.id });
      const { error } = await q;
      if (error) scheduleRefresh();
    },
    [user, likedTags, scheduleRefresh],
  );

  const toggleTagSave = useCallback<DataCtx["toggleTagSave"]>(
    async (tagId) => {
      if (!user) return;
      const on = savedTags.includes(tagId);
      setSavedTags((prev) => (on ? prev.filter((i) => i !== tagId) : [...prev, tagId]));
      bumpTag(tagId, "saves", on ? -1 : 1);
      const q = on
        ? supabase.from("slang_tag_saves").delete().eq("tag_id", tagId).eq("user_id", user.id)
        : supabase.from("slang_tag_saves").insert({ tag_id: tagId, user_id: user.id });
      const { error } = await q;
      if (error) scheduleRefresh();
    },
    [user, savedTags, scheduleRefresh],
  );

  const shareTag = useCallback<DataCtx["shareTag"]>(
    async (tagId) => {
      if (!user) return;
      const { error } = await supabase
        .from("slang_tag_shares")
        .insert({ tag_id: tagId, user_id: user.id });
      if (!error) bumpTag(tagId, "shares", 1);
    },
    [user],
  );

  /** Wiedergabe zählen – pro Tag höchstens alle 30 Sekunden. */
  const registerPlay = useCallback<DataCtx["registerPlay"]>(
    async (tagId) => {
      if (!user) return;
      const now = Date.now();
      if ((playThrottle.current[tagId] ?? 0) > now - 30_000) return;
      playThrottle.current[tagId] = now;
      const { error } = await supabase
        .from("slang_tag_plays")
        .insert({ tag_id: tagId, user_id: user.id });
      if (!error) bumpTag(tagId, "plays", 1);
    },
    [user],
  );

  // ---------- Profil ----------
  const updateMyProfile = useCallback<DataCtx["updateMyProfile"]>(
    async (patch) => {
      if (!user) return;
      const avatarPath =
        patch.avatarDataUrl !== undefined
          ? await uploadDataUrl(user.id, patch.avatarDataUrl, "avatars")
          : undefined;
      const coverPath =
        patch.coverDataUrl !== undefined
          ? await uploadDataUrl(user.id, patch.coverDataUrl, "covers")
          : undefined;

      const update: Row = {};
      if (patch.username !== undefined) update.username = patch.username;
      // Der oeffentliche Anzeigename wird in der Datenbank aus der gewaehlten
      // Namensanzeige abgeleitet und ist daher nicht direkt beschreibbar.
      if (patch.displayNameMode !== undefined) update.display_name_mode = patch.displayNameMode;
      if (patch.bio !== undefined) update.bio = patch.bio;
      if (patch.location !== undefined) update.location = patch.location;
      if (patch.locationVisibility !== undefined)
        update.location_visibility = patch.locationVisibility;
      if (patch.profileVisibility !== undefined)
        update.profile_visibility = patch.profileVisibility;
      if (patch.presenceStatus !== undefined) update.presence_status = patch.presenceStatus;
      if (patch.language !== undefined) update.language = patch.language;
      if (patch.theme !== undefined) update.theme = patch.theme;
      if (avatarPath !== undefined) update.avatar_url = avatarPath;
      if (coverPath !== undefined) update.cover_url = coverPath;

      const { error } = await supabase
        .from("profiles")
        .update(update as never)
        .eq("id", user.id);
      if (error) {
        console.error("[data] updateProfile failed", error.message);
        throw error;
      }
      // Eigene Änderungen sofort sichtbar: Kurzzeit-Cache verwerfen.
      invalidateClientCache("profile-locations:");
      await loadAll({ force: true });
    },
    [user, loadAll],
  );

  const value = useMemo<DataCtx>(
    () => ({
      loading,
      user,
      me,
      profiles,
      ensureProfiles,
      ensureProfileDirectory,
      posts,
      loadMorePosts,
      hasMorePosts,
      loadingMorePosts,
      tags,
      myTags,
      likedPosts,
      savedPosts,
      sharedPosts,
      likedTags,
      savedTags,
      commentsByPost,
      refresh: () => loadAll({ force: true }),
      newPostsCount,
      checkNewPosts,
      applyNewPosts,
      freshPostIds,

      getTag,
      searchTags,
      sortedTags,
      createTag,
      addDraftTag,
      draftTags: drafts.map((d) => d.tag),
      isDraftTag,
      commitDraftTags,
      discardDraftTags,
      createPost,
      updatePost,
      deletePost,
      isAdmin,
      isModerator,
      isCreator,
      isBusiness,
      isCreatorAccount,
      canCreateBusinessTag,
      canUseExtendedAudio,
      canDeleteTag,
      deleteTag,
      following,
      isFollowing,
      follow,
      unfollow,
      canUseTag,
      isTagLocked,

      updateMyProfile,
      togglePostLike,
      togglePostSave,
      sharePost,
      registerView,
      registerVideoView,
      loadComments,
      syncPost,
      addComment,
      toggleTagLike,
      toggleTagSave,
      shareTag,
      registerPlay,
    }),
    [
      loading,
      user,
      me,
      profiles,
      ensureProfiles,
      ensureProfileDirectory,
      posts,
      loadMorePosts,
      hasMorePosts,
      loadingMorePosts,
      tags,
      myTags,
      likedPosts,
      savedPosts,
      sharedPosts,
      likedTags,
      savedTags,
      commentsByPost,
      loadAll,
      newPostsCount,
      checkNewPosts,
      applyNewPosts,
      freshPostIds,

      getTag,
      searchTags,
      sortedTags,
      createTag,
      addDraftTag,
      drafts,
      isDraftTag,
      commitDraftTags,
      discardDraftTags,
      createPost,
      updatePost,
      deletePost,
      isAdmin,
      isModerator,
      isCreator,
      isBusiness,
      isCreatorAccount,
      canCreateBusinessTag,
      canUseExtendedAudio,
      canDeleteTag,
      deleteTag,
      following,
      isFollowing,
      follow,
      unfollow,
      canUseTag,
      isTagLocked,

      updateMyProfile,
      togglePostLike,
      togglePostSave,
      sharePost,
      registerView,
      registerVideoView,
      loadComments,
      syncPost,
      addComment,
      toggleTagLike,
      toggleTagSave,
      shareTag,
      registerPlay,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
