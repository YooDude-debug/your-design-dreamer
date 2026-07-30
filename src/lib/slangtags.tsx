import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import moinAudio from "@/assets/moinmoin.m4a.asset.json";

export type SlangTagStats = {
  plays: number;
  likes: number;
  uses: number;
  shares: number;
  saves: number;
  comments: number;
};

export type SlangTag = {
  id: string;
  /** Name ohne führendes $ */
  name: string;
  audio: string | null;
  duration: string;
  creator: string;
  createdAt: number;
  region: string;
  language: string;
  meaning: string;
  examples: string[];
  stats: SlangTagStats;
};

/** Platzierung eines SlangTags auf einem Bild (Prozentwerte, damit responsiv) */
export type SlangTagPlacement = {
  id: string;
  tagId: string;
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
  scale: number; // 0.6..2
  rotation: number; // deg
  variant: "glass" | "compact" | "dot";
};

const STORAGE_KEY = "ydude.slangtags.v1";

const emptyStats = (over: Partial<SlangTagStats> = {}): SlangTagStats => ({
  plays: 0,
  likes: 0,
  uses: 0,
  shares: 0,
  saves: 0,
  comments: 0,
  ...over,
});

const SEED: SlangTag[] = [
  {
    id: "st_moin",
    name: "Moin",
    audio: moinAudio.url,
    duration: "0:02",
    creator: "rostock.hafen",
    createdAt: Date.now() - 86400000 * 12,
    region: "Rostock, Germany",
    language: "Deutsch",
    meaning: "Norddeutscher Gruß — funktioniert zu jeder Tageszeit.",
    examples: ["Moin, alles fit?", "Moin Moin – aber nicht zu viel labern."],
    stats: emptyStats({ plays: 24800, likes: 2100, uses: 412, shares: 530, saves: 890, comments: 143 }),
  },
  {
    id: "st_digga",
    name: "Digga",
    audio: moinAudio.url,
    duration: "0:01",
    creator: "berlin.vibes",
    createdAt: Date.now() - 86400000 * 8,
    region: "Berlin, Germany",
    language: "Deutsch",
    meaning: "Freundschaftliche Anrede unter Homies.",
    examples: ["Digga, was geht?", "Ey Digga, chill mal."],
    stats: emptyStats({ plays: 15200, likes: 1300, uses: 298, shares: 532, saves: 610, comments: 96 }),
  },
  {
    id: "st_servus",
    name: "Servus",
    audio: moinAudio.url,
    duration: "0:01",
    creator: "muc.local",
    createdAt: Date.now() - 86400000 * 5,
    region: "München, Germany",
    language: "Deutsch",
    meaning: "Süddeutscher Gruß zum Kommen und Gehen.",
    examples: ["Servus beinand!", "Servus, pfiat di."],
    stats: emptyStats({ plays: 9400, likes: 780, uses: 122, shares: 210, saves: 305, comments: 41 }),
  },
  {
    id: "st_ickditdit",
    name: "IckDitDit",
    audio: moinAudio.url,
    duration: "0:03",
    creator: "kiez.talk",
    createdAt: Date.now() - 86400000 * 3,
    region: "Berlin, Germany",
    language: "Deutsch",
    meaning: "Berliner Klassiker – lässige Zustimmung.",
    examples: ["Ick dit dit, wa?"],
    stats: emptyStats({ plays: 12400, likes: 940, uses: 87, shares: 130, saves: 220, comments: 58 }),
  },
  {
    id: "st_refile",
    name: "ReFile",
    audio: moinAudio.url,
    duration: "0:02",
    creator: "taverna.express",
    createdAt: Date.now() - 86400000 * 2,
    region: "Athens, Greece",
    language: "Ελληνικά",
    meaning: "Re file (Ρε φίλε) – Hey Alter / echt jetzt.",
    examples: ["Ρε φίλε, τι λες;"],
    stats: emptyStats({ plays: 6100, likes: 520, uses: 64, shares: 98, saves: 140, comments: 27 }),
  },
  {
    id: "st_valeu",
    name: "Valeu",
    audio: moinAudio.url,
    duration: "0:02",
    creator: "carioca_021",
    createdAt: Date.now() - 86400000,
    region: "Rio de Janeiro, Brazil",
    language: "Português",
    meaning: "Danke / passt schon – mit Vibe.",
    examples: ["Valeu demais, irmão!"],
    stats: emptyStats({ plays: 9300, likes: 860, uses: 71, shares: 120, saves: 180, comments: 33 }),
  },
];

export type SortKey = "newest" | "uses" | "likes" | "plays";

type Ctx = {
  tags: SlangTag[];
  getTag: (idOrName: string) => SlangTag | undefined;
  createTag: (input: {
    name: string;
    audio: string | null;
    duration?: string;
    region: string;
    language?: string;
    creator: string;
    meaning?: string;
  }) => SlangTag;
  search: (q: string) => SlangTag[];
  sorted: (key: SortKey, filter?: (t: SlangTag) => boolean) => SlangTag[];
  bump: (tagId: string, key: keyof SlangTagStats, by?: number) => void;
  toggleLike: (tagId: string) => void;
  likedIds: string[];
  toggleSave: (tagId: string) => void;
  savedIds: string[];
};

const SlangTagContext = createContext<Ctx | null>(null);

export function SlangTagProvider({ children }: { children: ReactNode }) {
  const [tags, setTags] = useState<SlangTag[]>(SEED);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { tags?: SlangTag[]; liked?: string[]; saved?: string[] };
      if (parsed.tags?.length) {
        const byId = new Map(SEED.map((t) => [t.id, t]));
        parsed.tags.forEach((t) => byId.set(t.id, { ...byId.get(t.id), ...t }));
        setTags([...byId.values()]);
      }
      setLikedIds(parsed.liked ?? []);
      setSavedIds(parsed.saved ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: SlangTag[], liked: string[], saved: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tags: next, liked, saved }));
    } catch {
      /* quota */
    }
  }, []);

  const createTag = useCallback<Ctx["createTag"]>(
    (input) => {
      const clean = input.name.replace(/^\$/, "").replace(/\s+/g, "").slice(0, 24) || "tag";
      const tag: SlangTag = {
        id: `st_${Date.now().toString(36)}`,
        name: clean,
        audio: input.audio,
        duration: input.duration ?? "0:02",
        creator: input.creator,
        createdAt: Date.now(),
        region: input.region,
        language: input.language ?? "Deutsch",
        meaning: input.meaning ?? "",
        examples: [],
        stats: emptyStats(),
      };
      setTags((prev) => {
        const next = [tag, ...prev];
        persist(next, likedIds, savedIds);
        return next;
      });
      return tag;
    },
    [likedIds, savedIds, persist],
  );

  const bump = useCallback<Ctx["bump"]>(
    (tagId, key, by = 1) => {
      setTags((prev) => {
        const next = prev.map((t) =>
          t.id === tagId ? { ...t, stats: { ...t.stats, [key]: Math.max(0, t.stats[key] + by) } } : t,
        );
        persist(next, likedIds, savedIds);
        return next;
      });
    },
    [likedIds, savedIds, persist],
  );

  const toggleLike = useCallback(
    (tagId: string) => {
      setLikedIds((prev) => {
        const on = prev.includes(tagId);
        const nextLiked = on ? prev.filter((i) => i !== tagId) : [...prev, tagId];
        setTags((prevTags) => {
          const next = prevTags.map((t) =>
            t.id === tagId ? { ...t, stats: { ...t.stats, likes: Math.max(0, t.stats.likes + (on ? -1 : 1)) } } : t,
          );
          persist(next, nextLiked, savedIds);
          return next;
        });
        return nextLiked;
      });
    },
    [savedIds, persist],
  );

  const toggleSave = useCallback(
    (tagId: string) => {
      setSavedIds((prev) => {
        const on = prev.includes(tagId);
        const nextSaved = on ? prev.filter((i) => i !== tagId) : [...prev, tagId];
        setTags((prevTags) => {
          const next = prevTags.map((t) =>
            t.id === tagId ? { ...t, stats: { ...t.stats, saves: Math.max(0, t.stats.saves + (on ? -1 : 1)) } } : t,
          );
          persist(next, likedIds, nextSaved);
          return next;
        });
        return nextSaved;
      });
    },
    [likedIds, persist],
  );

  const getTag = useCallback<Ctx["getTag"]>(
    (idOrName) => {
      const key = idOrName.replace(/^\$/, "").toLowerCase();
      return tags.find((t) => t.id === idOrName || t.name.toLowerCase() === key);
    },
    [tags],
  );

  const search = useCallback<Ctx["search"]>(
    (q) => {
      const key = q.replace(/^\$/, "").trim().toLowerCase();
      if (!key) return [...tags].sort((a, b) => b.stats.uses - a.stats.uses).slice(0, 8);
      return tags
        .filter(
          (t) =>
            t.name.toLowerCase().includes(key) ||
            t.region.toLowerCase().includes(key) ||
            t.language.toLowerCase().includes(key) ||
            t.creator.toLowerCase().includes(key),
        )
        .slice(0, 12);
    },
    [tags],
  );

  const sorted = useCallback<Ctx["sorted"]>(
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

  const value = useMemo(
    () => ({ tags, getTag, createTag, search, sorted, bump, toggleLike, likedIds, toggleSave, savedIds }),
    [tags, getTag, createTag, search, sorted, bump, toggleLike, likedIds, toggleSave, savedIds],
  );

  return <SlangTagContext.Provider value={value}>{children}</SlangTagContext.Provider>;
}

export function useSlangTags() {
  const ctx = useContext(SlangTagContext);
  if (!ctx) throw new Error("useSlangTags must be used within SlangTagProvider");
  return ctx;
}

export function formatStat(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}
