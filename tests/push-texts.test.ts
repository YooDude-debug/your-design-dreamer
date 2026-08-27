/**
 * Messenger / Push – Sprachwahl und Textbildung.
 *
 * Wichtig: Push-Texte richten sich immer nach der Sprache des Empfängers und
 * enthalten niemals den Inhalt einer Chat-Nachricht.
 */

import { describe, expect, it } from "vitest";
import {
  exactPushLang,
  normalizePushLang,
  notificationLink,
  pushBody,
  pushLangFromText,
  pushTitle,
  resolveRecipientLang,
} from "@/lib/push-shared";

describe("Sprachwahl des Empfängers", () => {
  it("nimmt die gespeicherte Anzeigesprache", () => {
    expect(resolveRecipientLang({ uiLanguage: "el", language: "Deutsch" })).toBe("el");
  });

  it("fällt auf die Freitext-Sprache zurück", () => {
    expect(resolveRecipientLang({ uiLanguage: null, language: "Ελληνικά" })).toBe("el");
    expect(resolveRecipientLang({ language: "English" })).toBe("en");
  });

  it("nutzt den Projekt-Standard bei unbekannten Angaben", () => {
    expect(resolveRecipientLang({ uiLanguage: "xx", language: "Klingon" })).toBe("de");
  });

  it("normalisiert und erkennt Sprachcodes streng", () => {
    expect(normalizePushLang("en-GB")).toBe("en");
    expect(normalizePushLang(undefined)).toBe("de");
    expect(exactPushLang("en-GB")).toBeNull();
    expect(pushLangFromText("griechisch")).toBe("el");
    expect(pushLangFromText("")).toBeNull();
  });
});

describe("Push-Titel", () => {
  it("nennt den Absender bei einzelner Nachricht", () => {
    expect(pushTitle({ type: "message", lang: "de", actorName: "Anna" })).toBe(
      "Neue Nachricht von Anna",
    );
    expect(pushTitle({ type: "message", lang: "en", actorName: "Anna", voice: true })).toBe(
      "New voice message from Anna",
    );
  });

  it("bündelt mehrere Nachrichten desselben Absenders", () => {
    expect(pushTitle({ type: "message", lang: "de", actorName: "Anna", messageCount: 5 })).toBe(
      "Neue Nachrichten von Anna",
    );
  });

  it("bündelt Likes ohne einzelnen Namen", () => {
    expect(pushTitle({ type: "post_like", lang: "en", actorName: "Anna", likeCount: 4 })).toBe(
      "New likes",
    );
  });

  it("übersetzt bekannte Arten unabhängig vom gespeicherten Titel", () => {
    expect(pushTitle({ type: "comment", lang: "en", title: "Neuer Kommentar" })).toBe(
      "New comment",
    );
  });
});

describe("Push-Inhalt", () => {
  it("enthält bei Chat nur Absender und Anzahl, nie den Text", () => {
    const body = pushBody({ type: "message", lang: "de", actorName: "Anna", messageCount: 3 });
    expect(body).toBe("@Anna hat dir 3 neue Nachrichten gesendet.");
    expect(body).not.toContain("Hallo");
  });

  it("bündelt Like-Texte", () => {
    expect(pushBody({ type: "post_like", lang: "en", likeCount: 7 })).toBe(
      "7 people liked your post.",
    );
  });

  it("nutzt den gespeicherten Text nur bei unbekannter Art", () => {
    expect(pushBody({ type: "custom_thing", lang: "de", storedBody: "Hinweis" })).toBe("Hinweis");
  });
});

describe("Sprungziele", () => {
  it("bevorzugt gespeicherte interne Links", () => {
    expect(notificationLink({ type: "comment", link: "/p/abc" })).toBe("/p/abc");
  });

  it("verwirft externe Links", () => {
    expect(
      notificationLink({
        type: "comment",
        link: "https://evil.test",
        entityType: "post",
        entityId: "x",
      }),
    ).toBe("/p/x");
  });

  it("hat einen sicheren Standard", () => {
    expect(notificationLink({ type: "system" })).toBe("/dev");
  });
});
