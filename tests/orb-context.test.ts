/**
 * ORB Core – Gesprächskontext & ausdrückliches Lernen (Regressionsfall aus
 * docs/ORB_MEMORY_RECALL_AUDIT_2026-09-19.md).
 *
 * Kern: der flüchtige Kontext macht die Angabe im Gespräch nutzbar, ohne die
 * bestehenden Gedächtnisformeln (Wichtigkeit, Schwelle) zu verändern.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CONTEXT_WINDOW_MESSAGES,
  contextWindow,
  detectExplicitLearningRequest,
  formatConversationContext,
  resolveFromContext,
  type ConversationMessage,
} from "@/orb-core/context";
import { scoreImportance, shouldPersist } from "@/orb-core/core";

const STATEMENT = "Ich esse am liebsten Schnitzel und Brokkoli";

function msgs(...pairs: [ConversationMessage["role"], string][]): ConversationMessage[] {
  return pairs.map(([role, body]) => ({ role, body }));
}

describe("Gesprächskontext ist begrenzt und deterministisch", () => {
  it("nutzt höchstens 8 Nachrichten", () => {
    expect(CONTEXT_WINDOW_MESSAGES).toBe(8);
    const many = Array.from({ length: 30 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "orb") as ConversationMessage["role"],
      body: `Zug ${i}`,
    }));
    const win = contextWindow(many);
    expect(win).toHaveLength(8);
    expect(win[win.length - 1]?.body).toBe("Zug 29");
  });

  it("ist deterministisch und ignoriert leere Nachrichten", () => {
    const win = contextWindow(msgs(["user", " "], ["user", "Hallo"], ["orb", "Hi"]));
    expect(win.map((m) => m.body)).toEqual(["Hallo", "Hi"]);
    expect(contextWindow(msgs(["user", "Hallo"]))).toEqual(contextWindow(msgs(["user", "Hallo"])));
  });

  it("formatiert den Verlauf kurz und benennt die Rollen", () => {
    const text = formatConversationContext(contextWindow(msgs(["user", STATEMENT], ["orb", "Ok"])));
    expect(text).toContain("Benutzer: " + STATEMENT);
    expect(text).toContain("Du: Ok");
  });

  it("liefert ohne Verlauf keinen Kontext", () => {
    expect(formatConversationContext([])).toBeNull();
  });
});

describe("Bestehende Gedächtnisformeln bleiben unverändert", () => {
  it("Wichtigkeit der Aussage bleibt 0.25, Schwelle bleibt 0.35", () => {
    expect(scoreImportance(STATEMENT)).toBeCloseTo(0.25, 5);
    expect(shouldPersist(0.25)).toBe(false);
    expect(shouldPersist(0.35)).toBe(true);
  });

  it("die Merk-Aufforderung erfüllt die bestehende Schwelle weiterhin selbst", () => {
    expect(shouldPersist(scoreImportance("Merke dir mein Lieblingsessen"))).toBe(true);
  });
});

describe("Ausdrückliche Merk-Aufforderung", () => {
  it("wird erkannt", () => {
    expect(detectExplicitLearningRequest("Merke dir mein Lieblingsessen")).not.toBeNull();
    expect(detectExplicitLearningRequest("Speicher dir das gut ab")).not.toBeNull();
    expect(detectExplicitLearningRequest("Remember that")).not.toBeNull();
  });

  it("gewöhnliche Aussagen und Fragen sind keine Aufforderung", () => {
    expect(detectExplicitLearningRequest(STATEMENT)).toBeNull();
    expect(detectExplicitLearningRequest("Was esse ich gerne")).toBeNull();
  });

  it("löst „mein Lieblingsessen“ gegen den Kontext auf", () => {
    const req = detectExplicitLearningRequest("Merke dir mein Lieblingsessen")!;
    const resolved = resolveFromContext(
      req,
      contextWindow(msgs(["user", STATEMENT], ["orb", "Verstanden."])),
    );
    expect(resolved?.fact).toBe(STATEMENT);
    expect(resolved?.reason).toContain("lieblingsessen");
  });

  it("löst ein Verweiswort auf die letzte Aussage auf", () => {
    const req = detectExplicitLearningRequest("Speicher dir das gut ab")!;
    const resolved = resolveFromContext(
      req,
      contextWindow(msgs(["user", "Es war eine rtx 5070 oc"], ["orb", "Notiert."])),
    );
    expect(resolved?.fact).toBe("Es war eine rtx 5070 oc");
  });

  it("erfindet nichts, wenn der Kontext keinen Beleg enthält", () => {
    const req = detectExplicitLearningRequest("Merke dir mein Lieblingsessen")!;
    expect(resolveFromContext(req, contextWindow(msgs(["user", "Guten Morgen"])))).toBeNull();
    expect(resolveFromContext(req, [])).toBeNull();
  });

  it("nutzt keine Fragen, keine ORB-Antworten und keine weitere Aufforderung als Beleg", () => {
    const req = detectExplicitLearningRequest("Merke dir mein Lieblingsessen")!;
    const resolved = resolveFromContext(
      req,
      contextWindow(
        msgs(
          ["user", "Was esse ich gerne?"],
          ["orb", "Du isst am liebsten Pizza mit Ananas"],
          ["user", "Merke dir mein Lieblingsessen bitte"],
        ),
      ),
    );
    expect(resolved).toBeNull();
  });

  it("nimmt bei mehreren Belegen die jüngste Aussage", () => {
    const req = detectExplicitLearningRequest("Merke dir mein Lieblingsessen")!;
    const resolved = resolveFromContext(
      req,
      contextWindow(msgs(["user", "Ich esse gerne Pizza"], ["user", STATEMENT])),
    );
    expect(resolved?.fact).toBe(STATEMENT);
  });
});

describe("Architekturgrenze bleibt erhalten", () => {
  it("der Kontext liegt im privaten Core und nicht in der öffentlichen SDK-Oberfläche", () => {
    const sdk = readFileSync("src/orb-sdk/index.ts", "utf8");
    expect(sdk).not.toContain("orb-core/context");
    expect(sdk).not.toContain("resolveFromContext");
  });

  it("Y-Dude-Adapter enthält keine Gedächtnis- oder Kontextlogik", () => {
    const adapter = readFileSync("src/integrations/y-dude-orb/orb.functions.ts", "utf8");
    expect(adapter).not.toContain("orb-core/");
    expect(adapter).toContain("@/orb-sdk/orb-core.server");
  });

  it("die Engine lädt den Kontext aus der bestehenden Gesprächsablage", () => {
    const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
    expect(engine).toContain("CONTEXT_WINDOW_MESSAGES");
    expect(engine).toContain('.from("orb_messages")');
    // Kein zweiter Verlaufsspeicher, keine Schwellenänderung.
    expect(engine).toContain("shouldPersist(importance)");
    expect(engine).not.toContain("orb_context");
  });
});
