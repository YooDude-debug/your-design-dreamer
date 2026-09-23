/**
 * ORB Request Optimization P0 – Regressionstests.
 *
 * P0-1: alle rechnerischen Prüfungen liegen VOR der kostenpflichtigen
 * Formulierung; die verbleibende Ähnlichkeitsprüfung braucht den erzeugten
 * Text und bleibt danach (dokumentiert, nicht verschoben).
 *
 * P0-2: innerhalb eines Verarbeitungsvorgangs werden identische Daten
 * (Zustand, Gesprächsfenster, Interessen, Gedankenfäden) weitergegeben und
 * nicht erneut geladen. Reine Struktur-/Reihenfolgeprüfung – die ORB-Logik,
 * Schwellen und Formeln werden dabei nicht berührt.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");
const lines = engine.split("\n");
const lineOf = (needle: string) => lines.findIndex((l) => l.includes(needle));

describe("P0-1: Reihenfolge der Prüfungen", () => {
  it("die Endfreigabe (Energie/Neugier/Impuls) liegt vor der Formulierung", () => {
    const gate = lineOf("const gateDecision = finalAutonomyGate(");
    const abort = lineOf("if (!gateDecision.allowed) return silent(gateDecision.reason);");
    const formulate = lineOf("const spoken = await formulateQuestion(ctx, gap, impulse);");
    expect(gate).toBeGreaterThan(0);
    expect(abort).toBeGreaterThan(gate);
    expect(formulate).toBeGreaterThan(abort);
  });

  it("die Impulsentscheidung vergleicht frühere Fragen ohne Sprachaufruf", () => {
    const decide = lineOf("const impulseDecision = decideImpulse({");
    const previous = lineOf("previousImpulses: ctx.questions.map((row) => row.question),");
    const formulate = lineOf("const spoken = await formulateQuestion(ctx, gap, impulse);");
    expect(previous).toBeGreaterThan(decide);
    expect(formulate).toBeGreaterThan(previous);
  });

  it("die Ähnlichkeitsprüfung arbeitet auf dem erzeugten Text (nicht vorziehbar)", () => {
    expect(engine).toContain("isDuplicateQuestion(\n      spoken.question,");
  });

  it("stille Antworten behalten ihren Sprachaufruf (keine Silent-Optimierung)", () => {
    expect(engine).toContain("spoken = await speak({");
  });
});

describe("P0-2: keine doppelten Ladevorgänge im selben Vorgang", () => {
  it("loadCuriosityContext nimmt bereits geladene Daten an", () => {
    expect(engine).toContain("preloaded: CuriosityPreloaded | null = null,");
    expect(engine).toContain("preloaded?.stateRow ?? (await ensureState(db, userId, q))");
    expect(engine).toContain("preloaded?.threadEntries ?? (await loadThreads(db, userId, q))");
    expect(engine).toContain("preloaded\n      ? Promise.resolve(preloaded.interestRows)");
    expect(engine).toContain("preloaded\n      ? Promise.resolve(preloaded.recentMessages)");
  });

  it("der Gesprächszug übergibt die vier bereits geladenen Werte", () => {
    expect(engine).toContain("await loadCuriosityContext(db, userId, q, now, {");
    expect(engine).toContain("recentMessages: ctxRes.data,");
    expect(engine).toContain("interestRows: interestRes.data,");
    expect(engine).toContain("threadEntries: loadedThreads,");
  });

  it("im Gesprächszug bleibt kein Aufruf ohne Weitergabe zurück", () => {
    // Nur der Zug (`processInput`) hat bereits geladene Daten. Die eigenständigen
    // Pfade (`inspectCuriosity`, `askProactively`) laden weiterhin selbst.
    const turnStart = lineOf("export async function processInput(");
    const turnEnd = lineOf("async function loadCuriosityContext(");
    const inTurn = lines
      .slice(turnStart, turnEnd)
      .filter((l) => l.includes("loadCuriosityContext(db, userId, q, now)"));
    expect(inTurn).toEqual([]);
    expect(lines.filter((l) => l.includes("loadCuriosityContext(db, userId, q, now)")).length).toBe(
      2,
    );
  });

  it("die übernommenen Abfragen sind identisch begrenzt (8 Nachrichten, 8 Interessen)", () => {
    const context = readFileSync("src/orb-core/context.ts", "utf8");
    expect(context).toContain("CONTEXT_WINDOW_MESSAGES = 8");
    expect(engine).toContain('.from("orb_interests")');
  });

  it("keine Abfrage entfernt: Knoten, Fragen und Verbindungen werden weiter geladen", () => {
    expect(engine).toContain('.from("orb_nodes")');
    expect(engine).toContain('.from("orb_questions")');
    expect(engine).toContain('.from("orb_connections")');
  });

  it("kein Zwischenspeicher über die Anfrage hinaus", () => {
    expect(engine).not.toContain("globalThis.__orbCache");
    expect(engine).not.toMatch(/const\s+\w*[Cc]ache\s*=\s*new Map\(/);
  });
});
