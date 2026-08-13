/**
 * Temporaerer Composer-Entwurf (SlangShot & Beitrag).
 *
 * Grundsatz: es entstehen KEINE neuen Tabellen und keine Storage-Dateien.
 * Der Entwurf lebt ausschliesslich lokal im Browser (IndexedDB) – genau wie
 * die bestehenden SlangTag-Drafts, die erst beim Veroeffentlichen dauerhaft
 * gespeichert werden. Dadurch koennen keine verwaisten Video-/Audiodateien
 * in der Datenbank oder im Storage zurueckbleiben.
 */
import type { PostVisibility, SlangTagPlacement } from "@/lib/types";

const DB_NAME = "y-dude-composer";
const STORE = "draft";
const KEY = "current";
const DB_VERSION = 1;

export type ComposerDraft = {
  /** Standbild/Poster als Data-URL (Bild, GIF oder erstes Videobild). */
  image: string | null;
  /** SlangShot-Video (stumm) inklusive Laenge in Sekunden. */
  video: { blob: Blob; seconds: number } | null;
  /** Automatisch erzeugter oder ersetzter SlangTag des SlangShots. */
  shotTag: { name: string; audioDataUrl: string; duration: string; region: string } | null;
  /** Bereits vorhandene SlangTag-ID (Bibliothek) des sichtbaren Elements. */
  shotTagId: string | null;
  /** SlangTag-Positionen (X/Y in Prozent der Videoflaeche), Skalierung, Rotation. */
  placements: SlangTagPlacement[];
  description: string;
  hashtags: string[];
  region: string;
  visibility: PostVisibility;
  savedAt: number;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Entwurf speichern (Autosave nach jeder relevanten Aenderung). */
export async function saveComposerDraft(draft: Omit<ComposerDraft, "savedAt">): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...draft, savedAt: Date.now() } satisfies ComposerDraft, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Entwurf laden (nach Reload/Zurueck-Navigation). */
export async function loadComposerDraft(): Promise<ComposerDraft | null> {
  const db = await openDb();
  if (!db) return null;
  const draft = await new Promise<ComposerDraft | null>((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as ComposerDraft | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return draft;
}

/**
 * Entwurf endgueltig entfernen – nur beim ausdruecklichen Verwerfen oder nach
 * erfolgreicher Veroeffentlichung. Ein normaler Reload loescht nichts.
 */
export async function clearComposerDraft(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

/** Hat der Entwurf ueberhaupt Inhalt, der eine Wiederherstellung lohnt? */
export function draftHasContent(d: ComposerDraft | null): boolean {
  if (!d) return false;
  return !!(d.video || d.image || d.description.trim() || d.hashtags.length || d.placements.length);
}
