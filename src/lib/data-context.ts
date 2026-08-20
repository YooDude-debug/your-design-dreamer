import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type {
  Post,
  PostComment,
  Profile,
  SlangTag,
  SlangTagCtaType,
  SlangTagKind,
  SlangTagOwnerType,
  SortKey,
} from "@/lib/types";
import type { CreatePostInput, UpdatePostInput } from "@/lib/data";
import type { TagCommitOptions } from "@/lib/tag-commit-status";

export type CreateTagInput = {
  name: string;
  audioDataUrl: string | null;
  duration?: string;
  region: string;
  language?: string;
  meaning?: string;
  /** Standard: Community (`$`). `creator` nur für verifizierte Profile. */
  kind?: SlangTagKind;
  ownerType?: SlangTagOwnerType;
  company?: string;
  /** Nur Unternehmens-SlangTags (`ownerType: "company"`). */
  sponsored?: boolean;
  logoUrl?: string | null;
  description?: string;
  ctaType?: SlangTagCtaType | null;
  ctaUrl?: string | null;
  discountCode?: string;
  voucher?: string;
  location?: string;
  openingHours?: string;
  phone?: string;
  companyUrl?: string;
};

export type DataCtx = {
  loading: boolean;
  user: User | null;
  me: Profile | null;
  profiles: Record<string, Profile>;
  /** Lädt fehlende Profile gezielt über ihre User-ID nach (mischt sie ein). */
  ensureProfiles: (ids: string[]) => Promise<void>;
  posts: Post[];
  tags: SlangTag[];
  likedPosts: string[];
  savedPosts: string[];
  sharedPosts: string[];
  likedTags: string[];
  savedTags: string[];
  commentsByPost: Record<string, PostComment[]>;
  refresh: () => Promise<void>;
  /** Live-Feed: Anzahl vorgeladener, noch nicht eingefügter Beiträge. */
  newPostsCount: number;
  /** Prüft auf neue Beiträge (ohne den bestehenden Feed zu verändern). */
  checkNewPosts: () => Promise<number>;
  /** Vorgeladene Beiträge in den Feed übernehmen. */
  applyNewPosts: () => void;
  /** IDs der in dieser Sitzung nachgeladenen Beiträge (bleiben oben, created_at DESC). */
  freshPostIds: string[];


  /** Persönliche SlangTags des angemeldeten Kontos (Owner oder Ersteller). */
  myTags: SlangTag[];
  getTag: (idOrName: string) => SlangTag | undefined;
  searchTags: (q: string) => SlangTag[];
  sortedTags: (key: SortKey, filter?: (t: SlangTag) => boolean) => SlangTag[];
  createTag: (input: CreateTagInput, opts?: TagCommitOptions) => Promise<SlangTag | null>;
  /**
   * Temporärer SlangTag – existiert nur lokal im aktuellen Beitrags-Entwurf.
   * Wird erst beim Veröffentlichen dauerhaft gespeichert.
   */
  addDraftTag: (input: CreateTagInput) => SlangTag | null;
  /** Lokale Entwürfe (nicht in `tags` enthalten). */
  draftTags: SlangTag[];
  isDraftTag: (id: string) => boolean;
  /** Speichert Entwürfe dauerhaft; liefert die Zuordnung Entwurfs-ID → echte ID. */
  commitDraftTags: (
    ids: string[],
    opts?: TagCommitOptions,
  ) => Promise<Record<string, string> | null>;
  /** Verwirft Entwürfe restlos (kein Upload, kein Datenbankeintrag). */
  discardDraftTags: (ids?: string[]) => void;
  createPost: (input: CreatePostInput) => Promise<boolean>;

  updatePost: (postId: string, input: UpdatePostInput) => Promise<boolean>;
  deletePost: (postId: string) => Promise<boolean>;
  /** Bin ich Administrator? (aus `user_roles`) */
  isAdmin: boolean;
  /** Bin ich Moderator? (aus `user_roles`) */
  isModerator: boolean;
  /** Habe ich den Creator-Status? (aus `user_roles`) */
  isCreator: boolean;
  /** Habe ich den Unternehmer-Status? (aus `user_roles`) */
  isBusiness: boolean;
  /**
   * Besitze ich das Badge „Creator / Unternehmer“? Grundlage für den
   * Creator-Menübereich – unabhängig von der Adminrolle.
   */
  isCreatorAccount: boolean;
  /**
   * Darf ich Creator-/Unternehmer-SlangTags (`$$`) anlegen?
   * Administratoren sowie Konten mit Creator- oder Unternehmer-Rolle.
   */
  canCreateBusinessTag: boolean;
  /**
   * Darf ich die laengere Aufnahme (10 s) fuer Creator-/Unternehmer-SlangTags
   * nutzen? Community-SlangTags bleiben immer bei 5 Sekunden.
   */
  canUseExtendedAudio: boolean;
  /** Darf ich diesen SlangTag löschen? (Besitzer/Ersteller oder Admin) */
  canDeleteTag: (tag: SlangTag) => boolean;
  deleteTag: (tagId: string) => Promise<boolean>;

  /** IDs aller Profile, denen ich folge. */
  following: string[];
  isFollowing: (userId: string) => boolean;
  follow: (userId: string) => Promise<boolean>;
  unfollow: (userId: string) => Promise<boolean>;
  /** Darf ich diesen SlangTag verwenden? */
  canUseTag: (tag: SlangTag) => boolean;
  isTagLocked: (tag: SlangTag) => boolean;

  updateMyProfile: (
    patch: Partial<Profile> & { avatarDataUrl?: string | null; coverDataUrl?: string | null },
  ) => Promise<void>;
  togglePostLike: (postId: string) => Promise<void>;
  togglePostSave: (postId: string) => Promise<void>;
  sharePost: (postId: string) => Promise<void>;
  registerView: (postId: string) => Promise<void>;
  /** Videoaufruf eines SlangTag-Videos zählen. */
  registerVideoView: (postId: string) => Promise<void>;
  loadComments: (postId: string) => Promise<void>;
  /** Einmalige Synchronisierung eines Beitrags (Detailansicht). */
  syncPost: (postId: string) => Promise<void>;
  addComment: (postId: string, body: string, slangTagIds?: string[]) => Promise<void>;
  toggleTagLike: (tagId: string) => Promise<void>;
  toggleTagSave: (tagId: string) => Promise<void>;
  shareTag: (tagId: string) => Promise<void>;
  registerPlay: (tagId: string) => Promise<void>;
};

export const DataContext = createContext<DataCtx | null>(null);

/** Zugriff auf alle App-Daten. */
export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within AppDataProvider");
  return ctx;
}
