/**
 * ORB Core V0.2 – Level 1 (Beobachten) und Level 2 (Vorschlagen).
 *
 * Der ORB liest ausschliesslich Feed-Beiträge, die der Benutzer selbst sehen
 * darf (die bestehenden Zugriffsregeln der Datenbank gelten unverändert; es
 * wird kein erweiterter Zugriff und keine Servicerolle verwendet).
 *
 * Der ORB führt KEINE sozialen Aktionen aus: kein Liken, Kommentieren,
 * Posten, Nachrichten senden, Folgen. Nur lesen, bewerten, vorschlagen.
 */

import {
  AUTONOMOUS_SOCIAL_ACTIONS_ENABLED,
  confidenceFor,
  feedbackDelta,
  feedRelevance,
  nextInterest,
  normKey,
  SUGGESTION_THRESHOLD,
  suggestionReason,
  topicOf,
  type InterestRow,
} from "@/orb-core/memory";
import { getSnapshot, type DB, type OrbSnapshot } from "@/orb-core/engine.server";

/** Wie viele Beiträge eine Beobachtung höchstens ansieht (keine Vollabfrage). */
const OBSERVE_LIMIT = 30;

export type ObserveResult = {
  observed: number;
  created: number;
  skipped: number;
  snapshot: OrbSnapshot;
};

function postText(p: { title: string; description: string; hashtags: string[] }): string {
  return [p.title, p.description, (p.hashtags ?? []).join(" ")].filter(Boolean).join(" ");
}

/**
 * Beobachtungslauf: vergleicht zugängliche Feed-Beiträge mit dem
 * Interessenmodell und erzeugt ab der Relevanzschwelle Vorschläge.
 * Beobachtungen gelten als OBSERVED, abgeleitete Interessen als INFERRED.
 */
export async function observeFeed(db: DB, userId: string): Promise<ObserveResult> {
  // Harte Schranke: in V0.2 ist keine autonome Aktion erlaubt.
  if (AUTONOMOUS_SOCIAL_ACTIONS_ENABLED) throw new Error("autonomous actions are disabled in V0.2");

  const interestRes = await db
    .from("orb_interests")
    .select("*")
    .eq("user_id", userId)
    .order("weight", { ascending: false })
    .limit(10);
  if (interestRes.error) throw new Error(interestRes.error.message);

  const interests: InterestRow[] = interestRes.data.map((i) => ({
    topic: i.topic,
    weight: i.weight,
    confidence: i.confidence,
    source: i.source,
    activationCount: i.activation_count,
  }));

  if (interests.length === 0) {
    return { observed: 0, created: 0, skipped: 0, snapshot: await getSnapshot(db, userId) };
  }

  // Nur Beiträge anderer Nutzer, begrenzt und nach Aktualität sortiert.
  const postRes = await db
    .from("posts")
    .select("id, title, description, hashtags, user_id, created_at")
    .neq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(OBSERVE_LIMIT);
  if (postRes.error) throw new Error(postRes.error.message);

  let created = 0;
  let skipped = 0;

  for (const post of postRes.data) {
    const text = postText(post);
    const match = feedRelevance(text, interests);
    if (!match || match.relevance < SUGGESTION_THRESHOLD) {
      skipped += 1;
      continue;
    }

    const existing = await db
      .from("orb_suggestions")
      .select("id, status")
      .eq("user_id", userId)
      .eq("post_id", post.id)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      skipped += 1;
      continue;
    }

    const insert = await db.from("orb_suggestions").insert({
      user_id: userId,
      post_id: post.id,
      topic: match.topic,
      reason: suggestionReason(match.topic, match.relevance),
      relevance: match.relevance,
      status: "pending",
    });
    if (insert.error) throw new Error(insert.error.message);
    created += 1;

    // Beobachtung als eigene Erinnerung – ausdrücklich OBSERVED, niemals
    // als Aussage des Benutzers.
    const observedText = post.title.slice(0, 200);
    const key = normKey(observedText);
    if (key) {
      const known = await db
        .from("orb_nodes")
        .select("id, activation_count")
        .eq("user_id", userId)
        .eq("norm_key", key)
        .maybeSingle();
      if (known.error) throw new Error(known.error.message);
      if (known.data) {
        await db
          .from("orb_nodes")
          .update({
            activation_count: known.data.activation_count + 1,
            last_accessed_at: new Date().toISOString(),
          })
          .eq("id", known.data.id)
          .eq("user_id", userId);
      } else {
        await db.from("orb_nodes").insert({
          user_id: userId,
          type: "perception",
          content: observedText,
          importance: 0.4,
          confidence: confidenceFor("observed"),
          source: "observed",
          norm_key: key,
          topic: topicOf(observedText) ?? match.topic,
          activation_count: 1,
          metadata: { origin: "feed_observation", post_id: post.id },
        });
      }
    }

    // Abgeleitetes Interesse: nur schwach und mit geringerer Sicherheit.
    const prev = interests.find((i) => i.topic === match.topic) ?? null;
    const next = nextInterest(prev, {
      topic: match.topic,
      source: "inferred",
      importance: 0.4,
    });
    await db
      .from("orb_interests")
      .update({
        weight: next.weight,
        confidence: next.confidence,
        source: next.source,
        activation_count: next.activationCount,
        last_activated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("topic", match.topic);
  }

  return {
    observed: postRes.data.length,
    created,
    skipped,
    snapshot: await getSnapshot(db, userId),
  };
}

/**
 * Entscheidung des Benutzers zu einem Vorschlag. Beide Richtungen sind
 * Lernerfahrungen: Zustimmung verstärkt, Ablehnung schwächt ab (kein Löschen).
 */
export async function decideSuggestion(
  db: DB,
  userId: string,
  input: { suggestionId: string; accepted: boolean },
): Promise<OrbSnapshot> {
  const sugg = await db
    .from("orb_suggestions")
    .select("*")
    .eq("user_id", userId)
    .eq("id", input.suggestionId)
    .maybeSingle();
  if (sugg.error) throw new Error(sugg.error.message);
  if (!sugg.data) throw new Error("unknown suggestion");

  const update = await db
    .from("orb_suggestions")
    .update({
      status: input.accepted ? "accepted" : "rejected",
      decided_at: new Date().toISOString(),
    })
    .eq("id", input.suggestionId)
    .eq("user_id", userId);
  if (update.error) throw new Error(update.error.message);

  if (sugg.data.topic) {
    const delta = feedbackDelta(input.accepted ? "positive" : "negative", sugg.data.relevance);
    const current = await db
      .from("orb_interests")
      .select("*")
      .eq("user_id", userId)
      .eq("topic", sugg.data.topic)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (current.data) {
      const prev: InterestRow = {
        topic: current.data.topic,
        weight: current.data.weight,
        confidence: current.data.confidence,
        source: current.data.source,
        activationCount: current.data.activation_count,
      };
      const next = nextInterest(prev, {
        topic: prev.topic,
        source: input.accepted ? "user_stated" : prev.source,
        importance: sugg.data.relevance,
        delta,
      });
      await db
        .from("orb_interests")
        .update({
          weight: next.weight,
          confidence: next.confidence,
          source: next.source,
          activation_count: next.activationCount,
          last_activated_at: new Date().toISOString(),
        })
        .eq("id", current.data.id)
        .eq("user_id", userId);
    }
  }

  return getSnapshot(db, userId);
}
