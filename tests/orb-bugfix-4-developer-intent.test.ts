// BUG 4: bloßes „warum" darf keine Developer-Analyse auslösen; Admin-Gates bleiben.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { detectDeveloperDiagnosticIntent as detect } from "@/orb-dev/chat-bridge";

describe("BUG 4 – Developer-Intent", () => {
  it("1 persönliche Bitte mit untersuche + warum → none", () =>
    expect(detect("Untersuche bitte, warum ich schlecht schlafe").kind).toBe("none"));
  it("2 untersuche den Fehler → diagnostic", () =>
    expect(detect("untersuche den Fehler").kind).toBe("diagnostic"));
  it("3 normale ORB-Frage mit warum → none", () => {
    expect(detect("Warum ist der Himmel blau?").kind).toBe("none");
    expect(detect("Analysiere, warum mir Musik gefällt").kind).toBe("none");
  });
  it("4 echte technische Anfragen bleiben diagnostic", () => {
    expect(detect("Prüfe warum die Erinnerung nicht geladen wurde").kind).toBe("diagnostic");
    expect(detect("Finde heraus warum der Bug auftritt").kind).toBe("diagnostic");
    expect(detect("Analysiere den Memory Recall").kind).toBe("diagnostic");
  });
  const server = readFileSync("src/lib/orb-chat-bridge.functions.ts", "utf8");
  const page = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");
  it("5 Nicht-Admin: Gates im Browser und auf dem Server unverändert", () => {
    expect(page).toMatch(
      /isAdmin && detectDeveloperDiagnosticIntent\(text\)\.kind === "diagnostic"/,
    );
    expect(server).toMatch(/kind: "unauthorized"/);
    expect(server).toMatch(/isAdmin/);
  });
  it("6 Admin: Server prüft Intent erneut und führt gültige Analyse aus", () => {
    expect(server).toMatch(/detectDeveloperDiagnosticIntent/);
    expect(server).toMatch(/runChatDiagnostic/);
  });
});
