/**
 * ORB Core – geprüfte Begriffe und Beziehungen speichern (serverseitig).
 *
 * Läuft ausschliesslich innerhalb der bestehenden Hintergrund-Auswertung und
 * mit dem bereichsgebundenen Datenzugang (`scopedDb`): Bereich, RLS und
 * Bereichs-Trigger gelten unverändert. Kein zusätzlicher Modellaufruf.
 *
 * Begriffe sind eigene Knoten (`type = fact`, `metadata.kind = concept`,
 * Schlüssel mit Präfix). Wiederholte Erwähnung erhöht nur Zähler und Belege –
 * Inhalt, Evidenzstatus und Beziehungstyp bleiben unverändert.
 */

import type { Json } from "@/integrations/supabase/types";
import { internalError } from "@/orb-core/internal-error";
import type { DB, QueryCounter } from "@/orb-core/engine.server";
import {
  CONCEPT_KIND,
  CONCEPT_RELATION_KIND,
  appendEvidence,
  conceptMentionedIn,
  mergeRelationMetadata,
  type ConceptProposal,
  type EvidenceEntry,
  type RelationProposal,
} from "@/orb-core/analysis/concepts";

export type ConceptReport = {
  conceptsCreated: number;
  conceptsReused: number;
  relationsCreated: number;
  relationsReinforced: number;
  relationConflicts: number;
  memoryLinks: number;
};

export const EMPTY_CONCEPT_REPORT = (): ConceptReport => ({
  conceptsCreated: 0,
  conceptsReused: 0,
  relationsCreated: 0,
  relationsReinforced: 0,
  relationConflicts: 0,
  memoryLinks: 0,
});

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};

const RELATION_WEIGHT = 0.35;
const RELATION_IMPORTANCE = 0.3;
const RELATION_DECAY = 0.01;

async function upsertConcept(
  db: DB,
  userId: string,
  c: ConceptProposal,
  ev: EvidenceEntry,
  q: QueryCounter,
  report: ConceptReport,
): Promise<string | null> {
  const find = () =>
    q.tick(
      db
        .from("orb_nodes")
        .select("id, metadata, activation_count")
        .eq("user_id", userId)
        .eq("norm_key", c.key)
        .limit(1)
        .maybeSingle(),
    );
  const existing = await find();
  if (existing.error) throw internalError(existing.error);
  if (existing.data) {
    const meta = asObj(existing.data.metadata);
    const res = await q.tick(
      db
        .from("orb_nodes")
        .update({
          activation_count: existing.data.activation_count + 1,
          last_accessed_at: ev.at,
          metadata: {
            ...meta,
            mentions: (typeof meta["mentions"] === "number" ? meta["mentions"] : 1) + 1,
            evidence: appendEvidence(meta["evidence"], ev),
          },
        })
        .eq("id", existing.data.id)
        .eq("user_id", userId),
    );
    if (res.error) throw internalError(res.error);
    report.conceptsReused += 1;
    return existing.data.id;
  }

  const inserted = await q.tick(
    db
      .from("orb_nodes")
      .insert({
        user_id: userId,
        type: "fact",
        content: c.label,
        norm_key: c.key,
        topic: null,
        category: CONCEPT_KIND,
        importance: 0.3,
        confidence: c.confidence,
        source: "user_stated",
        source_reference: c.quote,
        temporal_scope: "long_term",
        lifecycle: "active",
        decay_rate: RELATION_DECAY,
        long_term_value: 0.5,
        metadata: {
          kind: CONCEPT_KIND,
          origin: "analysis",
          mentions: 1,
          evidence: [ev],
        },
      })
      .select("id")
      .single(),
  );
  if (inserted.error) {
    // Gleichzeitiges Anlegen: nur 23505 gilt als Rennen, dann vorhandenen nutzen.
    if (inserted.error.code !== "23505") throw internalError(inserted.error);
    const again = await find();
    if (again.error) throw internalError(again.error);
    if (!again.data) return null;
    report.conceptsReused += 1;
    return again.data.id;
  }
  report.conceptsCreated += 1;
  return inserted.data.id;
}

async function upsertRelation(
  db: DB,
  userId: string,
  sourceId: string,
  targetId: string,
  rel: Omit<RelationProposal, "fromKey" | "toKey">,
  ev: EvidenceEntry,
  q: QueryCounter,
  report: ConceptReport,
): Promise<void> {
  if (sourceId === targetId) return;
  // Beide Richtungen prüfen: eine Beziehung zwischen zwei Begriffen wird nur
  // einmal gespeichert.
  const existing = await q.tick(
    db
      .from("orb_connections")
      .select("id, metadata")
      .eq("user_id", userId)
      .or(
        `and(source_node_id.eq.${sourceId},target_node_id.eq.${targetId}),and(source_node_id.eq.${targetId},target_node_id.eq.${sourceId})`,
      )
      .limit(1)
      .maybeSingle(),
  );
  if (existing.error) throw internalError(existing.error);

  if (existing.data) {
    const current = asObj(existing.data.metadata);
    // Fremde Verbindung (z. B. aus Erfahrung) wird nicht umgedeutet.
    if (current["kind"] !== CONCEPT_RELATION_KIND) return;
    const merged = mergeRelationMetadata(current, { ...rel, fromKey: "", toKey: "" }, ev);
    const res = await q.tick(
      db
        .from("orb_connections")
        .update({ metadata: merged.metadata as Json, last_activated_at: ev.at })
        .eq("id", existing.data.id)
        .eq("user_id", userId),
    );
    if (res.error) throw internalError(res.error);
    report.relationsReinforced += 1;
    if (merged.conflict) report.relationConflicts += 1;
    return;
  }

  const res = await q.tick(
    db.from("orb_connections").insert({
      user_id: userId,
      source_node_id: sourceId,
      target_node_id: targetId,
      weight: RELATION_WEIGHT,
      importance: RELATION_IMPORTANCE,
      decay_rate: RELATION_DECAY,
      activation_count: 1,
      last_activated_at: ev.at,
      metadata: {
        kind: CONCEPT_RELATION_KIND,
        origin: "analysis",
        relation: rel.relation,
        basis: rel.basis,
        evidence_status: rel.status,
        confidence: rel.confidence,
        mentions: 1,
        evidence: [ev],
      },
    }),
  );
  if (res.error) {
    if (res.error.code === "23505") return; // paralleles Anlegen – bereits vorhanden
    throw internalError(res.error);
  }
  report.relationsCreated += 1;
}

/**
 * Begriffe, Beziehungen und Bezüge zu in diesem Lauf gespeicherten
 * Erinnerungen ablegen. Ein Fehler bei einem Eintrag verhindert die übrigen nicht.
 */
export async function persistConcepts(
  db: DB,
  userId: string,
  input: {
    concepts: ConceptProposal[];
    relations: RelationProposal[];
    /** In diesem Lauf gespeicherte/berührte Erinnerungen samt Text. */
    memories: { id: string; text: string }[];
    runId: string;
    nowIso: string;
  },
  q: QueryCounter,
): Promise<ConceptReport> {
  const report = EMPTY_CONCEPT_REPORT();
  const ids = new Map<string, string>();

  for (const c of input.concepts) {
    try {
      const id = await upsertConcept(
        db,
        userId,
        c,
        { quote: c.quote, at: input.nowIso, run: input.runId },
        q,
        report,
      );
      if (id) ids.set(c.key, id);
    } catch {
      // einzelner Begriff darf den Rest nicht verhindern
    }
  }

  for (const r of input.relations) {
    const from = ids.get(r.fromKey);
    const to = ids.get(r.toKey);
    if (!from || !to) continue;
    try {
      await upsertRelation(
        db,
        userId,
        from,
        to,
        r,
        { quote: r.quote, at: input.nowIso, run: input.runId },
        q,
        report,
      );
    } catch {
      // weiter mit der nächsten Beziehung
    }
  }

  // Erinnerung → Begriff nur, wenn der Begriff im Erinnerungstext vorkommt.
  for (const m of input.memories) {
    for (const c of input.concepts) {
      const conceptId = ids.get(c.key);
      if (!conceptId || !conceptMentionedIn(c.label, m.text)) continue;
      try {
        const before = report.relationsCreated;
        await upsertRelation(
          db,
          userId,
          m.id,
          conceptId,
          {
            relation: "related_to",
            basis: "inferred",
            status: "co_mentioned",
            quote: c.quote,
            confidence: c.confidence,
          },
          { quote: c.quote, at: input.nowIso, run: input.runId },
          q,
          report,
        );
        if (report.relationsCreated > before) {
          report.relationsCreated -= 1;
          report.memoryLinks += 1;
        }
      } catch {
        // weiter
      }
    }
  }

  return report;
}
