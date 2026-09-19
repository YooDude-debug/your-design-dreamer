/**
 * ORB Multimodal Composer – Bildanhänge (nur Staging).
 *
 * Geprüft wird: Validierung (Typ, Grösse, echte Signatur), Composer-Eingabe
 * (Kamera/Galerie/Datei), Vorschau/Entfernen, Übergabe an den bestehenden
 * OpenAI-Pfad, unveränderte Memory-Pipeline und ehrlicher Fallback.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ORB_IMAGE_MAX_BYTES,
  ORB_IMAGE_MAX_COUNT,
  ORB_IMAGE_MIME_TYPES,
  base64ByteLength,
  checkImageFile,
  sniffImageMime,
  toImageDataUrl,
  validateImageAttachment,
  validateImageAttachments,
} from "@/lib/orb-attachments";

const chat = readFileSync("src/components/orb/OrbChat.tsx", "utf8");
const attach = readFileSync("src/components/orb/OrbComposerAttachments.tsx", "utf8");
const route = readFileSync("src/routes/_authenticated/channels.orb.tsx", "utf8");
const adapter = readFileSync("src/integrations/y-dude-orb/orb.functions.ts", "utf8");
const sdk = readFileSync("src/orb-sdk/orb-core.server.ts", "utf8");
const openai = readFileSync("src/orb-core/llm/openai.server.ts", "utf8");
const select = readFileSync("src/orb-core/llm/select.server.ts", "utf8");
const engine = readFileSync("src/orb-core/engine.server.ts", "utf8");

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]).toString("base64");
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0, 0, 0, 0,
]).toString("base64");

describe("ORB Multimodal Composer – Validierung", () => {
  it("erkennt echte Bildsignaturen", () => {
    expect(sniffImageMime(Buffer.from(PNG, "base64"))).toBe("image/png");
    expect(sniffImageMime(Buffer.from(JPEG, "base64"))).toBe("image/jpeg");
    expect(sniffImageMime(Buffer.from("MZ executable binary", "utf8"))).toBeNull();
  });

  it("lehnt ungültige Dateitypen ab", () => {
    expect(checkImageFile({ type: "application/pdf", size: 100 }).ok).toBe(false);
    expect(checkImageFile({ type: "application/x-msdownload", size: 100 }).ok).toBe(false);
    const fake = validateImageAttachment({
      mimeType: "image/png",
      dataBase64: Buffer.from("MZ not a png at all", "utf8").toString("base64"),
    });
    expect(fake.ok).toBe(false);
  });

  it("lehnt zu grosse Dateien ab", () => {
    const check = checkImageFile({ type: "image/png", size: ORB_IMAGE_MAX_BYTES + 1 });
    expect(check.ok).toBe(false);
    expect(base64ByteLength("A".repeat(4))).toBe(3);
  });

  it("akzeptiert nur die vom Provider unterstützten Formate", () => {
    expect([...ORB_IMAGE_MIME_TYPES]).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ]);
    const ok = validateImageAttachment({ mimeType: "image/png", dataBase64: PNG });
    expect(ok.ok).toBe(true);
    expect(toImageDataUrl({ mimeType: "image/png", dataBase64: PNG })).toContain(
      "data:image/png;base64,",
    );
  });

  it("begrenzt die Anzahl der Bilder pro Nachricht", () => {
    const many = Array.from({ length: ORB_IMAGE_MAX_COUNT + 1 }, () => ({
      mimeType: "image/png",
      dataBase64: PNG,
    }));
    expect(validateImageAttachments(many).ok).toBe(false);
    const few = validateImageAttachments([{ mimeType: "image/jpeg", dataBase64: JPEG }]);
    expect(few.ok).toBe(true);
  });
});

describe("ORB Multimodal Composer – Eingabe und Vorschau", () => {
  it("bietet Kamera, Galerie und Datei am Texteingabefeld", () => {
    expect(attach).toContain('capture="environment"');
    expect(attach).toContain('data-testid="orb-input-camera"');
    expect(attach).toContain('data-testid="orb-input-gallery"');
    expect(attach).toContain('data-testid="orb-input-file"');
    expect(attach).toContain("ORB_IMAGE_ACCEPT");
    expect(chat).toContain("<OrbComposerAttachments");
  });

  it("zeigt die Kameraoption nur bei sinnvoller Unterstützung", () => {
    expect(attach).toContain('"capture" in input');
    expect(attach).toContain("pointer: coarse");
    expect(attach).toContain("supportsCamera &&");
  });

  it("zeigt eine Vorschau, die vor dem Senden entfernt werden kann", () => {
    expect(attach).toContain('data-testid="orb-attachment-previews"');
    expect(attach).toContain('data-testid="orb-attachment-remove"');
    expect(attach).toContain("attachments.filter((a) => a.id !== item.id)");
  });

  it("sendet Text ohne Bild weiterhin und Text zusammen mit Bild", () => {
    expect(chat).toContain("onSend(");
    expect(chat).toContain("attachments.map((a) => ({ mimeType: a.mimeType, dataBase64:");
    expect(chat).toContain("if (!value && attachments.length === 0) return;");
    expect(chat).toContain("text.trim().length === 0 && attachments.length === 0");
    expect(route).toContain("sendMutation.mutate({ text, images })");
  });
});

describe("ORB Multimodal Composer – Server- und Core-Grenze", () => {
  it("prüft Bilder serverseitig erneut im bestehenden Adapter", () => {
    expect(adapter).toContain("validateImageAttachments");
    expect(adapter).toContain("ORB_IMAGE_MAX_COUNT");
    expect(adapter).toContain("createOrbCore");
    expect(sdk).toContain("images?: OrbImageAttachment[]");
  });

  it("hält den OpenAI-Schlüssel serverseitig", () => {
    expect(openai).toContain('process.env["OPENAI_API_KEY"]');
    for (const file of [chat, attach, route]) {
      expect(file).not.toContain("OPENAI_API_KEY");
      expect(file).not.toContain("VITE_OPENAI");
      expect(file).not.toContain("api.openai.com");
    }
  });

  it("übergibt Bild und Text gemeinsam an den bestehenden OpenAI-Pfad", () => {
    expect(openai).toContain('type: "image_url"');
    expect(openai).toContain("content: userContent");
    expect(select).toContain("speakViaOpenAI(input.system, input.text, images)");
    expect(select).toContain("imageContextProcessed: images.length > 0");
  });

  it("lässt die bestehende Memory-Pipeline unberührt", () => {
    // Bilder werden ausschliesslich an die Sprachschicht übergeben.
    expect(engine).toContain("images?: OrbImageAttachment[]");
    expect(engine).toContain("generateReply({ system, text: input.text, images: input.images })");
    // Keine Speicherung von Bilddaten in Knoten, Verbindungen oder Nachrichten.
    expect(engine).not.toMatch(/orb_nodes[\s\S]{0,400}dataBase64/);
    expect(engine).not.toMatch(/orb_messages[\s\S]{0,400}dataBase64/);
    expect(engine).not.toContain("image_url");
  });

  it("verspricht bei fehlender Bildschicht keine Bildanalyse", () => {
    expect(engine).toContain("IMAGE_NOT_PROCESSED_HINT");
    expect(engine).toContain("!spoken.meta.imageContextProcessed");
    expect(select).toContain("imagesSent: 0");
  });

  it("behält den vollständigen Fallback auf die bestehende Sprachschicht", () => {
    expect(select).toContain("speakViaLovableGateway(input.system, input.text)");
    expect(select).toContain('provider: "local"');
  });

  it("erzeugt weder neue Tabellen noch Bildspeicher", () => {
    expect(adapter).not.toContain("storage");
    expect(attach).not.toContain("supabase");
    expect(attach).not.toContain('.from("');
  });
});
