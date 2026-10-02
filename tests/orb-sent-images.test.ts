/**
 * ORB Visual Communication P1 – gesendete Nutzerbilder sichtbar (nur Sitzung).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bindSentImages, type SentImageGroup } from "@/components/orb/OrbChat";

const chat = readFileSync("src/components/orb/OrbChat.tsx", "utf8");
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");

const group = (over: Partial<SentImageGroup> = {}): SentImageGroup => ({
  key: "g1",
  images: ["data:image/png;base64,AAA"],
  knownIds: ["m1"],
  status: "sending",
  sawPending: false,
  messageId: null,
  ...over,
});

describe("bindSentImages", () => {
  it("bindet ein Bild an die neue eigene Nachricht", () => {
    const out = bindSentImages([group()], [{ id: "m1", role: "user" }, { id: "m2", role: "user" }], true);
    expect(out[0]).toMatchObject({ status: "sent", messageId: "m2" });
  });

  it("drei Bilder bleiben in derselben Nachricht", () => {
    const g = group({ images: ["a", "b", "c"].map((x) => `data:image/png;base64,${x}`) });
    const out = bindSentImages([g], [{ id: "m2", role: "user" }], false);
    expect(out[0]?.images).toHaveLength(3);
    expect(out[0]?.messageId).toBe("m2");
  });

  it("ignoriert neue ORB-Nachrichten", () => {
    const out = bindSentImages([group()], [{ id: "o9", role: "orb" }], true);
    expect(out[0]).toMatchObject({ status: "sending", sawPending: true });
  });

  it("Fehlschlag: Senden lief, endete ohne neue eigene Nachricht", () => {
    const out = bindSentImages([group({ sawPending: true })], [{ id: "m1", role: "user" }], false);
    expect(out[0]?.status).toBe("failed");
  });

  it("vor Beginn des Sendens kein vorschneller Fehler", () => {
    const out = bindSentImages([group()], [{ id: "m1", role: "user" }], false);
    expect(out[0]?.status).toBe("sending");
  });

  it("zwei Gruppen bekommen verschiedene Nachrichten", () => {
    const out = bindSentImages(
      [group(), group({ key: "g2" })],
      [{ id: "m2", role: "user" }, { id: "m3", role: "user" }],
      false,
    );
    expect(out.map((g) => g.messageId)).toEqual(["m2", "m3"]);
  });
});

describe("Datensparsamkeit", () => {
  it("Bilder nur im Komponentenzustand – kein Speichern im Browser oder Server", () => {
    expect(chat).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(chat).toContain("SentImageThumbs");
    expect(engine).not.toMatch(/orb_messages[\s\S]{0,400}dataBase64/);
    expect(engine).not.toMatch(/orb_nodes[\s\S]{0,400}dataBase64/);
  });
});
