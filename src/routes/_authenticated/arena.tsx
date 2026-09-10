import { BackButton, CloseButton } from "@/components/ui/nav-buttons";
import { useMemo, useState } from "react";
import { slangTagPrefix } from "@/lib/slangtag-rules";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Award,
  Crown,
  Flame,
  Globe2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { ArenaCard } from "@/components/arena/ArenaCard";
import { Button } from "@/components/ui/button";
import { ArenaNavGrid, type ArenaTabId } from "@/components/arena/ArenaNavGrid";
import { SlangBoxSection } from "@/components/arena/MySlangTagsSection";
import { SlangTagManager } from "@/components/SlangTagManager";
import { GlobeVoteSection } from "@/components/globe-vote/GlobeVoteSection";
import { useSlideInClass } from "@/lib/use-swipe-nav-gesture";

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
import { useLang } from "@/lib/lang-context";
import { arenaTexts, type ArenaDict } from "@/lib/i18n-arena";

/** Aktive Bereiche. „arena" ist angekündigt, aber noch nicht freigeschaltet. */
const ARENA_TABS: ArenaTabId[] = ["box", "manager", "globe"];

export const Route = createFileRoute("/_authenticated/arena")({
  validateSearch: (search: Record<string, unknown>): { tab: ArenaTabId; q?: string } => ({
    tab: ARENA_TABS.includes(search.tab as ArenaTabId) ? (search.tab as ArenaTabId) : "box",
    ...(typeof search.q === "string" && search.q.trim() ? { q: search.q.trim() } : {}),
  }),

  head: () => ({
    meta: [
      { title: "Slang Arena – Community Voting | Y-Dude" },
      {
        name: "description",
        content:
          "Unternehmen schreiben SlangTag-Challenges aus, Creator reichen Audio-SlangTags ein und die Community kürt den Gewinner.",
      },
      { property: "og:title", content: "Slang Arena – Community Voting | Y-Dude" },
      {
        property: "og:description",
        content:
          "Challenges, Einreichungen, Live-Ranking und Gewinner-Lizenzen in der Y-Dude Slang Arena.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArenaPage,
});

function daysLeft(endsAt: number | null, at: ArenaDict): string {
  if (!endsAt) return at.daysOpen;
  const ms = endsAt - Date.now();
  if (ms <= 0) return at.daysEnded;
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? at.dayOne : at.daysMany(days);
}

function statusLabel(status: ArenaChallenge["status"], at: ArenaDict): string {
  if (status === "active") return at.statusActive;
  if (status === "draft") return at.statusDraft;
  if (status === "judging") return at.statusJudging;
  return at.statusClosed;
}

function ArenaPage() {
  const { me, user, profiles, isAdmin, getTag, myTags } = useData();
  const { lang, t } = useLang();
  const at = arenaTexts[lang];
  const arena = useArena(user?.id ?? null);
  // Spiegelverkehrte Rückgeste: leicht nach rechts, dann deutlich nach links → Feed.
  const slideIn = useSlideInClass();
  const navigate = useNavigate({ from: Route.fullPath });
  const { tab, q: globeQuery } = Route.useSearch();
  const [query, setQuery] = useState(globeQuery ?? "");
  const setTab = (next: ArenaTabId) =>
    void navigate({
      search: query.trim() ? { tab: next, q: query.trim() } : { tab: next },
      // Interne Tabwechsel erzeugen keine zusätzlichen Verlaufsschritte.
      replace: true,
    });

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
    { id: "box" as const, label: t.slangBox, icon: Sparkles },
    { id: "manager" as const, label: at.tabManagerLabel, icon: Settings },
    { id: "globe" as const, label: at.tabGlobeLabel, icon: Globe2 },
    // Challenge-Funktion folgt später: sichtbar, aber deaktiviert und ohne Daten.
    {
      id: "arena" as const,
      label: at.tabArenaLabel,
      icon: Trophy,
      disabled: true,
      badge: at.comingSoonBadge,
    },
  ];

  return (
    <div
      data-page-root
      className={`relative mx-auto flex h-[100svh] w-full max-w-6xl flex-col overflow-hidden px-3 py-3 sm:px-5 sm:py-5 ${slideIn}`}
      style={{ willChange: slideIn ? "transform" : undefined }}
    >
      <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
        <BackButton
          // Ein Klick verlässt die gesamte Slang Arena – unabhängig von internen Zuständen.
          onClick={() => void navigate({ to: "/feed" })}
          label={t.back}
          ariaLabel={t.back}
          className="px-3 text-[10px] normal-case sm:px-4 sm:text-xs"
        />
        <div className="flex min-w-0 items-center justify-center gap-2 sm:gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-brand bg-brand/10 text-brand shadow-glow-active sm:h-12 sm:w-12">
            <Trophy className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 text-center sm:text-left">
            <h1 className="truncate text-base font-black sm:text-2xl">{at.arenaTitle}</h1>
            <p className="hidden truncate text-xs text-muted-foreground xs:block">
              {at.arenaSubtitle}
            </p>
          </div>
        </div>
        <div className="flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-surface-2/60 text-center text-muted-foreground sm:w-16">
          <Crown className="h-4 w-4 text-foreground" />
          <span className="mt-1 text-[8px] font-bold leading-none sm:text-[9px]">
            {at.tabArenaLabel}
            <br />
            {at.comingSoonBadge}
          </span>
        </div>
      </header>

      <label className="group relative mt-4 block shrink-0">
        <span className="sr-only">{at.searchTagPlaceholder}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-brand" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            void navigate({
              search: next.trim() ? { tab, q: next } : { tab },
              replace: true,
            });
          }}
          placeholder={at.searchTagPlaceholder}
          className="control-field h-12 w-full rounded-2xl pl-12 pr-12 text-sm outline-none transition-shadow focus:border-brand/60 focus:shadow-glow-active"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setQuery("");
              void navigate({ search: { tab }, replace: true });
            }}
            aria-label={at.clearSearchAria}
            className="absolute right-1 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </label>

      {/* Vier Hauptbereiche: Slang Box · Manager · Globe · Arena */}
      <div className="mt-3 shrink-0">
        <ArenaNavGrid entries={tabs} active={tab} onSelect={setTab} />
      </div>

      {tab === "globe" && (
        // Wie Slang Box / Manager: fester Rahmen mit eigenem, internem Scroll.
        // Verhindert Fenster-Scroll im Globe-Tab, dessen Offset beim Wechsel auf
        // einen viewport-hohen Tab verwaist und die Seite verschoben stehen lässt.
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <GlobeVoteSection initialQuery={query} />
          </div>
        </div>
      )}

      {tab === "box" && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <SlangBoxSection query={query} />
        </div>
      )}

      {tab === "manager" && (
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-surface/80 p-3 sm:p-4">
            <SlangTagManager fill />
          </section>
        </div>
      )}

      {tab === "arena" &&
        (arena.loading ? (
          <p className="mt-8 text-sm text-muted-foreground">{at.arenaLoading}</p>
        ) : challenges.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {at.noChallengesYet}
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
                        : "border-border bg-background hover:border-brand/40"
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
                      <span>· {at.submissionsCount(count)}</span>
                      <span>· {daysLeft(c.endsAt, at)}</span>
                    </div>
                  </button>
                );
              })}

              {/* Creator-Liga */}
              {league.length > 0 && (
                <div className="rounded-xl border border-border bg-background p-3">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Crown className="h-3.5 w-3.5 text-brand" /> {at.creatorLeague}
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
                            @{p?.username ?? t.unknown}
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
                <div className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black">{selected.title}</h2>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isRunning(selected)
                          ? "border-brand/50 bg-brand/10 text-brand"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {statusLabel(selected.status, at)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Timer className="h-3 w-3" /> {daysLeft(selected.endsAt, at)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">
                    {selected.description}
                  </p>
                  <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <Info label={at.infoCompany} value={selected.companyName} />
                    <Info label={at.infoCategory} value={selected.category} />
                    <Info label={at.infoTarget} value={selected.targetAudience} />
                    <Info label={at.infoRegion} value={selected.region} />
                    <Info label={at.infoPrize} value={selected.prize} />
                    <Info label={at.infoTerms} value={selected.terms} />
                  </dl>

                  {isRunning(selected) && !alreadySubmitted && (
                    <button
                      type="button"
                      onClick={() => setSubmitOpen(true)}
                      className="tap-safe mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" /> {at.submitTagBtn}
                    </button>
                  )}
                  {alreadySubmitted && (
                    <p className="mt-4 text-xs text-muted-foreground">{at.alreadySubmittedMsg}</p>
                  )}
                </div>

                {/* Live-Ranking – Varianten desselben Namens stehen zusammen */}
                {ranked.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {at.noSubmissionsYet}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {variantGroups.map((group) => (
                      <div key={group.name} className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-black text-brand">${group.name}</span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {group.items.length === 1
                              ? at.variantOne
                              : at.variantsMany(group.items.length)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {at.votePerVariantHint}
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
                                      {at.placeBtn(place)}
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
                                    {at.licenseBtn}
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
                    {at.endVotingBtn}
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
  const { lang } = useLang();
  const at = arenaTexts[lang];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-3 backdrop-blur-sm">
      <div
        className={`max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-border bg-background p-4 ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black">{title}</h2>
          <CloseButton onClick={onClose} label={at.closeAria} className="ml-auto" />
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
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError(at.requiredFieldsError);
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      ...form,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    });
    setBusy(false);
    if (!ok) setError(at.createChallengeFailedError);
  };

  return (
    <Shell title={at.newChallengeDialogTitle} onClose={onClose}>
      <input
        className={inputCls}
        placeholder={at.titlePh}
        value={form.title}
        onChange={(e) => set("title")(e.target.value)}
      />
      <input
        className={inputCls}
        placeholder={at.companyPh}
        value={form.companyName}
        onChange={(e) => set("companyName")(e.target.value)}
      />
      <textarea
        className={`${inputCls} min-h-24`}
        placeholder={at.descriptionPh}
        value={form.description}
        onChange={(e) => set("description")(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={inputCls}
          placeholder={at.categoryPh}
          value={form.category}
          onChange={(e) => set("category")(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder={at.targetPh}
          value={form.targetAudience}
          onChange={(e) => set("targetAudience")(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder={at.regionPh}
          value={form.region}
          onChange={(e) => set("region")(e.target.value)}
        />
        <input
          className={inputCls}
          placeholder={at.prizePh}
          value={form.prize}
          onChange={(e) => set("prize")(e.target.value)}
        />
      </div>
      <textarea
        className={`${inputCls} min-h-20`}
        placeholder={at.termsPh}
        value={form.terms}
        onChange={(e) => set("terms")(e.target.value)}
      />
      <label className="block text-xs text-muted-foreground">
        {at.votingEndsLabel}
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
        {busy ? at.savingBtn : at.startChallengeBtn}
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
  const { lang } = useLang();
  const at = arenaTexts[lang];
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [pitch, setPitch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!tagId) {
      setError(at.chooseOwnTagError);
      return;
    }
    setBusy(true);
    const ok = await onSubmit(tagId, pitch.trim());
    setBusy(false);
    if (!ok) setError(at.submitFailedError);
  };

  return (
    <Shell title={at.submissionDialogTitle(challenge.title)} onClose={onClose}>
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{at.noOwnTagsMsg}</p>
      ) : (
        <>
          <label className="block text-xs text-muted-foreground">
            {at.ownTagLabel}
            <select
              className={`${inputCls} mt-1`}
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
            >
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {slangTagPrefix(t.kind)}
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <textarea
            className={`${inputCls} min-h-24`}
            placeholder={at.pitchPh}
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
            {busy ? at.sendingBtn : at.submitNowBtn}
          </button>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">{at.submissionTermsHint}</p>
    </Shell>
  );
}
