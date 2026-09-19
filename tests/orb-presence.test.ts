/**
 * ORB Core – Kernpräsenz (proaktive Neugier), Tests der reinen Logik.
 *
 * Geprüft wird: 40 Sekunden sind die früheste erlaubte Zeit, keine Frage bei
 * Tippen, Sprache, Mikrofon, laufender Anfrage oder inaktivem Tab, Cooldown
 * 2–5 Minuten, kein Fragen-Spam, keine generische Frage ohne Gedächtnisbezug
 * und keine sozialen Aktionen.
 */
import { describe, expect, it } from "vitest";

import {
  CURIOSITY_HIGH,
  CURIOSITY_VERY_HIGH,
  DIMENSION_HINT,
  PROACTIVE_COOLDOWN_MS,
  PROACTIVE_DIMENSIONS,
  PROACTIVE_MAX_IDLE_MS,
  PROACTIVE_MIN_IDLE_MS,
  PROACTIVE_SCOPE,
  PROACTIVE_SOCIAL_ACTIONS_ENABLED,
  curiosityBand,
  mayAskAtCuriosity,
  nextDimension,
  selectProactiveCandidate,
  shouldAskProactively,
  type ProactiveDimension,
  type ProactiveMemory,
} from "@/orb-core/presence";
import type { InterestRow } from "@/orb-core/memory";

const NOW = 1_700_000_000_000;

const ctx = (over: Partial<Parameters<typeof shouldAskProactively>[0]> = {}) => ({
  idleMs: 45_000,
  curiosity: 0.6,
  typing: false,
  speaking: false,
  listening: false,
  pending: false,
  tabVisible: true,
  hasCandidate: true,
  lastProactiveAt: null,
  now: NOW,
  ...over,
});

const memory = (over: Partial<ProactiveMemory> = {}): ProactiveMemory => ({
  id: "n1",
  content: "Ich baue gerade einen neuen Rechner mit einer starken Grafikkarte",
  topic: "hardware",
  importance: 0.7,
  confidence: 0.9,
  activationCount: 2,
  lastAccessedAt: NOW - 3_600_000,
  ...over,
});

const interest = (over: Partial<InterestRow> = {}): InterestRow => ({
  topic: "hardware",
  weight: 0.5,
  confidence: 0.9,
  source: "user_stated",
  activationCount: 3,
  ...over,
});

describe("Neugier-Schwellen", () => {
  it("ordnet die bestehende Zustandsgrösse in Bänder ein", () => {
    expect(curiosityBand(0.1)).toBe("low");
    expect(curiosityBand(0.4)).toBe("medium");
    expect(curiosityBand(CURIOSITY_HIGH)).toBe("high");
    expect(curiosityBand(CURIOSITY_VERY_HIGH)).toBe("very_high");
  });

  it("bei geringer Neugier fragt der ORB nicht", () => {
    expect(mayAskAtCuriosity(0.2)).toBe(false);
    expect(mayAskAtCuriosity(0.8)).toBe(true);
  });

  it("Cooldown liegt zwischen 2 und 5 Minuten", () => {
    for (const ms of Object.values(PROACTIVE_COOLDOWN_MS)) {
      expect(ms).toBeGreaterThanOrEqual(120_000);
      expect(ms).toBeLessThanOrEqual(300_000);
    }
    expect(PROACTIVE_COOLDOWN_MS.very_high).toBeLessThan(PROACTIVE_COOLDOWN_MS.medium);
  });
});

describe("Entscheidung: darf der ORB fragen?", () => {
  it("40 Sekunden sind die früheste erlaubte Zeit", () => {
    expect(shouldAskProactively(ctx({ idleMs: PROACTIVE_MIN_IDLE_MS - 1 })).ask).toBe(false);
    expect(shouldAskProactively(ctx({ idleMs: PROACTIVE_MIN_IDLE_MS })).ask).toBe(true);
  });

  it("nach langer Abwesenheit wird nicht nachträglich gefragt", () => {
    expect(shouldAskProactively(ctx({ idleMs: PROACTIVE_MAX_IDLE_MS + 1 })).ask).toBe(false);
  });

  it("Tippen, Mikrofon, Sprechen und laufende Anfrage verhindern die Frage", () => {
    expect(shouldAskProactively(ctx({ typing: true })).ask).toBe(false);
    expect(shouldAskProactively(ctx({ listening: true })).ask).toBe(false);
    expect(shouldAskProactively(ctx({ speaking: true })).ask).toBe(false);
    expect(shouldAskProactively(ctx({ pending: true })).ask).toBe(false);
  });

  it("inaktiver Tab verhindert die Frage", () => {
    expect(shouldAskProactively(ctx({ tabVisible: false })).ask).toBe(false);
  });

  it("geringe Neugier führt zum Schweigen", () => {
    expect(shouldAskProactively(ctx({ curiosity: 0.2 })).ask).toBe(false);
  });

  it("ohne Gedächtnisbezug gibt es keine generische Frage", () => {
    const v = shouldAskProactively(ctx({ hasCandidate: false }));
    expect(v.ask).toBe(false);
    expect(v.reason).toMatch(/generische Frage/);
  });

  it("Cooldown verhindert eine Fragen-Schleife", () => {
    const band = curiosityBand(0.6);
    expect(shouldAskProactively(ctx({ curiosity: 0.6, lastProactiveAt: NOW - 10_000 })).ask).toBe(
      false,
    );
    expect(
      shouldAskProactively(
        ctx({ curiosity: 0.6, lastProactiveAt: NOW - PROACTIVE_COOLDOWN_MS[band] - 1 }),
      ).ask,
    ).toBe(true);
  });

  it("jede Ablehnung ist begründet", () => {
    expect(shouldAskProactively(ctx({ typing: true })).reason.length).toBeGreaterThan(5);
  });
});

describe("Frageziel aus dem Gedächtnis", () => {
  it("wählt eine sichere, thematisch verankerte Erinnerung", () => {
    const c = selectProactiveCandidate({
      memories: [memory()],
      interests: [interest()],
      asked: [],
      now: NOW,
    });
    expect(c?.topic).toBe("hardware");
    expect(PROACTIVE_DIMENSIONS).toContain(c?.dimension as ProactiveDimension);
  });

  it("unsichere Erinnerungen tragen keine Frage", () => {
    expect(
      selectProactiveCandidate({
        memories: [memory({ confidence: 0.3 })],
        interests: [interest()],
        asked: [],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("Erinnerungen ohne Thema werden übergangen", () => {
    expect(
      selectProactiveCandidate({
        memories: [memory({ topic: null })],
        interests: [],
        asked: [],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("abgeschwächte Interessen tragen keine Frage", () => {
    expect(
      selectProactiveCandidate({
        memories: [memory()],
        interests: [interest({ weight: 0.05 })],
        asked: [],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("gleiche Frage wird nicht wiederholt – die Dimension wandert weiter", () => {
    const first = selectProactiveCandidate({
      memories: [memory()],
      interests: [interest()],
      asked: [],
      now: NOW,
    });
    const second = selectProactiveCandidate({
      memories: [memory()],
      interests: [interest()],
      asked: [{ topic: "hardware", dimension: first!.dimension }],
      now: NOW,
    });
    expect(second?.dimension).not.toBe(first!.dimension);
  });

  it("sind alle Dimensionen gestellt, bleibt der ORB still", () => {
    expect(
      selectProactiveCandidate({
        memories: [memory()],
        interests: [interest()],
        asked: PROACTIVE_DIMENSIONS.map((d) => ({ topic: "hardware", dimension: d })),
        now: NOW,
      }),
    ).toBeNull();
    expect(
      nextDimension(
        "hardware",
        PROACTIVE_DIMENSIONS.map((d) => ({ topic: "hardware", dimension: d })),
      ),
    ).toBeNull();
  });

  it("wichtigere und frischere Erinnerungen gewinnen", () => {
    const c = selectProactiveCandidate({
      memories: [
        memory({ id: "alt", importance: 0.4, lastAccessedAt: NOW - 400 * 3_600_000 }),
        memory({ id: "neu", importance: 0.9, lastAccessedAt: NOW - 3_600_000 }),
      ],
      interests: [interest()],
      asked: [],
      now: NOW,
    });
    expect(c?.nodeId).toBe("neu");
  });

  it("jede Dimension hat eine inhaltliche Anweisung", () => {
    for (const d of PROACTIVE_DIMENSIONS) expect(DIMENSION_HINT[d].length).toBeGreaterThan(10);
  });
});

describe("Grenzen der Kernpräsenz", () => {
  it("nur der ORB-Core-Chat, keine sozialen Aktionen", () => {
    expect(PROACTIVE_SCOPE).toBe("orb_core_chat_only");
    expect(PROACTIVE_SOCIAL_ACTIONS_ENABLED).toBe(false);
  });
});
