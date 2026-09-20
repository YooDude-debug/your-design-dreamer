/**
 * ORB SDK – Vertragstests der API-Grenze.
 *
 * Zweck: belegen, dass die Trennung rein struktureller Natur ist. Gleiche
 * Eingabe → gleiche Entscheidung, gleicher Zustandsübergang, gleiche
 * Erinnerungs-, Neugier- und Thread-Ergebnisse wie im Core. Ausserdem wird
 * geprüft, dass es genau eine Umsetzung gibt (die SDK rechnet nichts selbst)
 * und dass interne Verfahren nicht nach aussen sichtbar sind.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import * as sdk from "@/orb-sdk";
import * as core from "@/orb-core/core";
import * as curiosity from "@/orb-core/curiosity";
import * as presence from "@/orb-core/presence";

const state: core.OrbState = {
  curiosity: 0.6,
  joy: 0.5,
  fear: 0.08,
  trust: 0.4,
  uncertainty: 0.3,
  energy: 0.8,
};

describe("SDK-Grenze: identische Ergebnisse", () => {
  it("Gesichtsberechnung ist dieselbe Funktion", () => {
    expect(sdk.faceFromState).toBe(core.faceFromState);
    expect(sdk.faceFromState(state)).toEqual(core.faceFromState(state));
  });

  it("Kennwerte sind unveränderte Core-Werte", () => {
    expect(sdk.W_MIN).toBe(core.W_MIN);
    expect(sdk.STRONG_THRESHOLD).toBe(core.STRONG_THRESHOLD);
    expect(sdk.CURIOSITY_ASK_THRESHOLD).toBe(curiosity.CURIOSITY_ASK_THRESHOLD);
    expect(sdk.PROACTIVE_MIN_IDLE_MS).toBe(presence.PROACTIVE_MIN_IDLE_MS);
    expect(sdk.PROACTIVE_MAX_IDLE_MS).toBe(presence.PROACTIVE_MAX_IDLE_MS);
    expect(sdk.PROACTIVE_COOLDOWN_MS).toEqual(presence.PROACTIVE_COOLDOWN_MS);
  });

  it("Präsenzentscheidung wird unverändert weitergereicht", () => {
    expect(sdk.shouldAskProactively).toBe(presence.shouldAskProactively);
    expect(sdk.presenceProducesUserMessage).toBe(presence.presenceProducesUserMessage);
    expect(sdk.presenceProducesUserMessage("ASK")).toBe(true);
    expect(sdk.presenceProducesUserMessage("WAIT")).toBe(false);
    expect(sdk.presenceProducesUserMessage("DO_NOTHING")).toBe(false);
  });

  it("ORB bleibt auf den eigenen Chat begrenzt", () => {
    expect(sdk.PROACTIVE_SCOPE).toBe("orb_core_chat_only");
    expect(sdk.PROACTIVE_SOCIAL_ACTIONS_ENABLED).toBe(false);
  });
});

describe("SDK-Grenze: keine doppelte Umsetzung", () => {
  const index = readFileSync("src/orb-sdk/index.ts", "utf8");
  const facade = readFileSync("src/orb-sdk/orb-core.server.ts", "utf8");

  it("die SDK enthält nur Weiterleitungen, keine eigene Rechenlogik", () => {
    // Keine Zahlenschwellen, keine Formeln in der Grenze selbst.
    expect(index).not.toMatch(/Math\./);
    expect(facade).not.toMatch(/Math\./);
    expect(facade).not.toMatch(/\bfrom\s+"@supabase/);
  });

  it("jede Fähigkeit lädt den bestehenden Core", () => {
    const loads = facade.match(/await import\("@\/orb-core\//g) ?? [];
    expect(loads.length).toBeGreaterThanOrEqual(10);
  });

  it("interne Verfahren sind nicht über die SDK sichtbar", () => {
    const hidden = [
      "currentWeight",
      "reactivate",
      "reinforcement",
      "relevanceScore",
      "scoreImportance",
      "normKey",
      "detectKnowledgeGaps",
      "decideCuriosity",
      "nextState",
      "decide",
      "selectProactiveCandidate",
    ];
    for (const name of hidden) {
      expect(Object.keys(sdk)).not.toContain(name);
    }
  });
});

describe("SDK-Grenze: Persistenz und Sicherheit", () => {
  const facade = readFileSync("src/orb-sdk/orb-core.server.ts", "utf8");
  const adapter = readFileSync("src/integrations/y-dude-orb/orb.functions.ts", "utf8");

  it("die Fassade erzeugt keinen eigenen Datenzugang und keine Dienstschlüssel", () => {
    expect(facade).not.toMatch(/createClient/);
    expect(facade).not.toMatch(/SERVICE_ROLE/);
    expect(facade).not.toMatch(/client\.server/);
  });

  it("alle Adapter-Funktionen sind angemeldet und nutzen nur die SDK", () => {
    const handlers = adapter.match(/createServerFn\(/g) ?? [];
    const guards = adapter.match(/requireSupabaseAuth/g) ?? [];
    expect(handlers.length).toBe(11);
    // ein Import der Middleware + eine Verwendung pro Funktion
    expect(guards.length).toBe(handlers.length + 1);
    expect(adapter).not.toMatch(/@\/orb-core\//);
  });
});
