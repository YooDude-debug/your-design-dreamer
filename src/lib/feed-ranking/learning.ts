/**
 * Lernender Teil des Feed-Algorithmus.
 *
 * Aus jedem Signal wird eine kleine Anpassung gelernter Gewichte berechnet.
 * Wichtig: Die freiwillig gewählten Interessen bleiben unangetastet – das
 * Gelernte wirkt nur als gedeckelter Zuschlag bzw. Abschlag (siehe
 * `learning.influenceCap`).
 */

import { FEED_CONFIG } from "./config";
import type { FeedSignal, FeedSignalInput } from "./types";
import { clamp, norm } from "./utils";

export type WeightDelta = { key: string; delta: number };

/** Punktwert eines Signals; Verweildauer wird in ein Signal übersetzt. */
export function signalValue(signal: FeedSignal, dwellMs = 0) {
  const table = FEED_CONFIG.learning.signalValue;
  if (signal === "dwell" || signal === "view") {
    if (dwellMs >= FEED_CONFIG.learning.dwellPositiveMs) return table["dwell"] ?? 0;
    if (dwellMs > 0 && dwellMs <= FEED_CONFIG.learning.dwellFastScrollMs)
      return table["fast_scroll"] ?? 0;
  }
  return table[signal] ?? 0;
}

/** Welche Gewichts-Schlüssel ein Signal betrifft. */
export function weightKeysFor(input: FeedSignalInput) {
  const keys: string[] = [];
  if (input.authorId) keys.push(`author:${norm(input.authorId)}`);
  for (const topic of input.topics ?? []) {
    const value = norm(topic);
    if (value) keys.push(`topic:${value}`);
  }
  for (const tag of input.hashtags ?? []) {
    const value = norm(tag).replace(/^#+/, "");
    // Hashtags lernen im eigenen Namensraum – getrennt von Themen und SlangTags.
    if (value) keys.push(`hashtag:${value}`);
  }
  for (const id of input.slangTagIds ?? []) {
    const value = norm(id);
    if (value) keys.push(`slang:${value}`);
  }
  if (input.region) keys.push(`region:${norm(input.region)}`);
  if (input.language) keys.push(`language:${norm(input.language)}`);
  return keys;
}

/** Berechnet die Gewichtsänderungen eines Signals. */
export function deltasForSignal(input: FeedSignalInput): WeightDelta[] {
  const value = signalValue(input.signal, input.dwellMs);
  if (value === 0) return [];
  const delta = value * FEED_CONFIG.learning.rate;
  return weightKeysFor(input).map((key) => ({ key, delta }));
}

/** Wendet eine Änderung auf ein bestehendes Gewicht an (mit Grenzen). */
export function applyDelta(current: number, delta: number) {
  return Number(
    clamp(current + delta, FEED_CONFIG.learning.min, FEED_CONFIG.learning.max).toFixed(4),
  );
}

/** Signale, die den Inhalt dauerhaft ausblenden sollen. */
export function isSuppressSignal(signal: FeedSignal) {
  return signal === "not_interested" || signal === "mute" || signal === "block";
}
