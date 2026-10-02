/**
 * Regression: wiederholte, unpassende eigene ORB-Fragen (Verlauf 02.10.2026).
 * Isoliert – keine echte Datenbank, kein Modellaufruf.
 */
import { describe, expect, it } from "vitest";
import {
  deriveKnowledgeGaps,
  QUESTION_MEMORY_LOCK_MS,
  recentlyAskedMemoryIds,
  type AskedQuestion,
} from "@/orb-core/curiosity";
import { detectGaps, type GapNode } from "@/orb-core/gaps";
import { decideImpulse } from "@/orb-core/impulse";
import { buildSpeakSystemPrompt, ownQuestionHint } from "@/orb-core/llm/prompt.server";
import { scopedDb } from "@/orb-core/scope";
import { askProactively, AUTONOMOUS_QUESTION_SCOPE, type DB } from "@/orb-core/engine.server";

const NOW = Date.parse("2026-10-02T04:30:43Z");
const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const MEM = "14a7c0bd-a79f-44bf-9be7-4a2dc158d5b2";
const MEM_TEXT =
  "Mario möchte, dass bereits beantwortete Fragen und bereitgestellte Informationen im weiteren Gespräch berücksichtigt werden.";

/** Die vier tatsächlich gestellten Fragen zur selben Erinnerung (andere Wortwahl). */
const ASKED_TEXTS = [
  "Worauf soll sich diese Information beziehen?",
  "Auf welche Information bezieht sich das konkret?",
  "Worauf soll sich diese Berücksichtigung konkret beziehen?",
  "Worauf soll sich die Berücksichtigung bereits beantworteter Fragen und bereitgestellter Informationen konkret beziehen?",
];

const memNode: GapNode = {
  id: MEM,
  content: MEM_TEXT,
  topic: "mario",
  importance: 0.656,
  confidence: 0.9,
  longTermValue: 0.9,
  activationCount: 3,
  lastAccessedAt: NOW - 5 * MIN,
};

/** Wie im Live-Ladepfad: nur die Top-12 – Antwortknoten liegen ausserhalb. */
function liveGaps(connectionsToUnloadedAnswers: number) {
  const connections = Array.from({ length: connectionsToUnloadedAnswers }, (_, i) => ({
    sourceNodeId: MEM,
    targetNodeId: `answer-${i}`, // nicht in `nodes` → für die Erkennung unsichtbar
    weight: 0.56,
  }));
  return detectGaps({ nodes: [memNode], connections, now: NOW });
}

function impulseFor(lock: Set<string>, previous: string[] = []) {
  return decideImpulse({
    gaps: liveGaps(2),
    curiosity: 1,
    conversationTopics: ["mario"],
    previousImpulses: previous,
    recentlyAskedMemoryIds: lock,
    openQuestion: false,
    lastImpulseAt: null,
    now: NOW,
  });
}

const lockOf = (askedAtList: number[]) =>
  recentlyAskedMemoryIds(
    askedAtList.map((askedAt) => ({ memoryIds: [MEM], askedAt })),
    NOW,
  );

describe("Erinnerungssperre (7 Tage) – Impulspfad", () => {
  it("Ausgangslage: ohne Sperre erzeugt die Erinnerung genau die beobachtete Lücke", () => {
    const gaps = liveGaps(2);
    expect(gaps.some((g) => g.type === "missing_information" && g.relatedNodes.includes(MEM))).toBe(
      true,
    );
    expect(impulseFor(new Set()).impulse?.gap.relatedNodes).toContain(MEM);
  });

  it("dieselbe Erinnerung mit anderer Frageformulierung → keine neue Frage", () => {
    // Wortlaut-Prüfung allein lässt sie durch (Ursache des Fehlers) …
    expect(impulseFor(new Set(), ASKED_TEXTS).impulse).not.toBeNull();
    // … die Sperre auf Erinnerungsebene nicht.
    const d = impulseFor(lockOf([NOW - 30 * MIN]), ASKED_TEXTS);
    expect(d.impulse).toBeNull();
    expect(d.candidates.some((c) => c.gap.relatedNodes.includes(MEM))).toBe(false);
  });

  it("bereits beantwortete Frage vor 2 Minuten → gesperrt", () => {
    expect(impulseFor(lockOf([NOW - 2 * MIN])).impulse).toBeNull();
  });

  it("Antwortknoten ausserhalb der 12 geladenen Erinnerungen → Lücke bleibt erkannt, Frage trotzdem gesperrt", () => {
    expect(liveGaps(4).some((g) => g.relatedNodes.includes(MEM))).toBe(true);
    expect(impulseFor(lockOf([NOW - 2 * MIN])).impulse).toBeNull();
  });

  it("erneute Lücke nach mehreren Antworten (4 Fragen in 17 min) → gesperrt", () => {
    const lock = lockOf([NOW - 17 * MIN, NOW - 9 * MIN, NOW - 2 * MIN, NOW - 1 * MIN]);
    expect(impulseFor(lock, ASKED_TEXTS).impulse).toBeNull();
  });

  it("nach Ablauf der 7 Tage ist eine erneute Prüfung wieder möglich", () => {
    expect(lockOf([NOW - QUESTION_MEMORY_LOCK_MS - 1]).size).toBe(0);
    expect(impulseFor(lockOf([NOW - 8 * DAY])).impulse?.gap.relatedNodes).toContain(MEM);
    // Grenze: kurz vor Ablauf weiterhin gesperrt.
    expect(lockOf([NOW - QUESTION_MEMORY_LOCK_MS + MIN]).has(MEM)).toBe(true);
  });

  it("andere Erinnerungen bleiben unberührt", () => {
    const lock = recentlyAskedMemoryIds([{ memoryIds: ["andere"], askedAt: NOW - MIN }], NOW);
    expect(impulseFor(lock).impulse?.gap.relatedNodes).toContain(MEM);
  });

  it("fehlender Zeitpunkt sperrt nichts (keine erfundene Sperre)", () => {
    expect(recentlyAskedMemoryIds([{ memoryIds: [MEM], askedAt: null }], NOW).size).toBe(0);
  });
});

describe("Erinnerungssperre – deriveKnowledgeGaps", () => {
  const memories = [
    {
      id: MEM,
      content: "Mario mag lieber Pizza oder Pasta?",
      topic: "mario",
      importance: 0.7,
      confidence: 0.9,
      activationCount: 2,
      lastAccessedAt: NOW - MIN,
    },
  ];
  const base = { memories, interests: [], conversationTopics: ["mario"], curiosity: 1, now: NOW };
  const askedRow = (askedAt: number, kind: AskedQuestion["kind"] = null): AskedQuestion => ({
    nodeId: MEM,
    topic: null,
    kind,
    question: "",
    answered: true,
    askedAt,
  });

  it("ohne Frage entsteht eine Lücke", () => {
    expect(deriveKnowledgeGaps({ ...base, asked: [] }).length).toBeGreaterThan(0);
  });
  it("Frage zu derselben Erinnerung (beliebige Art) innerhalb 7 Tagen → keine Lücke", () => {
    expect(deriveKnowledgeGaps({ ...base, asked: [askedRow(NOW - 2 * MIN)] })).toEqual([]);
  });
  it("nach 7 Tagen wieder prüfbar", () => {
    expect(
      deriveKnowledgeGaps({ ...base, asked: [askedRow(NOW - 8 * DAY)] }).length,
    ).toBeGreaterThan(0);
  });
});

describe("Antwortschritt kennt die eigene Frage", () => {
  const promptBase = {
    text: "welche berücksichtigung",
    state: { curiosity: 1, joy: 1, fear: 0, trust: 1, uncertainty: 0, energy: 0.2 },
    goals: ["help_user"],
    decision: "answer",
    recalled: [],
    interests: [],
    context: "Nutzer: Machtblase der Lobbylisten …",
  } as unknown as Parameters<typeof buildSpeakSystemPrompt>[0];

  it("„Welche Berücksichtigung?“ → Frage und gespeicherte Lücke stehen im Prompt, kein erfundener Bezug", () => {
    const p = buildSpeakSystemPrompt({
      ...promptBase,
      ownQuestion: {
        question: ASKED_TEXTS[2]!,
        gap: `„${MEM_TEXT.slice(0, 80)}…“ ist wichtig, aber mit nichts verknüpft.`,
      },
    });
    expect(p).toContain(ASKED_TEXTS[2]);
    expect(p).toContain("Mario möchte, dass bereits beantwortete Fragen");
    expect(p).toContain("Erfinde keinen anderen Bezug");
    expect(p).toContain("stelle dieselbe Frage nicht erneut");
  });

  it("ohne gespeicherte Lücke → ORB soll offen sagen, dass der Bezug unsicher ist", () => {
    const hint = ownQuestionHint({ question: "Worauf bezieht sich das?", gap: null });
    expect(hint).toContain("nicht sicher rekonstruieren");
  });

  it("ohne offene Frage bleibt der Prompt byte-identisch", () => {
    expect(buildSpeakSystemPrompt({ ...promptBase, ownQuestion: null })).toBe(
      buildSpeakSystemPrompt(promptBase),
    );
    expect(ownQuestionHint(null)).toBe("");
  });
});

describe("Autonome Fragen nur im ORB-Core-Chat", () => {
  const SENTINEL = new Error("db-accessed");
  function recordingDb() {
    const tables: string[] = [];
    const db = {
      from(table: string) {
        tables.push(table);
        throw SENTINEL;
      },
      rpc() {
        tables.push("rpc");
        throw SENTINEL;
      },
    } as unknown as DB;
    return { db, tables };
  }

  for (const scope of ["normal", "y_dude", "unassigned"] as const) {
    it(`keine autonome Frage im Scope ${scope} – kein Laden, kein Eintrag`, async () => {
      const { db, tables } = recordingDb();
      const r = await askProactively(scopedDb(db, scope), "user-1");
      expect(r.asked).toBe(false);
      expect(r.question).toBeNull();
      expect(tables).toEqual([]);
    });
  }

  it("ohne Bereichsbindung ebenfalls still (sicherer Standard)", async () => {
    const { db, tables } = recordingDb();
    expect((await askProactively(db, "user-1")).asked).toBe(false);
    expect(tables).toEqual([]);
  });

  it("Scope orb_core → der bestehende Prüfpfad läuft (lädt Daten)", async () => {
    expect(AUTONOMOUS_QUESTION_SCOPE).toBe("orb_core");
    const { db, tables } = recordingDb();
    await expect(askProactively(scopedDb(db, "orb_core"), "user-1")).rejects.toBe(SENTINEL);
    expect(tables.length).toBeGreaterThan(0);
  });
});
