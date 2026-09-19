/**
 * ORB Core – Bugfix: interner Wartezustand darf kein „Pausenmodus“ werden.
 *
 * Geprüft wird die reine Logik: Nutzereingaben werden immer normal
 * beantwortet, WAIT/DO_NOTHING erzeugen keine sichtbare Nachricht, nur ASK
 * darf eine proaktive Frage auslösen, und es entsteht keine Pausen-,
 * Beschäftigungs- oder Arbeitssprache aus internen Zuständen.
 */
import { describe, expect, it } from "vitest";

import { conversationDecision, decide, type OrbState } from "@/lib/orb-core";
import { CURIOSITY_ASK_THRESHOLD, decideCuriosity, type KnowledgeGap } from "@/lib/orb-curiosity";
import {
  HONEST_PRESENCE_EXPLANATION,
  claimsFakePause,
  presenceProducesUserMessage,
  stripFakePauseClaim,
} from "@/lib/orb-presence";

const NOW = 1_700_000_000_000;

const state = (over: Partial<OrbState> = {}): OrbState => ({
  curiosity: 0.6,
  joy: 0.5,
  fear: 0.1,
  trust: 0.5,
  uncertainty: 0.2,
  energy: 0.8,
  ...over,
});

const gap = (over: Partial<KnowledgeGap> = {}): KnowledgeGap => ({
  nodeId: "n1",
  topic: "hardware",
  memory: "Ich baue gerade einen neuen Rechner",
  gap: "Welchen RAM brauchst du?",
  kind: "unknown_detail",
  score: 0.9,
  reason: "Offene Wissenslücke zum Rechnerbau.",
  ...over,
});

/** Antwortpfad einer echten Nutzereingabe – so wie im Server verdrahtet. */
const answerFor = (s: OrbState, opts?: { isQuestion?: boolean }) =>
  conversationDecision(
    decide({
      state: s,
      recalled: 1,
      isQuestion: opts?.isQuestion ?? false,
      isLearning: false,
    }).decision,
  ).decision;

describe("Nutzereingabe hat immer Vorrang", () => {
  it("1. „Hallo“ wird normal beantwortet, keine Pausenmeldung", () => {
    expect(answerFor(state())).not.toBe("stay_silent");
  });

  it("2./3. interner WAIT/DO_NOTHING blockiert die Antwort nicht", () => {
    for (const action of ["WAIT", "DO_NOTHING"] as const) {
      expect(presenceProducesUserMessage(action)).toBe(false);
    }
    expect(answerFor(state({ curiosity: 0.05 }))).not.toBe("stay_silent");
  });

  it("4. Cooldown betrifft nur eigene Fragen, nicht die Antwort", () => {
    const v = decideCuriosity({
      curiosity: 0.9,
      energy: 0.9,
      gaps: [gap()],
      lastQuestionAt: NOW - 1000,
      openQuestion: false,
      now: NOW,
    });
    expect(v.action).not.toBe("ASK");
    expect(presenceProducesUserMessage(v.action)).toBe(false);
    expect(answerFor(state())).not.toBe("stay_silent");
  });

  it("5. niedrige Energie verhindert keine Antwort", () => {
    const internal = decide({
      state: state({ energy: 0.02 }),
      recalled: 1,
      isQuestion: false,
      isLearning: false,
    }).decision;
    expect(internal).toBe("stay_silent"); // interner Steuerwert bleibt erhalten
    expect(conversationDecision(internal).decision).toBe("answer");
  });
});

describe("Ohne Nutzereingabe bleibt ORB still", () => {
  it("6./7. WAIT und DO_NOTHING erzeugen keine Nachricht", () => {
    expect(presenceProducesUserMessage("WAIT")).toBe(false);
    expect(presenceProducesUserMessage("DO_NOTHING")).toBe(false);
  });

  it("8. ASK mit echter Wissenslücke erzeugt eine proaktive Frage", () => {
    const v = decideCuriosity({
      curiosity: 0.9,
      energy: 0.9,
      gaps: [gap()],
      lastQuestionAt: null,
      openQuestion: false,
      now: NOW,
    });
    expect(v.action).toBe("ASK");
    expect(v.score).toBeGreaterThanOrEqual(CURIOSITY_ASK_THRESHOLD);
    expect(v.gap?.topic).toBe("hardware");
    expect(presenceProducesUserMessage(v.action)).toBe(true);
  });
});

describe("Keine vorgetäuschte Pause in der Sprache", () => {
  it("9./10. behauptete Pause wird durch die technische Wahrheit ersetzt", () => {
    expect(stripFakePauseClaim("Kein Fehler – ich brauche gerade eine Pause.")).toBe(
      HONEST_PRESENCE_EXPLANATION,
    );
    expect(
      stripFakePauseClaim("Ich brauche noch eine Pause, kann dir aber nicht Bescheid geben."),
    ).toBe(HONEST_PRESENCE_EXPLANATION);
    expect(HONEST_PRESENCE_EXPLANATION).toMatch(/interner Zustandswert/);
  });

  it("11. keine Pausensprache", () => {
    expect(claimsFakePause("Hallo, ich brauche gerade eine Pause.")).toBe(true);
    expect(claimsFakePause("Meine Pause ist vorbei.")).toBe(true);
  });

  it("12. keine Beschäftigt-Sprache", () => {
    expect(claimsFakePause("Ich bin gerade beschäftigt.")).toBe(true);
    expect(claimsFakePause("Ich bin momentan nicht verfügbar.")).toBe(true);
  });

  it("13. keine Arbeits-Sprache", () => {
    expect(claimsFakePause("Ich arbeite gerade an etwas.")).toBe(true);
    expect(claimsFakePause("Ich bin gleich wieder da.")).toBe(true);
  });

  it("normale Antworten bleiben unverändert", () => {
    const ok = "Hallo! Du hattest vorhin deinen Rechner erwähnt – welchen RAM nimmst du?";
    expect(claimsFakePause(ok)).toBe(false);
    expect(stripFakePauseClaim(ok)).toBe(ok);
  });
});
