import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * P-05 (Netzwerk-Requests reduzieren): Regressionsschutz für die drei
 * belegten Optimierungen. Sie dürfen nicht versehentlich zurückgedreht werden.
 */
describe("Netzwerk-Optimierung", () => {
  it("lädt das externe Zahlungsskript erst beim Aufruf (stripe-js/pure)", () => {
    const src = readFileSync("src/lib/stripe.ts", "utf8");
    expect(src).toContain('from "@stripe/stripe-js/pure"');
    expect(src).not.toMatch(/import \{ loadStripe[^}]*\} from "@stripe\/stripe-js";/);
  });

  it("lädt Messenger, Connections und Benachrichtigungen erst beim Öffnen", () => {
    const layer = readFileSync("src/components/SocialLayer.tsx", "utf8");
    expect(layer).toContain("LazyMessenger");
    expect(layer).toContain("LazyConnectionsPanel");
    expect(layer).toContain("LazyNotificationsPanel");
    // Keine direkten (eifrigen) Importe der Panels mehr.
    expect(layer).not.toContain('from "@/components/Messenger"');
    expect(layer).not.toContain('from "@/components/ConnectionsPanel"');
    expect(layer).not.toContain('from "@/components/NotificationsPanel"');

    const lazy = readFileSync("src/components/lazy/LazySocialPanels.tsx", "utf8");
    expect(lazy).toContain("lazy(");
    expect(lazy).toContain("Suspense");
  });

  it("fragt Profile des Sitzungsstarts nicht doppelt ab", () => {
    const data = readFileSync("src/lib/data.tsx", "utf8");
    // ensureProfiles wartet auf einen laufenden Sitzungsstart …
    expect(data).toContain("if (inFlightRef.current) {");
    // … und überspringt bereits geladene Profil-IDs.
    expect(data).toContain("loadedProfileIdsRef");
    expect(data).toContain("!alreadyLoaded.has(id)");
    // Beim Abmelden wird der Merker geleert.
    expect(data).toContain("loadedProfileIdsRef.current.clear();");
  });
});
