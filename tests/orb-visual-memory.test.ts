import { describe, expect, it } from "vitest";
import {
  extensionFor,
  imageLabel,
  imagesRetrievableFor,
  pickConverted,
  sha256Hex,
  shouldConvertToWebp,
  storagePathFor,
  validateImageLinks,
} from "@/orb-core/visual/assets";
import {
  storeImageAsset,
  linkMemoryImage,
  imagesForRecalledMemories,
  deleteVisualAsset,
  listUnassignedImages,
  loadTranscriptImages,
} from "@/orb-core/visual/assets.server";
import { scopedDb, ORB_SCOPED_TABLES } from "@/orb-core/scope";
import {
  RESPONSE_SCHEMA,
  SYSTEM_PROMPT,
  responseSchemaFor,
} from "@/orb-core/analysis/analyze.server";
import type { DB } from "@/orb-core/engine.server";

const PNG = btoa(
  String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8),
);
const U = "11111111-1111-1111-1111-111111111111";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
/** Minimaler In-Memory-Ersatz für Tabellen + Speicher (inkl. Scope-Filter-Prüfung). */
function fakeDb(opts: { uploadFails?: boolean; removeFails?: boolean } = {}) {
  const tables: Record<string, Row[]> = {
    orb_visual_assets: [],
    orb_memory_images: [],
    orb_nodes: [],
  };
  const objects = new Set<string>();
  const filtersSeen: string[] = [];
  const builder = (table: string) => {
    const rows = () => tables[table]!;
    const filters: ((r: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: any = null;
    let single = false;
    const run = () => {
      const match = rows().filter((r) => filters.every((f) => f(r)));
      if (op === "insert") {
        const items = (Array.isArray(payload) ? payload : [payload]).map((p: Row) => ({
          id: p.id ?? crypto.randomUUID(),
          created_at: new Date().toISOString(),
          ...p,
        }));
        if (table === "orb_memory_images") {
          for (const it of items) {
            if (
              tables.orb_memory_images!.some(
                (r) => r.memory_id === it.memory_id && r.image_id === it.image_id,
              )
            )
              return { data: null, error: { code: "23505" } };
            const node = tables.orb_nodes!.find((n) => n.id === it.memory_id);
            const asset = tables.orb_visual_assets!.find((a) => a.id === it.image_id);
            if (
              !node ||
              !asset ||
              node.scope !== it.scope ||
              asset.scope !== it.scope ||
              asset.user_id !== it.user_id ||
              asset.origin_status !== "stored"
            )
              return { data: null, error: { code: "23514" } };
          }
        }
        tables[table]!.push(...items);
        return { data: single ? items[0] : items, error: null };
      }
      if (op === "update") {
        match.forEach((r) => Object.assign(r, payload));
        return { data: match, error: null };
      }
      if (op === "delete") {
        tables[table] = rows().filter((r) => !match.includes(r));
        if (table === "orb_visual_assets")
          tables.orb_memory_images = tables.orb_memory_images!.filter(
            (l) => !match.some((m) => m.id === l.image_id),
          );
        return { data: null, error: null };
      }
      return { data: single ? (match[0] ?? null) : match, error: null };
    };
    const qb: any = {
      select: () => qb,
      insert: (p: any) => ((op = "insert"), (payload = p), qb),
      update: (p: any) => ((op = "update"), (payload = p), qb),
      delete: () => ((op = "delete"), qb),
      eq: (c: string, v: any) => {
        if (c === "scope") filtersSeen.push(`${table}:${v}`);
        filters.push((r) => r[c] === v);
        return qb;
      },
      in: (c: string, v: any[]) => (filters.push((r) => v.includes(r[c])), qb),
      order: () => qb,
      limit: () => qb,
      maybeSingle: () => ((single = true), qb),
      single: () => ((single = true), qb),
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return qb;
  };
  const db: any = {
    from: builder,
    storage: {
      from: () => ({
        upload: async (p: string) => {
          if (opts.uploadFails) return { error: { message: "fail" } };
          objects.add(p);
          return { error: null };
        },
        remove: async (ps: string[]) => {
          if (opts.removeFails) return { error: { message: "fail" } };
          ps.forEach((p) => objects.delete(p));
          return { error: null };
        },
        createSignedUrls: async (ps: string[]) => ({
          data: ps.map((p) => ({ path: p, signedUrl: `signed://${p}` })),
        }),
      }),
    },
  };
  return { db: db as DB, tables, objects, filtersSeen };
}

async function stored(
  db: DB,
  scope = "normal",
  data = PNG,
  source: "user_upload" | "orb_generated" = "user_upload",
) {
  const r = await storeImageAsset(scopedDb(db, scope as any), {
    userId: U,
    scope,
    mimeType: "image/png",
    dataBase64: data,
    sourceType: source,
    sourceMessageId: null,
  });
  if (!r.ok) throw new Error("store failed");
  return r.assetId;
}

describe("ORB Visual Memory", () => {
  it("1 validiert Uploads: falsche Signatur und MIME-Mismatch werden abgelehnt", async () => {
    const { db, tables } = fakeDb();
    const bad = await storeImageAsset(scopedDb(db, "normal"), {
      userId: U,
      scope: "normal",
      mimeType: "image/png",
      dataBase64: btoa("not-an-image-at-all"),
      sourceType: "user_upload",
      sourceMessageId: null,
    });
    expect(bad).toEqual({ ok: false, reason: "invalid_image" });
    const mismatch = await storeImageAsset(scopedDb(db, "normal"), {
      userId: U,
      scope: "normal",
      mimeType: "image/jpeg",
      dataBase64: PNG,
      sourceType: "user_upload",
      sourceMessageId: null,
    });
    expect(mismatch.ok).toBe(false);
    expect(tables.orb_visual_assets).toHaveLength(0);
  });

  it("2 WebP-Entscheidung: nur PNG/JPEG, nur echtes und nicht grösseres WebP", () => {
    expect(shouldConvertToWebp("image/png")).toBe(true);
    expect(shouldConvertToWebp("image/jpeg")).toBe(true);
    expect(shouldConvertToWebp("image/gif")).toBe(false);
    expect(shouldConvertToWebp("image/webp")).toBe(false);
    expect(
      pickConverted({ mimeType: "image/png", bytes: 100 }, { sniffed: "image/webp", bytes: 60 }),
    ).toBe("converted");
    expect(
      pickConverted({ mimeType: "image/png", bytes: 100 }, { sniffed: "image/webp", bytes: 160 }),
    ).toBe("original");
    expect(
      pickConverted({ mimeType: "image/png", bytes: 100 }, { sniffed: "image/png", bytes: 60 }),
    ).toBe("original");
    expect(pickConverted({ mimeType: "image/png", bytes: 100 }, null)).toBe("original");
  });

  it("Dateiendung folgt immer dem geprüften Typ", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(
      storagePathFor({
        userId: U,
        scope: "normal",
        sha256: "a".repeat(64),
        mimeType: "image/webp",
      }),
    ).toBe(`${U}/orb/normal/${"a".repeat(64)}.webp`);
  });

  it("3 Hash-Duplikate werden je Nutzer+Scope erkannt, nie bereichsübergreifend", async () => {
    const { db, tables } = fakeDb();
    const a = await stored(db, "normal");
    const b = await stored(db, "normal");
    const c = await stored(db, "orb_core");
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(tables.orb_visual_assets).toHaveLength(2);
    expect(await sha256Hex(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{64}$/);
  });

  it("4–6 Zuordnung: konkrete Memory-ID, mehrere Bilder je Erinnerung, ein Bild für mehrere Erinnerungen", async () => {
    const { db, tables } = fakeDb();
    tables.orb_nodes!.push(
      { id: "m1", user_id: U, scope: "normal", lifecycle: "active" },
      { id: "m2", user_id: U, scope: "normal", lifecycle: "active" },
    );
    const i1 = await stored(db);
    const PNG2 = btoa(
      String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9),
    );
    const i2 = await stored(db, "normal", PNG2);
    const s = scopedDb(db, "normal");
    for (const [m, i] of [
      ["m1", i1],
      ["m1", i2],
      ["m2", i1],
    ] as const) {
      expect(
        (await linkMemoryImage(s, { userId: U, memoryId: m, assetId: i, basis: "manual" })).ok,
      ).toBe(true);
    }
    expect(tables.orb_memory_images).toHaveLength(3);
  });

  it("7/10 Abruf liefert nur verknüpfte Bilder; unzugeordnete nie als Beleg", async () => {
    const { db, tables } = fakeDb();
    tables.orb_nodes!.push(
      { id: "m1", user_id: U, scope: "normal", lifecycle: "active" },
      { id: "m3", user_id: U, scope: "normal", lifecycle: "active" },
    );
    const i1 = await stored(db);
    const s = scopedDb(db, "normal");
    await linkMemoryImage(s, { userId: U, memoryId: "m1", assetId: i1, basis: "manual" });
    const out = await imagesForRecalledMemories(s, U, ["m1", "m3"]);
    expect(out).toHaveLength(1);
    expect(out[0]!.memoryId).toBe("m1");
    expect(await imagesForRecalledMemories(s, U, ["m3"])).toEqual([]);
  });

  it("Lebenszyklus: vergessene/archivierte Erinnerungen liefern keine Bilder", async () => {
    expect(imagesRetrievableFor("active")).toBe(true);
    expect(imagesRetrievableFor("forgotten")).toBe(false);
    expect(imagesRetrievableFor("archived")).toBe(false);
    const { db, tables } = fakeDb();
    tables.orb_nodes!.push({ id: "m1", user_id: U, scope: "normal", lifecycle: "active" });
    const i1 = await stored(db);
    const s = scopedDb(db, "normal");
    await linkMemoryImage(s, { userId: U, memoryId: "m1", assetId: i1, basis: "manual" });
    tables.orb_nodes![0]!.lifecycle = "forgotten";
    expect(await imagesForRecalledMemories(s, U, ["m1"])).toEqual([]);
    expect(tables.orb_memory_images).toHaveLength(1); // Vergessen löscht nichts
  });

  it("8 Scope-Isolation: jede Abfrage filtert den Bereich, fremder Bereich wird abgelehnt", async () => {
    expect(ORB_SCOPED_TABLES.has("orb_visual_assets")).toBe(true);
    expect(ORB_SCOPED_TABLES.has("orb_memory_images")).toBe(true);
    const { db, tables, filtersSeen } = fakeDb();
    tables.orb_nodes!.push({ id: "m1", user_id: U, scope: "orb_core", lifecycle: "active" });
    const i1 = await stored(db, "normal");
    const r = await linkMemoryImage(scopedDb(db, "orb_core"), {
      userId: U,
      memoryId: "m1",
      assetId: i1,
      basis: "manual",
    });
    expect(r).toEqual({ ok: false, reason: "rejected" });
    expect(filtersSeen.some((f) => f.startsWith("orb_visual_assets:"))).toBe(true);
    expect(await listUnassignedImages(scopedDb(db, "orb_core"), U)).toEqual([]);
  });

  it("11 Generierte Bilder werden als orb_generated markiert", async () => {
    const { db, tables } = fakeDb();
    await stored(db, "normal", PNG, "orb_generated");
    expect(tables.orb_visual_assets![0]!.source_type).toBe("orb_generated");
  });

  it("12 Löschen entfernt Objekt und Verknüpfungen; Speicherfehler lässt Zeile auffindbar", async () => {
    const { db, tables, objects } = fakeDb();
    tables.orb_nodes!.push({ id: "m1", user_id: U, scope: "normal", lifecycle: "active" });
    const i1 = await stored(db);
    const s = scopedDb(db, "normal");
    await linkMemoryImage(s, { userId: U, memoryId: "m1", assetId: i1, basis: "manual" });
    expect((await deleteVisualAsset(s, U, i1)).ok).toBe(true);
    expect(objects.size).toBe(0);
    expect(tables.orb_memory_images).toHaveLength(0);
    expect(tables.orb_nodes).toHaveLength(1); // Erinnerung bleibt

    const f = fakeDb({ removeFails: true });
    const i2 = await stored(f.db);
    expect(await deleteVisualAsset(scopedDb(f.db, "normal"), U, i2)).toEqual({
      ok: false,
      reason: "storage_failed",
    });
    expect(f.tables.orb_visual_assets).toHaveLength(1);
  });

  it("14 Speicherfehler: keine Asset-Zeile, keine Verknüpfung, kein Objekt", async () => {
    const { db, tables, objects } = fakeDb({ uploadFails: true });
    const r = await storeImageAsset(scopedDb(db, "normal"), {
      userId: U,
      scope: "normal",
      mimeType: "image/png",
      dataBase64: PNG,
      sourceType: "user_upload",
      sourceMessageId: null,
    });
    expect(r).toEqual({ ok: false, reason: "storage_failed" });
    expect(tables.orb_visual_assets).toHaveLength(0);
    expect(objects.size).toBe(0);
  });

  describe("Automatische Zuordnung über image_links", () => {
    const images = [
      {
        label: imageLabel(0),
        assetId: "a1",
        messageId: "msg1",
        messageBody: "Ich habe am Smart den Luftfilter gewechselt",
      },
    ];
    const storedC = [{ key: "smart_filter", nodeId: "n1" }];
    it("nimmt nur Belege aus genau der Bildnachricht an", () => {
      const r = validateImageLinks(
        [
          {
            image_ref: "img1",
            candidate_key: "smart_filter",
            evidence_quote: "am Smart den Luftfilter",
          },
          { image_ref: "img1", candidate_key: "smart_filter", evidence_quote: "ganz anderer Satz" },
          { image_ref: "img9", candidate_key: "smart_filter", evidence_quote: "am Smart" },
          { image_ref: "img1", candidate_key: "nicht_gespeichert", evidence_quote: "am Smart" },
        ],
        images,
        storedC,
      );
      expect(r.accepted).toEqual([{ ok: true, assetId: "a1", nodeId: "n1", label: "img1" }]);
      expect(r.rejected).toEqual([
        "evidence_not_in_image_message",
        "unknown_image",
        "candidate_not_stored",
      ]);
    });
    it("kein Vorschlag ⇒ keine Zuordnung", () => {
      expect(validateImageLinks(undefined, images, storedC).accepted).toEqual([]);
      expect(validateImageLinks([], images, storedC).accepted).toEqual([]);
    });
    it("Analyse vor Upload-Abschluss: nicht gespeicherte Bilder erscheinen nicht im Transkript", async () => {
      const { db, tables } = fakeDb();
      tables.orb_visual_assets!.push({
        id: "p1",
        user_id: U,
        scope: "normal",
        origin_status: "pending",
        source_type: "user_upload",
        source_message_id: "msg1",
      });
      expect(
        await loadTranscriptImages(scopedDb(db, "normal"), U, [
          { id: "msg1", role: "user", body: "x" },
        ]),
      ).toEqual([]);
    });
  });

  it("13 Analyse ohne Bilder: Schema und Prompt unverändert", () => {
    expect(responseSchemaFor(false)).toBe(RESPONSE_SCHEMA);
    expect(responseSchemaFor(true).required).toContain("image_links");
    expect(SYSTEM_PROMPT).not.toContain("Bildmarke");
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
