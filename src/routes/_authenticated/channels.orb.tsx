/**
 * ORB Core V0.2 – experimenteller Prototyp (nur Staging).
 *
 * Gesicht, Gedächtnisnetz, Sprache, Interessen, Vorschläge, Rückmeldungen und
 * Testbereich in einer Ansicht. Die Zustandswerte sind eine technische
 * Simulation, kein Bewusstsein. Der ORB handelt nie selbst: er liest, bewertet
 * und schlägt vor – likt, kommentiert, folgt und schreibt aber nichts.
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, ThumbsDown, ThumbsUp, Zap } from "lucide-react";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/nav-buttons";
import { goBackOr } from "@/lib/back-nav";
import { useOrbAvatarMode } from "@/lib/use-orb-avatar-mode";
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
import { OrbVoice } from "@/components/orb/OrbVoice";
import {
  decideOrbSuggestion,
  getOrbSnapshot,
  observeOrbFeed,
  recordOrbLearning,
  sendOrbFeedback,
  sendOrbInput,
  speakOrbReply,
  transcribeOrbAudio,
} from "@/lib/orb.functions";

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

  const [lastDecision, setLastDecision] = useState<{
    decision: string;
    reason: string;
    importance: number;
  } | null>(null);
  const [lesson, setLesson] = useState("");
  const [reaction, setReaction] = useState<"learned" | "reactivated" | "interested" | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);
  const [avatarMode, setAvatarMode] = useOrbAvatarMode();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechLevel, setSpeechLevel] = useState(0);

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
    mutationFn: (text: string) => send({ data: { text } }),
    onSuccess: (turn) => {
      setLastDecision({
        decision: turn.decision,
        reason: turn.decisionReason,
        importance: turn.importance,
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

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-4">
      <header className="mb-4 flex items-center gap-3">
        <BackButton
          onClick={() => goBackOr(router, "/channels")}
          ariaLabel="Zurück"
          className="shrink-0"
        />
        <h1 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-bold">
          <BrainCircuit className="h-5 w-5 shrink-0 text-brand" /> ORB Core
        </h1>
        <span className="shrink-0 rounded-full border border-dashed border-border px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
          Experiment
        </span>
      </header>

      <div className="mb-4">
        <OrbExperimentNotice />
      </div>

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
        <div className="space-y-5">
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background p-4">
            {avatarMode === "face" ? (
              <OrbRealFace
                state={snapshot.state}
                activity={
                  speaking
                    ? "speaking"
                    : listening
                      ? "listening"
                      : sendMutation.isPending
                        ? "thinking"
                        : "idle"
                }
                speechLevel={speechLevel}
                className="h-44 w-44"
              />
            ) : (
              <OrbFace
                state={snapshot.state}
                cracks={snapshot.cracks}
                thinking={sendMutation.isPending}
                reaction={reaction}
                className="h-40 w-40"
              />
            )}

            <OrbAvatarPicker mode={avatarMode} onChange={setAvatarMode} />
            <div className="grid w-full grid-cols-3 gap-2">
              {Object.entries(snapshot.state).map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="text-[11px] text-muted-foreground">{STATE_LABEL[k] ?? k}</div>
                  <div className="font-mono text-sm font-bold">{v.toFixed(2)}</div>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Die Werte sind eine technische Simulation eines Innenzustands – kein Bewusstsein und
              keine echten Gefühle. Erinnerungen verblassen durch Verfall, werden aber nie gelöscht.
            </p>
          </section>

          <OrbChat
            messages={snapshot.messages}
            pending={sendMutation.isPending}
            onSend={(text) => sendMutation.mutate(text)}
          />

          <OrbVoice
            onTranscript={(text) => sendMutation.mutate(text)}
            transcribe={(audioBase64) => transcribe({ data: { audioBase64 } })}
            speak={(text) => speak({ data: { text } })}
            lastReply={lastReply}
            busy={sendMutation.isPending}
            onListeningChange={setListening}
            onSpeakingChange={setSpeaking}
            onSpeechLevel={setSpeechLevel}
          />

          <OrbInterests interests={snapshot.interests} />

          <OrbSuggestions
            suggestions={snapshot.suggestions}
            observing={observeMutation.isPending}
            deciding={decideMutation.isPending}
            onObserve={() => observeMutation.mutate()}
            onDecide={(suggestionId, accepted) => decideMutation.mutate({ suggestionId, accepted })}
          />

          <section className="rounded-xl border border-border bg-background p-3">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Gedächtnisnetz
            </h2>
            <OrbGraph nodes={snapshot.nodes} connections={snapshot.connections} />
            <p className="text-[11px] text-muted-foreground">
              Durchgezogen = starke Verbindung, gestrichelt = schwach, Pfeil = Richtung, Dicke =
              Gewicht.
            </p>

            {snapshot.nodes.length > 0 && (
              <ul className="mt-3 space-y-1">
                {snapshot.nodes.slice(0, 6).map((n) => (
                  <li
                    key={n.id}
                    className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{n.content}</span>
                    <button
                      onClick={() => feedbackMutation.mutate({ nodeId: n.id, kind: "positive" })}
                      disabled={feedbackMutation.isPending}
                      aria-label="Wichtig"
                      className="rounded-full border border-border p-1.5 disabled:opacity-40"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => feedbackMutation.mutate({ nodeId: n.id, kind: "negative" })}
                      disabled={feedbackMutation.isPending}
                      aria-label="Weniger wichtig"
                      className="rounded-full border border-border p-1.5 disabled:opacity-40"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-background p-3">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Lernerfahrung („Riss“)
            </h2>
            <div className="flex items-end gap-2">
              <input
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                maxLength={300}
                placeholder="Was wurde aus einem Fehler gelernt?"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={() => {
                  const value = lesson.trim();
                  if (value) learnMutation.mutate(value);
                }}
                disabled={learnMutation.isPending || lesson.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40"
              >
                <Zap className="h-4 w-4" /> Speichern
              </button>
            </div>
          </section>

          <OrbDevPanel snapshot={snapshot} lastDecision={lastDecision} />
        </div>
      )}
    </div>
  );
}
