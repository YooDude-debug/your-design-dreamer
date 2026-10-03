/** Knowledge Globe: standardmäßig aktiv, nur Ausschalten wird gemerkt. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/_authenticated/channels.orb.$scope.tsx", "utf8");
const stage = readFileSync("src/components/orb-knowledge-graph/KnowledgeGraphStage.tsx", "utf8");

describe("Knowledge Globe Aktivierung", () => {
  it("erstes Öffnen und Neuladen ⇒ aktiv (Standard EIN, nur 'disabled' wird gelesen)", () => {
    expect(route).toContain("useState(true)");
    expect(route).toMatch(/getItem\(GLOBE_DISABLED_KEY\) === "1"\) setGlobeOnState\(false\)/);
  });
  it("Ausschalten merkt sich nur den Aus-Zustand, Einschalten löscht ihn", () => {
    expect(route).toContain('setItem(GLOBE_DISABLED_KEY, "1")');
    expect(route).toContain("removeItem(GLOBE_DISABLED_KEY)");
  });
  it("aus ⇒ Stage ausgehängt ⇒ keine Abfragen/Timer; genau eine Stage-Instanz", () => {
    expect(route).toContain("{isAdmin && globeOn && (");
    expect(route.match(/<KnowledgeGraphStage /g)?.length).toBe(1);
    expect(stage.match(/refetchInterval:/g)?.length).toBe(1);
    expect(stage).toContain("refetchInterval: POLL_MS");
  });
  it("eindeutige Beschriftung", () => {
    expect(route).toContain('"Knowledge Globe aktiv"');
    expect(route).toContain('"Knowledge Globe deaktiviert"');
  });
  it("Daten bleiben an Benutzer + Bereich gebunden", () => {
    expect(stage).toMatch(/queryKey:.*userId.*scope|\["orb-knowledge-graph", userId, scope\]/s);
    expect(route).toContain("<KnowledgeGraphStage scope={scope} />");
  });
});
