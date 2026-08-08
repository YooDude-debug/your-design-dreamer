import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Award,
  Crown,
  Flame,
  Globe2,
  Package,
  Plus,
  Settings,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { ArenaCard } from "@/components/arena/ArenaCard";
import { ArenaNavGrid, type ArenaTabId } from "@/components/arena/ArenaNavGrid";
import { ArenaFlowHint } from "@/components/arena/ArenaFlowHint";
import { MySlangTagsSection } from "@/components/arena/MySlangTagsSection";
import { GlobeVoteSection } from "@/components/globe-vote/GlobeVoteSection";
import { SlangTagManager } from "@/components/SlangTagManager";
import { useSlideInClass, useSwipeNavGesture } from "@/lib/use-swipe-nav-gesture";
import { EdgePeek } from "@/components/EdgePeek";


import { useData } from "@/lib/data-context";
import {
  creatorStats,
  isRunning,
  MEDALS,
  rankSubmissions,
  useArena,
  type ArenaChallenge,
} from "@/lib/arena";
import { formatStat } from "@/lib/types";

const ARENA_TABS: ArenaTabId[] = ["mine", "manager", "arena", "globe"];

export const Route = createFileRoute("/_authenticated/arena")({
  validateSearch: (search: Record<string, unknown>): { tab: ArenaTabId } => ({
    tab: ARENA_TABS.includes(search.tab as ArenaTabId) ? (search.tab as ArenaTabId) : "mine",
  }),

  head: () => ({
    meta: [
      { title: "SlangTag Arena – Community Voting | Y-Dude" },
      {
        name: "description",
        content:
          "Unternehmen schreiben SlangTag-Challenges aus, Creator reichen Audio-SlangTags ein und die Community kürt den Gewinner.",
      },
      { property: "og:title", content: "SlangTag Arena – Community Voting | Y-Dude" },
      {
        property: "og:description",
        content:
          "Challenges, Einreichungen, Live-Ranking und Gewinner-Lizenzen in der Y-Dude SlangTag Arena.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArenaPage,
});

function daysLeft(endsAt: number | null): string {
  if (!endsAt) return "offen";
  const ms = endsAt - Date.now();
  if (ms <= 0) return "beendet";
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? "1 Tag" : `${days} Tage`;
}

function ArenaPage() {
  const { me, user, tags, profiles, isAdmin, canCreateBusinessTag, getTag, myTags } = useData();
  const arena = useArena(user?.id ?? null);
  // Spiegelverkehrte Rückgeste: leicht nach rechts, dann deutlich nach links → Feed.
  useSwipeNavGesture("right-then-left", "/dev");
  const slideIn = useSlideInClass();
  const navigate = useNavigate({ from: Route.fullPath });
  const { tab } = Route.useSearch();
  const setTab = (next: ArenaTabId) => void navigate({ search: { tab: next } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);


  const challenges = arena.challenges;
  const selected = useMemo(
    () => challenges.find((c) => c.id === selectedId) ?? challenges[0] ?? null,
    [challenges, selectedId],
  );

  const ranked = useMemo(
    () => (selected ? rankSubmissions(arena.submissionsByChallenge[selected.id] ?? []) : []),
    [selected, arena.submissionsByChallenge],
  );
  const league = useMemo(
    () => creatorStats(arena.submissions, arena.awards).slice(0, 8),
    [arena.submissions, arena.awards],
  );

  // `myTags` kommt owner-scoped aus dem Datenkontext.


  /** Einreichungen nach SlangTag-Namen gruppiert – Varianten stehen zusammen. */
  const variantGroups = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; items: { submission: (typeof ranked)[number]; rank: number }[] }
    >();
    ranked.forEach((submission, i) => {
      const name = getTag(submission.tagId)?.name ?? "slangtag";
      const key = name.toLowerCase();
      const group = groups.get(key) ?? { name, items: [] };
      group.items.push({ submission, rank: i + 1 });
      groups.set(key, group);
    });
    return [...groups.values()].sort((a, b) => a.items[0].rank - b.items[0].rank);
  }, [ranked, getTag]);

  const ownsSelected = Boolean(selected && (selected.companyId === me?.id || isAdmin));
  const alreadySubmitted = ranked.some((s) => s.creatorId === me?.id);

  const tabs = [
    {
      id: "mine" as const,
      label: "Meine SlangTags",
      hint: "Sammlung",
      icon: Package,
      count: myTags.length,
    },
    {
      id: "manager" as const,
      label: "SlangTag Manager",
      hint: "Freigaben",
      icon: Settings,
      count: tags.filter((t) => t.ownerId === me?.id && t.communityShared).length,
    },
    {
      id: "arena" as const,
      label: "Arena",
      hint: "Challenges",
      icon: Trophy,
      count: challenges.filter((c) => isRunning(c)).length,
    },
    { id: "globe" as const, label: "🌍 Globe Vote", hint: "Suchen & Voten", icon: Globe2 },
  ];


  return (
    <div
      className={`mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 ${slideIn}`}
      style={{ willChange: slideIn ? "transform" : undefined }}
    >
      <EdgePeek to="/dev" />
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand/50 bg-brand/10 text-brand">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-black tracking-tight sm:text-xl">
              SlangTag Arena
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              SlangTag anlegen → verwalten → im Globe oder in der Arena zeigen.
            </p>
          </div>
        </div>
        {(canCreateBusinessTag || isAdmin) && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="tap-safe inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-brand px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" /> Challenge
          </button>
        )}
      </header>

      {/* Vier Module: Sammlung · Freigaben · Challenges · Globe Vote */}
      <ArenaNavGrid entries={tabs} active={tab} onSelect={setTab} />
      <ArenaFlowHint />


      {tab === "mine" && (
        <div className="mt-4">
          <MySlangTagsSection />
        </div>
      )}

      {tab === "globe" && (
        <div className="mt-4">
          <GlobeVoteSection />
        </div>
      )}

      {tab === "manager" && (
        <section className="mt-4 rounded-2xl border border-border bg-surface/50 p-4">
          <SlangTagManager />
        </section>
      )}


      {tab === "arena" &&
        (arena.loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Arena wird geladen …</p>
        ) : challenges.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Noch keine Challenge ausgeschrieben.
          </p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Challenge-Liste */}
            <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
              {challenges.map((c) => {
                const active = c.id === selected?.id;
                const count = (arena.submissionsByChallenge[c.id] ?? []).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-brand bg-brand/10"
                        : "border-border bg-surface/50 hover:border-brand/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold">{c.title}</span>
                      {isRunning(c) ? (
                        <Flame className="ml-auto h-3.5 w-3.5 shrink-0 text-brand" />
                      ) : (
                        <Award className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{c.companyName}</span>
                      <span>· {count} Einreichungen</span>
                      <span>· {daysLeft(c.endsAt)}</span>
                    </div>
                  </button>
                );
              })}

              {/* Creator-Liga */}
              {league.length > 0 && (
                <div className="rounded-xl border border-border bg-surface/50 p-3">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Crown className="h-3.5 w-3.5 text-brand" /> Creator-Liga
                  </h2>
                  <ul className="mt-2 space-y-1.5">
                    {league.map((s, i) => {
                      const p = profiles[s.creatorId];
                      return (
                        <li key={s.creatorId} className="flex items-center gap-2 text-xs">
                          <span className="w-4 shrink-0 text-muted-foreground">
                            {i < 3 ? MEDALS[i] : i + 1}
                          </span>
                          <Link
                            to="/profile/$username"
                            params={{ username: p?.username ?? "" }}
                            className="truncate hover:text-brand"
                          >
                            @{p?.username ?? "unknown"}
                          </Link>
                          <span className="ml-auto shrink-0 font-bold text-brand">
                            {formatStat(s.score)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </aside>

            {/* Detail der gewählten Challenge */}
            {selected && (
              <section className="min-w-0 space-y-4">
                <div className="rounded-2xl border border-border bg-surface/50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">{selected.title}</h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isRunning(selected)
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {isRunning(selected) ? "läuft" : selected.status}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Timer className="h-3 w-3" /> {daysLeft(selected.endsAt)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">
                    {selected.description}
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Info label="Unternehmen" value={selected.companyName} />
                    <Info label="Kategorie" value={selected.category} />
                    <Info label="Zielgruppe" value={selected.targetAudience} />
                    <Info label="Region" value={selected.region} />
                    <Info label="Gewinn" value={selected.prize} />
                    <Info label="Teilnahmebedingungen" value={selected.terms} />
                  </dl>

                  {isRunning(selected) && !alreadySubmitted && (
                    <button
                      type="button"
                      onClick={() => setSubmitOpen(true)}
                      className="tap-safe mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" /> SlangTag einreichen
                    </button>
                  )}
                  {alreadySubmitted && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Du hast für diese Challenge bereits einen SlangTag eingereicht.
                    </p>
                  )}
                </div>

                {/* Live-Ranking – Varianten desselben Namens stehen zusammen */}
                {ranked.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Noch keine Einreichungen – sei der erste Creator.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {variantGroups.map((group) => (
                      <div key={group.name} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-brand">${group.name}</span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {group.items.length === 1
                              ? "1 Variante"
                              : `${group.items.length} Varianten`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Stimme pro Variante ab – gleicher Name, eigener Sound.
                          </span>
                        </div>
                        {group.items.map(({ submission: s, rank }) => {
                          const award = arena.awards.find((a) => a.submissionId === s.id);
                          return (
                            <div key={s.id} className="space-y-2">
                              <ArenaCard
                                submission={s}
                                rank={rank}
                                voted={arena.myVotes.includes(s.id)}
                                liked={arena.myLikes.includes(s.id)}
                                comments={arena.commentsBySubmission[s.id]}
                                canDelete={s.creatorId === me?.id || isAdmin}
                                award={
                                  award
                                    ? { place: award.place, licensed: award.licensed }
                                    : undefined
                                }
                                onVote={() => void arena.toggleVote(s.id)}
                                onLike={() => void arena.toggleLike(s.id)}
                                onPlay={() => void arena.registerPlay(s.id)}
                                onLoadComments={() => void arena.loadComments(s.id)}
                                onComment={(body, ids) => arena.addComment(s.id, body, ids)}
                                onDelete={() => void arena.removeSubmission(s.id)}
                              />
                              {ownsSelected && !isRunning(selected) && (
                                <div className="flex flex-wrap gap-2 pl-1">
                                  {[1, 2, 3].map((place) => (
                                    <button
                                      key={place}
                                      type="button"
                                      onClick={() =>
                                        void arena.setAward(selected.id, s.id, place, false)
                                      }
                                      className="tap-safe rounded-full border border-border px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:border-brand/50 hover:text-brand"
                                    >
                                      Platz {place}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void arena.setAward(
                                        selected.id,
                                        s.id,
                                        award?.place ?? 1,
                                        true,
                                      )
                                    }
                                    className="tap-safe rounded-full border border-brand-cyan/50 px-3 text-[11px] font-bold uppercase tracking-wider text-brand-cyan"
                                  >
                                    Lizenz erteilen
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {ownsSelected && isRunning(selected) && (
                  <button
                    type="button"
                    onClick={() => void arena.closeChallenge(selected.id, "judging")}
                    className="tap-safe rounded-full border border-border px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:border-brand/50 hover:text-brand"
                  >
                    Voting beenden & bewerten
                  </button>
                )}
              </section>
            )}
          </div>
        ))}

      {createOpen && (
        <CreateChallengeDialog
          defaultCompany={me?.displayName || me?.username || ""}
          defaultRegion={me?.location ?? ""}
          onClose={() => setCreateOpen(false)}
          onSubmit={async (input) => {
            const ok = await arena.createChallenge(input);
            if (ok) setCreateOpen(false);
            return ok;
          }}
        />
      )}

      {submitOpen && selected && (
        <SubmitDialog
          challenge={selected}
          tags={myTags.map((t) => ({ id: t.id, name: t.name, kind: t.kind }))}
          onClose={() => setSubmitOpen(false)}
          onSubmit={async (tagId, pitch) => {
            const ok = await arena.submitTag(selected.id, tagId, pitch);
            if (ok) setSubmitOpen(false);
            return ok;
          }}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="whitespace-pre-line text-foreground/90">{value}</dd>
    </div>
  );
}

function Shell({
  title,
  onClose,
  wide,
  children,
}: {
  title: string;
  onClose: () => void;
  /** Breitere Variante für Verwaltungsbereiche (Box, Manager). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-3 backdrop-blur-sm">
      <div
        className={`max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-border bg-surface p-4 ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="tap-safe ml-auto grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

function CreateChallengeDialog({
  defaultCompany,
  defaultRegion,
  onClose,
  onSubmit,
}: {
  defaultCompany: string;
  defaultRegion: string;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    companyName: string;
    description: string;
    category: string;
    targetAudience: string;
    terms: string;
    region: string;
    prize: string;
    endsAt: string | null;
  }) => Promise<boolean>;
}) {
  const [form, setForm] = useState({
    title: "",
    companyName: defaultCompany,
    description: "",
    category: "",
    targetAudience: "",
    terms: "",
    region: defaultRegion,
    prize: "",
    endsAt: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError("Titel und Beschreibung sind erforderlich.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      ...form,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    });
    setBusy(false);
    if (!ok) setError("Die Challenge konnte nicht angelegt werden.");
  };

  return (
    <Shell title="Neue Challenge" onClose={onClose}>
      <input
        className={inputCls}
        placeholder="Titel der Challenge"
        value={form.title}
        onChange={(e) => set("title")(e.target.value)}
      />
      <input
        className={inputCls}
        placeholder="Unternehmen"
        value={form.companyName}
        onChange={(e) => set("companyName")(e.target.value)}
      />
      <textarea
        className={`${inputCls} min-h-24`}
        placeholder="Beschreibung & Briefing"
        value={form.description}
        onChange={(e) => set("description")(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder="Kategorie"
          value={form.category}
          onChange={(e) => set("category")(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Zielgruppe"
          value={form.targetAudience}
          onChange={(e) => set("targetAudience")(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Region"
          value={form.region}
          onChange={(e) => set("region")(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder="Gewinn / Prämie"
          value={form.prize}
          onChange={(e) => set("prize")(e.target.value)}
        />
      </div>
      <textarea
        className={`${inputCls} min-h-20`}
        placeholder="Teilnahmebedingungen (Nutzungsrechte, Lizenz, Laufzeit …)"
        value={form.terms}
        onChange={(e) => set("terms")(e.target.value)}
      />
      <label className="block text-xs text-muted-foreground">
        Ende des Votings
        <input
          type="date"
          className={`${inputCls} mt-1`}
          value={form.endsAt}
          onChange={(e) => set("endsAt")(e.target.value)}
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="tap-safe w-full rounded-xl bg-gradient-brand text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Speichern …" : "Challenge starten"}
      </button>
    </Shell>
  );
}

function SubmitDialog({
  challenge,
  tags,
  onClose,
  onSubmit,
}: {
  challenge: ArenaChallenge;
  tags: { id: string; name: string; kind: string }[];
  onClose: () => void;
  onSubmit: (tagId: string, pitch: string) => Promise<boolean>;
}) {
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!tagId) {
      setError("Bitte einen eigenen SlangTag auswählen.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit(tagId, pitch.trim());
    setBusy(false);
    if (!ok) setError("Die Einreichung war nicht möglich.");
  };

  return (
    <Shell title={`Einreichung: ${challenge.title}`} onClose={onClose}>
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Du hast noch keinen eigenen SlangTag. Nimm zuerst einen SlangTag auf.
        </p>
      ) : (
        <>
          <label className="block text-xs text-muted-foreground">
            Eigener SlangTag
            <select
              className={`${inputCls} mt-1`}
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
            >
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.kind === "creator" ? "$$" : "$"}
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <textarea
            className={`${inputCls} min-h-24`}
            placeholder="Kurzer Pitch: Warum passt dein SlangTag zur Marke?"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="tap-safe w-full rounded-xl bg-gradient-brand text-sm font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Senden …" : "Jetzt einreichen"}
          </button>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">
        Mit der Einreichung akzeptierst du die Teilnahmebedingungen der Challenge. Score-Formel:
        Votes ×4, Likes ×2, Kommentare ×1,5, Plays ×0,5.
      </p>
    </Shell>
  );
}
