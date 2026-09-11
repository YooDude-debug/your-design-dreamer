/**
 * Abbildung der bestehenden Feed-Signale auf die vorhandene Interest Engine.
 *
 * Reine Logik – keine Datenbank, kein UI. Es werden ausschließlich bereits
 * vorhandene Merkmale eines Signals verwendet (Hashtags, SlangTag-Themen,
 * Region, Sprache, Verweildauer) und ausschließlich bereits vorhandene
 * Kategorien aus `interest_categories` aufgelöst. Es werden keine neuen
 * Kategorien erfunden und keine Inhalte geraten.
 */

import type { FeedSignal, FeedSignalInput } from "@/lib/feed-ranking/types";
import type { InteractionAction, InterestCategory } from "./types";

/** Verweildauer, ab der die vorhandene Feed-Logik von echtem Interesse ausgeht. */
export const DWELL_POSITIVE_MS = 4_000;

/**
 * Signal → vorhandene Interest-Aktion.
 * Negative bzw. abwertende Signale (`skip`, `fast_scroll`, `not_interested`,
 * `mute`, `block`, `report`) haben in der vorhandenen Interest Engine keine
 * Entsprechung – sie bleiben bewusst beim Feed-Learning.
 */
const ACTION_BY_SIGNAL: Partial<Record<FeedSignal, InteractionAction>> = {
  view: "post_view",
  view_complete: "post_view_complete",
  dwell: "post_view",
  like: "post_like",
  comment: "post_comment",
  share: "post_share",
  save: "post_save",
  profile_visit: "profile_visit",
  follow: "connection",
};

export type MappedInteraction = {
  action: InteractionAction;
  postId?: string;
  peerId?: string;
  dwellMs: number;
  /** Aus Merkmalen des Signals aufgelöste, bereits vorhandene Kategorien. */
  categoryIds: string[];
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/^#+/, "")
    .replace(/[\s_]+/g, "-");
}

/** Nachschlagetabelle aus vorhandenen Kategorien (Slug und Name). */
export function buildCategoryIndex(categories: InterestCategory[]) {
  const bySlug = new Map<string, InterestCategory>();
  for (const category of categories) {
    if (!category.active) continue;
    bySlug.set(normalize(category.slug), category);
    bySlug.set(normalize(category.name), category);
  }
  return bySlug;
}

/**
 * Löst die Kategorien eines Signals auf: Hashtags/Themen über Slug bzw. Name,
 * Region über die Regionskategorien, Sprache über `lang-xx`.
 * Nur exakte Treffer – keine Heuristik, keine Zufallszuordnung.
 */
export function categoriesForSignal(
  index: Map<string, InterestCategory>,
  input: FeedSignalInput,
): string[] {
  const out = new Set<string>();
  const add = (raw: string | undefined, kinds?: InterestCategory["kind"][]) => {
    if (!raw) return;
    const hit = index.get(normalize(raw));
    if (hit && (!kinds || kinds.includes(hit.kind))) out.add(hit.id);
  };

  for (const tag of input.hashtags ?? []) add(tag);
  for (const topic of input.topics ?? []) add(topic);
  // Region kann mehrteilig sein ("Hamburg, Deutschland").
  for (const part of (input.region ?? "").split(/[,/|]/)) add(part, ["region"]);
  if (input.language) add(`lang-${input.language}`, ["language"]);

  return [...out];
}

/**
 * Wandelt einen Signal-Stapel in Interest-Aktionen um.
 * Kurze Verweildauern (schnelles Wegscrollen) erzeugen bewusst keine Aktion.
 */
export function mapSignals(
  index: Map<string, InterestCategory>,
  signals: FeedSignalInput[],
): MappedInteraction[] {
  const out: MappedInteraction[] = [];
  for (const signal of signals) {
    const action = ACTION_BY_SIGNAL[signal.signal];
    if (!action) continue;
    if (signal.signal === "dwell" && (signal.dwellMs ?? 0) < DWELL_POSITIVE_MS) continue;

    const entry: MappedInteraction = {
      action,
      dwellMs: Math.max(0, Math.round(signal.dwellMs ?? 0)),
      categoryIds: categoriesForSignal(index, signal),
    };
    if (signal.postId) entry.postId = signal.postId;
    if (signal.authorId) entry.peerId = signal.authorId;
    out.push(entry);
  }
  return out;
}
