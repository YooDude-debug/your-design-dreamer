/**
 * ORB Core V0.2 – experimenteller Bereich innerhalb von Channels.
 *
 * Gesicht, Gedächtnisnetz, Sprache, Interessen, Vorschläge, Rückmeldungen und
 * Testbereich in einer Ansicht. Die Zustandswerte sind eine technische
 * Simulation, kein Bewusstsein. Der ORB handelt nie selbst: er liest, bewertet
 * und schlägt vor – likt, kommentiert, folgt und schreibt aber nichts.
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Database,
  GitBranch,
  Loader2,
  Search,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/nav-buttons";
import { goBackOr } from "@/lib/back-nav";
import { useOrbAvatarMode } from "@/integrations/y-dude-orb/use-orb-avatar-mode";
import { OrbAvatarPicker } from "@/components/orb/OrbAvatarPicker";
import { OrbChat } from "@/components/orb/OrbChat";
import { OrbDevPanel } from "@/components/orb/OrbDevPanel";
import { OrbErrorState } from "@/components/orb/OrbErrorState";
import { OrbExperimentNotice } from "@/components/orb/OrbExperimentNotice";
import { OrbFace } from "@/components/orb/OrbFace";
import { OrbGraph } from "@/components/orb/OrbGraph";
import { OrbInterests } from "@/components/orb/OrbInterests";
import { OrbRealFace } from "@/components/orb/OrbRealFace";
import { OrbSuggestions } from "@/components/orb/OrbSuggestions";
import { OrbTechnicalDeck, type OrbTechnicalItem } from "@/components/orb/OrbTechnicalDeck";
import { OrbVoice } from "@/components/orb/OrbVoice";
import { Button } from "@/components/ui/button";
import { useOrbPresence } from "@/integrations/y-dude-orb/use-orb-presence";
import {
  decideOrbSuggestion,
  getOrbSnapshot,
  inspectOrbCuriosity,
  observeOrbFeed,
  recordOrbLearning,
  requestOrbCuriosity,
  sendOrbFeedback,
  sendOrbInput,
  speakOrbReply,
  transcribeOrbAudio,
} from "@/integrations/y-dude-orb/orb.functions";

export const Route = createFileRoute("/_authenticated/channels/orb")({
  head: () => ({
    meta: [
      { title: "ORB Core — Y-Dude" },
      {
        name: "description",
        content:
          "ORB Core: experimenteller Prototyp einer digitalen Entität mit Innenzustand, Gedächtnisnetz, Verfall und Reaktivierung.",
      },
      { property: "og:title", content: "ORB Core — Y-Dude" },
      {
        property: "og:description",
        content: "Innenzustand, Erinnerungen, Verbindungen und Lernerfahrungen des ORB Core.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrbCorePage,
  // Eigene Fehlergrenze: ein Fehler in ORB Core zeigt nie die allgemeine
  // Y-Dude-Fehlerseite und lässt die übrigen Channels unberührt.
  errorComponent: ({ error, reset }) => <OrbErrorState error={error} onRetry={reset} />,
  notFoundComponent: () => <OrbErrorState />,
});

const STATE_LABEL: Record<string, string> = {
  curiosity: "Neugier",
  joy: "Freude",
  fear: "Angst",
  trust: "Vertrauen",
  uncertainty: "Unsicherheit",
  energy: "Energie",
};

function OrbCorePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loadSnapshot = useServerFn(getOrbSnapshot);
  const send = useServerFn(sendOrbInput);
  const learn = useServerFn(recordOrbLearning);
  const feedback = useServerFn(sendOrbFeedback);
  const observe = useServerFn(observeOrbFeed);
  const decide = useServerFn(decideOrbSuggestion);
  const transcribe = useServerFn(transcribeOrbAudio);
  const speak = useServerFn(speakOrbReply);
  const curiosityFn = useServerFn(requestOrbCuriosity);
  const inspectCuriosity = useServerFn(inspectOrbCuriosity);

  const [lastDecision, setLastDecision] = useState<{
    decision: string;
    reason: string;
    importance: number;
    llm: { provider: "openai" | "local"; fallbackUsed: boolean } | null;
  } | null>(null);

  const [lesson, setLesson] = useState("");
  const [reaction, setReaction] = useState<"learned" | "reactivated" | "interested" | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useOrbAvatarMode();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechLevel, setSpeechLevel] = useState(0);
  const [typing, setTyping] = useState(false);
  const [speakRequest, setSpeakRequest] = useState<{ id: number; text: string } | null>(null);

  // Reaktion des Gesichts nach kurzer Zeit zurücksetzen.
  useEffect(() => {
    if (!reaction) return;
    const t = setTimeout(() => setReaction(null), 2000);
    return () => clearTimeout(t);
  }, [reaction]);

  const snapshotQuery = useQuery({
    queryKey: ["orb", "snapshot"],
    queryFn: () => loadSnapshot({}),
  });

  const sendMutation = useMutation({
    mutationFn: (input: { text: string; images?: { mimeType: string; dataBase64: string }[] }) =>
      send({ data: { text: input.text, images: input.images } }),
    onSuccess: (turn) => {
      setLastDecision({
        decision: turn.decision,
        reason: turn.decisionReason,
        importance: turn.importance,
        llm: turn.llm ? { provider: turn.llm.provider, fallbackUsed: turn.llm.fallbackUsed } : null,
      });
      setLastReply(turn.reply);
      setReaction(turn.learnedNew ? "learned" : turn.reactivated ? "reactivated" : null);

      queryClient.setQueryData(["orb", "snapshot"], turn.snapshot);
      if (turn.aiStatus === "quota") toast.error("Die Sprachschicht ist derzeit nicht verfügbar.");
    },
    onError: () => toast.error("Der ORB konnte die Erfahrung nicht verarbeiten."),
  });

  const learnMutation = useMutation({
    mutationFn: (value: string) => learn({ data: { lesson: value } }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["orb", "snapshot"], snapshot);
      setLesson("");
      setReaction("learned");
      toast.success("Lernerfahrung gespeichert – der ORB zeigt einen Riss.");
    },
    onError: () => toast.error("Die Lernerfahrung konnte nicht gespeichert werden."),
  });

  const feedbackMutation = useMutation({
    mutationFn: (input: { nodeId: string; kind: "positive" | "negative" }) =>
      feedback({ data: input }),
    onSuccess: (snapshot, input) => {
      queryClient.setQueryData(["orb", "snapshot"], snapshot);
      setReaction(input.kind === "positive" ? "interested" : "reactivated");
      toast.success(
        input.kind === "positive"
          ? "Verstärkt – diese Beziehung wird wichtiger."
          : "Abgeschwächt – die Beziehung verblasst, sie wird nicht gelöscht.",
      );
    },
    onError: () => toast.error("Die Rückmeldung konnte nicht gespeichert werden."),
  });

  const observeMutation = useMutation({
    mutationFn: () => observe({}),
    onSuccess: (result) => {
      queryClient.setQueryData(["orb", "snapshot"], result.snapshot);
      setReaction(result.created > 0 ? "interested" : null);
      toast.success(
        result.created > 0
          ? `${result.created} passende Beiträge gefunden.`
          : "Derzeit passt kein Beitrag zu deinen Interessen.",
      );
    },
    onError: () => toast.error("Die Beobachtung war nicht möglich."),
  });

  const decideMutation = useMutation({
    mutationFn: (input: { suggestionId: string; accepted: boolean }) => decide({ data: input }),
    onSuccess: (snapshot) => queryClient.setQueryData(["orb", "snapshot"], snapshot),
    onError: () => toast.error("Die Entscheidung konnte nicht gespeichert werden."),
  });

  const snapshot = snapshotQuery.data;

  // ---------------------------------------------------------- Kernpräsenz ---
  // Der Leerlauf-Beobachter läuft clientseitig; erst wenn alle Bedingungen
  // erfüllt sind, entsteht genau eine Anfrage. Kein Polling, keine DB-Abfrage
  // pro Takt. Der ORB spricht dabei ausschliesslich in diesem ORB-Core-Chat.
  const curiosityMutation = useMutation({
    mutationFn: () => curiosityFn({}),
    onSuccess: (result) => {
      if (!result.asked || !result.question) return;
      if (result.snapshot) queryClient.setQueryData(["orb", "snapshot"], result.snapshot);
      setLastReply(result.question);
      setReaction("interested");
      presence.noteProactive();
      setSpeakRequest({ id: Date.now(), text: result.question });
    },
    // Bleibt still: eine fehlgeschlagene eigene Frage ist kein Benutzerfehler.
    onError: (error) => console.error("ORB Kernpräsenz nicht möglich", error),
  });

  const askProactively = useCallback(() => {
    curiosityMutation.mutate();
  }, [curiosityMutation]);

  // Testbereich: Einblick in den Curiosity Core – ausschliesslich auf Knopfdruck.
  const curiosityInsight = useMutation({
    mutationFn: () => inspectCuriosity({}),
    onError: () => toast.error("Der Neugier-Einblick war nicht möglich."),
  });

  const presence = useOrbPresence({
    curiosity: snapshot?.state.curiosity ?? 0,
    typing,
    speaking,
    listening,
    pending: sendMutation.isPending || curiosityMutation.isPending,
    enabled: Boolean(snapshot),
    onAsk: askProactively,
  });

  const orbActivity = speaking
    ? "ORB spricht"
    : listening
      ? "ORB hört zu"
      : sendMutation.isPending || curiosityMutation.isPending
        ? "ORB denkt nach"
        : "Online";

  const technicalItems: OrbTechnicalItem[] = snapshot
    ? [
        {
          id: "state",
          label: "Zustand",
          summary: `${Math.round(snapshot.state.energy * 100)} % Energie`,
          icon: BrainCircuit,
          content: (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(snapshot.state).map(([key, value]) => (
                  <div key={key} className="rounded-md border border-border bg-background p-2.5">
                    <div className="text-[11px] text-muted-foreground">
                      {STATE_LABEL[key] ?? key}
                    </div>
                    <div className="font-mono text-sm font-bold">{value.toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Technische Simulation eines Innenzustands – kein Bewusstsein und keine echten
                Gefühle. Erinnerungen verblassen, werden aber nie gelöscht.
              </p>
            </div>
          ),
        },
        {
          id: "memory",
          label: "Memory",
          summary: `${snapshot.nodes.length} Erinnerungen`,
          icon: Database,
          content: (
            <div className="space-y-3">
              <OrbGraph nodes={snapshot.nodes} connections={snapshot.connections} />
              {snapshot.nodes.length > 0 && (
                <ul className="space-y-1.5">
                  {snapshot.nodes.slice(0, 6).map((node) => (
                    <li
                      key={node.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate">{node.content}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          feedbackMutation.mutate({ nodeId: node.id, kind: "positive" })
                        }
                        disabled={feedbackMutation.isPending}
                        aria-label="Wichtig"
                        title="Wichtig"
                        className="rounded-full"
                      >
                        <ThumbsUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          feedbackMutation.mutate({ nodeId: node.id, kind: "negative" })
                        }
                        disabled={feedbackMutation.isPending}
                        aria-label="Weniger wichtig"
                        title="Weniger wichtig"
                        className="rounded-full"
                      >
                        <ThumbsDown className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        },
        {
          id: "curiosity",
          label: "Neugier",
          summary: `${Math.round(snapshot.state.curiosity * 100)} % aktiv`,
          icon: Search,
          content: (
            <div className="space-y-3">
              <OrbInterests interests={snapshot.interests} />
              <OrbSuggestions
                suggestions={snapshot.suggestions}
                observing={observeMutation.isPending}
                deciding={decideMutation.isPending}
                onObserve={() => observeMutation.mutate()}
                onDecide={(suggestionId, accepted) =>
                  decideMutation.mutate({ suggestionId, accepted })
                }
              />
            </div>
          ),
        },
        {
          id: "threads",
          label: "Threads",
          summary: `${snapshot.threads?.length ?? 0} Gedankenfäden`,
          icon: GitBranch,
          content: (
            <div>
              {(snapshot.threads?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Keine offenen Gedankenfäden.</p>
              ) : (
                <ul className="space-y-2">
                  {(snapshot.threads ?? []).map((thread) => (
                    <li
                      key={thread.id}
                      className="rounded-md border border-border bg-background p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-semibold">{thread.title}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                          {thread.status}
                        </span>
                      </div>
                      {thread.unknown.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Offen: {thread.unknown.slice(0, 2).join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        },
        {
          id: "learning",
          label: "Lernen",
          summary: `${snapshot.cracks} Lernereignisse`,
          icon: Sprout,
          content: (
            <div className="space-y-2">
              <label htmlFor="orb-lesson" className="text-xs font-semibold text-foreground">
                Lernerfahrung („Riss“)
              </label>
              <div className="flex items-end gap-2">
                <input
                  id="orb-lesson"
                  value={lesson}
                  onChange={(event) => setLesson(event.target.value)}
                  maxLength={300}
                  placeholder="Was wurde aus einem Fehler gelernt?"
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                />
                <Button
                  type="button"
                  onClick={() => {
                    const value = lesson.trim();
                    if (value) learnMutation.mutate(value);
                  }}
                  disabled={learnMutation.isPending || lesson.trim().length === 0}
                  size="sm"
                >
                  <Zap className="size-4" /> Speichern
                </Button>
              </div>
            </div>
          ),
        },
        {
          id: "status",
          label: "Status",
          summary: orbActivity,
          icon: Activity,
          content: (
            <div className="space-y-2">
              {lastDecision?.llm && (
                <p className="text-[11px] text-muted-foreground">
                  Sprachschicht:{" "}
                  {lastDecision.llm.provider === "openai"
                    ? "OpenAI (Experiment)"
                    : "bestehende Sprachschicht"}
                  {lastDecision.llm.fallbackUsed ? " · Fallback aktiv" : ""}
                </p>
              )}
              <OrbDevPanel
                snapshot={snapshot}
                lastDecision={lastDecision}
                curiosity={curiosityInsight.data ?? null}
                curiosityLoading={curiosityInsight.isPending}
                onInspectCuriosity={() => curiosityInsight.mutate()}
              />
            </div>
          ),
        },
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-8 pt-3 sm:px-5 sm:pt-5">
      <header className="mb-3 flex items-center gap-3 border-b border-border pb-3">
        <BackButton
          onClick={() => goBackOr(router, "/channels")}
          ariaLabel="Zurück"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-base font-bold sm:text-lg">
            <BrainCircuit className="size-5 shrink-0 text-brand" /> ORB Core
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Persönlicher Gesprächskern
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-brand/35 bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase text-brand">
            Experiment
          </span>
          <OrbExperimentNotice />
        </span>
      </header>

      {snapshotQuery.isPending && (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> ORB wird geweckt …
        </p>
      )}

      {snapshotQuery.isError && (
        <OrbErrorState
          error={snapshotQuery.error}
          onRetry={() => void snapshotQuery.refetch()}
          retrying={snapshotQuery.isFetching}
        />
      )}

      {snapshot && (
        <div className="space-y-4">
          <section className="relative overflow-hidden rounded-lg border border-border bg-surface/70 px-4 py-4 shadow-subtle sm:px-5">
            <div className="pointer-events-none absolute inset-x-16 top-4 h-24 rounded-full bg-brand/5 blur-3xl" />
            <div className="relative flex flex-col items-center gap-2">
              {avatarMode === "face" ? (
                <OrbRealFace
                  state={snapshot.state}
                  activity={
                    speaking
                      ? "speaking"
                      : listening
                        ? "listening"
                        : sendMutation.isPending || curiosityMutation.isPending
                          ? "thinking"
                          : "idle"
                  }
                  speechLevel={speechLevel}
                  className="h-32 w-32 sm:h-36 sm:w-36"
                />
              ) : (
                <OrbFace
                  state={snapshot.state}
                  cracks={snapshot.cracks}
                  thinking={sendMutation.isPending || curiosityMutation.isPending}
                  reaction={reaction}
                  className="h-28 w-28 sm:h-32 sm:w-32"
                />
              )}

              <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5">
                <span
                  className={`size-2 rounded-full ${listening || speaking ? "bg-brand animate-pulse" : "bg-brand"}`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-foreground">{orbActivity}</span>
              </div>
              <div className="w-full max-w-sm pt-1">
                <OrbAvatarPicker mode={avatarMode} onChange={setAvatarMode} />
              </div>
            </div>
          </section>

          <OrbChat
            messages={snapshot.messages}
            pending={sendMutation.isPending || curiosityMutation.isPending}
            onSend={(text, images) => {
              presence.noteActivity();
              sendMutation.mutate({ text, images });
            }}
            onTypingChange={setTyping}
            onActivity={presence.noteActivity}
            voiceControls={
              <OrbVoice
                compact
                onTranscript={(text) => {
                  presence.noteActivity();
                  sendMutation.mutate({ text });
                }}
                transcribe={(audioBase64) => transcribe({ data: { audioBase64 } })}
                speak={(text) => speak({ data: { text } })}
                lastReply={lastReply}
                busy={sendMutation.isPending || curiosityMutation.isPending}
                onListeningChange={(value) => {
                  presence.noteActivity();
                  setListening(value);
                }}
                onSpeakingChange={setSpeaking}
                onSpeechLevel={setSpeechLevel}
                speakRequest={speakRequest}
              />
            }
          />

          <OrbTechnicalDeck items={technicalItems} />
        </div>
      )}
    </div>
  );
}
