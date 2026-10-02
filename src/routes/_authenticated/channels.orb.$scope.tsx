/**
 * ORB Core V0.2 – experimenteller Bereich innerhalb von Channels.
 *
 * Gesicht, Gedächtnisnetz, Sprache, Interessen, Vorschläge, Rückmeldungen und
 * Testbereich in einer Ansicht. Die Zustandswerte sind eine technische
 * Simulation, kein Bewusstsein. Der ORB handelt nie selbst: er liest, bewertet
 * und schlägt vor – likt, kommentiert, folgt und schreibt aber nichts.
 */

import { ClientOnly, createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createSendGate, lastOrbMessageId } from "@/integrations/y-dude-orb/reply-ref";
import {
  Activity,
  BrainCircuit,
  Database,
  GitBranch,
  Loader2,
  Network,
  Search,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { BackButton } from "@/components/ui/nav-buttons";
import { goBackOr } from "@/lib/back-nav";
import { OrbChat } from "@/components/orb/OrbChat";
import type { OrbVisualItem } from "@/components/orb/OrbVisualMessage";
import { OrbDevPanel } from "@/components/orb/OrbDevPanel";
import { OrbErrorState } from "@/components/orb/OrbErrorState";
import { OrbExperimentNotice } from "@/components/orb/OrbExperimentNotice";
import { OrbGraph } from "@/components/orb/OrbGraph";
import { OrbInterests } from "@/components/orb/OrbInterests";
import { OrbSuggestions } from "@/components/orb/OrbSuggestions";
import { OrbTechnicalDeck, type OrbTechnicalItem } from "@/components/orb/OrbTechnicalDeck";
import type { OrbAutonomyAttempt } from "@/components/orb/OrbDevPanel";
import { OrbVoice } from "@/components/orb/OrbVoice";
import { Button } from "@/components/ui/button";
import { useOrbPresence } from "@/integrations/y-dude-orb/use-orb-presence";
import {
  analyzeOrbContext,
  decideOrbSuggestion,
  getOrbSnapshot,
  inspectOrbCuriosity,
  observeOrbFeed,
  recordOrbLearning,
  requestOrbCuriosity,
  sendOrbFeedback,
  sendOrbInput,
  generateOrbVisual,
  speakOrbReply,
  transcribeOrbAudio,
} from "@/integrations/y-dude-orb/orb.functions";
import { orbChatRequestDiagnostic, type ChatBridgeView } from "@/lib/orb-chat-bridge.functions";
import { detectDeveloperDiagnosticIntent } from "@/orb-dev/chat-bridge";
import { adminCheckAccess } from "@/lib/admin.functions";
import {
  ORB_CHAT_SCOPES,
  ORB_SCOPE_LABEL,
  RETRIEVAL_CHANNEL,
  isOrbChatScope,
  type OrbChatScope,
} from "@/orb-sdk";
import { COGNITIVE_CHANNEL, toCognitiveView } from "@/lib/orb-knowledge-graph/cognitive-layers";

/** Bestehender Knowledge Globe – nur als visuelle Hintergrundebene, erst im Browser geladen. */
const KnowledgeGraphStage = lazy(
  () => import("@/components/orb-knowledge-graph/KnowledgeGraphStage"),
);

/** Nur Darstellung: kompakte Cognitive-Ansicht an den Knowledge Globe (flüchtig). */
function broadcastCognitive(obs: unknown) {
  if (typeof BroadcastChannel === "undefined") return;
  const view = toCognitiveView(obs, new Date().toISOString());
  if (!view) return;
  const ch = new BroadcastChannel(COGNITIVE_CHANNEL);
  ch.postMessage(view);
  ch.close();
}

export const Route = createFileRoute("/_authenticated/channels/orb/$scope")({
  // Scope kommt aus der Route; nur die drei festen Bereiche sind gültig.
  beforeLoad: ({ params }) => {
    if (!isOrbChatScope(params.scope)) throw notFound();
  },
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
  component: OrbScopePage,
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

/** Bereichswechsel baut den Chat vollständig neu auf (kein alter Verlauf). */
function OrbScopePage() {
  const { scope } = Route.useParams();
  if (!isOrbChatScope(scope)) return <OrbErrorState />;
  return <OrbCorePage key={scope} scope={scope} />;
}


function OrbCorePage({ scope }: { scope: OrbChatScope }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loadSnapshot = useServerFn(getOrbSnapshot);
  const send = useServerFn(sendOrbInput);
  const generateVisual = useServerFn(generateOrbVisual);
  // P2: von ORB erzeugte Bilder – nur diese Sitzung, nie gespeichert.
  const [visuals, setVisuals] = useState<OrbVisualItem[]>([]);
  const learn = useServerFn(recordOrbLearning);
  const feedback = useServerFn(sendOrbFeedback);
  // M4: bestehende Admin-Prüfung – nur Admins dürfen die Developer-Analyse auslösen.
  const checkAdmin = useServerFn(adminCheckAccess);
  const adminAccess = useQuery({
    queryKey: ["admin-check-access"],
    queryFn: () => checkAdmin(),
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminAccess.data?.isAdmin === true;
  const observe = useServerFn(observeOrbFeed);
  const decide = useServerFn(decideOrbSuggestion);
  const transcribe = useServerFn(transcribeOrbAudio);
  const speak = useServerFn(speakOrbReply);
  const curiosityFn = useServerFn(requestOrbCuriosity);
  const inspectCuriosity = useServerFn(inspectOrbCuriosity);
  const analyzeContext = useServerFn(analyzeOrbContext);
  const requestDiagnostic = useServerFn(orbChatRequestDiagnostic);

  const [lastDecision, setLastDecision] = useState<{
    decision: string;
    reason: string;
    importance: number;
    llm: { provider: "openai" | "local"; fallbackUsed: boolean } | null;
  } | null>(null);

  const [lesson, setLesson] = useState("");
  const [lastAutonomyAttempt, setLastAutonomyAttempt] = useState<OrbAutonomyAttempt | null>(null);
  // NUR Dry-Run (Experiment): stille Versuche in Folge – reine Beobachtung.
  const silentStreakRef = useRef(0);
  const [reaction, setReaction] = useState<"learned" | "reactivated" | "interested" | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);
  // Ergebnis einer ausdrücklich angeforderten technischen Analyse. Rein
  // informativ: der Vorschlag wartet immer auf eine menschliche Freigabe.
  const [bridge, setBridge] = useState<ChatBridgeView | null>(null);
  // Reiner UI-Zustand: Globe als Hintergrund an/aus (keine Speicherung).
  const [globeOn, setGlobeOn] = useState(false);
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
    queryKey: ["orb", "snapshot", scope],
    queryFn: () => loadSnapshot({ data: { scope } }),
  });

  const sendMutation = useMutation({
    mutationFn: (input: {
      text: string;
      images?: { mimeType: string; dataBase64: string }[];
      replyToOrbMessageId?: string;
    }) =>
      send({
        data: {
          scope,
          text: input.text,
          images: input.images,
          replyToOrbMessageId: input.replyToOrbMessageId,
        },
      }),
    onSuccess: (turn) => {
      setLastDecision({
        decision: turn.decision,
        reason: turn.decisionReason,
        importance: turn.importance,
        llm: turn.llm ? { provider: turn.llm.provider, fallbackUsed: turn.llm.fallbackUsed } : null,
      });
      setLastReply(turn.reply);
      setReaction(turn.learnedNew ? "learned" : turn.reactivated ? "reactivated" : null);

      queryClient.setQueryData(["orb", "snapshot", scope], turn.snapshot);
      // Flüchtiges Retrieval-Event an die Knowledge-Graph-Seite (nur Admins, nur Browser).
      if (isAdmin && turn.retrievalEvent && typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel(RETRIEVAL_CHANNEL);
        ch.postMessage(turn.retrievalEvent);
        ch.close();
      }
      if (isAdmin) broadcastCognitive(turn.cognitive);
      if (turn.aiStatus === "quota") toast.error("Die Sprachschicht ist derzeit nicht verfügbar.");

      // Visual Memory: nur tatsächlich verknüpfte, gespeicherte Bilder der
      // abgerufenen Erinnerungen (max. 3 je Antwort, je Sitzung einmal).
      const memoryImgs = (turn.memoryImages ?? []).flatMap((m) => m.images).slice(0, 3);
      if (memoryImgs.length > 0) {
        const lastOrb = [...turn.snapshot.messages].reverse().find((m) => m.role === "orb");
        setVisuals((prev) => {
          const shown = new Set(prev.map((v) => v.key));
          const add = memoryImgs
            .filter((img) => img.url && !shown.has(`visual-${scope}-mem-${img.id}`))
            .map(
              (img): OrbVisualItem => ({
                key: `visual-${scope}-mem-${img.id}`,
                afterMessageId: lastOrb?.id ?? null,
                kind: "memory",
                status: "ok",
                src: img.url!,
                origin: img.sourceType,
                createdAt: img.createdAt,
              }),
            );
          return add.length > 0 ? [...prev, ...add] : prev;
        });
      }

      // P2: gültiger, signierter Visual-Intent ⇒ Bild als eigene ORB-Nachricht.
      if (turn.visual) {
        const token = turn.visual.token;
        const key = `visual-${scope}-${Date.now()}`;
        const lastOrb = [...turn.snapshot.messages].reverse().find((m) => m.role === "orb");
        setVisuals((prev) => [
          ...prev,
          { key, afterMessageId: lastOrb?.id ?? null, kind: turn.visual!.kind, status: "loading" },
        ]);
        const update = (patch: Partial<OrbVisualItem>) =>
          setVisuals((prev) => prev.map((v) => (v.key === key ? { ...v, ...patch } : v)));
        void generateVisual({ data: { scope, token } })
          .then((res) => {
            if (res.status === "ok")
              update({ status: "ok", src: `data:${res.mimeType};base64,${res.dataBase64}` });
            else update({ status: "error", message: res.message });
          })
          .catch(() =>
            update({ status: "error", message: "Das Bild konnte nicht erstellt werden." }),
          );
      }

      // Stille Hintergrundauswertung des Gesprächs: keine sichtbare Reaktion,
      // kein Einfluss auf diese Antwort. Fehler bleiben ohne Folgen.
      void analyzeContext({ data: { scope } })
        .then((report) => {
          if (report.memoriesCreated + report.memoriesUpdated + report.memoriesDecayed > 0) {
            void queryClient.invalidateQueries({ queryKey: ["orb", "snapshot", scope] });
          }
        })
        .catch(() => undefined);
    },
    onError: () => toast.error("Der ORB konnte die Erfahrung nicht verarbeiten."),
  });

  // Brücke Chat → Developer / Repair: startet ausschliesslich eine lesende
  // Analyse. Die Berechtigung wird serverseitig erneut geprüft; aus dem Chat
  // entsteht nie eine Codeänderung, Freigabe, Sandbox-Ausführung oder ein
  // Deployment.
  const bridgeMutation = useMutation({
    mutationFn: (text: string) =>
      requestDiagnostic({ data: { action: "developer_diagnostic" as const, text } }),
    onSuccess: (view) => {
      setBridge(view);
      if (view.fixId) toast.success(`Fixvorschlag ${view.fixId} wartet auf Freigabe.`);
    },
    // Fehlende Berechtigung oder abgelehnte Anfrage bleiben ohne Folgen für das Gespräch.
    onError: () => setBridge(null),
  });

  const learnMutation = useMutation({
    mutationFn: (value: string) => learn({ data: { scope, lesson: value } }),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["orb", "snapshot", scope], snapshot);
      setLesson("");
      setReaction("learned");
      toast.success("Lernerfahrung gespeichert – der ORB zeigt einen Riss.");
    },
    onError: () => toast.error("Die Lernerfahrung konnte nicht gespeichert werden."),
  });

  const feedbackMutation = useMutation({
    mutationFn: (input: { nodeId: string; kind: "positive" | "negative" }) =>
      feedback({ data: { ...input, scope } }),
    onSuccess: (snapshot, input) => {
      queryClient.setQueryData(["orb", "snapshot", scope], snapshot);
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
    mutationFn: () => observe({ data: { scope } }),
    onSuccess: (result) => {
      queryClient.setQueryData(["orb", "snapshot", scope], result.snapshot);
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
    mutationFn: (input: { suggestionId: string; accepted: boolean }) =>
      decide({ data: { ...input, scope } }),
    onSuccess: (snapshot) => queryClient.setQueryData(["orb", "snapshot", scope], snapshot),
    onError: () => toast.error("Die Entscheidung konnte nicht gespeichert werden."),
  });

  const snapshot = snapshotQuery.data;

  // Lernereignisse: Knoten vom Typ „decision“ entstehen ausschliesslich durch
  // Lernvorgänge (Chat-Pfad engine.server.ts:1435, recordLearning:1787). Sie
  // werden hier nur angezeigt – Selektion und Sortierung, keine Logik.
  const lessons = snapshot
    ? snapshot.nodes
        .filter((n) => n.type === "decision")
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    : [];
  const lastLesson = lessons[0] ?? null;
  const lastLessonAt = lastLesson
    ? new Date(lastLesson.createdAt).toLocaleString("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  // P5-H: gemeinsamer Sendepfad für Text, Bild und Sprache.
  // Die Reply-ID wird erst hier – unmittelbar vor dem Senden – aus dem
  // aktuellen Cache gelesen. Die synchrone Sperre verhindert eine zweite
  // Anfrage, auch wenn ein Callback mit veraltetem Render-Zustand feuert.
  const sendGateRef = useRef(createSendGate());
  const curiosityPendingRef = useRef(false);
  const sendUserInput = (input: {
    text: string;
    images?: { mimeType: string; dataBase64: string }[];
  }): boolean => {
    if (!sendGateRef.current.tryAcquire(curiosityPendingRef.current)) return false;
    const current = queryClient.getQueryData<{ messages?: { id: string; role: string }[] }>([
      "orb",
      "snapshot",
    ]);
    sendMutation.mutate(
      { ...input, replyToOrbMessageId: lastOrbMessageId(current?.messages) },
      { onSettled: () => sendGateRef.current.release() },
    );
    return true;
  };

  // ---------------------------------------------------------- Kernpräsenz ---
  // Der Leerlauf-Beobachter läuft clientseitig; erst wenn alle Bedingungen
  // erfüllt sind, entsteht genau eine Anfrage. Kein Polling, keine DB-Abfrage
  // pro Takt. Der ORB spricht dabei ausschliesslich in diesem ORB-Core-Chat.
  const curiosityMutation = useMutation({
    mutationFn: () => curiosityFn({ data: { scope } }),
    onSuccess: (result) => {
      // Reine Beobachtung: der Server liefert bereits Begründung, Aktion und
      // Wert eines jeden Versuchs. Sie werden nur im Testbereich angezeigt,
      // nichts davon verändert Entscheidung, Zustand oder Ablauf.
      setLastAutonomyAttempt({
        at: new Date().toISOString(),
        asked: result.asked,
        action: result.action,
        reason: result.reason,
        topic: result.topic,
        kind: result.kind,
        score: result.score,
      });
      // NUR Dry-Run (Experiment): stille Versuche in Folge zählen – reine
      // Beobachtung, beeinflusst keinen Takt und keine Entscheidung.
      silentStreakRef.current = result.asked ? 0 : silentStreakRef.current + 1;
      if (isAdmin && result.asked) broadcastCognitive(result.cognitive);
      if (!result.asked || !result.question) return;
      if (result.snapshot) queryClient.setQueryData(["orb", "snapshot", scope], result.snapshot);
      setLastReply(result.question);
      setReaction("interested");
      presence.noteProactive();
      setSpeakRequest({ id: Date.now(), text: result.question });
    },
    // Bleibt still: eine fehlgeschlagene eigene Frage ist kein Benutzerfehler.
    onError: (error) => console.error("ORB Kernpräsenz nicht möglich", error),
  });
  curiosityPendingRef.current = curiosityMutation.isPending;

  const askProactively = useCallback(() => {
    curiosityMutation.mutate();
  }, [curiosityMutation]);

  // Testbereich: Einblick in den Curiosity Core – ausschliesslich auf Knopfdruck.
  const curiosityInsight = useMutation({
    mutationFn: () => inspectCuriosity({ data: { scope } }),
    onError: () => toast.error("Der Neugier-Einblick war nicht möglich."),
  });

  const presence = useOrbPresence({
    curiosity: snapshot?.state.curiosity ?? 0,
    typing,
    speaking,
    listening,
    pending: sendMutation.isPending || curiosityMutation.isPending,
    // Autonome eigene Fragen nur im ORB-Core-Chat (Server prüft zusätzlich).
    enabled: Boolean(snapshot) && scope === "orb_core",
    onAsk: askProactively,
    // NUR Dry-Run (Experiment): bereits vorhandene Werte, nur protokolliert.
    dryRun: {
      energy: snapshot?.state.energy ?? null,
      lastAttempt: lastAutonomyAttempt,
      silentStreak: silentStreakRef.current,
    },
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
                    <div className="font-mono text-sm font-bold">{Math.round(value * 100)} %</div>
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
            <div className="space-y-3">
              <div className="rounded-md border border-border bg-background p-2.5">
                <p className="text-xs font-semibold text-foreground">
                  {snapshot.cracks} {snapshot.cracks === 1 ? "Lernerfahrung" : "Lernerfahrungen"}{" "}
                  vorhanden
                </p>
                {lastLesson ? (
                  <div className="mt-2 min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Letzte · {lastLessonAt}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {lastLesson.content}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {snapshot.cracks > 0
                      ? "Keine Lernerfahrung unter den geladenen Knoten sichtbar."
                      : "Noch keine Lernerfahrung vorhanden."}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="orb-lesson" className="text-xs font-semibold text-foreground">
                  Lernerfahrung („Riss“)
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    id="orb-lesson"
                    value={lesson}
                    onChange={(event) => setLesson(event.target.value)}
                    maxLength={300}
                    rows={4}
                    placeholder="Was wurde aus einem Fehler gelernt?"
                    className="min-h-[6rem] w-full min-w-0 flex-1 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand"
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      const value = lesson.trim();
                      if (value) learnMutation.mutate(value);
                    }}
                    disabled={learnMutation.isPending || lesson.trim().length === 0}
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                  >
                    <Zap className="size-4" /> Speichern
                  </Button>
                </div>
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
                lastAutonomyAttempt={lastAutonomyAttempt}
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
            Persönlicher Gesprächskern · Bereich {ORB_SCOPE_LABEL[scope]}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-brand/35 bg-brand/10 px-2 py-1 text-[10px] font-semibold uppercase text-brand">
            Experiment
          </span>
          <OrbExperimentNotice>
            {isAdmin && (
              <Link
                to="/orb/knowledge-graph"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
              >
                <Network className="size-3.5" aria-hidden />
                Wissensgraph
              </Link>
            )}
          </OrbExperimentNotice>
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

          <div className="relative isolate">
            {isAdmin && globeOn && (
              <div
                aria-hidden="true"
                inert
                className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-lg [&>div]:!h-full [&>div>*:not(:first-child)]:hidden"
              >
                <ClientOnly fallback={null}>
                  <Suspense fallback={null}>
                    <KnowledgeGraphStage />
                  </Suspense>
                </ClientOnly>
              </div>
            )}
            <div className="space-y-4">
              {(bridgeMutation.isPending || bridge) && (
                <section className="rounded-lg border border-border bg-surface/70 px-4 py-3 text-xs">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand">
                    Technische Analyse (nur lesend)
                  </p>
                  {bridgeMutation.isPending ? (
                    <p className="mt-1 text-muted-foreground">
                      ORB analysiert die technische Ursache …
                    </p>
                  ) : bridge ? (
                    <div className="mt-1 space-y-1">
                      <p>{bridge.reply}</p>
                      {bridge.accepted && (
                        <p className="text-[11px] text-muted-foreground">
                          Anfrage {bridge.requestId} · Ursache {bridge.confidence} ·
                          {bridge.fixId
                            ? ` ${bridge.fixId} wartet auf Freigabe im Developer-Bereich`
                            : " kein Fixvorschlag erstellt"}{" "}
                          · nichts verändert, nichts ausgeführt, nichts veröffentlicht
                        </p>
                      )}
                    </div>
                  ) : null}
                </section>
              )}

              <OrbChat
                glass={isAdmin && globeOn}
                headerActions={
                  isAdmin ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={globeOn}
                      onClick={() => setGlobeOn((v) => !v)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/80 py-1 pl-3 pr-1 text-xs font-semibold text-foreground"
                    >
                      Knowledge Globe
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${globeOn ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {globeOn ? "ON" : "OFF"}
                      </span>
                    </button>
                  ) : undefined
                }
                messages={snapshot.messages}
                visuals={visuals.filter(
                  (v) =>
                    v.key.startsWith(`visual-${scope}-`) &&
                    (v.afterMessageId === null ||
                      snapshot.messages.some((m) => m.id === v.afterMessageId)),
                )}
                pending={sendMutation.isPending || curiosityMutation.isPending}
                onSend={(text, images) => {
                  presence.noteActivity();
                  sendUserInput({ text, images });
                  // Nur eine AUSDRÜCKLICHE technische Anweisung darf zusätzlich eine
                  // Analyse anfordern. Normale Nachrichten lösen nichts aus.
                  if (isAdmin && detectDeveloperDiagnosticIntent(text).kind === "diagnostic") {
                    setBridge(null);
                    bridgeMutation.mutate(text);
                  }
                }}
                onTypingChange={setTyping}
                onActivity={presence.noteActivity}
                voiceControls={
                  <OrbVoice
                    compact
                    onTranscript={(text) => {
                      // P5-H: Sperre im tatsächlichen Sendepfad – läuft bereits
                      // eine Anfrage, wird das Transcript nicht gesendet.
                      if (!sendUserInput({ text })) {
                        toast.message("ORB antwortet noch – bitte gleich noch einmal sprechen.");
                        return;
                      }
                      presence.noteActivity();
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
            </div>
          </div>

          <OrbTechnicalDeck items={technicalItems} />
        </div>
      )}
    </div>
  );
}
