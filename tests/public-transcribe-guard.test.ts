import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkIpRateLimit, resetIpRateLimits } from "../src/lib/ip-rate-limit.server";
import {
  MAX_TEST_AUDIO_BYTES,
  MAX_TEST_AUDIO_SECONDS,
  audioSeconds,
  decodeDataUrl,
  transcribeTestAudio,
} from "../src/lib/public-transcribe.server";

function dataUrl(mime: string, bytes: number): string {
  const raw = "a".repeat(bytes);
  return `data:${mime};base64,${btoa(raw)}`;
}

describe("public transcription – IP rate limit", () => {
  beforeEach(() => resetIpRateLimits());

  it("lässt erlaubte Anzahl durch und blockt danach", () => {
    const opts = { scope: "t", ip: "1.2.3.4", max: 3, windowSeconds: 60 } as const;
    expect(checkIpRateLimit(opts).ok).toBe(true);
    expect(checkIpRateLimit(opts).ok).toBe(true);
    expect(checkIpRateLimit(opts).ok).toBe(true);
    const blocked = checkIpRateLimit(opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("trennt Buckets pro IP und öffnet nach dem Fenster wieder", () => {
    const base = { scope: "t", max: 1, windowSeconds: 60 } as const;
    expect(checkIpRateLimit({ ...base, ip: "1.1.1.1" }).ok).toBe(true);
    expect(checkIpRateLimit({ ...base, ip: "1.1.1.1" }).ok).toBe(false);
    expect(checkIpRateLimit({ ...base, ip: "2.2.2.2" }).ok).toBe(true);
    expect(checkIpRateLimit({ ...base, ip: "1.1.1.1", now: Date.now() + 61_000 }).ok).toBe(true);
  });
});

describe("public transcription – Eingabelimits (fail-closed)", () => {
  it("lehnt unbekanntes Format ab", () => {
    expect(() => decodeDataUrl(dataUrl("audio/aiff", 5000))).toThrow(/unsupported/);
  });

  it("lehnt kaputte Data-URL ab", () => {
    expect(() => decodeDataUrl("not-a-data-url")).toThrow(/invalid/);
  });

  it("lehnt zu große Dateien ab", () => {
    expect(() => decodeDataUrl(dataUrl("audio/mp4", MAX_TEST_AUDIO_BYTES + 10))).toThrow(
      /too large/,
    );
  });

  it("lehnt zu lange Audios ab", () => {
    // 24 kbit/s Schätzung → mehr als MAX_TEST_AUDIO_SECONDS
    const bytes = Math.ceil((MAX_TEST_AUDIO_SECONDS + 5) * (24_000 / 8));
    expect(bytes).toBeLessThan(MAX_TEST_AUDIO_BYTES);
    expect(() => decodeDataUrl(dataUrl("audio/webm", bytes))).toThrow(/too long/);
  });

  it("akzeptiert eine kurze gültige Aufnahme", () => {
    const res = decodeDataUrl(dataUrl("audio/webm", 8000));
    expect(res.mime).toBe("audio/webm");
    expect(audioSeconds(res.bytes, res.mime)).toBeLessThan(MAX_TEST_AUDIO_SECONDS);
  });
});

describe("public transcription – externer Aufruf", () => {
  it("ruft die API genau einmal auf und wirft bei Fehler ohne Retry", async () => {
    process.env["LOVABLE_API_KEY"] = "test-key";
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcribeTestAudio(dataUrl("audio/webm", 8000))).rejects.toThrow(
      /transcription failed/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("wirft ohne API-Key, ohne einen Request zu senden", async () => {
    delete process.env["LOVABLE_API_KEY"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(transcribeTestAudio(dataUrl("audio/webm", 8000))).rejects.toThrow(
      /LOVABLE_API_KEY/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
