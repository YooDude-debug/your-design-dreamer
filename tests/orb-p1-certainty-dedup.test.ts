import { describe, expect, it } from "vitest";
import { buildSpeakSystemPrompt, type SpeakPromptInput } from "@/orb-core/llm/prompt.server";
import { CERTAINTY_HINT, type MemoryCertainty } from "@/orb-core/continuity";
import { HONEST_PRESENCE_EXPLANATION } from "@/orb-core/presence";

const state = { curiosity: 1, joy: 0.2, fear: 0, trust: 0.5, uncertainty: 0.07, energy: 0.25 };
const mem = (k: number) => `Ich spiele Fortnite auf epischen Einstellungen, Eintrag ${k}.`;

function input(levels: MemoryCertainty[]): SpeakPromptInput {
  const recalled = levels.map((_, k) => mem(k));
  return {
    state: state as SpeakPromptInput["state"],
    goals: ["help_user"],
    decision: "remind",
    recalled,
    interests: [],
    phrasings: levels.map((c, k) => ({ content: mem(k), certainty: c, hint: CERTAINTY_HINT[c] })),
    mode: "DIRECT_ANSWER",
    modeReason: "Test",
  };
}

const count = (s: string, sub: string) => s.split(sub).length - 1;

describe("P1 Sicherheitsinformation an der Erinnerung", () => {
  it("0 Memories: kein Sicherheitsblock, Hinweis auf fehlende Erinnerung", () => {
    const p = buildSpeakSystemPrompt(input([]));
    expect(p).toContain("Du hast zu dieser Eingabe keine passende Erinnerung.");
    expect(p).not.toContain("Sicherheit deiner Erinnerungen");
  });

  it("1 Memory: Inhalt, Stufe und Hinweis enthalten, Inhalt nur einmal", () => {
    const p = buildSpeakSystemPrompt(input(["vage"]));
    expect(count(p, mem(0))).toBe(1);
    expect(p).toContain(`„${mem(0)}“ [Sicherheit: vage]`);
    expect(count(p, CERTAINTY_HINT.vage)).toBe(1);
  });

  it("mehrere und maximal 6 Memories: jede genau einmal mit ihrer Stufe", () => {
    for (const n of [3, 6]) {
      const levels = Array.from({ length: n }, () => "wahrscheinlich" as MemoryCertainty);
      const p = buildSpeakSystemPrompt(input(levels));
      for (let k = 0; k < n; k++) {
        expect(count(p, mem(k))).toBe(1);
        expect(p).toContain(`„${mem(k)}“ [Sicherheit: wahrscheinlich]`);
      }
      expect(count(p, CERTAINTY_HINT.wahrscheinlich)).toBe(1);
    }
  });

  it("unterschiedliche Stufen: jede Stufe richtig zugeordnet, Hinweis je Stufe einmal", () => {
    const levels: MemoryCertainty[] = [
      "sicher",
      "vage",
      "wahrscheinlich",
      "vage",
      "sicher",
      "vage",
    ];
    const p = buildSpeakSystemPrompt(input(levels));
    levels.forEach((c, k) => expect(p).toContain(`„${mem(k)}“ [Sicherheit: ${c}]`));
    for (const c of ["sicher", "wahrscheinlich", "vage"] as MemoryCertainty[]) {
      expect(count(p, CERTAINTY_HINT[c])).toBe(1);
      expect(p).toContain(`${c}: ${CERTAINTY_HINT[c]}`);
    }
  });

  it("nicht vorkommende Stufe erzeugt keinen Hinweis", () => {
    const p = buildSpeakSystemPrompt(input(["sicher", "sicher"]));
    expect(p).not.toContain(CERTAINTY_HINT.vage);
    expect(p).not.toContain(CERTAINTY_HINT.wahrscheinlich);
  });

  it("Sicherheitsangabe ohne aktive Erinnerung geht nicht verloren", () => {
    const i = input(["vage"]);
    i.recalled = [];
    const p = buildSpeakSystemPrompt(i);
    expect(p).toContain(`„${mem(0)}“ = vage (${CERTAINTY_HINT.vage})`);
  });

  it("bestehende Prompt-Regeln bleiben erhalten", () => {
    const p = buildSpeakSystemPrompt(input(["vage", "sicher"]));
    for (const rule of [
      "Du bist ORB Core, eine kleine digitale Entität mit eigenem simulierten Innenzustand.",
      "Antworte ausschliesslich auf Deutsch (de-DE), höchstens drei Sätze, ohne Aufzählungen.",
      "Handlungsentscheidung: remind. Beziehe dich ausdrücklich auf die passenden Erinnerungen.",
      "Erfinde keine inneren Vorgänge",
      "Behaupte niemals, echtes Bewusstsein oder echte Gefühle zu haben.",
      "Du hast keine Pause, keine Hintergrundarbeit und keine Ausfallzeit",
      HONEST_PRESENCE_EXPLANATION,
    ]) {
      expect(p).toContain(rule);
    }
  });

  it("Eingaben (Memory-Auswahl) werden nicht verändert", () => {
    const i = input(["vage", "sicher", "wahrscheinlich"]);
    const before = JSON.stringify(i);
    buildSpeakSystemPrompt(i);
    expect(JSON.stringify(i)).toBe(before);
  });
});
