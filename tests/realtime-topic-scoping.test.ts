/**
 * Realtime-Sicherheit – Vertrag im Code.
 *
 * Presence und Tipp-Hinweise dürfen ausschliesslich über eng geschnittene
 * Topics laufen (je Nutzer bzw. je Unterhaltung). Globale Broadcast- oder
 * Presence-Topics sind nicht erlaubt, weil jeder angemeldete Nutzer sie
 * abonnieren und damit Metadaten fremder Nutzer mitlesen könnte.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { chatTopic, presenceTopic } from "@/lib/social";

const social = readFileSync(join(process.cwd(), "src", "lib", "social.tsx"), "utf8");

describe("Realtime-Topics sind nutzer- bzw. chatbezogen", () => {
  it("Presence-Topic enthält die Nutzer-ID", () => {
    expect(presenceTopic("abc")).toBe("presence-u-abc");
  });

  it("Chat-Topic enthält die Unterhaltungs-ID", () => {
    expect(chatTopic("xyz")).toBe("chat-xyz");
  });

  it("es gibt kein globales Presence- oder Broadcast-Topic mehr", () => {
    expect(social).not.toMatch(/channel\("ydude-presence"/);
    expect(social).not.toMatch(/channel\("ydude-social"/);
    expect(social).not.toMatch(/channel\("ydude-social-out"/);
  });

  it("jeder Kanalaufruf ist an eine ID gebunden", () => {
    const channels = social.match(/supabase\.channel\(([^)]*)/g) ?? [];
    expect(channels.length).toBeGreaterThan(0);
    for (const call of channels) {
      expect(call).toMatch(/presenceTopic\(|chatTopic\(|`ydude-social-\$\{uid\}`/);
    }
  });

  it("Tipp-Hinweise senden nur die Absender-ID, keine weiteren Metadaten", () => {
    expect(social).toMatch(/event: "typing", payload: \{ u: uid \}/);
  });

  it("eingehende Tipp-Hinweise werden gegen die Chat-Mitgliedschaft geprüft", () => {
    expect(social).toMatch(/conv\.members\.includes\(senderId\)/);
  });

  it("Presence wird nur für berechtigte Gegenüber abonniert", () => {
    expect(social).toMatch(/presencePeerIds/);
    expect(social).toMatch(/status === "accepted"/);
  });
});
