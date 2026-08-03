import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { DataContext, type CreateTagInput, type DataCtx } from "@/lib/data-context";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { moderateNewSlangTag } from "@/lib/moderation.functions";
import { removeUploads, signPaths, uploadDataUrl, variantPath } from "@/lib/media";
import { checkSlangTagName } from "@/lib/slangtag-rules";
import type {
  Post,
  PostVisibility,
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
  "id,name,audio_url,duration,creator_id,region,language,meaning,examples,plays_count,likes_count,uses_count,shares_count,saves_count,comments_count,created_at,updated_at,kind,owner_id,owner_type,company,verification_status,unlock_type,follow_required,released_at,drop_release_date,drop_limit,drop_expires,drop_rarity,deleted_at,sponsored,logo_url,description,cta_type,cta_url,clicks_count,conversion_count,reach_count,transcript";

// Der Standort ist auf DB-Ebene nicht breit lesbar und kommt ueber profile_locations.
const PROFILE_COLUMNS =
  "id,username,display_name,bio,location_visibility,language,avatar_url,cover_url,verified,level,xp,created_at,updated_at,last_seen_at,is_test_bot";

async function withProfileLocations(rows: Row[]): Promise<Row[]> {
  if (rows.length === 0) return rows;
  const { data, error } = await supabase.rpc("profile_locations", {
    _ids: rows.map((r) => r.id as string),
  });
  if (error) {
    console.error("[data] profile locations failed", error.message);
    return rows;
  }
  const map = new Map<string, string>();
  ((data ?? []) as Row[]).forEach((r) =>
    map.set(r.user_id as string, (r.location as string) ?? ""),
  );
  return rows.map((r) => ({ ...r, location: map.get(r.id as string) ?? "" }));
}

async function withBusinessInfo(rows: Row[]): Promise<Row[]> {
  const ids = rows.filter((r) => r.owner_type === "company").map((r) => r.id as string);
  if (ids.length === 0) return rows;
  const { data, error } = await supabase.rpc("slang_tag_business_info", { _tag_ids: ids });
  if (error) {
    console.error("[data] business info failed", error.message);
    return rows;
  }
  const map = new Map<string, Row>();
  ((data ?? []) as Row[]).forEach((r) => map.set(r.tag_id as string, r));
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
    location: (row.location as string) ?? "",
    locationVisibility: ((row.location_visibility as string) ??
      "public") as Profile["locationVisibility"],
    language: (row.language as string) ?? "Deutsch",
    avatarPath,
    avatar: avatarPath ? (urls[avatarPath] ?? null) : null,
    coverPath,
    cover: coverPath ? (urls[coverPath] ?? null) : null,
    verified: Boolean(row.verified),
    level: (row.level as number) ?? 1,
    xp: (row.xp as number) ?? 0,
    isTestBot: Boolean(row.is_test_bot),
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
    ownerId,
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

function mapPost(row: Row, urls: Record<string, string>, profiles: Record<string, Profile>): Post {
  const imagePath = (row.image_url as string | null) ?? null;
  const audioPath = (row.audio_url as string | null) ?? null;
  const author = profiles[row.user_id as string];
  return {
    id: row.id as string,
    userId: row.user_id as string,
    author: {
      id: row.user_id as string,
      username: author?.username ?? "unbekannt",
      displayName: author?.displayName ?? "Unbekannt",
      avatar: author?.avatar ?? null,
      verified: author?.verified ?? false,
      isTestBot: author?.isTestBot ?? false,
    },
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    region: (row.region as string) ?? "",
    hashtags: asArray<string>(row.hashtags),
    image: imagePath ? (urls[imagePath] ?? null) : null,
    imageThumb: imagePath ? (urls[variantPath(imagePath, "thumb") ?? ""] ?? null) : null,
    imageMedium: imagePath ? (urls[variantPath(imagePath, "medium") ?? ""] ?? null) : null,
    audio: audioPath ? (urls[audioPath] ?? null) : null,
    duration: (row.duration as string) ?? "0:02",
    placements: asArray<SlangTagPlacement>(row.placements),
    slangTagIds: asArray<string>(row.slang_tag_ids),
    visibility: ((row.visibility as string) ?? "public") as PostVisibility,
    stats: {
      likes: (row.likes_count as number) ?? 0,
      comments: (row.comments_count as number) ?? 0,
      shares: (row.shares_count as number) ?? 0,
      views: (row.views_count as number) ?? 0,
      saves: (row.saves_count as number) ?? 0,
    },
    createdAt: new Date(row.created_at as string).getTime(),
  };
}

export type CreatePostInput = {
  title: string;
  description: string;
  region: string;
  hashtags: string[];
  imageDataUrl: string | null;
  audioPath: string | null;
  duration: string;
  placements: SlangTagPlacement[];
  slangTagIds: string[];
  visibility?: PostVisibility;
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
  visibility?: PostVisibility;
};

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [posts, setPosts] = useState<Post[]>([]);
  const [tags, setTags] = useState<SlangTag[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [sharedPosts, setSharedPosts] = useState<string[]>([]);
  const [likedTags, setLikedTags] = useState<string[]>([]);
  const [savedTags, setSavedTags] = useState<string[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
  const [following, setFollowing] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  // Temporaere SlangTags eines Beitrags-Entwurfs: nur lokal, kein Upload,
  // kein Datenbankeintrag. Werden erst beim Veroeffentlichen dauerhaft.
  const [drafts, setDrafts] = useState<{ tag: SlangTag; input: CreateTagInput }[]>([]);
  const userIdRef = useRef<string | null>(null);
  const playThrottle = useRef<Record<string, number>>({});
  /** Merkt sich einen bewussten Logout, damit laufende Ladevorgaenge verstummen. */
  const signedOutRef = useRef(false);

  /** Setzt alle nutzerbezogenen Daten zurueck (Logout = normaler Zustand). */
  const resetUserData = useCallback(() => {
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
    setLoading(false);
  }, []);



  const me = user ? (profiles[user.id] ?? null) : null;

  /** Legt beim ersten Login automatisch ein Profil an. */
  const ensureProfile = useCallback(async (u: User) => {
    const { data } = await supabase.from("profiles").select("id").eq("id", u.id).maybeSingle();
    if (data) return;
    const base =
      (u.email?.split("@")[0] ?? "dude").replace(/[^a-z0-9._-]/gi, "").toLowerCase() || "dude";
    let username = base;
    for (let i = 0; i < 5; i += 1) {
      const { error } = await supabase.from("profiles").insert({
        id: u.id,
        username,
        display_name: base,
      });
      if (!error) return;
      if (error.code !== "23505") {
        console.error("[data] profile create failed", error.message);
        return;
      }
      username = `${base}${Math.floor(Math.random() * 9999)}`;
    }
  }, []);

  const loadAll = useCallback(async () => {
    const uid = userIdRef.current;
    // Nach dem Abmelden gibt es keine Sitzung mehr: dann wird nichts geladen
    // und "keine Daten" ist der normale Zustand, kein Fehler.
    if (!uid) {
      signedOutRef.current = true;
      resetUserData();
      return;
    }
    signedOutRef.current = false;
    const [profRes, tagRes, postRes, botRes] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS),
      supabase
        .from("slang_tags")
        .select(SLANG_TAG_COLUMNS)
        .order("created_at", { ascending: false }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.rpc("test_bots_visible"),
    ]);

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
    const profFailed = check("Profile", profRes.error);
    const tagFailed = check("SlangTags", tagRes.error);
    const postFailed = check("Beitraege", postRes.error);
    check("Einstellungen", botRes.error);
    if (failures.length > 0) {
      toast.error(`Daten konnten nicht geladen werden: ${failures.join(", ")}.`);
    }

    // Testbots und ihre Inhalte existieren nur im Entwicklungsmodus:
    // ist der Hauptschalter aus, werden sie überall ausgeblendet.
    const botsVisible = botRes.data === true;
    const allProfRows = (profRes.data ?? []) as Row[];
    const botIds = new Set(
      allProfRows.filter((p) => Boolean(p.is_test_bot)).map((p) => p.id as string),
    );
    const hidden = (id: unknown) => !botsVisible && botIds.has(id as string);

    const profRows = await withProfileLocations(allProfRows.filter((p) => !hidden(p.id)));
    const tagRows = await withBusinessInfo(
      ((tagRes.data ?? []) as Row[]).filter((t) => !hidden(t.creator_id)),
    );
    const postRows = ((postRes.data ?? []) as Row[]).filter((p) => !hidden(p.user_id));

    const urls = await signPaths([
      ...profRows.flatMap((p) => [p.avatar_url as string | null, p.cover_url as string | null]),
      ...tagRows.map((t) => t.audio_url as string | null),
      ...postRows.flatMap((p) => [
        p.image_url as string | null,
        variantPath(p.image_url as string | null, "thumb"),
        variantPath(p.image_url as string | null, "medium"),
        p.audio_url as string | null,
      ]),
    ]);

    const profileMap: Record<string, Profile> = {};
    profRows.forEach((r) => {
      const p = mapProfile(r, urls);
      profileMap[p.id] = p;
    });

    // Bei einem Fehler bleibt der letzte gute Stand erhalten statt geleert zu werden.
    if (!profFailed) setProfiles(profileMap);
    if (!tagFailed) setTags(tagRows.map((r) => mapTag(r, urls, profileMap)));
    if (!postFailed) setPosts(postRows.map((r) => mapPost(r, urls, profileMap)));

    if (uid) {
      const [pl, ps, psh, tl, tsv, fl, roles] = await Promise.all([
        supabase.from("post_likes").select("post_id").eq("user_id", uid),
        supabase.from("post_saves").select("post_id").eq("user_id", uid),
        supabase.from("post_shares").select("post_id").eq("user_id", uid),
        supabase.from("slang_tag_likes").select("tag_id").eq("user_id", uid),
        supabase.from("slang_tag_saves").select("tag_id").eq("user_id", uid),
        supabase.from("follows").select("following_id").eq("follower_id", uid),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      setLikedPosts((pl.data ?? []).map((r) => r.post_id as string));
      setSavedPosts((ps.data ?? []).map((r) => r.post_id as string));
      setSharedPosts((psh.data ?? []).map((r) => r.post_id as string));
      setLikedTags((tl.data ?? []).map((r) => r.tag_id as string));
      setSavedTags((tsv.data ?? []).map((r) => r.tag_id as string));
      setFollowing(((fl.data ?? []) as Row[]).map((r) => r.following_id as string));
      setIsAdmin(((roles.data ?? []) as Row[]).some((r) => r.role === "admin"));
    } else {
      setIsAdmin(false);
    }
  }, []);

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
      await loadAll();
      if (!cancelled) setLoading(false);
    };
    void init();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      const u = session?.user ?? null;
      setUser(u);
      userIdRef.current = u?.id ?? null;
      void loadAll();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [ensureProfile, loadAll]);

  // Realtime: Beiträge, Kommentare und SlangTags sofort synchronisieren
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void loadAll(), 350);
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

  useEffect(() => {
    const channel = supabase
      .channel("ydude-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleRefresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slang_tags" },
        scheduleRefresh,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload) => {
        const rec = (payload.new ?? payload.old) as Row | undefined;
        const postId = rec?.post_id as string | undefined;
        if (postId) void loadComments(postId);
        scheduleRefresh();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, loadComments]);

  // ---------- SlangTags ----------
  const getTag = useCallback<DataCtx["getTag"]>(
    (idOrName) => {
      const key = idOrName.replace(/^\$\$?/, "").toLowerCase();
      const match = (t: SlangTag) => t.id === idOrName || t.name.toLowerCase() === key;
      // Entwuerfe des aktuellen Beitrags sind ebenfalls auffindbar,
      // damit Vorschau, Canvas und Chips sie darstellen koennen.
      return tags.find(match) ?? drafts.find((d) => match(d.tag))?.tag;
    },
    [tags, drafts],
  );

  const searchTags = useCallback<DataCtx["searchTags"]>(
    (q) => {
      const key = q
        .replace(/^\$\$?/, "")
        .trim()
        .toLowerCase();
      if (!key) return [...tags].sort((a, b) => b.stats.uses - a.stats.uses).slice(0, 8);
      return tags
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
    [tags],
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
      const check = checkSlangTagName(input.name, tags);
      if (!check.ok) {
        console.warn("[data] createTag rejected", check.error);
        return null;
      }
      const kind: SlangTagKind = input.kind ?? "community";
      // Unternehmer-/Creator-SlangTags: nur verifizierte Konten oder Admins.
      if (kind === "creator" && !me.verified && !isAdmin) return null;

      // Laenge nach Kontotyp: Community 5 Sekunden,
      // verifizierte Unternehmer/Creator und Admins 10 Sekunden.
      const maxSeconds = isAdmin || me.verified ? 10 : 5;
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
              ? `SlangTag konnte nicht gespeichert werden: ${error.message}`
              : "SlangTag konnte nicht gespeichert werden.",
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
          if (silent) status?.({ phase: "rejected", detail: result.message });
          else toast.error(result.message);
        }
      } catch (e) {
        console.error("[data] moderation failed", e);
        published = false;
        if (silent) status?.({ phase: "rejected" });
        else toast.error("Dieser SlangTag wird von unserer Moderation geprueft.");
      }
      if (!published) return null;
      status?.({ phase: "success" });

      const urls = await signPaths([audioPath]);
      const tag = mapTag(data as Row, urls, profiles);
      setTags((prev) => [tag, ...prev]);
      return tag;
    },
    [user, me, isAdmin, profiles, tags],
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
      const check = checkSlangTagName(input.name, [...tags, ...drafts.map((d) => d.tag)]);
      if (!check.ok) {
        console.warn("[data] addDraftTag rejected", check.error);
        return null;
      }
      const kind: SlangTagKind = input.kind ?? "community";
      if (kind === "creator" && !me.verified && !isAdmin) return null;

      const maxSeconds = isAdmin || me.verified ? 10 : 5;
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
    [user, me, isAdmin, profiles, tags, drafts],
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

  /** Community-Tags sind immer nutzbar, Creator-Tags erst nach dem Folgen. */
  const canUseTag = useCallback<DataCtx["canUseTag"]>(
    (tag) => {
      if (tag.kind !== "creator" || !tag.followRequired) return true;
      if (!user) return false;
      return tag.ownerId === user.id || following.includes(tag.ownerId);
    },
    [user, following],
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
  const createPost = useCallback<DataCtx["createPost"]>(
    async (input) => {
      if (!user) return false;
      const imagePath = await uploadDataUrl(user.id, input.imageDataUrl, "images");
      const { data, error } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          title: input.title,
          description: input.description,
          region: input.region,
          hashtags: input.hashtags,
          image_url: imagePath,
          audio_url: input.audioPath,
          duration: input.duration,
          placements: input.placements as unknown as never,
          slang_tag_ids: input.slangTagIds,
          visibility: input.visibility ?? "public",
        })
        .select("*")
        .maybeSingle();
      if (error || !data) {
        console.error("[data] createPost failed", error?.code ?? "", error?.message);
        // Rollback: hochgeladenes Bild samt Varianten entfernen.
        await removeUploads([imagePath]);
        return false;
      }

      const urls = await signPaths([
        imagePath,
        variantPath(imagePath, "thumb"),
        variantPath(imagePath, "medium"),
        input.audioPath,
      ]);
      setPosts((prev) => [mapPost(data as Row, urls, profiles), ...prev]);
      scheduleRefresh();
      return true;
    },
    [user, profiles, scheduleRefresh],
  );

  /** Eigenen Beitrag bearbeiten – RLS erlaubt das nur dem Autor. */
  const updatePost = useCallback<DataCtx["updatePost"]>(
    async (postId, input) => {
      if (!user) return false;
      const update: Row = {};
      if (input.title !== undefined) update.title = input.title;
      if (input.description !== undefined) update.description = input.description;
      if (input.region !== undefined) update.region = input.region;
      if (input.hashtags !== undefined) update.hashtags = input.hashtags;
      if (input.placements !== undefined) update.placements = input.placements;
      if (input.slangTagIds !== undefined) update.slang_tag_ids = input.slangTagIds;
      if (input.visibility !== undefined) update.visibility = input.visibility;
      if (input.imageDataUrl !== undefined) {
        update.image_url = input.imageDataUrl
          ? await uploadDataUrl(user.id, input.imageDataUrl, "images")
          : null;
      }

      const { data, error } = await supabase
        .from("posts")
        .update(update as never)
        .eq("id", postId)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();
      if (error || !data) {
        console.error("[data] updatePost failed", error?.message);
        return false;
      }
      const row = data as Row;
      const imgPath = row.image_url as string | null;
      const urls = await signPaths([
        imgPath,
        variantPath(imgPath, "thumb"),
        variantPath(imgPath, "medium"),
        row.audio_url as string | null,
      ]);
      const mapped = mapPost(row, urls, profiles);
      setPosts((prev) => prev.map((p) => (p.id === postId ? mapped : p)));
      return true;
    },
    [user, profiles],
  );

  /** Eigenen Beitrag löschen – Likes/Kommentare etc. hängen per FK-Cascade daran. */
  const deletePost = useCallback<DataCtx["deletePost"]>(
    async (postId) => {
      if (!user) return false;
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("user_id", user.id);
      if (error) {
        console.error("[data] deletePost failed", error.message);
        return false;
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

  /** Unternehmer-SlangTags ($$) dürfen Admins sowie verifizierte Konten anlegen. */
  const canCreateBusinessTag = isAdmin || Boolean(me?.verified);

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

  const registerView = useCallback<DataCtx["registerView"]>(
    async (postId) => {
      if (!user) return;
      const { error } = await supabase
        .from("post_views")
        .insert({ post_id: postId, user_id: user.id });
      if (!error) bumpPost(postId, "views", 1);
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
      if (patch.displayName !== undefined) update.display_name = patch.displayName;
      if (patch.bio !== undefined) update.bio = patch.bio;
      if (patch.location !== undefined) update.location = patch.location;
      if (patch.locationVisibility !== undefined)
        update.location_visibility = patch.locationVisibility;
      if (patch.language !== undefined) update.language = patch.language;
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
      await loadAll();
    },
    [user, loadAll],
  );

  const value = useMemo<DataCtx>(
    () => ({
      loading,
      user,
      me,
      profiles,
      posts,
      tags,
      likedPosts,
      savedPosts,
      sharedPosts,
      likedTags,
      savedTags,
      commentsByPost,
      refresh: loadAll,
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
      canCreateBusinessTag,
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
      loadComments,
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
      posts,
      tags,
      likedPosts,
      savedPosts,
      sharedPosts,
      likedTags,
      savedTags,
      commentsByPost,
      loadAll,
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
      canCreateBusinessTag,
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
      loadComments,
      addComment,
      toggleTagLike,
      toggleTagSave,
      shareTag,
      registerPlay,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
