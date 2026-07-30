import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Profile = {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  language: string;
  avatar: string | null;
  cover: string | null;
  verified: boolean;
  stats: { slangtags: number; followers: number; following: number; likes: number };
  level: number;
  xp: number;
  xpNext: number;
  collected: number;
  collectedGoal: number;
};

export type UserPost = {
  id: string;
  title: string;
  description: string;
  region: string;
  hashtags: string[];
  image: string | null;
  audio: string | null;
  duration: string;
  createdAt: number;
  likes: number;
  comments: number;
  shares: number;
};

const DEFAULT_PROFILE: Profile = {
  displayName: "Mario Jorde",
  username: "mariojorde",
  bio: "Slang ist mehr als Worte. Es ist ein Vibe.",
  location: "Berlin, Germany",
  language: "Deutsch",
  avatar: null,
  cover: null,
  verified: true,
  stats: { slangtags: 128, followers: 2400, following: 320, likes: 5600 },
  level: 12,
  xp: 2450,
  xpNext: 3500,
  collected: 48,
  collectedGoal: 100,
};

const STORAGE_KEY = "ydude.profile.v1";
const POSTS_KEY = "ydude.posts.v1";

type Ctx = {
  profile: Profile;
  updateProfile: (patch: Partial<Profile>) => void;
  posts: UserPost[];
  addPost: (post: Omit<UserPost, "id" | "createdAt" | "likes" | "comments" | "shares">) => void;
};

const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [posts, setPosts] = useState<UserPost[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile((p) => ({ ...p, ...JSON.parse(raw) }));
      const rawPosts = localStorage.getItem(POSTS_KEY);
      if (rawPosts) setPosts(JSON.parse(rawPosts));
    } catch {
      /* ignore */
    }
  }, []);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  const addPost = useCallback<Ctx["addPost"]>((post) => {
    setPosts((prev) => {
      const next = [
        { ...post, id: `p${Date.now()}`, createdAt: Date.now(), likes: 0, comments: 0, shares: 0 },
        ...prev,
      ].slice(0, 20);
      try {
        localStorage.setItem(POSTS_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
    setProfile((prev) => {
      const next = { ...prev, stats: { ...prev.stats, slangtags: prev.stats.slangtags + 1 }, xp: prev.xp + 50 };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ profile, updateProfile, posts, addPost }), [profile, updateProfile, posts, addPost]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

export function formatCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}
