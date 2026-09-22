/**
 * ORB Core – Thread Matching: Anzeige-Limit vs. Matching-Kandidaten.
 *
 * Reproduziert und sichert ab: ein passender Faden ausserhalb der 12 jüngsten
 * Fäden muss gefunden werden. Die Matching-Logik selbst wird nicht verändert,
 * nur die Kandidatenmenge, die sie erhält.
 */
import { describe, expect, it } from "vitest";

import {
  THREAD_LOAD_LIMIT,
  THREAD_MATCH_CANDIDATE_LIMIT,
  loadMatchCandidates,
  loadThreads,
  syncThreads,
  type LoadedThread,
} from "@/orb-core/continuity-store.server";
import type { ThoughtThread } from "@/orb-core/continuity";

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const USER = "11111111-1111-4111-8111-111111111111";

const q = { tick: <T>(p: PromiseLike<T>) => Promise.resolve(p) };

type Row = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  status: string;
  known: string[];
  unknown: string[];
  curiosity: number;
  importance: number;
  activation_count: number;
  node_ids: string[];
  last_activation_at: string;
  last_resume_at: string | null;
  resolved_at: string | null;
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: "t0",
    user_id: USER,
    title: "faden",
    topic: "reisen",
    status: "OPEN",
    known: ["Ich war in Japan und will wieder hin."],
    unknown: ["Warum?"],
    curiosity: 0.8,
    importance: 0.8,
    activation_count: 1,
    node_ids: [],
    last_activation_at: new Date(NOW - MIN).toISOString(),
    last_resume_at: null,
    resolved_at: null,
    ...over,
  };
}

/** Minimaler Datenbank-Doppelgänger: nur die tatsächlich genutzten Ketten. */
function fakeDb(rows: Row[]) {
  const inserts: Row[] = [];
  const updates: { id: string; patch: Record<string, unknown> }[] = [];
  const db = {
    from(table: string) {
      if (table !== "orb_threads") throw new Error(`unerwartete Tabelle ${table}`);
      const state: { neq: [string, string][]; limit: number | null } = { neq: [], limit: null };
      const select = () => {
        const builder: Record<string, unknown> = {};
        const chain = () => builder;
        Object.assign(builder, {
          eq: chain,
          ilike: chain,
          order: chain,
          neq: (col: string, val: string) => {
            state.neq.push([col, val]);
            return builder;
          },
          limit: (n: number) => {
            state.limit = n;
            return builder;
          },
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
          then: (resolve: (v: { data: Row[]; error: null }) => unknown) => {
            let out = [...rows].sort(
              (a, b) =>
                new Date(b.last_activation_at).getTime() -
                new Date(a.last_activation_at).getTime(),
            );
            for (const [col, val] of state.neq) {
              out = out.filter((r) => (r as unknown as Record<string, unknown>)[col] !== val);
            }
            if (state.limit !== null) out = out.slice(0, state.limit);
            return resolve({ data: out, error: null });
          },
        });
        return builder;
      };
      return {
        select,
        update: (patch: Record<string, unknown>) => {
          const b: Record<string, unknown> = {};
          let id = "";
          Object.assign(b, {
            eq: (col: string, val: string) => {
              if (col === "id") id = val;
              return b;
            },
            then: (resolve: (v: { error: null }) => unknown) => {
              updates.push({ id, patch });
              return resolve({ error: null });
            },
          });
          return b;
        },
        insert: (r: Row) => ({
          select: () => ({
            single: () => {
              const created = { ...row(), ...r, id: `new-${inserts.length + 1}` };
              inserts.push(created);
              return Promise.resolve({ data: created, error: null });
            },
          }),
        }),
      };
    },
  };
  return { db: db as never, inserts, updates };
}

function loadedOf(rows: Row[]): LoadedThread[] {
  return rows.map((r) => ({
    thread: {
      id: r.id,
      title: r.title,
      topic: r.topic,
      status: r.status,
      known: r.known,
      unknown: r.unknown,
      curiosity: r.curiosity,
      importance: r.importance,
      lastActivationAt: new Date(r.last_activation_at).getTime(),
      activationCount: r.activation_count,
      resolvedAt: null,
      nodeIds: r.node_ids,
    } as ThoughtThread,
    lastResumeAt: null,
  }));
}

/** 12 junge Fäden mit fremdem Thema + ein älterer, passender Faden. */
function corpus() {
  const young = Array.from({ length: 12 }, (_, i) =>
    row({
      id: `young-${i}`,
      title: `junger faden ${i}`,
      topic: "hardware",
      known: ["Mein Rechner hat eine neue Grafikkarte."],
      last_activation_at: new Date(NOW - (i + 1) * MIN).toISOString(),
    }),
  );
  const old = row({
    id: "old-match",
    title: "japan reise",
    topic: "reisen",
    known: ["Ich war in Japan und will wieder hin."],
    last_activation_at: new Date(NOW - 48 * 60 * MIN).toISOString(),
  });
  return { young, old, all: [...young, old] };
}

const INPUT = {
  text: "Ich war in Japan und will wieder hin.",
  topic: "reisen",
  importance: 0.8,
  focusNodeId: null,
  conversationTopics: ["reisen"],
  interests: [],
  now: NOW,
};

describe("Thread Matching – Anzeige-Limit und Kandidatenmenge sind getrennt", () => {
  it("Anzeige bleibt bei 12", () => {
    expect(THREAD_LOAD_LIMIT).toBe(12);
  });

  it("Kandidatenmenge für das Matching ist grösser als das Anzeige-Limit", () => {
    expect(THREAD_MATCH_CANDIDATE_LIMIT).toBeGreaterThan(THREAD_LOAD_LIMIT);
  });

  it("loadThreads liefert weiterhin höchstens 12 Fäden", async () => {
    const { all } = corpus();
    const { db } = fakeDb(all);
    const loaded = await loadThreads(db, USER, q);
    expect(loaded).toHaveLength(12);
    expect(loaded.some((e) => e.thread.id === "old-match")).toBe(false);
  });

  it("loadMatchCandidates liefert den älteren passenden Faden mit", async () => {
    const { all } = corpus();
    const { db } = fakeDb(all);
    const cands = await loadMatchCandidates(db, USER, q);
    expect(cands.some((e) => e.thread.id === "old-match")).toBe(true);
    expect(cands.length).toBeLessThanOrEqual(THREAD_MATCH_CANDIDATE_LIMIT);
  });

  it("REPRODUKTION: nur die 12 jüngsten Fäden erzeugen einen unnötigen neuen Faden", async () => {
    const { young, all } = corpus();
    const { db, inserts } = fakeDb(all);
    const res = await syncThreads(db, USER, q, { ...INPUT, loaded: loadedOf(young) });
    expect(res.reactivated).toBeNull();
    expect(res.created).not.toBeNull();
    expect(inserts).toHaveLength(1);
  });

  it("Test B – Treffer ausserhalb der ersten 12 wird gefunden und reaktiviert", async () => {
    const { all } = corpus();
    const { db, inserts, updates } = fakeDb(all);
    const cands = await loadMatchCandidates(db, USER, q);
    const res = await syncThreads(db, USER, q, { ...INPUT, loaded: cands });
    expect(res.created).toBeNull();
    expect(res.reactivated?.id).toBe("old-match");
    expect(inserts).toHaveLength(0);
    expect(updates.map((u) => u.id)).toContain("old-match");
  });

  it("Test A – Treffer innerhalb der ersten 12 verhält sich unverändert", async () => {
    const { old } = corpus();
    const rows = [{ ...old, last_activation_at: new Date(NOW - MIN).toISOString() }];
    const { db, inserts } = fakeDb(rows);
    const cands = await loadMatchCandidates(db, USER, q);
    const res = await syncThreads(db, USER, q, { ...INPUT, loaded: cands });
    expect(res.reactivated?.id).toBe("old-match");
    expect(inserts).toHaveLength(0);
  });

  it("Test C – ohne passenden Faden entsteht weiterhin ein neuer", async () => {
    const { young } = corpus();
    const { db, inserts } = fakeDb(young);
    const cands = await loadMatchCandidates(db, USER, q);
    const res = await syncThreads(db, USER, q, { ...INPUT, loaded: cands });
    expect(res.created).not.toBeNull();
    expect(inserts).toHaveLength(1);
  });

  it("Test C2 – ohne ausreichende Bedeutung entsteht kein Faden", async () => {
    const { young } = corpus();
    const { db, inserts } = fakeDb(young);
    const cands = await loadMatchCandidates(db, USER, q);
    const res = await syncThreads(db, USER, q, {
      ...INPUT,
      importance: 0.2,
      loaded: cands,
    });
    expect(res.created).toBeNull();
    expect(inserts).toHaveLength(0);
  });

  it("Test D – ein geklärter Faden wird nicht reaktiviert", async () => {
    const { old } = corpus();
    const rows = [{ ...old, status: "RESOLVED", resolved_at: new Date(NOW).toISOString() }];
    const { db, inserts } = fakeDb(rows);
    const cands = await loadMatchCandidates(db, USER, q);
    expect(cands.some((e) => e.thread.id === "old-match")).toBe(false);
    const res = await syncThreads(db, USER, q, { ...INPUT, loaded: loadedOf(rows) });
    expect(res.reactivated).toBeNull();
    expect(inserts).toHaveLength(1);
  });

  it("Test E – topic = null folgt weiterhin der Textähnlichkeit", async () => {
    const { old } = corpus();
    const rows = [{ ...old, topic: null }];
    const { db } = fakeDb(rows);
    const cands = await loadMatchCandidates(db, USER, q);
    const res = await syncThreads(db, USER, q, { ...INPUT, topic: null, loaded: cands });
    expect(res.reactivated?.id).toBe("old-match");
  });

  it("Test E2 – fremdes Thema bleibt getrennt", async () => {
    const { young } = corpus();
    const { db, inserts } = fakeDb(young);
    const cands = await loadMatchCandidates(db, USER, q);
    const res = await syncThreads(db, USER, q, { ...INPUT, loaded: cands });
    expect(res.reactivated).toBeNull();
    expect(inserts).toHaveLength(1);
  });
});
